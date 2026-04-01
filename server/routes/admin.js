/**
 * ========================================
 * ADMIN API ROUTES
 * System management, timetable CRUD, bulk operations
 * ========================================
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { User, Class, Attendance, Session, Announcement, TimetableUploadLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const validator = require('validator');
const authMiddleware = require('../middleware/authMiddleware');
const uploadHandler = require('../utils/timetableUploadHandler');
const parser = require('../utils/timetableParser');

function rowSignature(row) {
    return [
        row.Course_Code || '',
        row.Course_Name || '',
        row.Day || '',
        row.From_Time || '',
        row.To_Time || '',
        row.Venue || '',
        row.Program || '',
        row.Year_Semester || ''
    ].join('|');
}

function rowIdentity(row) {
    return [row.Course_Code || '', row.Day || '', row.From_Time || ''].join('|');
}

// Configure multer for file uploads with security
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
    storage: multer.memoryStorage(), // Store in memory to avoid disk I/O
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow Excel and CSV files
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv',
            'text/plain',
            'application/csv',
            'application/octet-stream'
        ];
        
        const allowedExts = ['.xlsx', '.csv', '.txt', '.tsv'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExts.includes(ext) && (allowedMimes.includes(file.mimetype) || !file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: .xlsx, .csv, .txt, .tsv'), false);
        }
    }
});

// Require authentication for all admin routes
router.use(authMiddleware);

// Restrict access to Admins only
router.use((req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }
});

/**
 * GET /api/admin/timetable/template
 * Download a CSV template for non-technical admins.
 */
router.get('/timetable/template', async (req, res) => {
    const header = [
        'College',
        'Department',
        'Program',
        'Year_Semester',
        'Course_Code',
        'Course_Name',
        'Section',
        'Day',
        'From_Time',
        'To_Time',
        'Venue',
        'Lecturer',
        'LecturerId'
    ];

    const sample = [
        'CBMS',
        'Computing',
        'BSc Honours in Computer Science',
        'Y2 S1',
        'CSC2101',
        'Database Systems',
        'A',
        'Monday',
        '09:00',
        '10:30',
        'Lab B1',
        'Dr. Jane Doe',
        '210123'
    ];

    const csv = `${header.join(',')}\n${sample.join(',')}\n`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="timetable_template.csv"');
    return res.status(200).send(csv);
});

/**
 * POST /api/admin/timetable/preview
 * Parse and validate uploaded file without changing database.
 */
router.post('/timetable/preview', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const parsed = await parser.parseFile(req.file.buffer, req.file.originalname);
        const preview = parsed.data.slice(0, 20);
        const summary = parser.generateSummary(parsed.data);

        const [currentRows] = await sequelize.query(
            `SELECT Course_Code, Course_Name, Day, From_Time, To_Time, Venue, Program, Year_Semester
             FROM timetable`
        );

        const incomingRows = parsed.data.map((r) => ({
            Course_Code: r.Course_Code,
            Course_Name: r.Course_Name,
            Day: r.Day,
            From_Time: r.From_Time,
            To_Time: r.To_Time,
            Venue: r.Venue,
            Program: r.Program,
            Year_Semester: r.Year_Semester
        }));

        const currentSet = new Set(currentRows.map(rowSignature));
        const incomingSet = new Set(incomingRows.map(rowSignature));

        const added = incomingRows.filter((r) => !currentSet.has(rowSignature(r)));
        const removed = currentRows.filter((r) => !incomingSet.has(rowSignature(r)));

        const currentById = new Map(currentRows.map((r) => [rowIdentity(r), r]));
        const incomingById = new Map(incomingRows.map((r) => [rowIdentity(r), r]));
        const changed = [];
        for (const [id, nextRow] of incomingById.entries()) {
            const prevRow = currentById.get(id);
            if (!prevRow) continue;
            if (rowSignature(prevRow) !== rowSignature(nextRow)) {
                changed.push({
                    id,
                    before: prevRow,
                    after: nextRow
                });
            }
        }

        const diff = {
            currentRows: currentRows.length,
            incomingRows: incomingRows.length,
            toAdd: added.length,
            toRemove: removed.length,
            toChange: changed.length,
            samples: {
                add: added.slice(0, 5),
                remove: removed.slice(0, 5),
                change: changed.slice(0, 5)
            }
        };

        return res.json({
            success: parsed.errors.length === 0,
            errors: parsed.errors,
            summary,
            preview,
            totalRows: parsed.data.length,
            diff
        });
    } catch (err) {
        console.error('Timetable preview error:', err);
        return res.status(500).json({ success: false, message: 'Preview failed', errors: [err.message] });
    }
});

