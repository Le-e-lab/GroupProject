/**
 * ========================================
 * ADMIN API ROUTES
 * System management, timetable CRUD, bulk operations
 * ========================================
 */
const express = require('express');
const router = express.Router();
const { User, Class, Attendance, Session, Announcement, sequelize } = require('../models');
const { Op } = require('sequelize');
const validator = require('validator');
const authMiddleware = require('../middleware/authMiddleware');

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

module.exports = router;
