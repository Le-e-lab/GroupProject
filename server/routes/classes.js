const express = require('express');
const router = express.Router();
const { Class, User } = require('../models');
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

const CLASS_CACHE_TTL_MS = 60 * 1000;
const classCache = new Map();

function getCache(key) {
    const entry = classCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CLASS_CACHE_TTL_MS) {
        classCache.delete(key);
        return null;
    }
    return entry.value;
}

function setCache(key, value) {
    classCache.set(key, { ts: Date.now(), value });
}

/**
 * GET /api/classes
 * Retrieve all available classes
 */
router.get('/', async (req, res) => {
    try {
        const { year, program, day } = req.query; // Added 'day' to destructuring
        const cacheKey = `all:${year || ''}:${program || ''}:${day || ''}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
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

        const classes = await Class.findAll({
            where: whereClause,
            raw: true,
            attributes: [
                'Course_Code',
                'Course_Name',
                'Year_Semester',
                'Day',
                'From_Time',
                'To_Time',
                'Venue',
                'Lecturer',
                'LecturerId',
                'Program',
                'College'
            ]
        });
        
        // CRITICAL FIX: Filter to only valid weekdays (DB has corrupted Day values)
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const validClasses = classes.filter(c => validDays.includes(c.Day));
        
        // Deduplicate: Ensure we only send one instance of a class per schedule block
        const seen = new Set();
        const uniqueClasses = validClasses.filter(c => {
            const key = `${c.Course_Code}-${c.Day}-${c.From_Time}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log(`[Classes API] Fetched ${classes.length} total, ${uniqueClasses.length} unique with valid days`);
        
        // Transform to Frontend Format
        const formatted = uniqueClasses.map(c => ({
            id: `${c.Course_Code}-${c.Day}-${c.From_Time}`, // Composite ID
            code: c.Course_Code,
            name: c.Course_Name,
            year: parseInt(c.Year_Semester?.substring(1,2)) || 1,
            day: c.Day,
            time: `${c.From_Time} - ${c.To_Time}`,
            room: c.Venue,
            lecturerName: c.Lecturer,
            lecturerId: c.LecturerId || null,
            program: c.Program,
            college: c.College
        }));

        setCache(cacheKey, formatted);
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
        const cacheKey = `lecturer:${id}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
        // 1. Get Lecturer Name from User Table
        const lecturerUser = await User.findByPk(id);
        if (!lecturerUser) {
             return res.status(404).json({ message: 'Lecturer not found' });
        }
        
        console.log(`Fetching classes for lecturer: ${lecturerUser.fullName} (${id})`);

        // Merge strict LecturerId matches with fuzzy name matches to handle partially migrated timetable rows.
        const surname = lecturerUser.fullName ? lecturerUser.fullName.split(' ').pop() : '';
        const byId = await Class.findAll({
            where: { LecturerId: id },
            raw: true,
            attributes: [
                'Course_Code',
                'Course_Name',
                'Year_Semester',
                'Day',
                'From_Time',
                'To_Time',
                'Venue',
                'Lecturer',
                'LecturerId',
                'Program',
                'College'
            ]
        });
        const byName = await Class.findAll({
            where: {
                [Op.or]: [
                    { Lecturer: { [Op.like]: `%${lecturerUser.fullName || ''}%` } },
                    { Lecturer: { [Op.like]: `%${surname}%` } }
                ]
            },
            raw: true,
            attributes: [
                'Course_Code',
                'Course_Name',
                'Year_Semester',
                'Day',
                'From_Time',
                'To_Time',
                'Venue',
                'Lecturer',
                'LecturerId',
                'Program',
                'College'
            ]
        });
        const classes = [...byId, ...byName];
        
        // Deduplicate: The OR query can return the same row multiple times
        // if multiple conditions match (e.g. full name AND surname both match)
        const seen = new Set();
        const uniqueClasses = classes.filter(c => {
            const key = `${c.Course_Code}-${c.Day}-${c.From_Time}`.toLowerCase();
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
            lecturerId: c.LecturerId || null,
            program: c.Program,
            college: c.College
        }));

        setCache(cacheKey, formatted);
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
        const { name, code, time, room, lecturerId, lecturerName, day, year, program, college, section } = req.body;

        if (!name || !code || !time || !room || !day) {
            return res.status(400).json({ message: 'Missing required class fields' });
        }

        const [fromTime, toTime] = String(time).split(' - ').map((v) => (v || '').trim());
        if (!fromTime || !toTime) {
            return res.status(400).json({ message: 'Time must be in "HH:MM - HH:MM" format' });
        }

        const duplicate = await Class.findOne({
            where: {
                Course_Code: code,
                Day: day,
                From_Time: fromTime,
                Program: program || (String(code).substring(0, 4) || ''),
                Year_Semester: `Y${year || 2}S1`,
                Section: section || '1'
            }
        });

        if (duplicate) {
            return res.status(409).json({ message: 'A class entry for this course/day/time already exists.' });
        }
        
        const newClass = await Class.create({
            Course_Code: code,
            Course_Name: name,
            Day: day,
            From_Time: fromTime,
            To_Time: toTime,
            Venue: room,
            Lecturer: lecturerName || '',
            LecturerId: lecturerId || '',
            Year_Semester: `Y${year || 2}S1`,
            Program: program || (String(code).substring(0, 4) || ''),
            Section: section || '1',
            College: college || 'Computing'
        });

        classCache.clear();

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

        const [courseCode, currentDay, currentFromTime] = String(classId).split('-');
        if (!courseCode || !currentDay || !currentFromTime) {
            return res.status(400).json({ message: 'Invalid class id format' });
        }

        const classObj = await Class.findOne({
            where: {
                Course_Code: courseCode,
                Day: currentDay,
                From_Time: currentFromTime
            }
        });
        
        if (!classObj) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Update fields
        if (day) classObj.Day = day;
        if (time) {
            const [fromTime, toTime] = String(time).split(' - ').map((v) => (v || '').trim());
            if (!fromTime || !toTime) {
                return res.status(400).json({ message: 'Time must be in "HH:MM - HH:MM" format' });
            }
            classObj.From_Time = fromTime;
            classObj.To_Time = toTime;
        }
        if (room) classObj.Venue = room;

        await classObj.save();

        classCache.clear();

        res.json({ message: 'Class updated', class: classObj });
    } catch (err) {
        console.error("Error updating class:", err);
        res.status(500).json({ message: 'Server error updating class' });
    }
});

module.exports = router;
