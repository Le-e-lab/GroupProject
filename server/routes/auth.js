const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, '../data/users.json');

// Helper to read users
const getUsers = () => {
    try {
        if (!fs.existsSync(usersFile)) return [];
        const data = fs.readFileSync(usersFile);
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading users.json:", err.message);
        return [];
    }
};

// Helper to save users
const saveUsers = (users) => {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
};

// REGISTER
router.post('/register', (req, res) => {
    const { fullName, email, password, role, idNumber } = req.body;

    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const users = getUsers();
    
    /* 
       TODO: SQL Check -> SELECT * FROM users WHERE email = ? 
    */
    // Check if exists
    if (users.find(u => u.email === email || u.idNumber === idNumber)) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = {
        id: Date.now().toString(),
        fullName,
        email,
        password, // TODO: Use bcrypt.hash(password, 10)
        role,
        idNumber: idNumber || 'ST' + Math.floor(Math.random() * 10000), 
        createdAt: new Date().toISOString()
    };

    /* 
       TODO: SQL Insert -> INSERT INTO users (...) VALUES (...) 
    */
    users.push(newUser);
    saveUsers(users);

    res.status(201).json({ message: 'Registration successful', user: { id: newUser.id, name: newUser.fullName, role: newUser.role } });
});

// LOGIN
router.post('/login', (req, res) => {
    let { email, password } = req.body;
    
    // Debugging logs
    console.log(`Login Attempt: Input="${email}", Pass="${password}"`);

    const users = getUsers();
    
    // Safe trim
    email = email ? email.trim() : '';
    password = password ? password.trim() : '';

    const user = users.find(u => {
        const matchId = (u.idNumber === email);
        const matchEmail = (u.email === email);
        const matchPass = (u.password === password);
        
        // Detailed log for debugging (remove in production)
        if (matchId || matchEmail) {
            console.log(`User Found (${u.idNumber}): Password match? ${matchPass}`);
        }
        
        return (matchId || matchEmail) && matchPass;
    });

    if (!user) {
        console.log("Login Failed: No matching user or wrong password.");
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ 
        message: 'Login successful', 
        user: { 
            id: user.id, 
            fullName: user.fullName, 
            email: user.email, 
            role: user.role,
            idNumber: user.idNumber
        } 
    });
});

module.exports = router;
