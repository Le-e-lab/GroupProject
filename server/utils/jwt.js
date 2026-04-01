function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length < 32) {
        throw new Error('JWT_SECRET is missing or too short. Use at least 32 characters in production.');
    }
    return secret;
}

module.exports = { getJwtSecret };
