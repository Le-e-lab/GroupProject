/**
 * ========================================
 * ATTENDANCE ROUTES
 * ========================================
 * Handles all attendance-related operations:
 * 1. Generating OTP Codes (Lecturer)
 * 2. Validating OTP Codes (Student)
 * 3. Fetching Attendance Statistics (Dashboard/Reports)
 * 4. Bulk Marking (Manual fallback)
 */
const express = require('express');
const router = express.Router();
const { Attendance, Session, Class, User, DeviceSession, BiometricVerification, Announcement, sequelize } = require('../models');
const { TOTP, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const { Op } = require('sequelize');
const validator = require('validator');
const authMiddleware = require('../middleware/authMiddleware');
const { attendanceAttemptLimiter } = require('../middleware/rateLimiters');
const { verifyWithProvider, getProviderConfig } = require('../utils/identityVerification');

const canManageAttendanceRoles = new Set(['lecturer', 'admin']);
const canViewClassAttendanceRoles = new Set(['lecturer', 'admin', 'student_rep']);
const codeValidationRoles = new Set(['student', 'student_rep']);

function hasRole(req, rolesSet) {
    return req.user && rolesSet.has(req.user.role);
}

function requireRoles(rolesSet, message = null) {
    return (req, res, next) => {
        if (!hasRole(req, rolesSet)) {
            if (message) {
                return res.status(403).json({ message });
            }
            return res.status(403).json({ message: `Forbidden: requires role ${Array.from(rolesSet).join(' or ')}` });
        }
        return next();
    };
}

function canAccessStudentData(req, studentId) {
    if (!req.user) return false;
    if (req.user.id === String(studentId)) return true;
    return hasRole(req, canViewClassAttendanceRoles);
}

// Protect all attendance routes by default.
router.use(authMiddleware);

// Create a new TOTP instance (30s step, window 1)
// Manual TOTP Implementation (HMAC-SHA1)
// We use otplib components just for base32 decoding
const crypto = require('crypto');
const base32 = new ScureBase32Plugin();

// Device Fingerprinting Helper
function generateDeviceId(userAgent, remoteIp) {
    const fingerprint = `${userAgent}|${remoteIp}`;
    return crypto.createHash('md5').update(fingerprint).digest('hex');
}

function getDeviceInfo(req) {
    return {
        userAgent: req.get('user-agent') || 'Unknown',
        ip: req.ip || req.connection.remoteAddress || '0.0.0.0'
    };
}

function generateTOTP(secret, window = 0) {
    try {
        const key = base32.decode(secret);
        const epoch = Math.floor(Date.now() / 1000);
        const step = 30;
        const counter = Math.floor(epoch / step) + window;
        
        const buf = Buffer.alloc(8);
        buf.writeBigInt64BE(BigInt(counter), 0);

        const hmac = crypto.createHmac('sha1', key);
        hmac.update(buf);
        const digest = hmac.digest();

        const offset = digest[digest.length - 1] & 0xf;
        const code = (
            ((digest[offset] & 0x7f) << 24) |
            ((digest[offset + 1] & 0xff) << 16) |
            ((digest[offset + 2] & 0xff) << 8) |
            (digest[offset + 3] & 0xff)
        ) % 1000000;

        return code.toString().padStart(6, '0');
    } catch (e) {
        console.error('TOTP Generation Error:', e);
        return null;
    }
}

function verifyTOTP(token, secret, window = 1) {
    for (let i = -window; i <= window; i++) {
        if (generateTOTP(secret, i) === token) return true;
    }
    return false;
}

function generateSecret() {
    const bytes = crypto.randomBytes(20);
    return base32.encode(bytes).replace(/=/g, '');
}

function isAttendanceComplete(record) {
    return !!(record && record.checkedInAt && record.checkedOutAt && record.status === 'present');
}

function isLegacyPresent(record) {
    return !!(record && record.status === 'present' && !record.checkedInAt && !record.checkedOutAt);
}

function isFinalizedAttendance(record) {
    return isAttendanceComplete(record) || isLegacyPresent(record);
}

function parseCourseCode(classId) {
    const safe = String(classId || '').trim();
    if (!safe) return '';
    if (safe.includes('--')) return safe.split('--')[0].trim();
    return safe.split('-')[0].trim();
}

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function extractYearNumber(value) {
    const safe = String(value || '').toLowerCase();
    if (!safe) return null;
    const explicit = safe.match(/y\s*(\d+)/i);
    if (explicit && explicit[1]) return parseInt(explicit[1], 10);
    const firstNumber = safe.match(/(\d+)/);
    if (firstNumber && firstNumber[1]) return parseInt(firstNumber[1], 10);
    return null;
}

function programKeysCompatible(left, right) {
    const a = normalizeKey(left);
    const b = normalizeKey(right);
    if (!a || !b) return true;
    if (a === b) return true;
    return a.startsWith(b) || b.startsWith(a) || a.includes(b) || b.includes(a);
}

function yearKeysCompatible(left, right) {
    const a = normalizeKey(left);
    const b = normalizeKey(right);
    if (!a || !b) return true;
    if (a === b) return true;

    const yearA = extractYearNumber(a);
    const yearB = extractYearNumber(b);
    if (Number.isInteger(yearA) && Number.isInteger(yearB)) {
        return yearA === yearB;
    }

    return a.startsWith(b) || b.startsWith(a);
}

function parseClassIdentity(classId) {
    const safe = String(classId || '').trim();
    if (!safe) {
        return { courseCode: '', day: '', fromTime: '', programKey: '', yearKey: '' };
    }

    if (safe.includes('--')) {
        const parts = safe.split('--');
        return {
            courseCode: (parts[0] || '').trim(),
            day: (parts[1] || '').trim(),
            fromTime: (parts[2] || '').trim(),
            programKey: (parts[3] || '').trim(),
            yearKey: (parts[4] || '').trim()
        };
    }

    const parts = safe.split('-');
    if (parts.length >= 3) {
        const courseCode = parts[0].trim();
        const fromTime = parts[parts.length - 1].trim();
        const day = parts.slice(1, parts.length - 1).join('-').trim();
        return { courseCode, day, fromTime, programKey: '', yearKey: '' };
    }

    return { courseCode: parseCourseCode(safe), day: '', fromTime: '', programKey: '', yearKey: '' };
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatCsvDateTime(value) {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const seconds = String(dt.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function startOfLocalDay(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
}

function classIdentityCompatible(requestedClassId, sessionClassId) {
    const requested = parseClassIdentity(requestedClassId);
    const sessionIdentity = parseClassIdentity(sessionClassId);

    if (!requested.courseCode || !sessionIdentity.courseCode) return false;
    if (requested.courseCode !== sessionIdentity.courseCode) return false;

    if (requested.day && sessionIdentity.day && requested.day !== sessionIdentity.day) return false;
    if (requested.fromTime && sessionIdentity.fromTime && requested.fromTime !== sessionIdentity.fromTime) return false;
    if (requested.programKey && sessionIdentity.programKey && requested.programKey !== sessionIdentity.programKey) return false;
    if (requested.yearKey && sessionIdentity.yearKey && requested.yearKey !== sessionIdentity.yearKey) return false;

    return true;
}

function classRowMatchesIdentity(row, identity) {
    if (!row || !identity || !identity.courseCode) return false;
    if (String(row.Course_Code || '').trim() !== String(identity.courseCode || '').trim()) return false;
    if (identity.day && String(row.Day || '').trim() !== String(identity.day || '').trim()) return false;
    if (identity.fromTime && String(row.From_Time || '').trim() !== String(identity.fromTime || '').trim()) return false;
    if (identity.programKey && !programKeysCompatible(row.Program, identity.programKey)) return false;
    if (identity.yearKey && !yearKeysCompatible(row.Year_Semester, identity.yearKey)) return false;
    return true;
}

function attendanceClassMatchesIdentity(classId, identity) {
    if (!identity || !identity.courseCode) return true;
    return classIdentityCompatible(classId, `${identity.courseCode}--${identity.day || ''}--${identity.fromTime || ''}--${identity.programKey || ''}--${identity.yearKey || ''}`);
}

async function findActiveSessionForClass(classId, status) {
    const where = {
        classId,
        expiresAt: { [Op.gt]: new Date() }
    };

    if (status) {
        where.status = status;
    }

    const exact = await Session.findOne({ where });
    if (exact) return exact;

    const identity = parseClassIdentity(classId);
    if (!identity.courseCode) return null;

    const fallbackWhere = {
        expiresAt: { [Op.gt]: new Date() },
        classId: { [Op.like]: `${identity.courseCode}%` }
    };

    if (status) {
        fallbackWhere.status = status;
    }

    const candidates = await Session.findAll({
        where: fallbackWhere,
        order: [['updatedAt', 'DESC']]
    });

    return candidates.find((candidate) => classIdentityCompatible(classId, candidate.classId)) || null;
}

function lecturerNameTerms(user) {
    const fullName = String((user && user.fullName) || '').trim();
    const noDots = fullName.replace(/\./g, '').trim();
    const surname = fullName ? fullName.split(' ').pop() : '';
    return [fullName, noDots, surname].filter(Boolean);
}

function belongsToLecturer(classRow, user) {
    if (!classRow || !user) return false;
    if (String(classRow.LecturerId || '') === String(user.id || '')) return true;

    const lecturer = String(classRow.Lecturer || '').toLowerCase();
    const terms = lecturerNameTerms(user).map((term) => term.toLowerCase());
    return terms.some((term) => term && lecturer.includes(term));
}

async function findClassForSession(classId, user = null) {
    const { courseCode, day, fromTime, programKey, yearKey } = parseClassIdentity(classId);
    if (!courseCode) return null;

    const isLecturer = user && user.role === 'lecturer';
    const whereBase = { Course_Code: courseCode };
    if (day && fromTime) {
        whereBase.Day = day;
        whereBase.From_Time = fromTime;
    }

    const candidateMatchesIdentity = (row) => {
        if (!row) return false;
        if (programKey && normalizeKey(row.Program) !== programKey) return false;
        if (yearKey && normalizeKey(row.Year_Semester) !== yearKey) return false;
        return true;
    };

    if (isLecturer) {
        const terms = lecturerNameTerms(user);
        const ownerFilters = [{ LecturerId: String(user.id) }];
        for (const term of terms) {
            ownerFilters.push({ Lecturer: { [Op.like]: `%${term}%` } });
        }

        const ownedRows = await Class.findAll({
            where: {
                ...whereBase,
                [Op.or]: ownerFilters
            }
        });
        const owned = ownedRows.find(candidateMatchesIdentity) || ownedRows[0];
        if (owned) return owned;
    }

    if (day && fromTime) {
        const compositeRows = await Class.findAll({ where: whereBase });
        const exactComposite = compositeRows.find(candidateMatchesIdentity) || compositeRows[0];
        if (exactComposite) return exactComposite;
        return null;
    }

    const exact = await Class.findOne({ where: { Course_Code: courseCode } });
    if (exact) return exact;

    return Class.findOne({
        where: {
            Course_Code: { [Op.like]: `${courseCode}%` }
        }
    });
}

async function findLecturerOwnedClassRowsForCourse(courseCode, user) {
    if (!user || user.role !== 'lecturer') return [];

    const termSet = new Set(lecturerNameTerms(user));
    const terms = Array.from(termSet);
    const ownerFilters = [{ LecturerId: String(user.id) }];
    for (const term of terms) {
        ownerFilters.push({ Lecturer: { [Op.like]: `%${term}%` } });
    }

    const rows = await Class.findAll({
        where: {
            Course_Code: courseCode,
            [Op.or]: ownerFilters
        }
    });

    return rows.filter((row) => belongsToLecturer(row, user));
}

function buildCompositeClassIdFromRow(row) {
    const course = String(row && row.Course_Code || '').trim();
    const day = String(row && row.Day || '').trim();
    const from = String(row && row.From_Time || '').trim();
    const programKey = normalizeKey(row && row.Program || 'unknown_program') || 'unknown_program';
    const yearKey = normalizeKey(row && row.Year_Semester || 'unknown_year') || 'unknown_year';
    return `${course}--${day}--${from}--${programKey}--${yearKey}`;
}

function studentEligibleForClass(student, classRow) {
    if (!student || !classRow) {
        return { ok: false, reason: 'Class or student record missing' };
    }

    const studentProgram = String(student.program || '').trim();
    const classProgram = String(classRow.Program || '').trim();
    if (!studentProgram || !classProgram) {
        return { ok: false, reason: 'Student or class program is not configured' };
    }

    const programMatch = programKeysCompatible(studentProgram, classProgram);
    if (!programMatch) {
        return { ok: false, reason: 'Student does not belong to this course program' };
    }

    const yearMatch = String(classRow.Year_Semester || '').match(/Y\s*(\d)/i);
    if (yearMatch && student.year) {
        const classYear = parseInt(yearMatch[1], 10);
        if (Number.isInteger(classYear) && Number.isInteger(Number(student.year)) && Number(student.year) !== classYear) {
            return { ok: false, reason: 'Student year does not match class year' };
        }
    }

    return { ok: true };
}

async function resolveEligibleClassForStudent(sessionClassId, student) {
    const classRow = await findClassForSession(sessionClassId);
    if (classRow) {
        const eligibility = studentEligibleForClass(student, classRow);
        if (eligibility.ok) {
            return { classRow, source: 'primary' };
        }
    }

    const identity = parseClassIdentity(sessionClassId);
    if (!identity.courseCode) {
        return null;
    }

    const fallbackCandidates = await Class.findAll({
        where: {
            Course_Code: identity.courseCode
        }
    });

    // Prefer exact day/time cohort first, then relax to same course code cohort variants.
    const strictCandidates = fallbackCandidates.filter((candidate) => {
        if (identity.day && candidate.Day && candidate.Day !== identity.day) return false;
        if (identity.fromTime && candidate.From_Time && candidate.From_Time !== identity.fromTime) return false;
        return true;
    });

    for (const candidate of strictCandidates) {
        const fallbackEligibility = studentEligibleForClass(student, candidate);
        if (!fallbackEligibility.ok) continue;
        return { classRow: candidate, source: 'fallback_strict' };
    }

    for (const candidate of fallbackCandidates) {
        const fallbackEligibility = studentEligibleForClass(student, candidate);
        if (!fallbackEligibility.ok) continue;
        return { classRow: candidate, source: 'fallback_course' };
    }

    return null;
}

/**
 * POST /api/attendance/generate-code
 * Lecturer generates a code for a class session
 */
router.post('/generate-code', requireRoles(canManageAttendanceRoles), async (req, res) => {
    try {
        const { classId, forceNew } = req.body;
        if (!classId) return res.status(400).json({ message: 'Class ID required' });

        if (forceNew) {
            await Session.destroy({ where: { classId } });
        }

        let session = await Session.findOne({
            where: {
                classId,
                expiresAt: { [Op.gt]: new Date() }
            }
        });

        let secret;
        if (session) {
            secret = session.secret;
        } else {
            secret = generateSecret();
            const clientIP = req.ip || req.connection.remoteAddress;
            const lecturerIp = clientIP && clientIP.includes('::ffff:') ? clientIP.split('::ffff:')[1] : clientIP;

            await Session.create({
                id: Date.now().toString(),
                classId,
                secret,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2 hours validity
                lecturerIp
            });
        }

        const token = generateTOTP(secret);
        const timeLeft = 30 - Math.floor((Date.now() / 1000) % 30);

        res.json({
            classId,
            code: token,
            timeLeft: timeLeft * 1000
        });
    } catch (err) {
        console.error('Generate code error:', err);
        res.status(500).json({ message: 'Error generating code' });
    }
});

/**
 * GET /api/attendance/today/:id
 */
router.get('/today/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!canAccessStudentData(req, id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        const startOfDay = startOfLocalDay();
        const todayLocal = getLocalDateString();
        
        const attendance = await Attendance.findAll({
            where: {
                userId: id,
                [Op.or]: [
                    { date: todayLocal },
                    { checkedInAt: { [Op.gte]: startOfDay } },
                    { checkedOutAt: { [Op.gte]: startOfDay } }
                ]
            },
            attributes: ['classId', 'status', 'checkedInAt', 'checkedOutAt']
        });

        const presentClassIds = [];
        let activeCheckIn = null;

        for (const row of attendance) {
            if (isFinalizedAttendance(row)) {
                presentClassIds.push(row.classId);
            }

            if (!activeCheckIn && row.checkedInAt && !row.checkedOutAt) {
                const classRow = await findClassForSession(row.classId);
                activeCheckIn = {
                    classId: row.classId,
                    checkedInAt: row.checkedInAt,
                    code: classRow ? classRow.Course_Code : parseCourseCode(row.classId),
                    name: classRow ? classRow.Course_Name : 'Active lesson',
                    time: classRow ? `${classRow.From_Time} - ${classRow.To_Time}` : '',
                    room: classRow ? classRow.Venue : ''
                };
            }
        }

        res.json({ presentClassIds, activeCheckIn });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching today attendance' });
    }
});

/**
 * GET /api/attendance/stats/course/:courseId
 * Stats for a course
 */

/**
 * GET /api/attendance/student/:id
 * Student-level attendance stats for dashboard overview.
 */
router.get('/student/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!canAccessStudentData(req, id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const student = await User.findByPk(id);
        if (!student || !['student', 'student_rep'].includes(String(student.role || ''))) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const classWhere = {};
        if (student.program) {
            classWhere.Program = { [Op.like]: `${student.program}%` };
        }
        if (student.year) {
            classWhere.Year_Semester = { [Op.like]: `Y${student.year}%` };
        }

        const cohortClasses = await Class.findAll({
            where: classWhere,
            attributes: ['Course_Code', 'Course_Name']
        });

        const classNameByCode = new Map();
        for (const row of cohortClasses) {
            const code = String(row.Course_Code || '').trim();
            if (!code || classNameByCode.has(code)) continue;
            classNameByCode.set(code, String(row.Course_Name || code));
        }

        const records = await Attendance.findAll({
            where: { userId: id },
            attributes: ['classId', 'status', 'checkedInAt', 'checkedOutAt']
        });

        const cohortCodes = Array.from(classNameByCode.keys());
        const sessionRecords = cohortCodes.length
            ? await Attendance.findAll({
                where: {
                    [Op.or]: cohortCodes.map((code) => ({ classId: { [Op.like]: `${code}%` } }))
                },
                attributes: ['classId', 'date']
            })
            : [];

        const sessionDatesByCode = new Map();
        for (const row of sessionRecords) {
            const code = parseCourseCode(row.classId);
            if (!code) continue;
            if (!sessionDatesByCode.has(code)) sessionDatesByCode.set(code, new Set());
            sessionDatesByCode.get(code).add(String(row.date || ''));
        }

        const statsByCode = new Map();
        for (const row of records) {
            const code = parseCourseCode(row.classId);
            if (!code) continue;

            if (!statsByCode.has(code)) {
                statsByCode.set(code, {
                    courseCode: code,
                    name: classNameByCode.get(code) || code,
                    total: 0,
                    attended: 0
                });
            }

            const stat = statsByCode.get(code);
            stat.total += 1;
            if (isFinalizedAttendance(row)) {
                stat.attended += 1;
            }
        }

        for (const [code, name] of classNameByCode.entries()) {
            if (!statsByCode.has(code)) {
                statsByCode.set(code, {
                    courseCode: code,
                    name,
                    total: 0,
                    attended: 0
                });
            }
        }

        const stats = Array.from(statsByCode.values())
            .map((item) => {
                const sessionCount = sessionDatesByCode.has(item.courseCode)
                    ? sessionDatesByCode.get(item.courseCode).size
                    : 0;
                const total = Math.max(sessionCount, item.attended, 0);
                return {
                    ...item,
                    total,
                    percentage: total > 0 ? Math.floor((item.attended / total) * 100) : 0
                };
            })
            .sort((a, b) => String(a.courseCode).localeCompare(String(b.courseCode)));

        return res.json({ stats });
    } catch (err) {
        console.error('Student stats error:', err);
        return res.status(500).json({ message: 'Error fetching student stats' });
    }
});


