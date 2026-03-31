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
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

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
        const { lecturerName, courseCode, courseName, program, year, type, message, lecturerId, authorId, authorName } = req.body;

        if (!message || !courseCode) {
            return res.status(400).json({ message: 'courseCode and message are required' });
        }

        const finalAuthorId = authorId || lecturerId || 'unknown';
        const finalAuthorName = authorName || lecturerName || 'Lecturer / Rep';

        const announcement = await Announcement.create({
            lecturerId: finalAuthorId,
            lecturerName: finalAuthorName,
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
 * GET /api/announcements/by-courses?codes=NCSC211,NCSC312&excludeAuthor=210101
 * Fetch announcements for specific course codes (for lecturer to see rep announcements)
 */
router.get('/by-courses', async (req, res) => {
    try {
        const { codes, excludeAuthor } = req.query;
        if (!codes) return res.json({ announcements: [] });

        const codeList = codes.split(',').map(c => c.trim()).filter(Boolean);
        if (codeList.length === 0) return res.json({ announcements: [] });

        const where = {
            courseCode: { [Op.in]: codeList }
        };

        // Exclude the lecturer's own announcements so they only see rep/other posts
        if (excludeAuthor) {
            where.lecturerId = { [Op.ne]: excludeAuthor };
        }

        const announcements = await Announcement.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        res.json({ announcements });
    } catch (err) {
        console.error("Error fetching announcements by courses:", err);
        res.status(500).json({ message: 'Failed to fetch announcements' });
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
