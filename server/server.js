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
const helmet = require('helmet');
const authMiddleware = require('./middleware/authMiddleware');
const { getJwtSecret } = require('./utils/jwt');
const { apiIdentityLimiter } = require('./middleware/rateLimiters');

const app = express();
const PORT = process.env.PORT || 3000;

try {
    getJwtSecret();
} catch (err) {
    console.error(`[SECURITY] ${err.message}`);
    process.exit(1);
}

// Security: Rate Limiters (DISABLED for University Wi-Fi compatibility)
// Because thousands of students share the same public IP via the campus network,
// strict IP-based rate limiting will accidentally block legitimate users.
// const authLimiter = rateLimit({ ... });
// const attendanceLimiter = rateLimit({ ... });

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com', 'https://fonts.googleapis.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https://*.openstreetmap.org', 'https://unpkg.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            connectSrc: ["'self'", 'https://router.project-osrm.org', 'https://*.openstreetmap.org'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production'
}));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS policy violation'));
    },
    credentials: true
}));

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// Identity-based API rate limiting avoids shared Wi-Fi IP lockouts while still limiting abuse.
app.use('/api', apiIdentityLimiter);

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

if (process.env.ENABLE_DEBUG_ROUTES === 'true') {
    app.get('/api/debug/users', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Forbidden' });
            }
            const count = await User.count();
            const firstUser = await User.findOne();
            return res.json({ count, firstUser });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/debug/seed', authMiddleware, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Forbidden' });
            }

            const seedData = require('./data/seed_data');
            console.log('SEEDING via API...');

            const lecturers = seedData.generateLecturers();
            for (const lec of lecturers) {
                try { await User.create(lec); } catch (e) {}
            }

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

            for (const cls of timetableData) {
                try { await Class.create(cls); } catch (e) {}
            }

            const students = seedData.generateStudents();
            for (const stu of students) {
                try { await User.create(stu); } catch (e) {}
            }

            const count = await User.count();
            return res.json({ message: 'Seeding Complete', count });
        } catch (e) {
            console.error(e);
            return res.status(500).json({ error: e.message });
        }
    });
}

// Database synchronization
const db = require('./models'); // <--- Missing import
const { sequelize } = db;
console.log('Server DB Path:', sequelize.options.storage);
const { User, Attendance, Session, Class, Announcement, TimetableUploadLog } = db;
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
    Announcement.sync(), // Create the announcements table
    TimetableUploadLog.sync()
]).then(async () => {
    console.log("Synced Users, Attendance, Sessions, Classes, Announcements, and Upload Logs.");

    // Auto-seed admin account only when explicitly enabled.
    try {
        const adminExists = await User.findOne({ where: { role: 'admin' } });
        const shouldSeedAdmin = process.env.SEED_DEFAULT_ADMIN === 'true';
        const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

        if (!adminExists && shouldSeedAdmin) {
            if (!defaultAdminPassword || defaultAdminPassword.length < 12) {
                throw new Error('DEFAULT_ADMIN_PASSWORD must be set to at least 12 characters when SEED_DEFAULT_ADMIN=true');
            }
            await User.create({
                id: 'admin',
                fullName: 'System Administrator',
                email: 'admin@upath.ac.zw',
                password: defaultAdminPassword,
                role: 'admin',
                department: 'IT Administration'
            });
            console.log('[SEED] Default admin created from environment configuration.');
        } else if (adminExists) {
            console.log('[SEED] Admin account exists:', adminExists.id);
        } else {
            console.log('[SEED] Admin seeding skipped. Set SEED_DEFAULT_ADMIN=true to enable.');
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

// Fallback for SPA (serve index.html for all non-API GET requests)
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
    }
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
