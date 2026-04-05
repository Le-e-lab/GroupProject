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
const { Attendance, Session, Class, User, DeviceSession, BiometricVerification, sequelize } = require('../models');
const { TOTP, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const { Op } = require('sequelize');
const validator = require('validator');
const authMiddleware = require('../middleware/authMiddleware');
const { attendanceAttemptLimiter } = require('../middleware/rateLimiters');
const { verifyWithProvider, getProviderConfig } = require('../utils/identityVerification');

const canManageAttendanceRoles = new Set(['lecturer', 'admin']);
const canViewClassAttendanceRoles = new Set(['lecturer', 'admin', 'student_rep']);

function hasRole(req, rolesSet) {
    return req.user && rolesSet.has(req.user.role);
}

function requireRoles(rolesSet) {
    return (req, res, next) => {
        if (!hasRole(req, rolesSet)) {
            return res.status(403).json({ message: 'Forbidden' });
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

function studentEligibleForClass(student, classRow) {
    if (!student || !classRow) {
        return { ok: false, reason: 'Class or student record missing' };
    }

    const studentProgram = String(student.program || '').trim().toLowerCase();
    const classProgram = String(classRow.Program || '').trim().toLowerCase();
    if (!studentProgram || !classProgram) {
        return { ok: false, reason: 'Student or class program is not configured' };
    }

    const programMatch = studentProgram.startsWith(classProgram) || classProgram.startsWith(studentProgram);
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
        
        res.json({ code: token, timeLeft: timeLeft * 1000 });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error generating code' });
    }
});

/**
 * POST /api/attendance/validate-code
 * Student submits code to mark attendance
 */
router.post('/validate-code', attendanceAttemptLimiter, async (req, res) => {
    try {
        let { classId, studentId, code, userLat, userLon } = req.body;
        
        // Sanitize the inputs
        if (classId) classId = validator.escape(validator.trim(classId));
        if (studentId) studentId = validator.escape(validator.trim(studentId));
        if (code) code = validator.escape(validator.trim(String(code)));

        if (!studentId) {
            return res.status(400).json({ message: 'Student ID required' });
        }

        const isPrivileged = hasRole(req, canManageAttendanceRoles);
        if (!isPrivileged && String(req.user.id) !== String(studentId)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        // Find active session
        const session = await Session.findOne({
            where: {
                classId,
                expiresAt: { [Op.gt]: new Date() }
            }
        });

        if (!session) {
            return res.status(400).json({ message: 'No active attendance session for this class' });
        }

        // Verify OTP
        const isValid = verifyTOTP(code, session.secret);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid or expired code' });
        }

        // --- SECURITY LOGIC (Geo/IP) can be re-enabled here if needed ---
        
        // Mark Attendance
        const existing = await Attendance.findOne({
            where: {
                classId,
                userId: studentId,  // FIX: Column is userId, not studentId
                date: {
                    [Op.gte]: new Date(new Date().setHours(0,0,0,0)) // Today
                }
            }
        });

        if (existing) {
            return res.json({ message: 'Attendance already marked' });
        }

        await Attendance.create({
            id: Date.now().toString(),
            classId,
            userId: studentId,  // FIX: Column is userId, not studentId
            status: 'present',
            date: new Date().toISOString().split('T')[0]
        });

        res.json({ message: 'Attendance marked successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error validating code' });
    }
});

/**
 * GET /api/attendance/student/:id
 * Stats for a student
 */
router.get('/student/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!canAccessStudentData(req, id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        
        // 1. Fetch Student
        const student = await User.findByPk(id);
        if (!student) return res.status(404).json({ message: 'Student not found' });

        // 2. Fetch User's Classes - STRICT exact program match
        const whereClause = {};
        if (student.program) {
             // STRICT: Exact program match only (no fuzzy like)
             whereClause.Program = student.program;
        }
        
        const year = student.year || (student.id.startsWith('25') ? 1 : 2);
        whereClause.Year_Semester = { 
             [Op.or]: [
                 { [Op.like]: `Y${year}%` },
                 { [Op.like]: '%All%' }
             ]
        };

        const allClasses = await Class.findAll({ where: whereClause });
        const attendance = await Attendance.findAll({ where: { userId: id } });

        const stats = [];
        const seenCourses = new Set(); // Track unique courses
        
        for (const classObj of allClasses) {
            const courseCode = classObj.Course_Code;
            
            // DEDUP: Skip if we've already processed this course
            if (seenCourses.has(courseCode)) continue;
            seenCourses.add(courseCode);
            
            // Match logic: Did they attend this course? (by course code prefix)
            const myRecords = attendance.filter((a) => a.classId && a.classId.startsWith(courseCode) && isFinalizedAttendance(a));
            const attendedCount = myRecords.length;
            
            // Total Sessions (Estimate from unique dates in Attendance DB or Default)
            const allClassRecords = await Attendance.findAll({
                attributes: ['date'],
                where: { classId: { [Op.like]: `${courseCode}%` } }
            });
            const uniqueDates = new Set(allClassRecords.map(r => new Date(r.date).toDateString()));
            let totalSessions = uniqueDates.size;
            if (totalSessions < 12) totalSessions = 12; // Baseline for demo

            stats.push({
                courseCode: classObj.Course_Code,
                name: classObj.Course_Name,
                attended: attendedCount,
                total: totalSessions
            });
        }

        res.json({ stats });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching stats' });
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
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const attendance = await Attendance.findAll({
            where: {
                userId: id, // FIX: Changed from studentId to userId
                date: { [Op.gte]: startOfDay },
                status: 'present'
            },
            attributes: ['classId']
        });

        res.json({ presentClassIds: attendance.map(a => a.classId) });

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
        const { classId, students, date } = req.body;
        
        if (!students || !Array.isArray(students)) return res.status(400).json({ message: 'Invalid students' });

        // Filter out already marked for today to prevent dupes? 
        // For now, simple insert.
        const nowIso = new Date().toISOString();
        const records = students.map(sId => ({
            classId,
            userId: sId,  // FIX: Changed from studentId to userId
            status: 'present',
            date: date || new Date().toISOString().split('T')[0],
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
            attributes: ['Program', 'Year_Semester']
        });
        
        const cohorts = allClassEntries.map(c => {
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
        const allRecords = await Attendance.findAll({
            where: { classId: { [Op.like]: `${courseCode}%` } }
        });
        
        const uniqueDates = new Set(allRecords.map(r => new Date(r.date).toDateString()));
        const totalSessions = Math.max(uniqueDates.size, 6); // Minimum 6 for mid-semester
        
        // For each student, get their attendance count
        const result = await Promise.all(students.map(async (s) => {
            const attended = await Attendance.count({
                where: {
                    userId: s.id,
                    classId: { [Op.like]: `${courseCode}%` },
                    status: 'present'
                }
            });
            
            const pct = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
            
            // Risk categorization
            let status = 'good';
            if (attended === 0) status = 'danger';
            else if (pct < 50) status = 'risk';
            else if (pct < 75) status = 'warning';
            
            return {
                id: s.id,
                fullName: s.fullName,
                program: s.program,
                year: s.year,
                attended,
                total: totalSessions,
                percentage: pct,
                status
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
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const records = await Attendance.findAll({
            where: {
                classId: { [Op.like]: `${courseCode}%` },
                date: { [Op.gte]: startOfDay },
                status: 'present'
            },
            attributes: ['userId', 'method', 'date']
        });

        // Deduplicate by userId
        const checkedIn = {};
        records.forEach(r => {
            if (!checkedIn[r.userId]) {
                checkedIn[r.userId] = { userId: r.userId, method: r.method };
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
                date: { [Op.gte]: today }
            },
            order: [['date', 'ASC'], ['userId', 'ASC']]
        });

        const studentMap = new Map(students.map((student) => [String(student.id), student]));
        const rows = ['Date,CourseCode,CourseName,StudentId,FullName,Program,Year,Method,CheckInTime,CheckOutTime,Completion'];

        for (const record of records) {
            const student = studentMap.get(String(record.userId));
            if (!student) continue;

            const safeName = `"${String(student.fullName || '').replace(/"/g, '""')}"`;
            const safeProgram = `"${String(student.program || '').replace(/"/g, '""')}"`;
            const checkInTime = record.checkedInAt ? new Date(record.checkedInAt).toISOString() : '';
            const checkOutTime = record.checkedOutAt ? new Date(record.checkedOutAt).toISOString() : '';
            const completion = isAttendanceComplete(record) ? 'complete' : 'incomplete';
            rows.push([
                record.date,
                courseCode,
                `"${String(courseName).replace(/"/g, '""')}"`,
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

        const todayStamp = new Date().toISOString().slice(0, 10);
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
router.post('/checkin', requireRoles(canManageAttendanceRoles), async (req, res) => {
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
router.post('/checkout', requireRoles(canManageAttendanceRoles), async (req, res) => {
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

        // Generate check-out secret
        const checkOutSecret = generateSecret();
        session.status = 'checkout_open';
        session.checkOutTime = new Date();
        session.checkOutSecret = checkOutSecret;
        await session.save();

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
router.post('/close', requireRoles(canManageAttendanceRoles), async (req, res) => {
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

        session.status = 'closed';
        session.expiresAt = new Date();
        await session.save();

        return res.json({ message: 'Session closed', classId, sessionId: session.id });
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

        const isPrivileged = hasRole(req, canManageAttendanceRoles);
        if (!isPrivileged && String(req.user.id) !== String(studentId)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Find session
        const session = await Session.findOne({
            where: { classId, expiresAt: { [Op.gt]: new Date() } }
        });

        if (!session || session.status !== 'checkin_open') {
            return res.status(400).json({ message: 'Check-in is not currently open' });
        }

        const classRow = await findClassForSession(classId);
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const student = await User.findByPk(studentId);
        if (!student || !['student', 'student_rep'].includes(student.role)) {
            return res.status(404).json({ message: 'Student not found' });
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
                classId,
                userId: studentId,
                date: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) }
            }
        });

        let attendance;
        if (existing) {
            if (isAttendanceComplete(existing)) {
                return res.json({
                    message: 'Attendance already completed for this class',
                    attendanceId: existing.id,
                    requiresVerification: false,
                    nextStep: 'done'
                });
            }
            existing.checkedInAt = existing.checkedInAt || new Date();
            existing.method = existing.method || 'checkin_checkout';
            existing.status = existing.status === 'present' ? 'present' : 'absent';
            await existing.save();
            attendance = existing;
        } else {
            attendance = await Attendance.create({
                classId,
                userId: studentId,
                date: new Date().toISOString().split('T')[0],
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
            nextStep: requiresVerification ? 'verify_identity' : 'await_checkout'
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

        const isPrivileged = hasRole(req, canManageAttendanceRoles);
        if (!isPrivileged && String(req.user.id) !== String(studentId)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Find session
        const session = await Session.findOne({
            where: { classId, expiresAt: { [Op.gt]: new Date() } }
        });

        if (!session || session.status !== 'checkout_open') {
            return res.status(400).json({ message: 'Check-out is not currently open' });
        }

        const classRow = await findClassForSession(classId);
        if (!classRow) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const student = await User.findByPk(studentId);
        if (!student || !['student', 'student_rep'].includes(student.role)) {
            return res.status(404).json({ message: 'Student not found' });
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
            return res.status(403).json({ message: 'Device not recognized. Complete identity verification before check-out.' });
        }

        if (!device.isTrusted || device.requiresVerification) {
            return res.status(403).json({
                message: 'Identity verification required before check-out.',
                requiresVerification: true,
                nextStep: 'verify_identity'
            });
        }

        // Update or create attendance
        let attendance = attendanceId ? 
            await Attendance.findByPk(attendanceId) : 
            await Attendance.findOne({
                where: { classId, userId: studentId, date: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } }
            });

        if (!attendance) {
            return res.status(400).json({
                message: 'Check-in record not found. Ask lecturer for manual attendance if needed.'
            });
        }

        if (!attendance.checkedInAt) {
            return res.status(400).json({
                message: 'You must check in before checking out.'
            });
        }

        // Mark checked out and finalize attendance
        attendance.checkedOutAt = new Date();
        attendance.status = 'present';
        attendance.method = attendance.method || 'checkin_checkout';
        await attendance.save();

        res.json({
            message: 'Attendance successfully recorded',
            attendanceId: attendance.id,
            checkedInAt: attendance.checkedInAt,
            checkedOutAt: attendance.checkedOutAt
        });
    } catch (err) {
        console.error('Check-out validation error:', err);
        res.status(500).json({ message: 'Error validating check-out' });
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
