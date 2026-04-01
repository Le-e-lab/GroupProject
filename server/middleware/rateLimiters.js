const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwt');

function getAuthUserId(req) {
    const token = req.cookies && req.cookies.upath_token;
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        return decoded && decoded.id ? String(decoded.id) : null;
    } catch (e) {
        return null;
    }
}

function getLoginIdentifier(req) {
    const raw = req.body && (req.body.email || req.body.id || req.body.identifier);
    if (!raw) return null;
    return String(raw).trim().toLowerCase();
}

function identityKey(req, prefix) {
    const userId = getAuthUserId(req);
    if (userId) return `${prefix}:uid:${userId}`;

    const identifier = getLoginIdentifier(req);
    if (identifier) return `${prefix}:ident:${identifier}`;

    return `${prefix}:ip:${ipKeyGenerator(req.ip)}`;
}

const apiIdentityLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => identityKey(req, 'api'),
    message: { message: 'Too many requests. Please slow down and try again shortly.' }
});

const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => identityKey(req, 'auth-login'),
    skipSuccessfulRequests: true,
    message: { message: 'Too many login attempts. Please wait and try again.' }
});

const attendanceAttemptLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user && req.user.id ? String(req.user.id) : getAuthUserId(req);
        if (userId) return `attendance-verify:uid:${userId}`;

        const studentId = req.body && req.body.studentId ? String(req.body.studentId).trim() : '';
        if (studentId) return `attendance-verify:student:${studentId}`;

        return `attendance-verify:ip:${ipKeyGenerator(req.ip)}`;
    },
    skipSuccessfulRequests: true,
    message: { message: 'Too many attendance code attempts. Please wait before retrying.' }
});

module.exports = {
    apiIdentityLimiter,
    authLoginLimiter,
    attendanceAttemptLimiter
};