/**
 * GET /api/attendance/stats/course/:courseId
 * Real-time stats for a specific course
 */
router.get('/stats/course/:courseId', async (req, res) => {
    try {
        console.log(`[DEBUG] Fetching stats for course: ${req.params.courseId}`);
        const { courseId } = req.params;

        // 1. Get Confirmable Sessions (Unique dates recorded for this class)
        const sessions = await Attendance.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('date')), 'date']
            ],
            where: {
                classId: { [Op.like]: `${courseId}%` } 
            }
        });
        
        let totalSessions = sessions.length;
        if (totalSessions === 0) totalSessions = 1; 

        // 2. Total Attendance Records
        const totalRecords = await Attendance.count({
             where: {
            classId: { [Op.like]: `${courseId}%` },
            status: 'present'
            }
        });

        // 3. Get expected student count from Users table (not just those who attended)
        const classEntries = await Class.findAll({
            where: { Course_Code: courseId },
            attributes: ['Program', 'Year_Semester']
        });
        
        const cohorts = classEntries.map(c => {
            const ym = c.Year_Semester && c.Year_Semester.match(/Y(\d)/i);
            return {
                program: { [Op.like]: `${c.Program || ''}%` },
                year: ym ? parseInt(ym[1]) : 2
            };
        }).filter(c => c.program);

        let activeStudents = 0;
        if (cohorts.length > 0) {
            activeStudents = await User.count({
                where: {
                    role: { [Op.in]: ['student', 'student_rep'] },
                    [Op.or]: cohorts
                }
            });
        }

        if (activeStudents === 0) activeStudents = 25; // Fallback for demo if no users seeded
        const expectedRecords = totalSessions * activeStudents;
        
        // Calculate Average
        let avg = 0;
        if (expectedRecords > 0) {
            avg = Math.round((totalRecords / expectedRecords) * 100);
        }

        res.json({
            courseId,
            totalSessions,
            totalStudents: activeStudents,
            avgAttendance: avg,
            presentCount: totalRecords
        });

    } catch (err) {
        console.error("Stats Error:", err);
        console.error("Stats Error Stack:", err.stack); // Added stack trace
        res.status(500).json({ message: 'Error fetching course stats: ' + err.message });
    }
});

