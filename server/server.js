/**
 * ============================================================================
 * UPath Backend Server
 * ============================================================================
 * 
 * This file serves as the main entry point for the backend API.
 * It handles the API routes, static file serving, and basic server configuration.
 * 
 * FOR DEVELOPERS & DEBUGGING:
 * 
 * 1. How to Run:
 *    - Ensure Node.js is installed.
 *    - Run `npm install` to install dependencies (express, cors, body-parser).
 *    - Run `node server/server.js` to start the server.
 *    - The server defaults to port 3000 (http://localhost:3000).
 * 
 * 2. Directory Structure:
 *    - /public: Contains all frontend files (HTML, CSS, JS). Served statically.
 *    - /server/data: JSON files acting as a database (users.json).
 *    - /server/routes: API route definitions (if separated).
 * 
 * 3. Common Issues & Fixes:
 *    - "Address already in use": The port 3000 is taken. Kill the process occupying it 
 *      or change the PORT variable below.
 *    - "Cannot GET /page": Ensure the file exists in the /public folder.
 *    - JSON Errors: Check /server/data/users.json for valid JSON syntax.
 *    - "Camera Access Denied": Accessing camera usually requires HTTPS or localhost.
 * 
 * 4. Extending the API:
 *    - Add new routes using `app.get('/api/endpoint', handler)` or `app.post(...)`.
 *    - Always restart the server after making changes to this file.
 * 
 * ============================================================================
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir);
}

// Routes
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const classRoutes = require('./routes/classes');

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);

// Database synchronization
const db = require('./models'); // <--- Missing import
const { User, Attendance, Session, Class } = db;
const { Op } = require('sequelize');

async function seedAttendanceIfEmpty() {
    const count = await Attendance.count();
    if (count > 0) {
        console.log(`Attendance data exists (${count} records).`);
        return;
    }
    
    console.log("Seeding demo attendance data...");
    
    // Get students and their programs
    const students = await User.findAll({ where: { role: 'student' }});
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Generate dates for past 6 weeks (mid-semester = ~6 sessions)
    const dates = [];
    const today = new Date();
    for (let week = 1; week <= 6; week++) {
        // One session per week per course
        const d = new Date(today);
        d.setDate(d.getDate() - (week * 7)); // Go back by weeks
        dates.push(d.toISOString().split('T')[0]);
    }
    
    const records = [];
    for (const student of students) {
        if (!student.program || !student.year) continue;
        
        // Get classes for this student's program and year
        const classes = await Class.findAll({
            where: {
                Program: student.program,
                Day: { [Op.in]: validDays },
                Year_Semester: { [Op.like]: `Y${student.year}%` }
            }
        });
        
        // For each class, randomly attend some sessions (60-95%)
        const seenCodes = new Set();
        for (const cls of classes) {
            if (seenCodes.has(cls.Course_Code)) continue;
            seenCodes.add(cls.Course_Code);
            
            const compositeId = `${cls.Course_Code}-${cls.Day}-${cls.From_Time}`;
            const rate = 0.6 + Math.random() * 0.35;
            
            dates.forEach(dt => {
                if (Math.random() < rate) {
                    records.push({
                        classId: compositeId,
                        userId: student.id,
                        date: dt,
                        status: 'present',
                        method: Math.random() > 0.3 ? 'totp' : 'manual'
                    });
                }
            });
        }
    }
    
    if (records.length > 0) {
        await Attendance.bulkCreate(records);
        console.log(`Seeded ${records.length} attendance records.`);
    }
}

Promise.all([
    User.sync(),
    Attendance.sync(),
    Session.sync()
]).then(() => {
    console.log("Synced Users, Attendance, and Sessions.");
    return seedAttendanceIfEmpty();
}).catch(err => console.error("DB Sync Error:", err));

// Fallback for SPA (or 404)
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Prevent silent exits
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// Keep process alive explicitly (Desperate measure for weird environments)
// Force Event Loop to stay active
setInterval(() => {
    // Heartbeat to keep process alive
}, 10000);
