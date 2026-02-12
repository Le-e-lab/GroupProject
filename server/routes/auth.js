const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { Op } = require('sequelize');

/**
 * ========================================
 * REGISTER ROUTE
 * ========================================
 */
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, password, role, idNumber } = req.body;

        if (!fullName || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ email }, { id: idNumber || '' }]
            }
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const newUser = await User.create({
            id: idNumber || (role === 'lecturer' ? '21' : '25') + Math.floor(1000 + Math.random() * 9000), // Mock ID gen
            fullName,
            email,
            password, // TODO: Use bcrypt
            role,
            department: role === 'lecturer' ? 'Computer Science' : undefined,
            year: role === 'student' ? 1 : undefined
        });

        res.status(201).json({ 
            message: 'Registration successful', 
            user: { id: newUser.id, name: newUser.fullName, role: newUser.role } 
        });

    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ message: 'Error registering user' });
    }
});

/**
 * ========================================
 * LOGIN ROUTE
 * ========================================
 */
router.post('/login', async (req, res) => {
    try {
        // Allow login with EMAIL or ID (frontend sends ID in 'email' field usually)
        const { email, password } = req.body;
        const identifier = email; // Alias for clarity

        console.log(`[AUTH] Login Attempt: Input="${identifier}"`);

        // 1. Find user by email OR id
        const user = await User.findOne({ 
            where: { 
                [Op.or]: [
                    { email: identifier },
                    { id: identifier }
                ]
            } 
        });
        
        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 2. Return User Profile (Excluding sensitive data if any, keeping password for now as simple str)
        // Ideally we shouldn't send password back, but keeping structure for now.
        // CRITICAL: Must include 'program' for student filtering.
        res.json({ 
            message: 'Login successful', 
            user: { 
                id: user.id, 
                fullName: user.fullName, 
                email: user.email, 
                role: user.role,
                year: user.year,
                department: user.department,
                program: user.program, // <--- The Key Filter Field
                college: user.college  // <--- Added for Organization
            } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * ========================================
 * GET ALL USERS ROUTE
 * ========================================
 */
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password'] }
        });
        
        const students = users.filter(u => u.role === 'student');
        const lecturers = users.filter(u => u.role === 'lecturer');

        res.json({ students, lecturers });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});
router.get('/user/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