/**
 * POST /api/attendance/bulk-mark
 */
router.post('/bulk-mark', requireRoles(canManageAttendanceRoles), async (req, res) => {
    try {
        const classId = validator.escape(validator.trim(String(req.body.classId || '')));
        const students = Array.isArray(req.body.students)
            ? req.body.students.map((id) => validator.escape(validator.trim(String(id || '')))).filter(Boolean)
            : [];
        const safeDate = req.body.date
            ? validator.escape(validator.trim(String(req.body.date)))
            : getLocalDateString();

        if (!classId) return res.status(400).json({ message: 'Class ID is required' });
        if (!students.length) return res.status(400).json({ message: 'Invalid students' });

        const classIdentity = parseClassIdentity(classId);
        if (!classIdentity.courseCode || !classId.includes('--')) {
            return res.status(400).json({ message: 'Please use a specific class variant ID from My Classes/Manual Attendance.' });
        }

        const classRow = await findClassForSession(classId, req.user);
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        if (req.user.role === 'lecturer' && !belongsToLecturer(classRow, req.user)) {
            return res.status(403).json({ message: 'Forbidden: you can only mark attendance for your assigned classes' });
        }

        const studentRows = await User.findAll({
            where: {
                id: { [Op.in]: students },
                role: { [Op.in]: ['student', 'student_rep'] }
            }
        });

        const studentMap = new Map(studentRows.map((row) => [String(row.id), row]));
        const invalidStudents = [];
        for (const studentId of students) {
            const student = studentMap.get(String(studentId));
            if (!student) {
                invalidStudents.push({ id: studentId, reason: 'Student not found' });
                continue;
            }
            const eligibility = studentEligibleForClass(student, classRow);
            if (!eligibility.ok) {
                invalidStudents.push({ id: studentId, reason: eligibility.reason });
            }
        }

        if (invalidStudents.length) {
            return res.status(400).json({
                message: 'Some students are outside this class cohort',
                invalidStudents: invalidStudents.slice(0, 10)
            });
        }

        const nowIso = new Date().toISOString();
        const records = students.map((sId) => ({
            classId,
            userId: sId,
            status: 'present',
            date: safeDate,
            method: 'manual',
            checkedInAt: nowIso,
            checkedOutAt: nowIso
        }));

        await Attendance.bulkCreate(records);
        res.json({ message: 'Bulk attendance saved' });

    } catch (err) {
        console.error("Bulk Mark Error:", err);
        res.status(500).json({ message: 'Error saving bulk attendance: ' + err.message });
    }
});

/**
 * POST /api/attendance/mark
 * Manual mark/update for a single student attendance record.
 */
