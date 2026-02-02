const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const attendanceFile = path.join(__dirname, '../data/attendance.json');

const getAttendance = () => {
    if (!fs.existsSync(attendanceFile)) return [];
    return JSON.parse(fs.readFileSync(attendanceFile));
};

const saveAttendance = (data) => {
    fs.writeFileSync(attendanceFile, JSON.stringify(data, null, 2));
};

// MARK ATTENDANCE (Single)
router.post('/mark', (req, res) => {
    try {
        const { studentId, classId, status, date } = req.body;
        const records = getAttendance();

        const newRecord = {
            id: Date.now().toString(),
            studentId,
            classId,
            status: status || 'present',
            date: date || new Date().toISOString()
        };

        records.push(newRecord);
        saveAttendance(records);

        res.json({ message: 'Attendance marked', record: newRecord });
    } catch (err) {
        console.error("Error marking attendance:", err);
        res.status(500).json({ message: 'Server error marking attendance' });
    }
});

// MARK BULK ATTENDANCE (For Manual Entry Page)
router.post('/bulk-mark', (req, res) => {
    /* 
       TODO: In a real SQL implementation, perform a Batch Insert transaction here.
       Mock Implementation: Loop and push to JSON.
    */
    try {
        const { date, classId, students } = req.body;
        
        if (!students || !Array.isArray(students)) {
            return res.status(400).json({ message: 'Invalid students list' });
        }

        const records = getAttendance();
        const timestamp = new Date().toISOString();

        const newRecords = students.map(s => ({
            id: 'att_' + Date.now() + Math.random().toString(36).substr(2, 9),
            studentId: s.id,
            classId, // e.g., 'c1'
            status: s.status, // 'present' or 'absent'
            date: date || timestamp
        }));

        records.push(...newRecords);
        saveAttendance(records);

        console.log(`[Batch] Marked ${newRecords.length} records for Class ${classId}`);
        res.json({ message: 'Bulk attendance saved successfully', count: newRecords.length });

    } catch (err) {
        console.error("Error in bulk-mark:", err);
        res.status(500).json({ message: 'Server error processing bulk attendance' });
    }
});

// GET STUDENT ATTENDANCE
router.get('/student/:id', (req, res) => {
    try {
        const records = getAttendance();
        
        /* 
           TODO: SQL Query -> SELECT * FROM attendance WHERE studentId = ? 
        */
        const studentRecords = records.filter(r => r.studentId === req.params.id);
        res.json(studentRecords);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching records' });
    }
});

module.exports = router;
