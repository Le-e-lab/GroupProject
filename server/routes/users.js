/**
 * ========================================
 * USERS API ROUTES
 * Handles user listing and role management
 * ========================================
 */
const express = require('express');
const router = express.Router();
const { User, Class } = require('../models');
const { Op } = require('sequelize');
const validator = require('validator');
const authMiddleware = require('../middleware/authMiddleware');

function isAdmin(req) {
    return req.user && req.user.role === 'admin';
}

function isLecturer(req) {
    return req.user && req.user.role === 'lecturer';
}

function normalizeLanguage(input) {
    const short = String(input || '').trim().toLowerCase().slice(0, 2);
    return ['en', 'fr', 'pt'].includes(short) ? short : null;
}

// Protect all user routes
router.use(authMiddleware);

router.get('/me', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'fullName', 'email', 'role', 'year', 'program', 'department', 'college', 'language']
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        console.error('Error fetching current user:', err);
        res.status(500).json({ message: 'Error fetching current user' });
    }
});

router.put('/me/language', async (req, res) => {
    try {
        const language = normalizeLanguage(req.body && req.body.language);
        if (!language) {
            return res.status(400).json({ message: 'Invalid language. Supported: en, fr, pt' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await user.update({ language });
        return res.json({ success: true, message: 'Language preference saved', language });
    } catch (err) {
        console.error('Error updating language:', err);
        res.status(500).json({ message: 'Error updating language' });
    }
});

/**
 * GET /api/users/stats/overview
 * System-wide statistics for admin dashboard
 * NOTE: Must be defined BEFORE /:id to avoid being caught by the param route
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const totalStudents = await User.count({ where: { role: { [Op.in]: ['student', 'student_rep'] } } });
        const totalLecturers = await User.count({ where: { role: 'lecturer' } });
        const totalAdmins = await User.count({ where: { role: 'admin' } });
        const totalReps = await User.count({ where: { role: 'student_rep' } });
        const totalClasses = await Class.count();

        res.json({ totalStudents, totalLecturers, totalAdmins, totalReps, totalClasses });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

/**
 * GET /api/users
 * List users with optional filters: ?role=student&program=NCSC&year=2
 */
router.get('/', async (req, res) => {
    try {
        const where = {};
        if (req.query.role) {
            if (req.query.role === 'student') {
                where.role = { [Op.in]: ['student', 'student_rep'] };
            } else {
                where.role = req.query.role;
            }
        }
        if (req.query.program) where.program = req.query.program;
        if (req.query.year) where.year = parseInt(req.query.year);

        // Handle specific Course Code filter
        if (req.query.courseCode) {
            const courseRows = await Class.findAll({ where: { Course_Code: req.query.courseCode } });
            if (courseRows.length > 0) {
                // Broaden to catch related programs
                const courseConditions = courseRows.map(courseRow => {
                    const yearMatch = courseRow.Year_Semester && courseRow.Year_Semester.match(/Y(\d)/i);
                    const condition = { year: yearMatch ? parseInt(yearMatch[1]) : 0 };
                    if (courseRow.Department) condition.department = { [Op.like]: `${courseRow.Department}%` };
                    if (courseRow.Program) condition.program = { [Op.like]: `${courseRow.Program}%` };
                    return condition;
                });
                
                const courseWhere = { [Op.or]: courseConditions };
                
                if (Object.keys(where).length > 0) {
                    const existing = { ...where };
                    ['program', 'department', 'college', 'year', 'role'].forEach(k => delete where[k]);
                    where[Op.and] = [existing, courseWhere];
                } else {
                    Object.assign(where, courseWhere);
                }
            } else {
                where.id = 'INVALID_COURSE';
            }
        }

        if (req.query.lecturerId) {
            const lecturerUser = await User.findByPk(req.query.lecturerId);
            if (lecturerUser) {
                const taughtClasses = await Class.findAll({
                    where: {
                        [Op.or]: [
                            { LecturerId: req.query.lecturerId },
                            { Lecturer: { [Op.like]: `%${lecturerUser.fullName.split(' ').pop()}%` } }
                        ]
                    }
                });

                if (taughtClasses.length > 0) {
                    const codes = taughtClasses.map(c => c.Course_Code).filter(Boolean);
                    
                    // Build conditions based on Department/Program + Year pairs from classes
                    const cohorts = taughtClasses.map(c => {
                        const yearMatch = c.Year_Semester && c.Year_Semester.match(/Y(\d)/i);
                        return {
                            department: c.Department,
                            program: c.Program,
                            year: yearMatch ? parseInt(yearMatch[1]) : null
                        };
                    }).filter(c => (c.department || c.program) && c.year);

                    // De-duplicate cohorts
                    const uniqueCohorts = Array.from(new Set(cohorts.map(JSON.stringify))).map(JSON.parse);

                    const cohortConditions = uniqueCohorts.map(c => {
                        const cond = { year: c.year };
                        if (c.department) cond.department = { [Op.like]: `${c.department}%` };
                        if (c.program) cond.program = { [Op.like]: `${c.program}%` };
                        return cond;
                    });

                    // Include students with attendance
                    const { Attendance } = require('../models');
                    const studentIdsWithAttendance = await Attendance.findAll({
                        where: { classId: { [Op.in]: codes } },
                        attributes: ['userId']
                    }).then(res => [...new Set(res.map(a => a.userId))]);

                    const lecturerWhere = {
                        [Op.or]: [
                            ...cohortConditions,
                            { id: { [Op.in]: studentIdsWithAttendance } }
                        ]
                    };

                    if (Object.keys(where).length > 0) {
                        const existing = { ...where };
                        if (where[Op.and]) {
                            where[Op.and].push(lecturerWhere);
                        } else {
                            Object.keys(existing).forEach(k => delete where[k]);
                            where[Op.and] = [existing, lecturerWhere];
                        }
                    } else {
                        Object.assign(where, lecturerWhere);
                    }
                } else {
                    where.id = 'NO_CLASSES_FOUND';
                }
            }
        }

        // Add Search functionality (Server-side)
        if (req.query.search) {
            const searchVal = `%${req.query.search}%`;
            const searchWhere = {
                [Op.or]: [
                    { fullName: { [Op.like]: searchVal } },
                    { id: { [Op.like]: searchVal } }
                ]
            };

            if (where[Op.and]) {
                where[Op.and].push(searchWhere);
            } else if (Object.keys(where).length > 0) {
                const existing = { ...where };
                Object.keys(existing).forEach(k => delete where[k]);
                where[Op.and] = [existing, searchWhere];
            } else {
                Object.assign(where, searchWhere);
            }
        }

        const users = await User.findAll({
            where,
            attributes: ['id', 'fullName', 'email', 'role', 'year', 'program', 'department', 'college', 'language'],
            order: [['fullName', 'ASC']]
        });

        res.json({ users });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

/**
 * GET /api/users/:id
 * Get a single user by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: ['id', 'fullName', 'email', 'role', 'year', 'program', 'department', 'college', 'language']
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ message: 'Error fetching user' });
    }
});

/**
 * PUT /api/users/:id/role
 * Change a user's role (e.g., promote student to student_rep)
 * Body: { role: 'student_rep' }
 * Allowed by: lecturer (can only set student_rep), admin (can set any role)
 */
router.put('/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ['student', 'student_rep', 'lecturer', 'admin'];

        if (!isAdmin(req) && !isLecturer(req)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (isLecturer(req) && role !== 'student_rep') {
            return res.status(403).json({ message: 'Lecturers can only assign student_rep role' });
        }

        if (isLecturer(req) && req.params.id === req.user.id) {
            return res.status(403).json({ message: 'Lecturers cannot update their own role' });
        }

        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be one of: ' + validRoles.join(', ') });
        }

        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Update the role directly (bypassing ENUM by using raw update for SQLite compatibility)
        await user.update({ role });

        console.log(`[ROLE CHANGE] User ${user.id} (${user.fullName}) role changed to: ${role}`);
        res.json({ success: true, message: `Role updated to ${role}`, user: { id: user.id, fullName: user.fullName, role: user.role } });
    } catch (err) {
        console.error('Error updating role:', err);
        res.status(500).json({ message: 'Error updating role' });
    }
});

/**
 * DELETE /api/users/:id
 * Delete a user (Admin only in production)
 */
router.delete('/:id', async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        if (req.params.id === req.user.id) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await user.destroy();
        console.log(`[USER DELETED] ${user.id} (${user.fullName})`);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Error deleting user' });
    }
});

module.exports = router;