router.post('/mark', requireRoles(canManageAttendanceRoles), async (req, res) => {
    try {
        let { classId, studentId, status, date } = req.body;

        classId = validator.escape(validator.trim(String(classId || '')));
        studentId = validator.escape(validator.trim(String(studentId || '')));
        status = validator.escape(validator.trim(String(status || 'present')));
        const safeDate = date ? validator.escape(validator.trim(String(date))) : new Date().toISOString().split('T')[0];

        if (!classId || !studentId) {
            return res.status(400).json({ message: 'classId and studentId are required' });
        }

        if (!['present', 'absent', 'late'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const existing = await Attendance.findOne({
            where: {
                classId,
                userId: studentId,
                date: safeDate
            }
        });

        if (existing) {
            existing.status = status;
            existing.method = 'manual';
            existing.checkedInAt = existing.checkedInAt || new Date();
            existing.checkedOutAt = existing.checkedOutAt || new Date();
            await existing.save();
            return res.json({ message: 'Attendance updated', attendance: existing });
        }

        const created = await Attendance.create({
            classId,
            userId: studentId,
            status,
            date: safeDate,
            method: 'manual',
            checkedInAt: new Date(),
            checkedOutAt: new Date()
        });

        return res.status(201).json({ message: 'Attendance marked', attendance: created });
    } catch (err) {
        console.error('Mark attendance error:', err);
        return res.status(500).json({ message: 'Error marking attendance' });
    }
});
/**
 * GET /api/attendance/students/:courseCode
 * Get all students for a course with their attendance stats
 */
router.get('/students/:courseCode', requireRoles(canViewClassAttendanceRoles), async (req, res) => {
    try {
        const { courseCode } = req.params;
        const requestedClassId = validator.escape(validator.trim(String(req.query.classId || '')));
        const requestedIdentity = requestedClassId ? parseClassIdentity(requestedClassId) : null;

        if (requestedClassId && req.user.role === 'lecturer') {
            const scopedClass = await findClassForSession(requestedClassId, req.user);
            if (!scopedClass || !belongsToLecturer(scopedClass, req.user)) {
                return res.status(403).json({ message: 'Forbidden: class does not belong to lecturer' });
            }
        }
        
        // Get the class to find year/program
        const classObj = await Class.findOne({
            where: { Course_Code: courseCode }
        });
        
        if (!classObj) return res.status(404).json({ message: 'Course not found' });
        
        // Parse year from Year_Semester
        let year = 2;
        if (classObj.Year_Semester) {
            const match = classObj.Year_Semester.match(/\d+/);
            if (match) year = parseInt(match[0]);
        }
        
        // FIX: Get ALL programs that take this course (not just first one)
        const allClassEntries = await Class.findAll({
            where: { Course_Code: courseCode },
            attributes: ['Course_Code', 'Day', 'From_Time', 'Program', 'Year_Semester']
        });

        const lecturerOwnedEntries = req.user.role === 'lecturer'
            ? await findLecturerOwnedClassRowsForCourse(courseCode, req.user)
            : [];

        if (req.user.role === 'lecturer' && !lecturerOwnedEntries.length) {
            return res.status(403).json({ message: 'Forbidden: no class ownership for this course' });
        }

        const baseEntries = req.user.role === 'lecturer' ? lecturerOwnedEntries : allClassEntries;

        const scopedClassEntries = requestedIdentity
            ? baseEntries.filter((entry) => classRowMatchesIdentity(entry, requestedIdentity))
            : baseEntries;

        if (requestedClassId && scopedClassEntries.length === 0) {
            return res.json({ students: [], totalSessions: 0 });
        }

        const cohortSource = scopedClassEntries.length ? scopedClassEntries : baseEntries;
        
        const cohorts = cohortSource.map(c => {
            const ym = c.Year_Semester && c.Year_Semester.match(/Y(\d)/i);
            return {
                program: { [Op.like]: `${c.Program || ''}%` },
                year: ym ? parseInt(ym[1]) : 2
            };
        }).filter(c => c.program);
        
        // Get students from ALL programs that take this course
        const students = await User.findAll({
            where: {
                role: { [Op.in]: ['student', 'student_rep'] },
                [Op.or]: cohorts
            }
        });
        
        // Get total sessions for this course (unique dates)
        let allRecords = await Attendance.findAll({
            where: { classId: { [Op.like]: `${courseCode}%` } }
        });
        if (requestedIdentity) {
            allRecords = allRecords.filter((r) => attendanceClassMatchesIdentity(r.classId, requestedIdentity));
        } else if (req.user.role === 'lecturer' && cohortSource.length) {
            const scopeIdentities = cohortSource.map((entry) => ({
                courseCode: String(entry.Course_Code || '').trim(),
                day: String(entry.Day || '').trim(),
                fromTime: String(entry.From_Time || '').trim(),
                programKey: normalizeKey(entry.Program || ''),
                yearKey: normalizeKey(entry.Year_Semester || '')
            }));
            allRecords = allRecords.filter((record) => scopeIdentities.some((identity) => attendanceClassMatchesIdentity(record.classId, identity)));
        }
        
        const uniqueDates = new Set(allRecords.map(r => new Date(r.date).toDateString()));
        const totalSessions = uniqueDates.size;
        
        // For each student, get their attendance count
        const result = await Promise.all(students.map(async (s) => {
            const attended = allRecords.filter((r) => String(r.userId) === String(s.id) && isFinalizedAttendance(r)).length;

            const pct = totalSessions > 0 ? Math.floor((attended / totalSessions) * 100) : 0;
            
            // Risk categorization
            let status = 'good';
            if (attended === 0) status = 'danger';
            else if (pct < 50) status = 'risk';
            else if (pct < 75) status = 'warning';
            
            let recommendedClassId = null;
            const preferred = cohortSource.find((entry) => {
                const eligible = studentEligibleForClass(s, entry);
                return eligible.ok;
            }) || null;
            if (preferred) {
                recommendedClassId = buildCompositeClassIdFromRow(preferred);
            }

            return {
                id: s.id,
                fullName: s.fullName,
                program: s.program,
                year: s.year,
                attended,
                total: totalSessions,
                percentage: pct,
                status,
                recommendedClassId
            };
        }));
        
        res.json({ students: result, totalSessions });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching students' });
    }
});

/**
 * GET /api/attendance/today-by-class/:courseCode
 * Returns list of student IDs who have checked in today for this course
 */
router.get('/today-by-class/:courseCode', requireRoles(canViewClassAttendanceRoles), async (req, res) => {
    try {
        const { courseCode } = req.params;
        const requestedClassId = validator.escape(validator.trim(String(req.query.classId || '')));
        const sources = validator.escape(validator.trim(String(req.query.sources || ''))).toLowerCase();
        const state = validator.escape(validator.trim(String(req.query.state || ''))).toLowerCase();
        const requestedIdentity = requestedClassId ? parseClassIdentity(requestedClassId) : null;
        const todayLocal = getLocalDateString();
        const startOfDay = startOfLocalDay();

        if (requestedClassId && req.user.role === 'lecturer') {
            const scopedClass = await findClassForSession(requestedClassId, req.user);
            if (!scopedClass || !belongsToLecturer(scopedClass, req.user)) {
                return res.status(403).json({ message: 'Forbidden: class does not belong to lecturer' });
            }
        }

        const lecturerOwnedEntries = req.user.role === 'lecturer'
            ? await findLecturerOwnedClassRowsForCourse(courseCode, req.user)
            : [];

        if (req.user.role === 'lecturer' && !lecturerOwnedEntries.length) {
            return res.status(403).json({ message: 'Forbidden: no class ownership for this course' });
        }

        const records = await Attendance.findAll({
            where: {
                classId: { [Op.like]: `${courseCode}%` },
                [Op.and]: [
                    {
                        [Op.or]: [
                            { date: todayLocal },
                            { checkedInAt: { [Op.gte]: startOfDay } },
                            { checkedOutAt: { [Op.gte]: startOfDay } }
                        ]
                    },
                    { checkedInAt: { [Op.ne]: null } }
                ]
            },
            attributes: ['classId', 'userId', 'method', 'date', 'checkedInAt', 'checkedOutAt', 'status']
        });

        let filtered = records;
        if (requestedIdentity) {
            filtered = filtered.filter((r) => attendanceClassMatchesIdentity(r.classId, requestedIdentity));
        } else if (req.user.role === 'lecturer' && lecturerOwnedEntries.length) {
            const scopeIdentities = lecturerOwnedEntries.map((entry) => ({
                courseCode: String(entry.Course_Code || '').trim(),
                day: String(entry.Day || '').trim(),
                fromTime: String(entry.From_Time || '').trim(),
                programKey: normalizeKey(entry.Program || ''),
                yearKey: normalizeKey(entry.Year_Semester || '')
            }));
            filtered = filtered.filter((r) => scopeIdentities.some((identity) => attendanceClassMatchesIdentity(r.classId, identity)));
        }
        if (sources === 'automated') {
            const automatedMethods = new Set(['totp', 'qr', 'checkin_checkout']);
            filtered = filtered.filter((r) => automatedMethods.has(String(r.method || '').toLowerCase()));
        }
        if (state === 'active') {
            filtered = filtered.filter((r) => !r.checkedOutAt);
        }
        if (state === 'complete') {
            filtered = filtered.filter((r) => !!r.checkedOutAt);
        }

        // Deduplicate by userId, keeping the latest check-in row per student.
        const checkedIn = {};
        filtered.forEach(r => {
            const existing = checkedIn[r.userId];
            const existingTs = existing?.checkedInAt ? new Date(existing.checkedInAt).getTime() : 0;
            const candidateTs = r.checkedInAt ? new Date(r.checkedInAt).getTime() : 0;
            if (!existing || candidateTs >= existingTs) {
                checkedIn[r.userId] = {
                    userId: r.userId,
                    method: r.method,
                    status: r.status,
                    checkedInAt: r.checkedInAt,
                    checkedOutAt: r.checkedOutAt
                };
            }
        });

        res.json({ checkedInStudents: Object.values(checkedIn) });
    } catch (err) {
        console.error('Error fetching today class attendance:', err);
        res.status(500).json({ message: 'Error fetching attendance' });
    }
});

/**
 * GET /api/attendance/students/:courseCode/export
 * Lecturer/admin export of registered students for a course as CSV.
 */
router.get('/students/:courseCode/export', async (req, res) => {
    try {
        const courseCode = validator.escape(validator.trim(req.params.courseCode || ''));
        if (!courseCode) return res.status(400).json({ message: 'Course code is required' });

        const classes = await Class.findAll({ where: { Course_Code: courseCode } });
        if (!classes.length) return res.status(404).json({ message: 'Course not found' });

        if (req.user.role === 'lecturer') {
            const ownMatch = classes.some((c) => String(c.LecturerId || '') === String(req.user.id));
            if (!ownMatch) {
                return res.status(403).json({ message: 'You can only export your own class lists' });
            }
        } else if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const cohorts = classes.map((c) => {
            const ym = c.Year_Semester && c.Year_Semester.match(/Y(\d)/i);
            return {
                program: { [Op.like]: `${c.Program || ''}%` },
                year: ym ? parseInt(ym[1], 10) : 1
            };
        }).filter((c) => c.program);

        const students = await User.findAll({
            where: {
                role: { [Op.in]: ['student', 'student_rep'] },
                [Op.or]: cohorts
            },
            order: [['fullName', 'ASC']]
        });

        const allRecords = await Attendance.findAll({ where: { classId: { [Op.like]: `${courseCode}%` } } });
        const uniqueDates = new Set(allRecords.map((r) => new Date(r.date).toDateString()));
        const totalSessions = Math.max(uniqueDates.size, 1);

        const rows = ['StudentId,FullName,Program,Year,AttendanceCount,TotalSessions,Percentage'];

        for (const s of students) {
            const attended = await Attendance.count({
                where: {
                    userId: s.id,
                    classId: { [Op.like]: `${courseCode}%` },
                    status: 'present'
                }
            });
            const pct = Math.round((attended / totalSessions) * 100);
            const safeName = `"${String(s.fullName || '').replace(/"/g, '""')}"`;
            const safeProgram = `"${String(s.program || '').replace(/"/g, '""')}"`;
            rows.push([s.id, safeName, safeProgram, s.year || '', attended, totalSessions, pct].join(','));
        }

        const filename = `${courseCode}_registered_students.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(rows.join('\n'));
    } catch (err) {
        console.error('Export students error:', err);
        return res.status(500).json({ message: 'Error exporting class list' });
    }
});

/**
 * GET /api/attendance/today-by-class/:courseCode/export
 * Export today's check-ins for a class as CSV.
 */
router.get('/today-by-class/:courseCode/export', requireRoles(canViewClassAttendanceRoles), async (req, res) => {
    try {
        const courseCode = validator.escape(validator.trim(req.params.courseCode || ''));
        const requestedClassId = validator.escape(validator.trim(String(req.query.classId || '')));
        const sources = validator.escape(validator.trim(String(req.query.sources || ''))).toLowerCase();
        const requestedIdentity = requestedClassId ? parseClassIdentity(requestedClassId) : null;
        if (!courseCode) return res.status(400).json({ message: 'Course code is required' });

        const classes = await Class.findAll({ where: { Course_Code: courseCode } });
        if (!classes.length) return res.status(404).json({ message: 'Course not found' });

        if (req.user.role === 'lecturer') {
            const ownMatch = classes.some((c) => String(c.LecturerId || '') === String(req.user.id));
            if (!ownMatch) {
                return res.status(403).json({ message: 'You can only export your own class lists' });
            }
        } else if (req.user.role !== 'admin' && req.user.role !== 'student_rep') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const todayLocal = getLocalDateString();
        const today = startOfLocalDay();

        const [course] = classes;
        const courseName = course.Course_Name || courseCode;
        const yearSemester = course.Year_Semester || '';
        const yearMatch = yearSemester.match(/Y(\d)/i);
        const courseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

        const cohorts = classes.map((c) => {
            const ym = c.Year_Semester && c.Year_Semester.match(/Y(\d)/i);
            return {
                program: { [Op.like]: `${c.Program || ''}%` },
                year: ym ? parseInt(ym[1], 10) : 1
            };
        }).filter((c) => c.program);

        const students = await User.findAll({
            where: {
                role: { [Op.in]: ['student', 'student_rep'] },
                [Op.or]: cohorts
            },
            order: [['fullName', 'ASC']]
        });

        const records = await Attendance.findAll({
            where: {
                classId: { [Op.like]: `${courseCode}%` },
                [Op.or]: [
                    { date: todayLocal },
                    { checkedInAt: { [Op.gte]: today } },
                    { checkedOutAt: { [Op.gte]: today } }
                ]
            },
            order: [['date', 'ASC'], ['userId', 'ASC']]
        });

        let filtered = records;
        if (requestedIdentity) {
            filtered = filtered.filter((r) => attendanceClassMatchesIdentity(r.classId, requestedIdentity));
        }
        if (sources === 'automated') {
            const automatedMethods = new Set(['totp', 'qr', 'checkin_checkout']);
            filtered = filtered.filter((r) => automatedMethods.has(String(r.method || '').toLowerCase()));
        }

        const latestByUser = new Map();
        for (const record of filtered) {
            const key = String(record.userId || '');
            const existing = latestByUser.get(key);
            const existingTs = existing
                ? new Date(existing.checkedOutAt || existing.checkedInAt || existing.date || 0).getTime()
                : 0;
            const candidateTs = new Date(record.checkedOutAt || record.checkedInAt || record.date || 0).getTime();
            if (!existing || candidateTs >= existingTs) {
                latestByUser.set(key, record);
            }
        }
        const exportRecords = Array.from(latestByUser.values())
            .sort((a, b) => String(a.userId || '').localeCompare(String(b.userId || '')));

        const studentMap = new Map(students.map((student) => [String(student.id), student]));
        const rows = ['Date,CourseCode,CourseName,StudentId,FullName,Program,Year,Method,CheckInTime,CheckOutTime,Completion'];

        for (const record of exportRecords) {
            let student = studentMap.get(String(record.userId));
            if (!student) {
                // Include late roster updates/manual entries so exports do not silently drop check-ins.
                student = await User.findByPk(record.userId);
            }
            if (!student) continue;

            const resolvedClass = await findClassForSession(record.classId);
            const resolvedCourseName = resolvedClass && resolvedClass.Course_Name ? resolvedClass.Course_Name : courseName;

            const safeName = `"${String(student.fullName || '').replace(/"/g, '""')}"`;
            const safeProgram = `"${String(student.program || '').replace(/"/g, '""')}"`;
            const checkInTime = formatCsvDateTime(record.checkedInAt);
            const checkOutTime = formatCsvDateTime(record.checkedOutAt);
            const completion = isAttendanceComplete(record) ? 'complete' : 'incomplete';
            rows.push([
                record.date,
                courseCode,
                `"${String(resolvedCourseName).replace(/"/g, '""')}"`,
                student.id,
                safeName,
                safeProgram,
                student.year || courseYear || '',
                record.method || 'manual',
                checkInTime,
                checkOutTime,
                completion
            ].join(','));
        }

        const todayStamp = todayLocal;
        const filename = `${courseCode}_${todayStamp}_today_checkins.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(rows.join('\n'));
    } catch (err) {
        console.error('Export today check-ins error:', err);
        return res.status(500).json({ message: 'Error exporting today check-ins' });
    }
});

/**
 * POST /api/attendance/checkin
 * Lecturer opens check-in for a class session
 */
router.post('/checkin', requireRoles(canManageAttendanceRoles, 'Sign in as lecturer or admin to open check-in'), async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) return res.status(400).json({ message: 'Class ID required' });

        const classRow = await findClassForSession(classId, req.user);
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        if (req.user.role === 'lecturer' && !belongsToLecturer(classRow, req.user)) {
            return res.status(403).json({ message: 'You can only open check-in for your own class' });
        }

        // Find or create session
        let session = await Session.findOne({
            where: { classId, expiresAt: { [Op.gt]: new Date() } }
        });

        if (!session) {
            const secret = generateSecret();
            const checkInSecret = generateSecret();
            const clientIP = req.ip || req.connection.remoteAddress;
            const lecturerIp = clientIP && clientIP.includes('::ffff:') ? clientIP.split('::ffff:')[1] : clientIP;

            session = await Session.create({
                id: Date.now().toString(),
                classId,
                secret,
                checkInSecret,
                checkOutSecret: null,
                status: 'checkin_open',
                checkInTime: new Date(),
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 2),
                lecturerIp
            });
        } else {
            // Existing session: transition to check-in state
            session.status = 'checkin_open';
            session.checkInTime = new Date();
            await session.save();
        }

        const checkInCode = generateTOTP(session.checkInSecret);
        const timeLeft = 30 - Math.floor((Date.now() / 1000) % 30);

        res.json({
            sessionId: session.id,
            code: checkInCode,
            timeLeft: timeLeft * 1000,
            status: 'checkin_open',
            message: 'Check-in is now open'
        });
    } catch (err) {
        console.error('Check-in error:', err);
        res.status(500).json({ message: 'Error opening check-in' });
    }
});

/**
 * POST /api/attendance/checkout
 * Lecturer opens check-out for a class session
 */
router.post('/checkout', requireRoles(canManageAttendanceRoles, 'Sign in as lecturer or admin to open check-out'), async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) return res.status(400).json({ message: 'Class ID required' });

        const classRow = await findClassForSession(classId, req.user);
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        if (req.user.role === 'lecturer' && !belongsToLecturer(classRow, req.user)) {
            return res.status(403).json({ message: 'You can only open check-out for your own class' });
        }

        let session = await Session.findOne({
            where: { classId, expiresAt: { [Op.gt]: new Date() } }
        });

        if (!session) {
            return res.status(400).json({ message: 'No active session for this class' });
        }

        const wasCheckoutOpen = session.status === 'checkout_open';

        // Generate check-out secret
        const checkOutSecret = generateSecret();
        session.status = 'checkout_open';
        session.checkOutTime = new Date();
        session.checkOutSecret = checkOutSecret;
        await session.save();

        // Notify students once when switching into checkout mode.
        if (!wasCheckoutOpen) {
            try {
                await Announcement.create({
                    lecturerId: String(req.user.id || classRow.LecturerId || ''),
                    lecturerName: String(req.user.fullName || classRow.Lecturer || 'Lecturer'),
                    courseCode: String(classRow.Course_Code || parseCourseCode(classId) || ''),
                    courseName: String(classRow.Course_Name || classRow.Course_Code || 'Class'),
                    year: extractYearNumber(classRow.Year_Semester) || null,
                    program: classRow.Program || null,
                    type: 'info',
                    message: `Checkout is now open for ${String(classRow.Course_Code || parseCourseCode(classId))}. Please complete checkout to finalize attendance.`
                });
            } catch (announcementError) {
                console.warn('Checkout-open announcement failed:', announcementError && announcementError.message ? announcementError.message : announcementError);
            }
        }

        const checkOutCode = generateTOTP(checkOutSecret);
        const timeLeft = 30 - Math.floor((Date.now() / 1000) % 30);

        res.json({
            sessionId: session.id,
            code: checkOutCode,
            timeLeft: timeLeft * 1000,
            status: 'checkout_open',
            message: 'Check-out is now open'
        });
    } catch (err) {
        console.error('Check-out error:', err);
        res.status(500).json({ message: 'Error opening check-out' });
    }
});

/**
 * POST /api/attendance/close
 * Lecturer/admin closes an active session for a class
 */
router.post('/close', requireRoles(canManageAttendanceRoles, 'Sign in as lecturer or admin to close a session'), async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) return res.status(400).json({ message: 'Class ID required' });

        const classRow = await findClassForSession(classId, req.user);
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        if (req.user.role === 'lecturer' && !belongsToLecturer(classRow, req.user)) {
            return res.status(403).json({ message: 'You can only close sessions for your own class' });
        }

        const session = await Session.findOne({
            where: { classId, expiresAt: { [Op.gt]: new Date() } }
        });

        if (!session) {
            return res.status(404).json({ message: 'No active session for this class' });
        }

        const todayLocal = getLocalDateString();
        const sessionIdentity = parseClassIdentity(classId);
        let unresolvedRecords = await Attendance.findAll({
            where: {
                classId: { [Op.like]: `${parseCourseCode(classId)}%` },
                date: todayLocal,
                checkedInAt: { [Op.ne]: null },
                checkedOutAt: null
            },
            attributes: ['userId', 'classId', 'checkedInAt']
        });

        unresolvedRecords = unresolvedRecords
            .filter((row) => attendanceClassMatchesIdentity(row.classId, sessionIdentity));

        const unresolvedUserIds = Array.from(new Set(unresolvedRecords.map((row) => String(row.userId))));

        session.status = 'closed';
        session.expiresAt = new Date();
        await session.save();

        return res.json({
            message: 'Session closed',
            classId,
            sessionId: session.id,
            uncheckedOutCount: unresolvedUserIds.length,
            uncheckedOutStudentIds: unresolvedUserIds
        });
    } catch (err) {
        console.error('Close session error:', err);
        return res.status(500).json({ message: 'Error closing session' });
    }
});

/**
 * POST /api/attendance/validate-checkin
 * Student submits check-in code and device info
 */
router.post('/validate-checkin', attendanceAttemptLimiter, async (req, res) => {
    try {
        let { classId, studentId, code } = req.body;

        if (classId) classId = validator.escape(validator.trim(classId));
        if (studentId) studentId = validator.escape(validator.trim(studentId));
        if (code) code = validator.escape(validator.trim(String(code)));

        if (!studentId) return res.status(400).json({ message: 'Student ID required' });

        if (!hasRole(req, codeValidationRoles)) {
            return res.status(403).json({ message: 'Only students can check in using attendance codes' });
        }

        if (String(req.user.id) !== String(studentId)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Find session
        const session = await findActiveSessionForClass(classId, 'checkin_open');

        if (!session) {
            const checkoutSession = await findActiveSessionForClass(classId, 'checkout_open');
            if (checkoutSession) {
                return res.status(409).json({
                    message: 'Check-out is currently open',
                    success: false,
                    resultCode: 'session_checkout_open',
                    expectedAction: 'checkout',
                    sessionStatus: 'checkout_open',
                    classId: checkoutSession.classId
                });
            }

            return res.status(400).json({
                message: 'Check-in is not currently open',
                success: false,
                resultCode: 'checkin_not_open',
                expectedAction: 'checkin'
            });
        }

        const canonicalClassId = session.classId || classId;

        const student = await User.findByPk(studentId);
        if (!student || !['student', 'student_rep'].includes(student.role)) {
            return res.status(403).json({ message: 'Please sign in as a student account' });
        }

        const resolvedClass = await resolveEligibleClassForStudent(canonicalClassId, student);
        const classRow = resolvedClass && resolvedClass.classRow;
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const eligibility = studentEligibleForClass(student, classRow);
        if (!eligibility.ok) {
            return res.status(403).json({ message: eligibility.reason });
        }

        // Verify check-in code
        const isValid = verifyTOTP(code, session.checkInSecret);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid or expired check-in code' });
        }

        // Check device
        const deviceInfo = getDeviceInfo(req);
        const deviceId = generateDeviceId(deviceInfo.userAgent, deviceInfo.ip);

        let device = await DeviceSession.findOne({
            where: { userId: studentId, deviceId }
        });

        let requiresVerification = false;
        if (!device) {
            // New device: check if user has 3+ devices already
            const activeDevices = await DeviceSession.findAll({
                where: { userId: studentId }
            });

            requiresVerification = true; // Always require verification on unknown device

            if (activeDevices.length >= 3) {
                // Remove oldest untrusted device
                const untrusted = activeDevices.filter((d) => !d.isTrusted).sort((a, b) => a.createdAt - b.createdAt);
                if (untrusted.length > 0) {
                    await untrusted[0].destroy();
                }
            }

            device = await DeviceSession.create({
                userId: studentId,
                deviceId,
                deviceName: deviceInfo.userAgent.substring(0, 100),
                lastIp: deviceInfo.ip,
                lastUserAgent: deviceInfo.userAgent,
                requiresVerification: true,
                isTrusted: false
            });
        } else {
            // Known device: update last seen
            device.lastSeenAt = new Date();
            device.lastIp = deviceInfo.ip;
            await device.save();
            requiresVerification = !device.isTrusted;
        }

        // Create tentative attendance record
        const existing = await Attendance.findOne({
            where: {
                userId: studentId,
                classId: { [Op.like]: `${parseCourseCode(canonicalClassId)}%` },
                date: getLocalDateString()
            }
        });

        let attendance;
        if (existing) {
            if (isAttendanceComplete(existing)) {
                return res.json({
                    message: 'Attendance already completed for this class',
                    attendanceId: existing.id,
                    requiresVerification: false,
                    nextStep: 'done',
                    success: true,
                    resultCode: 'already_completed',
                    attendanceComplete: true,
                    expectedAction: 'done',
                    checkedInAt: existing.checkedInAt,
                    checkedOutAt: existing.checkedOutAt
                });
            }
            existing.checkedInAt = existing.checkedInAt || new Date();
            existing.method = existing.method || 'checkin_checkout';
            existing.status = existing.status === 'present' ? 'present' : 'absent';
            await existing.save();
            attendance = existing;
        } else {
            attendance = await Attendance.create({
                classId: canonicalClassId,
                userId: studentId,
                date: getLocalDateString(),
                status: 'absent',
                method: 'checkin_checkout',
                checkedInAt: new Date()
            });
        }

        res.json({
            message: 'Check-in recorded',
            attendanceId: attendance.id,
            requiresVerification,
            deviceId: device.id,
            nextStep: requiresVerification ? 'verify_identity' : 'await_checkout',
            success: true,
            resultCode: 'checkin_recorded',
            attendanceComplete: false,
            expectedAction: requiresVerification ? 'verify_identity' : 'checkout',
            checkedInAt: attendance.checkedInAt,
            checkedOutAt: attendance.checkedOutAt || null
        });
    } catch (err) {
        console.error('Check-in validation error:', err);
        res.status(500).json({ message: 'Error validating check-in' });
    }
});

/**
 * POST /api/attendance/validate-checkout
 * Student submits check-out code to complete attendance
 */
router.post('/validate-checkout', attendanceAttemptLimiter, async (req, res) => {
    try {
        let { classId, studentId, code, attendanceId } = req.body;

        if (classId) classId = validator.escape(validator.trim(classId));
        if (studentId) studentId = validator.escape(validator.trim(studentId));
        if (code) code = validator.escape(validator.trim(String(code)));
        if (attendanceId) attendanceId = parseInt(attendanceId, 10);

        if (!studentId) return res.status(400).json({ message: 'Student ID required' });

        if (!hasRole(req, codeValidationRoles)) {
            return res.status(403).json({ message: 'Only students can check out using attendance codes' });
        }

        if (String(req.user.id) !== String(studentId)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Find session
        const session = await findActiveSessionForClass(classId, 'checkout_open');


        if (!session) {
            const checkinSession = await findActiveSessionForClass(classId, 'checkin_open');
            if (checkinSession) {
                return res.status(409).json({
                    message: 'Check-in is currently open',
                    success: false,
                    resultCode: 'session_checkin_open',
                    expectedAction: 'checkin',
                    sessionStatus: 'checkin_open',
                    classId: checkinSession.classId
                });
            }

            return res.status(400).json({
                message: 'Check-out is not currently open',
                success: false,
                resultCode: 'checkout_not_open',
                expectedAction: 'checkout'
            });
        }

        const canonicalClassId = session.classId || classId;

        const student = await User.findByPk(studentId);
        if (!student || !['student', 'student_rep'].includes(student.role)) {
            return res.status(403).json({ message: 'Please sign in as a student account' });
        }

        const resolvedClass = await resolveEligibleClassForStudent(canonicalClassId, student);
        const classRow = resolvedClass && resolvedClass.classRow;
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const eligibility = studentEligibleForClass(student, classRow);
        if (!eligibility.ok) {
            return res.status(403).json({ message: eligibility.reason });
        }

        // Verify check-out code
        const isValid = verifyTOTP(code, session.checkOutSecret);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid or expired check-out code' });
        }

        const deviceInfo = getDeviceInfo(req);
        const deviceId = generateDeviceId(deviceInfo.userAgent, deviceInfo.ip);
        const device = await DeviceSession.findOne({
            where: { userId: studentId, deviceId }
        });

        if (!device) {
            return res.status(403).json({
                message: 'Device not recognized. Complete identity verification before check-out.',
                success: false,
                resultCode: 'verification_required',
                expectedAction: 'verify_identity',
                attendanceComplete: false
            });
        }

        if (!device.isTrusted || device.requiresVerification) {
            return res.status(403).json({
                message: 'Identity verification required before check-out.',
                requiresVerification: true,
                nextStep: 'verify_identity',
                success: false,
                resultCode: 'verification_required',
                expectedAction: 'verify_identity',
                attendanceComplete: false
            });
        }

        // Update or create attendance
        let attendance = null;
        if (attendanceId) {
            const byId = await Attendance.findByPk(attendanceId);
            if (byId && String(byId.userId) === String(studentId)
                && parseCourseCode(byId.classId) === parseCourseCode(canonicalClassId)) {
                attendance = byId;
            }
        }

        if (!attendance) {
            attendance = await Attendance.findOne({
                where: {
                    userId: studentId,
                    classId: { [Op.like]: `${parseCourseCode(canonicalClassId)}%` },
                    date: getLocalDateString(),
                    checkedInAt: { [Op.ne]: null },
                    checkedOutAt: null
                },
                order: [['checkedInAt', 'DESC']]
            });
        }

        if (!attendance) {
            attendance = await Attendance.findOne({
                where: {
                    userId: studentId,
                    classId: { [Op.like]: `${parseCourseCode(canonicalClassId)}%` },
                    date: getLocalDateString()
                },
                order: [['checkedInAt', 'DESC']]
            });
        }

        if (!attendance) {
            return res.status(400).json({
                message: 'Check-in record not found. Ask lecturer for manual attendance if needed.',
                success: false,
                resultCode: 'checkin_missing',
                expectedAction: 'checkin'
            });
        }

        if (!attendance.checkedInAt) {
            return res.status(400).json({
                message: 'You must check in before checking out.',
                success: false,
                resultCode: 'checkin_missing',
                expectedAction: 'checkin'
            });
        }

        // Mark checked out and finalize attendance
        attendance.checkedOutAt = new Date();
        attendance.status = 'present';
        attendance.method = attendance.method || 'checkin_checkout';
        await attendance.save();

        // Defensive cleanup: close any duplicate open rows for the same student/course/day.
        await Attendance.update(
            {
                checkedOutAt: attendance.checkedOutAt,
                status: 'present',
                method: 'checkin_checkout'
            },
            {
                where: {
                    userId: studentId,
                    classId: { [Op.like]: `${parseCourseCode(canonicalClassId)}%` },
                    date: getLocalDateString(),
                    checkedInAt: { [Op.ne]: null },
                    checkedOutAt: null
                }
            }
        );

        res.json({
            message: 'Attendance successfully recorded',
            attendanceId: attendance.id,
            checkedInAt: attendance.checkedInAt,
            checkedOutAt: attendance.checkedOutAt,
            success: true,
            resultCode: 'checkout_recorded',
            attendanceComplete: true,
            expectedAction: 'done'
        });
    } catch (err) {
        console.error('Check-out validation error:', err);
        res.status(500).json({ message: 'Error validating check-out' });
    }
});

/**
 * GET /api/attendance/active-sessions
 * Student-facing list of currently open attendance sessions for the logged-in user.
 */
router.get('/active-sessions', async (req, res) => {
    try {
        const debugMode = String(req.query.debug || '') === '1';
        if (!codeValidationRoles.has(req.user.role)) {
            return res.status(403).json({ message: 'Please sign in as a student account' });
        }

        const student = await User.findByPk(req.user.id);
        if (!student || !['student', 'student_rep'].includes(String(student.role || ''))) {
            return res.status(403).json({ message: 'Please sign in as a student account' });
        }

        const activeSessions = await Session.findAll({
            where: {
                expiresAt: { [Op.gt]: new Date() },
                status: { [Op.in]: ['checkin_open', 'checkout_open'] }
            },
            order: [['updatedAt', 'DESC']]
        });

        const debug = {
            student: {
                id: student.id,
                role: student.role,
                program: student.program,
                year: student.year
            },
            activeSessionCount: activeSessions.length,
            includedSessionCount: 0,
            excludedByReason: {
                classRowIneligible: 0,
                missingCourseCodeIdentity: 0,
                fallbackNoEligibleCandidate: 0,
                identityProgramYearMismatch: 0
            }
        };

        const sessions = [];
        for (const session of activeSessions) {
            const classRow = await findClassForSession(session.classId);
            if (classRow) {
                const eligibility = studentEligibleForClass(student, classRow);
                if (eligibility.ok) {
                    sessions.push({
                        sessionId: session.id,
                        status: session.status,
                        classId: session.classId,
                        code: classRow.Course_Code,
                        name: classRow.Course_Name,
                        day: classRow.Day,
                        time: `${classRow.From_Time} - ${classRow.To_Time}`,
                        room: classRow.Venue,
                        lecturer: classRow.Lecturer,
                        program: classRow.Program,
                        year: classRow.Year_Semester
                    });
                    debug.includedSessionCount += 1;
                    continue;
                }
                debug.excludedByReason.classRowIneligible += 1;
                // Fall through and try other rows with the same course code/identity.
            }

            const identity = parseClassIdentity(session.classId);
            if (!identity.courseCode) {
                debug.excludedByReason.missingCourseCodeIdentity += 1;
                continue;
            }

            const fallbackCandidates = await Class.findAll({
                where: {
                    Course_Code: identity.courseCode
                }
            });

            let matchedFallback = false;
            const strictCandidates = fallbackCandidates.filter((candidate) => {
                if (identity.day && candidate.Day && candidate.Day !== identity.day) return false;
                if (identity.fromTime && candidate.From_Time && candidate.From_Time !== identity.fromTime) return false;
                return true;
            });

            const relaxedCandidates = strictCandidates.length ? strictCandidates : fallbackCandidates;

            for (const candidate of relaxedCandidates) {
                const fallbackEligibility = studentEligibleForClass(student, candidate);
                if (!fallbackEligibility.ok) continue;

                sessions.push({
                    sessionId: session.id,
                    status: session.status,
                    classId: session.classId,
                    code: candidate.Course_Code || identity.courseCode,
                    name: candidate.Course_Name || 'Active lesson',
                    day: candidate.Day || identity.day || 'Today',
                    time: candidate.From_Time && candidate.To_Time ? `${candidate.From_Time} - ${candidate.To_Time}` : (identity.fromTime ? `${identity.fromTime} -` : ''),
                    room: candidate.Venue || '',
                    lecturer: candidate.Lecturer || '',
                    program: candidate.Program || student.program || '',
                    year: candidate.Year_Semester || student.year || ''
                });
                matchedFallback = true;
                break;
            }

            if (matchedFallback) {
                debug.includedSessionCount += 1;
                continue;
            }

            debug.excludedByReason.fallbackNoEligibleCandidate += 1;

            const programMatch = !identity.programKey || programKeysCompatible(student.program, identity.programKey);
            const yearMatch = !identity.yearKey || yearKeysCompatible(`y${student.year}`, identity.yearKey);
            if (!programMatch || !yearMatch) {
                debug.excludedByReason.identityProgramYearMismatch += 1;
                continue;
            }

            sessions.push({
                sessionId: session.id,
                status: session.status,
                classId: session.classId,
                code: identity.courseCode,
                name: 'Active lesson',
                day: identity.day || 'Today',
                time: identity.fromTime ? `${identity.fromTime} -` : '',
                room: '',
                lecturer: '',
                program: student.program || '',
                year: student.year || ''
            });
            debug.includedSessionCount += 1;
        }

        if (debugMode) {
            return res.json({ sessions, debug });
        }
        return res.json({ sessions });
    } catch (err) {
        console.error('Error fetching active attendance sessions:', err);
        return res.status(500).json({ message: 'Error fetching active attendance sessions' });
    }
});

/**
 * GET /api/attendance/lecturer-active-sessions
 * Lecturer/admin view of currently active check-in/check-out sessions.
 */
router.get('/lecturer-active-sessions', requireRoles(canManageAttendanceRoles), async (req, res) => {
    try {
        const activeSessions = await Session.findAll({
            where: {
                expiresAt: { [Op.gt]: new Date() },
                status: { [Op.in]: ['checkin_open', 'checkout_open'] }
            },
            order: [['updatedAt', 'DESC']]
        });

        const sessions = [];
        for (const session of activeSessions) {
            const classRow = await findClassForSession(session.classId);
            if (!classRow) continue;

            if (req.user.role === 'lecturer' && String(classRow.LecturerId || '') !== String(req.user.id)) {
                continue;
            }

            sessions.push({
                sessionId: session.id,
                status: session.status,
                classId: session.classId,
                code: classRow.Course_Code,
                name: classRow.Course_Name,
                day: classRow.Day,
                time: `${classRow.From_Time} - ${classRow.To_Time}`,
                room: classRow.Venue,
                lecturer: classRow.Lecturer,
                expiresAt: session.expiresAt,
                updatedAt: session.updatedAt
            });
        }

        return res.json({ sessions });
    } catch (err) {
        console.error('Error fetching lecturer active sessions:', err);
        return res.status(500).json({ message: 'Error fetching lecturer active sessions' });
    }
});

/**
 * POST /api/attendance/verify-identity
 * Verify student identity via biometric or face recognition (client-side photo, server-side validation)
 */
router.post('/verify-identity', authMiddleware, async (req, res) => {
    try {
        const { userId, method, photoWidth, photoHeight, sessionId, selfieImage, idImage, deviceId } = req.body;

        if (!userId || !method) {
            return res.status(400).json({ message: 'User ID and verification method required' });
        }

        if (String(req.user.id) !== String(userId) && !hasRole(req, canManageAttendanceRoles)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const providerCfg = getProviderConfig();
        let verified = false;
        let verificationNotes = null;

        if (method === 'fingerprint') {
            // WebAuthn/platform biometric success is validated client-side by browser and token auth.
            verified = true;
            verificationNotes = 'platform_biometric';
        } else {
            const providerResult = await verifyWithProvider({
                userId,
                method,
                selfieImage,
                idImage,
                deviceId,
                metadata: {
                    userAgent: req.get('user-agent') || '',
                    ip: req.ip || req.connection.remoteAddress || ''
                }
            });
            verified = Boolean(providerResult.verified);
            verificationNotes = providerResult.reason || 'provider_result';

            if (!verified) {
                return res.status(403).json({
                    message: providerCfg.enabled
                        ? 'Identity verification failed. Please see lecturer for manual attendance.'
                        : 'Identity provider is not configured. Please use device biometrics or lecturer manual attendance.',
                    verified: false,
                    reason: providerResult.reason || 'verification_failed'
                });
            }
        }

        // Log verification attempt (photo data NOT stored)
        const verification = await BiometricVerification.create({
            userId,
            sessionId,
            method,
            verified,
            photoMetadata: {
                width: photoWidth || null,
                height: photoHeight || null,
                providedSelfie: Boolean(selfieImage),
                providedId: Boolean(idImage)
            },
            notes: verificationNotes
        });

        // Mark device as trusted
        const deviceInfo = getDeviceInfo(req);
        const currentDeviceId = generateDeviceId(deviceInfo.userAgent, deviceInfo.ip);
        const device = await DeviceSession.findOne({
            where: { userId, deviceId: currentDeviceId }
        });

        if (device && !device.isTrusted) {
            device.isTrusted = true;
            device.requiresVerification = false;
            await device.save();
        }

        res.json({
            message: 'Identity verified',
            verificationId: verification.id,
            verified
        });
    } catch (err) {
        console.error('Identity verification error:', err);
        res.status(500).json({ message: 'Error verifying identity' });
    }
});

/**
 * GET /api/devices/active
 * List active devices for the authenticated user
 */
router.get('/devices/active', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const devices = await DeviceSession.findAll({
            where: { userId },
            order: [['lastSeenAt', 'DESC']]
        });

        res.json({
            devices: devices.map((d) => ({
                id: d.id,
                deviceName: d.deviceName,
                lastIp: d.lastIp,
                isTrusted: d.isTrusted,
                lastSeenAt: d.lastSeenAt,
                createdAt: d.createdAt
            })),
            maxDevices: 3,
            totalDevices: devices.length
        });
    } catch (err) {
        console.error('Get active devices error:', err);
        res.status(500).json({ message: 'Error fetching devices' });
    }
});

/**
 * POST /api/devices/register
 * Manually register a new device (not recommended; mainly for admin use)
 */
router.post('/devices/register', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const deviceInfo = getDeviceInfo(req);
        const deviceId = generateDeviceId(deviceInfo.userAgent, deviceInfo.ip);

        const devices = await DeviceSession.findAll({ where: { userId } });
        if (devices.length >= 3) {
            return res.status(400).json({
                message: 'Maximum device limit (3) reached. Remove a device to add another.',
                maxDevices: 3,
                totalDevices: devices.length
            });
        }

        const existing = await DeviceSession.findOne({
            where: { userId, deviceId }
        });

        if (existing) {
            existing.lastSeenAt = new Date();
            await existing.save();
            return res.json({ message: 'Device already registered', deviceId: existing.id });
        }

        const device = await DeviceSession.create({
            userId,
            deviceId,
            deviceName: deviceInfo.userAgent.substring(0, 100),
            lastIp: deviceInfo.ip,
            lastUserAgent: deviceInfo.userAgent,
            isTrusted: true, // Registering from known location
            requiresVerification: false
        });

        res.json({
            message: 'Device registered',
            deviceId: device.id,
            deviceName: device.deviceName
        });
    } catch (err) {
        console.error('Device registration error:', err);
        res.status(500).json({ message: 'Error registering device' });
    }
});

module.exports = router;

/**
 * ========================================
 * MEMORY & DATABASE LEAK PREVENTION
 * ========================================
 * Periodically purge expired 6-digit TOTP sessions from the SQLite 
 * database so the table doesn't grow infinitely over months of uptime.
 * Runs every 1 hour (3600000 ms).
 */
setInterval(async () => {
    try {
        const deletedCount = await Session.destroy({
            where: {
                expiresAt: { [Op.lt]: new Date() }
            }
        });
        if (deletedCount > 0) {
            console.log(`[CLEANUP] Purged ${deletedCount} expired attendance sessions from the database.`);
        }
    } catch (e) {
        console.error('[CLEANUP Error] Failed to purge expired sessions:', e);
    }
}, 3600000);