/**
 * GET /api/admin/timetable/upload-history
 * Returns recent upload operations for audit and rollback visibility.
 */
router.get('/timetable/upload-history', async (req, res) => {
    try {
        const logs = await TimetableUploadLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: 25
        });

        res.json({ logs });
    } catch (err) {
        console.error('Upload history error:', err);
        res.status(500).json({ message: 'Error fetching upload history' });
    }
});

/**
 * GET /api/admin/timetable/backups
 * List latest timetable backups available for rollback.
 */
router.get('/timetable/backups', async (req, res) => {
    try {
        const backups = await uploadHandler.listBackups(25);
        return res.json({ backups });
    } catch (err) {
        console.error('Backups list error:', err);
        return res.status(500).json({ message: 'Error fetching timetable backups' });
    }
});

/**
 * POST /api/admin/timetable/rollback/:backupId
 * Restore timetable from a backup snapshot.
 */
router.post('/timetable/rollback/:backupId', async (req, res) => {
    const backupId = validator.escape(validator.trim(req.params.backupId || ''));
    if (!backupId) {
        return res.status(400).json({ success: false, message: 'backupId is required' });
    }

    try {
        const restore = await uploadHandler.restoreBackup(backupId);
        await TimetableUploadLog.create({
            uploadedBy: req.user.id,
            filename: `ROLLBACK:${backupId}`,
            rowsInserted: restore.restoredRows || 0,
            resetAttendance: false,
            deletedAttendanceRecords: 0,
            status: 'success',
            errorSummary: null
        });

        return res.json({
            success: true,
            message: `Rollback completed from ${backupId}`,
            data: restore
        });
    } catch (err) {
        console.error('Rollback error:', err);
        await TimetableUploadLog.create({
            uploadedBy: req.user.id,
            filename: `ROLLBACK:${backupId}`,
            rowsInserted: 0,
            resetAttendance: false,
            deletedAttendanceRecords: 0,
            status: 'failed',
            errorSummary: err.message
        });
        return res.status(500).json({ success: false, message: 'Rollback failed', errors: [err.message] });
    }
});

/**
 * POST /api/admin/timetable/upload
 * Upload and replace entire timetable with new semester data
 * Supports Excel (.xlsx, .xls) and CSV (.csv, .txt) files
 * 
 * Query parameters:
 * - resetAttendance: 'true' to clear all attendance records (optional)
 * 
 * Returns: { success, message, data, errors, warnings }
 */
router.post('/timetable/upload', upload.single('file'), async (req, res) => {
    try {
        // Validate file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
                errors: ['A file is required for timetable upload']
            });
        }

        // Get options from query parameters
        const resetAttendance = req.query.resetAttendance === 'true';

        console.log(`[API] Timetable upload request: file=${req.file.originalname}, resetAttendance=${resetAttendance}, user=${req.user.id}`);

        // Process the upload
        const result = await uploadHandler.uploadTimetable(
            req.file.buffer,
            req.file.originalname,
            { resetAttendance }
        );

        await TimetableUploadLog.create({
            uploadedBy: req.user.id,
            filename: req.file.originalname,
            rowsInserted: result?.data?.rowsInserted || 0,
            resetAttendance,
            deletedAttendanceRecords: result?.data?.deletedAttendanceRecords || 0,
            status: result.success ? 'success' : 'failed',
            errorSummary: result.errors && result.errors.length ? result.errors.slice(0, 5).join(' | ') : null
        });

        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (err) {
        console.error('Timetable upload error:', err);
        if (req.file && req.user) {
            await TimetableUploadLog.create({
                uploadedBy: req.user.id,
                filename: req.file.originalname,
                status: 'failed',
                errorSummary: err.message,
                rowsInserted: 0,
                resetAttendance: req.query.resetAttendance === 'true',
                deletedAttendanceRecords: 0
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during timetable upload',
            errors: [err.message]
        });
    }
});

/**
 * GET /api/admin/timetable/upload-status
 * Check current timetable status and statistics
 */
