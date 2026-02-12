const express = require('express');
const router = express.Router();
const { Class, User } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/classes
 * Retrieve all available classes
 */
router.get('/', async (req, res) => {
    try {
        const { year, program, day } = req.query; // Added 'day' to destructuring
        
        const whereClause = {};

        
        // If a program is provided, apply STRICT filtering (exact match)
        if (program) {
             // STRICT: Exact program match only (no fuzzy like)
             whereClause.Program = program;
        }
        
        if (year) {
            // DB has "Year_Semester" e.g. "Y1 S2" or "All Years"
            whereClause.Year_Semester = { 
                [Op.or]: [
                    { [Op.like]: `Y${year}%` }, // Specific Year
                    { [Op.like]: '%All%' }      // Shared across years
                ]
            };
        }

        if (day) {
            whereClause.Day = day;
        }

        const classes = await Class.findAll({ where: whereClause });
        
        // CRITICAL FIX: Filter to only valid weekdays (DB has corrupted Day values)
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const validClasses = classes.filter(c => validDays.includes(c.Day));
        
        console.log(`[Classes API] Fetched ${classes.length} total, ${validClasses.length} with valid days`);
        
        // Transform to Frontend Format
        const formatted = validClasses.map(c => ({
            id: `${c.Course_Code}-${c.Day}-${c.From_Time}`, // Composite ID
            code: c.Course_Code,
            name: c.Course_Name,
            year: parseInt(c.Year_Semester?.substring(1,2)) || 1,
            day: c.Day,
            time: `${c.From_Time} - ${c.To_Time}`,
            room: c.Venue,
            lecturerName: c.Lecturer,
            program: c.Program,
            college: c.College
        }));

        res.json(formatted);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /api/classes/lecturer/:id
 * Retrieve classes assigned to a specific lecturer
 */
router.get('/lecturer/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Get Lecturer Name from User Table
        const lecturerUser = await User.findByPk(id);
        if (!lecturerUser) {
             return res.status(404).json({ message: 'Lecturer not found' });
        }
        
        console.log(`Fetching classes for lecturer: ${lecturerUser.fullName} (${id})`);

        // Search by LecturerId (Robust) OR fallback to Fuzzy Name (Legacy support)
        const classes = await Class.findAll({
            where: {
                [Op.or]: [
                    { LecturerId: id },
                    { Lecturer: { [Op.like]: `%${lecturerUser.fullName}%` } }, // Full name match
                    // Try matching just the surname if full name fails (e.g. "Mr. Makambwa" vs "B. Makambwa")
                    { Lecturer: { [Op.like]: `%${lecturerUser.fullName.split(' ').pop()}%` } } 
                ]
            }
        });
        
        // Deduplicate: The OR query can return the same row multiple times
        // if multiple conditions match (e.g. full name AND surname both match)
        const seen = new Set();
        const uniqueClasses = classes.filter(c => {
            const key = `${c.Course_Code}-${c.Day}-${c.From_Time}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        // Transform
        const formatted = uniqueClasses.map(c => ({
            id: `${c.Course_Code}-${c.Day}-${c.From_Time}`,
            code: c.Course_Code,
            name: c.Course_Name,
            year: parseInt(c.Year_Semester?.substring(1,2)) || 1,
            day: c.Day,
            time: `${c.From_Time} - ${c.To_Time}`,
            room: c.Venue,
            lecturerName: c.Lecturer,
            program: c.Program,
            college: c.College
        }));

        res.json(formatted);
    } catch (err) {
        console.error("Error fetching lecturer classes:", err);
        res.status(500).json({ message: 'Error fetching classes' });
    }
});

/**
 * POST /api/classes
 * Create a new class
 */
router.post('/', async (req, res) => {
    try {
        const { name, code, time, room, lecturerId, lecturerName, day, year } = req.body;
        
        const newClass = await Class.create({
            id: 'c' + Date.now(),
            name, 
            code, 
            time, 
            room, 
            lecturerId, 
            lecturerName, 
            day,
            year: year || 2
        });

        res.json({ message: 'Class created', class: newClass });
    } catch (err) {
        console.error("Error creating class:", err);
        res.status(500).json({ message: 'Error creating class' });
    }
});

/**
 * PUT /api/classes/:id
 * Update class details (e.g. rescheduling)
 */
router.put('/:id', async (req, res) => {
    try {
        const classId = req.params.id;
        const { day, time, room } = req.body;
        
        const classObj = await Class.findByPk(classId);
        
        if (!classObj) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Update fields
        if (day) classObj.day = day;
        if (time) classObj.time = time;
        if (room) classObj.room = room;

        await classObj.save();

        res.json({ message: 'Class updated', class: classObj });
    } catch (err) {
        console.error("Error updating class:", err);
        res.status(500).json({ message: 'Server error updating class' });
    }
});

module.exports = router;
