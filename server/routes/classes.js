const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const classesFile = path.join(__dirname, '../data/classes.json');

const getClasses = () => {
    try {
        if (!fs.existsSync(classesFile)) return [];
        return JSON.parse(fs.readFileSync(classesFile));
    } catch (err) {
        console.error("Error reading classes.json:", err.message);
        return [];
    }
};

const saveClasses = (data) => {
    fs.writeFileSync(classesFile, JSON.stringify(data, null, 2));
};

// GET ALL CLASSES (For Students)
router.get('/', (req, res) => {
    res.json(getClasses());
});

// GET LECTURER CLASSES
router.get('/lecturer/:id', (req, res) => {
    const classes = getClasses();
    // In a real app we'd filter by exact ID, for demo we might just return all or filter mock
    // const myClasses = classes.filter(c => c.lecturerId === req.params.id);
    res.json(classes); // Returning all for demo visibility
});

// CREATE CLASS
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

module.exports = router;
