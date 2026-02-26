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
        if (req.query.role) where.role = req.query.role;
        if (req.query.program) where.program = req.query.program;
        if (req.query.year) where.year = parseInt(req.query.year);

        if (req.query.lecturerId) {
            const lecturerUser = await User.findByPk(req.query.lecturerId);
            if (lecturerUser) {
                // 1. Find all Course Codes taught by this lecturer
                const taughtClasses = await Class.findAll({
                    where: {
                        [Op.or]: [
                            { LecturerId: req.query.lecturerId },
                            { Lecturer: { [Op.like]: `%${lecturerUser.fullName}%` } }
                        ]
                    },
                    attributes: ['Course_Code']
                });

                if (taughtClasses.length > 0) {
                    const courseCodes = [...new Set(taughtClasses.map(c => c.Course_Code).filter(Boolean))];
                    
                    // 2. Find ALL (Program, Year) pairs for these Course Codes
                    const cohorts = await Class.findAll({
                        where: { Course_Code: { [Op.in]: courseCodes } },
                        attributes: ['Program', 'Year_Semester']
                    });

                    // 3. Build the OR conditions for students
                    const cohortConditions = cohorts.map(c => {
                        const yearMatch = c.Year_Semester && c.Year_Semester.match(/Y(\d)/i);
                        // USE FUZZY MATCHING for program to handle truncation
                        const cond = { program: { [Op.like]: `${c.Program || ''}%` } };
                        if (yearMatch) cond.year = parseInt(yearMatch[1]);
                        return cond;
                    }).filter(cond => cond.program);

                    if (cohortConditions.length > 0) {
                        // Apply these to the 'where' object
                        // If user specifically requested a program/year, Sequelize will intersect them if we use Op.and
                        if (Object.keys(where).length > 0) {
                            const existingWhere = { ...where };
                            // Clear them from top level so we can wrap them
                            delete where.program;
                            delete where.year;
                            delete where.role;
                            
                            where[Op.and] = [
                                existingWhere,
                                { [Op.or]: cohortConditions }
                            ];
                        } else {
                            where[Op.or] = cohortConditions;
                        }
                    }
                } else {
                    where.id = 'NO_CLASSES_FOUND';
                }
            }
        }

        const users = await User.findAll({
            where,
            attributes: ['id', 'fullName', 'email', 'role', 'year', 'program', 'department', 'college'],
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
            attributes: ['id', 'fullName', 'email', 'role', 'year', 'program', 'department', 'college']
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