router.get('/timetable/upload-status', async (req, res) => {
    try {
        const exists = await uploadHandler.validateTimetableExists();
        const stats = await uploadHandler.getTimetableStats();

        res.json({
            exists: exists.hasData,
            totalClasses: exists.rowCount,
            stats: stats || {}
        });
    } catch (err) {
        console.error('Error getting upload status:', err);
        res.status(500).json({ message: 'Error fetching upload status' });
    }
});

/**
 * GET /api/admin/stats
 * Full system overview for the admin dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        const totalStudents = await User.count({ where: { role: { [Op.in]: ['student', 'student_rep'] } } });
        const totalLecturers = await User.count({ where: { role: 'lecturer' } });
        const totalAdmins = await User.count({ where: { role: 'admin' } });
        const totalReps = await User.count({ where: { role: 'student_rep' } });
        const totalClasses = await Class.count();
        const totalAttendance = await Attendance.count();
        const activeSessions = await Session.count({ where: { expiresAt: { [Op.gt]: new Date() } } });
        const totalAnnouncements = await Announcement.count();

        res.json({
            totalStudents, totalLecturers, totalAdmins, totalReps,
            totalClasses, totalAttendance, activeSessions, totalAnnouncements
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ message: 'Error fetching admin stats' });
    }
});

/**
 * GET /api/admin/timetable
 * Full timetable listing with optional filters
 */
router.get('/timetable', async (req, res) => {
    try {
        const where = {};
        if (req.query.college) where.College = req.query.college;
        if (req.query.program) where.Program = req.query.program;
        if (req.query.year) where.Year_Semester = { [Op.like]: `Y${req.query.year}%` };
        if (req.query.day) where.Day = req.query.day;

        const classes = await Class.findAll({ where, order: [['Program', 'ASC'], ['Day', 'ASC'], ['From_Time', 'ASC']] });
        res.json({ classes });
    } catch (err) {
        console.error('Admin timetable error:', err);
        res.status(500).json({ message: 'Error fetching timetable' });
    }
});

/**
 * PUT /api/admin/timetable/:rowid
 * Update a timetable entry (change time, day, venue)
 * Used by both Admin and Student Rep
 */
router.put('/timetable/:rowid', async (req, res) => {
    try {
        const { Day, From_Time, To_Time, Venue } = req.body;
        const rowid = req.params.rowid;

        // Use raw query since Timetable model has no primary key
        const updates = [];
        const values = {};

        if (Day) { updates.push('Day = :Day'); values.Day = validator.escape(Day); }
        if (From_Time) { updates.push('From_Time = :From_Time'); values.From_Time = validator.escape(From_Time); }
        if (To_Time) { updates.push('To_Time = :To_Time'); values.To_Time = validator.escape(To_Time); }
        if (Venue) { updates.push('Venue = :Venue'); values.Venue = validator.escape(Venue); }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        values.rowid = rowid;
        await sequelize.query(
            `UPDATE timetable SET ${updates.join(', ')} WHERE rowid = :rowid`,
            { replacements: values }
        );

        console.log(`[TIMETABLE UPDATE] Row ${rowid} updated:`, values);
        res.json({ success: true, message: 'Timetable entry updated' });
    } catch (err) {
        console.error('Timetable update error:', err);
        res.status(500).json({ message: 'Error updating timetable' });
    }
});

/**
 * POST /api/admin/timetable
 * Add a new class to the timetable (Admin only)
 */
router.post('/timetable', async (req, res) => {
    try {
        let { College, Department, Program, Year_Semester, Course_Code, Course_Name, Section, Day, From_Time, To_Time, Venue, Lecturer, LecturerId } = req.body;

        if (!Course_Code || !Course_Name || !Day || !From_Time || !To_Time) {
            return res.status(400).json({ message: 'Course_Code, Course_Name, Day, From_Time, and To_Time are required' });
        }

        // Sanitize
        Course_Code = validator.escape(validator.trim(Course_Code));
        Course_Name = validator.escape(validator.trim(Course_Name));
        Day = validator.escape(validator.trim(Day));
        Venue = Venue ? validator.escape(validator.trim(Venue)) : 'TBD';

        await sequelize.query(
            `INSERT INTO timetable (College, Department, Program, Year_Semester, Course_Code, Course_Name, Section, Day, From_Time, To_Time, Venue, Lecturer, LecturerId)
             VALUES (:College, :Department, :Program, :Year_Semester, :Course_Code, :Course_Name, :Section, :Day, :From_Time, :To_Time, :Venue, :Lecturer, :LecturerId)`,
            {
                replacements: {
                    College: College || '', Department: Department || '', Program: Program || '',
                    Year_Semester: Year_Semester || '', Course_Code, Course_Name, Section: Section || '',
                    Day, From_Time, To_Time, Venue, Lecturer: Lecturer || '', LecturerId: LecturerId || ''
                }
            }
        );

        console.log(`[TIMETABLE ADD] New class: ${Course_Code} - ${Course_Name}`);
        res.status(201).json({ success: true, message: 'Class added to timetable' });
    } catch (err) {
        console.error('Timetable add error:', err);
        res.status(500).json({ message: 'Error adding class' });
    }
});

