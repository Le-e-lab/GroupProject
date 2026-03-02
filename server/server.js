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
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Rate Limiters (DISABLED for University Wi-Fi compatibility)
// Because thousands of students share the same public IP via the campus network,
// strict IP-based rate limiting will accidentally block legitimate users.
// const authLimiter = rateLimit({ ... });
// const attendanceLimiter = rateLimit({ ... });

// Middleware
app.use(cors({
    origin: true,
    credentials: true 
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Disable caching for all served files so browsers always get fresh content
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

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
const announcementRoutes = require('./routes/announcements');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes); // authLimiter disabled for shared Campus WiFi
app.use('/api/attendance', attendanceRoutes); // attendanceLimiter disabled for shared Campus WiFi
app.use('/api/classes', classRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Seed Route
app.post('/api/debug/seed', async (req, res) => {
    try {
        const seedData = require('./data/seed_data');
        console.log('SEEDING via API...');
        
        // 1. Lecturers
        const lecturers = seedData.generateLecturers();
        for (const lec of lecturers) {
            try { await User.create(lec); } catch(e) {}
        }
        
        // 2. Classes
        const classes = seedData.generateClasses();
        // Map to DB Schema
        const timetableData = classes.map(c => ({
           Course_Code: c.code,
           Course_Name: c.name,
           Day: c.day,
           From_Time: c.time.split(' - ')[0],
           To_Time: c.time.split(' - ')[1],
           Venue: c.room,
           Lecturer: c.lecturerName,
           LecturerId: c.lecturerId,
           Year_Semester: `Y${c.year}S1`,
           Program: c.code.substring(0, 4),
           Section: '1',
           College: c.department || 'Computing' 
        }));
        // Use bulkCreate for classes as it's faster and less prone to PK constraint if empty
        // But if exists, we might ignore.
        // Let's use loop for safety if PK exists
         for (const cls of timetableData) {
            try { await Class.create(cls); } catch(e) {}
        }

        // 3. Students
        const students = seedData.generateStudents();
        for (const stu of students) {
            try { await User.create(stu); } catch(e) {}
        }
        
        const count = await User.count();
        res.json({ message: 'Seeding Complete', count });
        
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Debug Route
app.get('/api/debug/users', async (req, res) => {
    try {
        const count = await User.count();
        const firstUser = await User.findOne();
        res.json({ count, firstUser });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Seed Route
app.post('/api/debug/seed', async (req, res) => {
    try {
        const seedData = require('./data/seed_data');
        console.log('SEEDING via API...');
        
        // 1. Lecturers
        const lecturers = seedData.generateLecturers();
        for (const lec of lecturers) {
            try { await User.create(lec); } catch(e) {}
        }
        
        // 2. Classes
        const classes = seedData.generateClasses();
        // Map to DB Schema
        const timetableData = classes.map(c => ({
           Course_Code: c.code,
           Course_Name: c.name,
           Day: c.day,
           From_Time: c.time.split(' - ')[0],
           To_Time: c.time.split(' - ')[1],
           Venue: c.room,
           Lecturer: c.lecturerName,
           LecturerId: c.lecturerId,
           Year_Semester: `Y${c.year}S1`,
           Program: c.rawProgram || c.code.substring(0, 4),
           Section: c.rawSection || '1',
           College: c.rawCollege || c.department || 'Computing' 
        }));

         for (const cls of timetableData) {
            try { await Class.create(cls); } catch(e) {}
        }

        // 3. Students
        const students = seedData.generateStudents();
        for (const stu of students) {
            try { await User.create(stu); } catch(e) {}
        }
        
        const count = await User.count();
        res.json({ message: 'Seeding Complete', count });
        
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Database synchronization
const db = require('./models'); // <--- Missing import
const { sequelize } = db;
console.log('Server DB Path:', sequelize.options.storage);
const { User, Attendance, Session, Class, Announcement } = db;
const { Op } = require('sequelize');

async function seedAttendanceIfEmpty() {
    const count = await Attendance.count();
    if (count > 0) {
        console.log(`Attendance data exists (${count} records).`);
        return;
    }
    
    console.log("Seeding demo attendance data...");
    
    // Get students and their programs
    const students = await User.findAll({ where: { role: { [Op.in]: ['student', 'student_rep'] } }});
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
    User.sync({ alter: true }), // alter:true to apply new ENUM roles (student_rep, admin) to existing DB
    Attendance.sync(),
    Session.sync(),
    Class.sync(), // Create the timetable table if it doesn't exist
    Announcement.sync() // Create the announcements table
]).then(async () => {
    console.log("Synced Users, Attendance, Sessions, Classes, and Announcements.");

    // Auto-seed default Admin account if none exists
    try {
        const adminExists = await User.findOne({ where: { role: 'admin' } });
        if (!adminExists) {
            await User.create({
                id: 'admin',
                fullName: 'System Administrator',
                email: 'admin@upath.ac.zw',
                password: 'admin123',
                role: 'admin',
                department: 'IT Administration'
            });
            console.log('[SEED] Default admin created — Login: admin / admin123');
        } else {
            console.log('[SEED] Admin account exists:', adminExists.id);
        }
    } catch (e) {
        console.error('Admin seed error:', e.message);
    }

    // Auto-seed ALL data from data folder if the DB is empty (first boot)
    try {
        const classCount = await Class.count();
        const userCount = await User.count({ where: { role: { [Op.ne]: 'admin' } } });

        if (classCount === 0 || userCount === 0) {
            console.log('[AUTO-SEED] Fresh database detected. Seeding from data folder...');
            const seedData = require('./data/seed_data');

            // 1. Lecturers
            const lecturers = seedData.generateLecturers();
            let lecCount = 0;
            for (const lec of lecturers) {
                try { await User.create(lec); lecCount++; } catch(e) {}
            }
            console.log(`[AUTO-SEED] Created ${lecCount} lecturers.`);

            // 2. Classes (timetable)
            const classes = seedData.generateClasses();
            const timetableData = classes.map(c => ({
                Course_Code: c.code,
                Course_Name: c.name,
                Day: c.day,
                From_Time: c.time.split(' - ')[0],
                To_Time: c.time.split(' - ')[1],
                Venue: c.room,
                Lecturer: c.lecturerName,
                LecturerId: c.lecturerId,
                Year_Semester: `Y${c.year}S1`,
                Program: c.rawProgram || c.code.substring(0, 4),
                Section: c.rawSection || '1',
                College: c.rawCollege || c.department || 'Computing'
            }));

            let clsCount = 0;
            for (const cls of timetableData) {
                try { await Class.create(cls); clsCount++; } catch(e) {}
            }
            console.log(`[AUTO-SEED] Created ${clsCount} classes.`);

            // 3. Students
            const students = seedData.generateStudents();
            let stuCount = 0;
            for (const stu of students) {
                try { await User.create(stu); stuCount++; } catch(e) {}
            }
            console.log(`[AUTO-SEED] Created ${stuCount} students.`);

            const total = await User.count();
            console.log(`[AUTO-SEED] Complete! Total users: ${total}`);
        } else {
            console.log(`[SEED] Database populated (${classCount} classes, ${userCount} users).`);
        }

        // Now seed attendance if needed
        await seedAttendanceIfEmpty();

    } catch (e) {
        console.error('Auto-seed error:', e.message);
    }
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
