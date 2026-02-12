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
const { Attendance, Session, Class, User, sequelize } = require('../models');
const { TOTP, NobleCryptoPlugin, ScureBase32Plugin } = require('otplib');
const { Op } = require('sequelize');

// Create a new TOTP instance (30s step, window 1)
// Manual TOTP Implementation (HMAC-SHA1)
// We use otplib components just for base32 decoding
const crypto = require('crypto');
const base32 = new ScureBase32Plugin();

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

/**
 * POST /api/attendance/generate-code
 * Lecturer generates a code for a class session
 */
router.post('/generate-code', async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) return res.status(400).json({ message: 'Class ID required' });

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
router.post('/validate-code', async (req, res) => {
    try {
        const { classId, studentId, code, userLat, userLon } = req.body;
        
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
            const myRecords = attendance.filter(a => a.classId && a.classId.startsWith(courseCode));
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
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const attendance = await Attendance.findAll({
            where: {
                userId: id, // FIX: Changed from studentId to userId
                date: { [Op.gte]: startOfDay }
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
                classId: { [Op.like]: `${courseId}%` }
            }
        });

        // 3. Get Unique Students
        const uniqueStudents = await Attendance.findAll({
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('userId')), 'userId']
            ],
            where: {
                classId: { [Op.like]: `${courseId}%` }
            }
        });
        
        const activeStudents = uniqueStudents.length || 25; // Default if no data
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
router.post('/bulk-mark', async (req, res) => {
    try {
        const { classId, students, date } = req.body;
        
        if (!students || !Array.isArray(students)) return res.status(400).json({ message: 'Invalid students' });

        // Filter out already marked for today to prevent dupes? 
        // For now, simple insert.
        const records = students.map(sId => ({
            classId,
            userId: sId,  // FIX: Changed from studentId to userId
            status: 'present',
            date: date || new Date().toISOString().split('T')[0]
        }));

        await Attendance.bulkCreate(records);
        res.json({ message: 'Bulk attendance saved' });

    } catch (err) {
        console.error("Bulk Mark Error:", err);
        res.status(500).json({ message: 'Error saving bulk attendance: ' + err.message });
    }
});
/**
 * GET /api/attendance/students/:courseCode
 * Get all students for a course with their attendance stats
 */
router.get('/students/:courseCode', async (req, res) => {
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
            attributes: ['Program']
        });
        const programs = [...new Set(allClassEntries.map(c => c.Program).filter(Boolean))];
        
        // Get students from ALL programs that take this course
        const students = await User.findAll({
            where: {
                role: 'student',
                program: { [Op.in]: programs },
                year: year
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
                    classId: { [Op.like]: `${courseCode}%` }
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

module.exports = router;