/**
 * DELETE /api/admin/timetable/:rowid
 * Remove a class from the timetable (Admin only)
 */
router.delete('/timetable/:rowid', async (req, res) => {
    try {
        await sequelize.query('DELETE FROM timetable WHERE rowid = :rowid', {
            replacements: { rowid: req.params.rowid }
        });
        console.log(`[TIMETABLE DELETE] Row ${req.params.rowid} deleted`);
        res.json({ success: true, message: 'Class removed from timetable' });
    } catch (err) {
        console.error('Timetable delete error:', err);
        res.status(500).json({ message: 'Error deleting class' });
    }
});

/**
 * POST /api/admin/create-user
 * Admin creates a new user directly
 */
router.post('/create-user', async (req, res) => {
    try {
        let { id, fullName, email, password, role, year, program, department, college } = req.body;

        if (!id || !fullName || !password || !role) {
            return res.status(400).json({ message: 'id, fullName, password, and role are required' });
        }

        fullName = validator.escape(validator.trim(fullName));
        email = email ? (validator.normalizeEmail(validator.trim(email)) || email) : `${id}@au.ac.zw`;

        const existing = await User.findByPk(id);
        if (existing) return res.status(400).json({ message: 'User with this ID already exists' });

        const newUser = await User.create({
            id, fullName, email, password, role,
            year: year || null, program: program || null,
            department: department || null, college: college || null
        });

        console.log(`[ADMIN CREATE USER] ${newUser.id} - ${newUser.fullName} (${newUser.role})`);
        res.status(201).json({ success: true, user: { id: newUser.id, fullName: newUser.fullName, role: newUser.role } });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ message: 'Error creating user' });
    }
});
/**
 * PUT /api/admin/timetable/update-by-match
 * Update a timetable entry by matching Course_Code + old Day + old From_Time
 * Used by Student Rep Console (no rowid available on frontend)
 */
router.put('/timetable/update-by-match', async (req, res) => {
    try {
        const { Course_Code, oldDay, oldFrom, Day, From_Time, To_Time, Venue } = req.body;

        if (!Course_Code || !oldDay || !oldFrom) {
            return res.status(400).json({ message: 'Course_Code, oldDay, and oldFrom are required' });
        }

        const updates = [];
        const values = { Course_Code, oldDay, oldFrom };

        if (Day) { updates.push('Day = :Day'); values.Day = validator.escape(Day); }
        if (From_Time) { updates.push('From_Time = :From_Time'); values.From_Time = validator.escape(From_Time); }
        if (To_Time) { updates.push('To_Time = :To_Time'); values.To_Time = validator.escape(To_Time); }
        if (Venue) { updates.push('Venue = :Venue'); values.Venue = validator.escape(Venue); }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }

        await sequelize.query(
            `UPDATE timetable SET ${updates.join(', ')} WHERE Course_Code = :Course_Code AND Day = :oldDay AND From_Time = :oldFrom`,
            { replacements: values }
        );

        console.log(`[TIMETABLE UPDATE BY MATCH] ${Course_Code} ${oldDay} ${oldFrom} -> updated`);
        res.json({ success: true, message: 'Timetable entry updated' });
    } catch (err) {
        console.error('Timetable update-by-match error:', err);
        res.status(500).json({ message: 'Error updating timetable' });
    }
});

router.use((err, req, res, next) => {
    if (err && err.name === 'MulterError') {
        return res.status(400).json({ success: false, message: 'Upload validation failed', errors: [err.message] });
    }
    if (err && err.message && err.message.toLowerCase().includes('file type')) {
        return res.status(400).json({ success: false, message: 'Invalid upload file', errors: [err.message] });
    }
    return next(err);
});

module.exports = router;
