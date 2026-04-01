const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const validator = require('validator');
const authMiddleware = require('../middleware/authMiddleware');
const { getJwtSecret } = require('../utils/jwt');
const { authLoginLimiter } = require('../middleware/rateLimiters');

/**
 * ========================================
 * REGISTER ROUTE
 * ========================================
 */
router.post('/register', async (req, res) => {
    try {
        let { fullName, email, password, role, idNumber } = req.body;

        if (!fullName || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Sanitize inputs
        fullName = validator.escape(validator.trim(fullName));
        email = validator.normalizeEmail(validator.trim(email)) || email;
        if (idNumber) idNumber = validator.escape(validator.trim(idNumber));

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
            password, // Password hashed by User model hook
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

const jwt = require('jsonwebtoken');

/**
 * ========================================
 * LOGIN ROUTE
 * ========================================
 */
router.post('/login', authLoginLimiter, async (req, res) => {
    try {
        const jwtSecret = getJwtSecret();
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
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 2. Generate JWT Token
        const payload = {
            id: user.id,
            role: user.role,
            fullName: user.fullName
        };

        const token = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });

        // 3. Set HttpOnly Cookie
        res.cookie('upath_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        // 4. Return User Profile (Excluding sensitive data if any, keeping password for now as simple str)
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
 * LOGOUT ROUTE
 * ========================================
 */
router.post('/logout', (req, res) => {
    res.clearCookie('upath_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ message: 'Logged out successfully' });
});

/**
 * ========================================
 * GET ALL USERS ROUTE
 * ========================================
 */
router.get('/users', authMiddleware, async (req, res) => {
    try {
        if (!['lecturer', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        const users = await User.findAll({
            attributes: { exclude: ['password'] }
        });
        
        const students = users.filter(u => u.role === 'student' || u.role === 'student_rep');
        const lecturers = users.filter(u => u.role === 'lecturer');

        res.json({ students, lecturers });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ message: 'Server error fetching users' });
    }
});

router.get('/user/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.id !== req.params.id && !['lecturer', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
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
