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
