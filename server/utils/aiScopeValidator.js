/**
 * AI Scope Validator
 * Ensures AI responses stay within application domain
 * Prevents hallucination and off-topic responses
 */

const ALLOWED_SCOPES = {
    'attendance': {
        keywords: ['attendance', 'check-in', 'checkout', 'present', 'absent', 'late', 'excused', 'report', 'export'],
        description: 'Attendance tracking, check-ins, reports'
    },
    'schedule': {
        keywords: ['schedule', 'timetable', 'class', 'course', 'time', 'venue', 'day', 'lecture', 'lesson'],
        description: 'Class schedules and timetables'
    },
    'dashboard': {
        keywords: ['dashboard', 'summary', 'overview', 'status', 'stats', 'next'],
        description: 'Dashboard pages and user status'
    },
    'map': {
        keywords: ['map', 'building', 'location', 'direction', 'room', 'venue', 'where', 'find'],
        description: 'Campus map and location finding'
    },
    'profile': {
        keywords: ['profile', 'name', 'email', 'program', 'year', 'department', 'info'],
        description: 'User profile information'
    },
    'admin': {
        keywords: ['upload', 'data', 'duplicate', 'quality', 'security', 'export', 'backup'],
        description: 'Administrative data quality and uploads'
    }
};

const OUT_OF_SCOPE_KEYWORDS = new Set([
    'password', 'secret', 'token', 'api', 'database', 'server', 'config',
    'medical', 'health', 'hospital', 'doctor', 'illness',
    'money', 'payment', 'fee', 'financial', 'bank', 'credit',
    'personal', 'advice', 'relationship', 'private',
    'politics', 'religion', 'controversial',
    'illegal', 'hack', 'cheat', 'bypass'
]);

/**
 * Check if a prompt/question is within the allowed scope
 * @param {string} prompt - User's question/prompt
 * @param {string} userRole - User's role (student, lecturer, admin, etc.)
 * @returns {object} { isInScope: boolean, reason: string, scopes: string[] }
 */
function validateScope(prompt, userRole = 'student') {
    const text = String(prompt || '').toLowerCase();
    
    // Check for out-of-scope keywords
    for (const keyword of OUT_OF_SCOPE_KEYWORDS) {
        if (text.includes(keyword)) {
            return {
                isInScope: false,
                reason: `Question contains out-of-scope topic: "${keyword}". I can only help with attendance, schedules, profiles, and campus navigation.`,
                scopes: []
            };
        }
    }
    
    // Find matching scopes
    const matchedScopes = [];
    const scores = {};
    
    for (const [scope, config] of Object.entries(ALLOWED_SCOPES)) {
        // Admin role can access admin scope more easily
        if (scope === 'admin' && userRole !== 'admin') {
            continue;
        }
        
        let score = 0;
        for (const keyword of config.keywords) {
            if (text.includes(keyword)) {
                score += keyword.length; // Weight by keyword length
            }
        }
        
        if (score > 0) {
            scores[scope] = score;
            matchedScopes.push({ scope, score });
        }
    }
    
    // If we found matching scopes, it's likely in scope
    if (matchedScopes.length > 0) {
        matchedScopes.sort((a, b) => b.score - a.score);
        const scopeNames = matchedScopes.map(m => m.scope);
        
        return {
            isInScope: true,
            reason: null,
            scopes: scopeNames,
            confidence: matchedScopes[0].score
        };
    }
    
    // Very short or empty prompts are likely not specific enough
    if (text.length < 5) {
        return {
            isInScope: false,
            reason: 'Your question is too short. Please ask something specific about attendance, schedules, reports, or campus locations.',
            scopes: []
        };
    }
    
    // Moderate confidence check
    // If it has some words but doesn't match strongly, ask for clarification
    return {
        isInScope: false,
        reason: 'I couldn\'t understand the topic clearly. Please ask about: attendance, class schedules, reports, profiles, or campus buildings.',
        scopes: [],
        suggestion: 'Try asking about your attendance records, today\'s schedule, or how to find a building.'
    };
}

/**
 * Build a scope-filtered system instruction for the AI
 * @param {string} userRole - User's role
 * @param {string[]} detectedScopes - Scopes detected from the prompt
 * @returns {string} Updated system instruction
 */
function buildScopedInstruction(userRole, detectedScopes = []) {
    const baseInstruction = [
        'You are a helpful assistant for the UPath attendance and scheduling system.',
        'Your expertise is strictly limited to:',
        '  • Attendance tracking (check-ins, reports, exports)',
        '  • Class schedules and timetables',
        '  • Student and lecturer dashboards',
        '  • Campus map and building locations',
        '  • User profiles and program information.'
    ];
    
    if (userRole === 'admin') {
        baseInstruction.push('  • Data quality issues and administrative tasks');
    }
    
    baseInstruction.push('');
    baseInstruction.push('IMPORTANT RULES:');
    baseInstruction.push('1. Do NOT reveal API keys, tokens, passwords, or server details.');
    baseInstruction.push('2. Do NOT provide personal, medical, or financial advice.');
    baseInstruction.push('3. If asked about out-of-scope topics, politely redirect.');
    baseInstruction.push('4. Keep answers short and actionable.');
    baseInstruction.push('5. When relevant, suggest checking a specific page or feature.');
    
    return baseInstruction.join('\n');
}

module.exports = {
    validateScope,
    buildScopedInstruction,
    ALLOWED_SCOPES,
    OUT_OF_SCOPE_KEYWORDS
};
