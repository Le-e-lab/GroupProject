const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwt');

const authMiddleware = (req, res, next) => {
    // Check for token in cookies
    const token = req.cookies.upath_token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    try {
        const jwtSecret = getJwtSecret();
        // Verify token
        const decoded = jwt.verify(token, jwtSecret);
        
        // Attach user info to request
        req.user = decoded;
        
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err.message);
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = authMiddleware;
