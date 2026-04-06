const express = require('express');
const router = express.Router();
const { Class, User } = require('../models');
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

const CLASS_CACHE_TTL_MS = 60 * 1000;
const classCache = new Map();

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function programValuesCompatible(left, right) {
    const a = normalizeKey(left);
    const b = normalizeKey(right);
    if (!a || !b) return true;
    if (a === b) return true;
    return a.startsWith(b) || b.startsWith(a) || a.includes(b) || b.includes(a);
}

function buildClassId(row) {
    const course = String(row.Course_Code || '').trim();
    const day = String(row.Day || '').trim();
    const from = String(row.From_Time || '').trim();
    const programKey = normalizeKey(row.Program || 'unknown_program') || 'unknown_program';
    const yearKey = normalizeKey(row.Year_Semester || 'unknown_year') || 'unknown_year';
    return `${course}--${day}--${from}--${programKey}--${yearKey}`;
}

function parseClassId(classId) {
    const raw = String(classId || '').trim();
    if (!raw) return null;

    if (raw.includes('--')) {
        const parts = raw.split('--');
        return {
            courseCode: parts[0] || '',
            day: parts[1] || '',
            fromTime: parts[2] || '',
            programKey: parts[3] || '',
            yearKey: parts[4] || ''
        };
    }

    const legacy = raw.split('-');
    if (legacy.length >= 3) {
        return {
            courseCode: legacy[0] || '',
            day: legacy[1] || '',
            fromTime: legacy[2] || '',
            programKey: '',
            yearKey: ''
        };
    }

    return {
        courseCode: raw,
        day: '',
        fromTime: '',
        programKey: '',
        yearKey: ''
    };
}

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
        const requesterRole = String((req.user && req.user.role) || '').toLowerCase();
        const isStudentRequester = requesterRole === 'student' || requesterRole === 'student_rep';

        let effectiveProgram = String(program || '').trim();
        let effectiveYear = String(year || '').trim();

        if (isStudentRequester) {
            if (!effectiveProgram) {
                effectiveProgram = String((req.user && req.user.program) || '').trim();
            }
            if (!effectiveYear && req.user && req.user.year) {
                effectiveYear = String(req.user.year);
            }

            if (!effectiveProgram || !effectiveYear) {
                // Fail closed for students with incomplete profiles to avoid leaking unrelated classes.
                return res.json([]);
            }
        }

        const cacheKey = `all:${requesterRole}:${String((req.user && req.user.id) || '')}:${effectiveYear || ''}:${effectiveProgram || ''}:${day || ''}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        
        const whereClause = {};

        
        const requestedProgram = String(effectiveProgram || '').trim();
        
        if (effectiveYear) {
            // DB has "Year_Semester" e.g. "Y1 S2" or "All Years"
            whereClause.Year_Semester = { 
                [Op.or]: [
                    { [Op.like]: `Y${effectiveYear}%` }, // Specific Year
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

        // Program matching is compatibility-based to support naming variants across roster imports.
        const cohortClasses = requestedProgram
            ? validClasses.filter((c) => programValuesCompatible(c.Program, requestedProgram))
            : validClasses;
        
        // Deduplicate: Ensure we only send one instance of a class per schedule block
        const seen = new Set();
        const uniqueClasses = cohortClasses.filter(c => {
            const key = `${String(c.Course_Code || '').trim().toLowerCase()}-${String(c.Day || '').trim().toLowerCase()}-${String(c.From_Time || '').trim().toLowerCase()}-${normalizeKey(c.Program)}-${normalizeKey(c.Year_Semester)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log(`[Classes API] Fetched ${classes.length} total, ${uniqueClasses.length} unique with valid days`);
        
        // Transform to Frontend Format
        const formatted = uniqueClasses.map(c => ({
            id: buildClassId(c), // Composite ID (program/year aware)
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
            const key = `${String(c.Course_Code || '').trim().toLowerCase()}-${String(c.Day || '').trim().toLowerCase()}-${String(c.From_Time || '').trim().toLowerCase()}-${normalizeKey(c.Program)}-${normalizeKey(c.Year_Semester)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        // Transform
        const formatted = uniqueClasses.map(c => ({
            id: buildClassId(c),
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

        const parsed = parseClassId(classId);
        if (!parsed || !parsed.courseCode || !parsed.day || !parsed.fromTime) {
            return res.status(400).json({ message: 'Invalid class id format' });
        }

        const whereClause = {
            Course_Code: parsed.courseCode,
            Day: parsed.day,
            From_Time: parsed.fromTime
        };

        if (parsed.programKey) {
            whereClause.Program = { [Op.like]: `%` };
        }

        if (parsed.yearKey) {
            whereClause.Year_Semester = { [Op.like]: `%` };
        }

        const candidates = await Class.findAll({ where: whereClause });
        const classObj = candidates.find((row) => {
            if (parsed.programKey && normalizeKey(row.Program) !== parsed.programKey) return false;
            if (parsed.yearKey && normalizeKey(row.Year_Semester) !== parsed.yearKey) return false;
            return true;
        }) || candidates[0];
        
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
