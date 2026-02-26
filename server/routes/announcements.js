/**
 * ========================================
 * ANNOUNCEMENTS ROUTES
 * ========================================
 * Handles lecturer-to-student notifications.
 * Stored in SQLite database via the Announcement model.
 */

const express = require('express');
const router = express.Router();
const { Announcement } = require('../models');
const { Op } = require('sequelize');
const validator = require('validator');

/**
 * ========================================
 * DATABASE STORAGE OPTIMIZATION
 * ========================================
 * Automatically delete announcements older than 7 days off the database
 * Runs every 24 hours.
 */
setInterval(async () => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const deletedCount = await Announcement.destroy({
            where: {
                timestamp: { [Op.lt]: sevenDaysAgo }
            }
        });
        if (deletedCount > 0) {
            console.log(`[CLEANUP] Purged ${deletedCount} old announcements from the database (Storage limit).`);
        }
    } catch (e) {
        console.error('[CLEANUP Error] Failed to purge old announcements:', e);
    }
}, 24 * 60 * 60 * 1000);

/**
 * POST /api/announcements
 * Lecturer posts a notification to a class.
 * Body: { lecturerId, lecturerName, courseCode, courseName, program, year, type, message }
 */
router.post('/', async (req, res) => {
    try {
        const { lecturerName, courseCode, courseName, program, year, type, message, lecturerId } = req.body;

        if (!message || !courseCode) {
            return res.status(400).json({ message: 'courseCode and message are required' });
        }

        const announcement = await Announcement.create({
            lecturerId: lecturerId || 'unknown',
            lecturerName: lecturerName || 'Lecturer',
            courseCode,
            courseName: courseName || courseCode,
            program: program || null,
            year: year || null,
            type: type || 'info', 
            message: validator.escape(message) // Sanitize input to prevent XSS
        });

        console.log(`[ANNOUNCEMENT DB] ${announcement.type.toUpperCase()} by ${lecturerName}: ${message}`);
        res.status(201).json({ success: true, announcement });
    } catch (err) {
        console.error("Error creating announcement:", err);
        res.status(500).json({ message: 'Failed to create announcement' });
    }
});

/**
 * GET /api/announcements
 * Fetch announcements for a specific student (filtered by program + year).
 */
router.get('/', async (req, res) => {
    try {
        const { program, year } = req.query;
        
        // Fetch all announcements, ordered newest first
        const allAnnouncements = await Announcement.findAll({
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        const studentYear = year ? parseInt(year) : null;

        const filtered = allAnnouncements.filter(a => {
            const programMatch = !a.program || !program || a.program === program;
            const yearMatch = !a.year || !studentYear || parseInt(a.year) === studentYear;
            return programMatch && yearMatch;
        });

        res.json({ announcements: filtered.slice(0, 10) });
    } catch (err) {
        console.error("Error fetching announcements:", err);
        res.status(500).json({ message: 'Failed to fetch announcements' });
    }
});

/**
 * DELETE /api/announcements/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await Announcement.destroy({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete announcement' });
    }
});

module.exports = router;
