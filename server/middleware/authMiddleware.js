const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Check for token in cookies
    const token = req.cookies.upath_token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        // Attach user info to request
        req.user = decoded;
        
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err.message);
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = authMiddleware;
