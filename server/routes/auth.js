const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, '../data/users.json');

/**
 * Helper to read users from the JSON "database"
 * @returns {object} - { students: [], lecturers: [] }
 */
const getUsers = () => {
    try {
        if (!fs.existsSync(usersFile)) return { students: [], lecturers: [] };
        const data = fs.readFileSync(usersFile);
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading users.json:", err.message);
        return { students: [], lecturers: [] };
    }
};

/**
 * Helper to save users
 * @param {object} users - Full users object
 */
const saveUsers = (users) => {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

/**
 * ========================================
 * REGISTER ROUTE
 * ========================================
 */
router.post('/register', (req, res) => {
    const { fullName, email, password, role, idNumber } = req.body;

    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const db = getUsers();
    // Default to empty arrays if undefined
    if (!db.students) db.students = [];
    if (!db.lecturers) db.lecturers = [];

    // Search collision in both arrays
    const allUsers = [...db.students, ...db.lecturers];
    if (allUsers.find(u => u.email === email || u.id === idNumber)) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = {
        id: idNumber || (role === 'lecturer' ? '21' : '25') + Math.floor(1000 + Math.random() * 9000), // Mock ID gen
        fullName,
        email,
        password, // TODO: Use bcrypt in production
        role,
        department: role === 'lecturer' ? 'Computer Science' : undefined, // Default for now
        year: role === 'student' ? 1 : undefined,
        createdAt: new Date().toISOString()
    };

    // Push to correct array
    if (role === 'lecturer') {
        db.lecturers.push(newUser);
    } else {
        db.students.push(newUser);
    }

    saveUsers(db);

    res.status(201).json({ message: 'Registration successful', user: { id: newUser.id, name: newUser.fullName, role: newUser.role } });
});

/**
 * ========================================
 * LOGIN ROUTE
 * ========================================
 */
router.post('/login', (req, res) => {
    let { email, password } = req.body;
    
    // Debugging logs
    console.log(`[AUTH] Login Attempt: Input="${email}"`);

    const db = getUsers();
    const allUsers = [...(db.students || []), ...(db.lecturers || [])];
    
    // Safe trim
    email = email ? email.trim() : '';
    password = password ? password.trim() : '';

    // Find user by Email OR ID (idNumber)
    const user = allUsers.find(u => {
        const matchId = (u.id === email); // Front-end sends ID as 'email' field sometimes
        const matchEmail = (u.email === email);
        const matchPass = (u.password === password);
        return (matchId || matchEmail) && matchPass;
    });

    if (!user) {
        console.warn("[AUTH] Login Failed: Invalid credentials");
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[AUTH] Login Success: ${user.fullName} (${user.role})`);

    res.json({ 
        message: 'Login successful', 
        user: { 
            id: user.id, 
            fullName: user.fullName, 
            email: user.email, 
            role: user.role,
            year: user.year,
            department: user.department
        } 
    });
});

module.exports = router;
