const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const classesFile = path.join(__dirname, '../data/classes.json');

/**
 * Helper to read classes from JSON
 * @returns {array} Array of class objects
 */
const getClasses = () => {
    try {
        if (!fs.existsSync(classesFile)) return [];
        return JSON.parse(fs.readFileSync(classesFile));
    } catch (err) {
        console.error("Error reading classes.json:", err.message);
        return [];
    }
};

/**
 * Helper to save classes
 * @param {array} data Class array
 */
const saveClasses = (data) => {
    fs.writeFileSync(classesFile, JSON.stringify(data, null, 2));
};

/**
 * GET /api/classes
 * Retrieve all available classes
 */
router.get('/', (req, res) => {
    res.json(getClasses());
});

/**
 * GET /api/classes/lecturer/:id
 * Retrieve classes assigned to a specific lecturer
 */
router.get('/lecturer/:id', (req, res) => {
    const classes = getClasses();
    // In a real app we'd filter by exact ID, for demo we might just return all or filter mock
    // const myClasses = classes.filter(c => c.lecturerId === req.params.id);
    res.json(classes); // Returning all for demo visibility
});

/**
 * POST /api/classes
 * Create a new class
 */
router.post('/', (req, res) => {
    /* 
       TODO: SQL Insert -> INSERT INTO classes (...) VALUES (...) 
    */
    try {
        const { name, code, time, room, lecturerId, lecturerName, day } = req.body;
        const classes = getClasses();

        const newClass = {
            id: 'c' + Date.now(),
            name, code, time, room, lecturerId, lecturerName, day // In real DB, ensure these match schema
        };

        classes.push(newClass);
        saveClasses(classes);
        res.json({ message: 'Class created', class: newClass });
    } catch (err) {
        res.status(500).json({ message: 'Error creating class' });
    }
});

/**
 * PUT /api/classes/:id
 * Update class details (e.g. rescheduling)
 */
router.put('/:id', (req, res) => {
    try {
        const classId = req.params.id;
        const { day, time, room } = req.body;
        
        const classes = getClasses();
        const index = classes.findIndex(c => c.id === classId);
        
        if (index === -1) {
            return res.status(404).json({ message: 'Class not found' });
        }

        // Update fields
        if (day) classes[index].day = day;
        if (time) classes[index].time = time;
        if (room) classes[index].room = room;

        saveClasses(classes);
        res.json({ message: 'Class updated', class: classes[index] });
    } catch (err) {
        console.error("Error updating class:", err);
        res.status(500).json({ message: 'Server error updating class' });
    }
});

module.exports = router;
