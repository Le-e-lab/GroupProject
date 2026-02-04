const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const attendanceFile = path.join(__dirname, '../data/attendance.json');

/**
 * Accessor for attendance records
 * @returns {Array} List of attendance records
 */
const getAttendance = () => {
    if (!fs.existsSync(attendanceFile)) return [];
    return JSON.parse(fs.readFileSync(attendanceFile));
};

/**
 * Persist attendance records
 * @param {Array} data 
 */
const saveAttendance = (data) => {
    fs.writeFileSync(attendanceFile, JSON.stringify(data, null, 2));
};

/**
 * POST /api/attendance/mark
 * Mark single student attendance
 */
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

/**
 * POST /api/attendance/bulk-mark
 * Mark attendance for multiple students (Manual Entry)
 */
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
            studentId: s.id || s, // Handle if passed as ID string or object
            classId, 
            status: 'present',
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

/**
 * GET /api/attendance/student/:id
 * Retrieve attendance history and calculated stats for a student
 */
router.get('/student/:id', (req, res) => {
    try {
        const records = getAttendance();
        const studentRecords = records.filter(r => r.studentId === req.params.id);
        
        // Calculate detailed stats
        // We need total sessions per course to calculate percentage
        // For this demo, we can count unique dates in the global record for each course
        // Or assume a fixed number. Let's infer from global records.
        
        const courseStats = {};
        records.forEach(r => {
            if (!courseStats[r.classId]) courseStats[r.classId] = new Set();
            courseStats[r.classId].add(r.date.split('T')[0]); // unique dates
        });

        const myStats = {};
        studentRecords.forEach(r => {
            if (!myStats[r.classId]) myStats[r.classId] = 0;
            myStats[r.classId]++;
        });

        const detailedStats = Object.keys(myStats).map(cCode => ({
            courseCode: cCode,
            attended: myStats[cCode],
            total: courseStats[cCode] ? courseStats[cCode].size : 12 // Default if no dates found
        }));

        res.json({
            history: studentRecords,
            stats: detailedStats
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching records' });
    }
});

/**
 * GET /api/attendance/stats/course/:courseId
 * Retrieve aggregated stats for a course (Lecturer Dashboard)
 */
router.get('/stats/course/:courseId', (req, res) => {
    try {
        const records = getAttendance();
        const courseId = req.params.courseId;
        const usersPath = path.join(__dirname, '../data/users.json');
        
        // Get Total Students Enrolled (Mock Logic: Based on Year)
        // In real app, query enrollment table.
        // Here, we check users.json and filter by year (1 or 2).
        let totalStudents = 30; // Fallback
        
        if (fs.existsSync(usersPath)) {
            const users = JSON.parse(fs.readFileSync(usersPath));
            // HACK: Guess year from course code (CS1xx vs CS2xx) or pass it in query
            // Enrolled year heuristic: 1 if code contains '1', else 2
            const enrolledYear = courseId.includes('1') ? 1 : 2; 
            
            // Count students in that year
            if (users.students) {
                const yearStudents = users.students.filter(s => s.year === enrolledYear);
                if (yearStudents.length > 0) totalStudents = yearStudents.length;
            }
        }

        // Filter for this course
        const courseRecords = records.filter(r => r.classId === courseId);
        
        // Calculate Stats
        const uniqueDates = new Set(courseRecords.map(r => r.date.split('T')[0]));
        const totalSessions = uniqueDates.size || 1; // Avoid div/0
        const totalPresent = courseRecords.length;
        
        // Average Attendance = (Total Present) / (Total Sessions * Total Students)
        let avg = 0;
        if (totalSessions > 0 && totalStudents > 0) {
            avg = Math.round((totalPresent / (totalSessions * totalStudents)) * 100);
        }

        res.json({
            totalSessions,
            totalStudents,
            totalPresent,
            avgAttendance: avg > 100 ? 100 : avg // Cap at 100
        });

    } catch (err) {
        console.error("Error stats:", err);
        res.status(500).json({ message: 'Error calculating stats' });
    }
});

module.exports = router;
