const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const validator = require('validator');
const authMiddleware = require('../middleware/authMiddleware');
const { User } = require('../models');
const { validateScope, buildScopedInstruction } = require('../utils/aiScopeValidator');

const router = express.Router();

const assistantLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        if (req.user && req.user.id) {
            return `ai:uid:${req.user.id}`;
        }
        return `ai:ip:${ipKeyGenerator(req.ip)}`;
    },
    message: { message: 'Too many assistant requests. Please wait a moment and try again.' }
});

const allowedRoles = new Set(['student', 'student_rep', 'lecturer', 'admin']);

function normalizeLanguage(input) {
    const short = String(input || '').trim().toLowerCase().slice(0, 2);
    return ['en', 'fr', 'pt'].includes(short) ? short : 'en';
}

function normalizeResponseStyle(input) {
    const style = String(input || '').trim().toLowerCase();
    if (['concise', 'detailed', 'action-plan'].includes(style)) return style;
    return 'balanced';
}

function detectPromptIntent(prompt) {
    const text = String(prompt || '').toLowerCase();
    if (/summar|recap|overview|résum|resum|resumo/.test(text)) return 'summary';
    if (/next action|what next|next step|prochaine action|proximo passo/.test(text)) return 'next-action';
    if (/recommend|improve|insight|trend|analysis|analyse|analise/.test(text)) return 'insight';
    if (/schedule|timetable|class|cours|aula|attendance|presence|presenca/.test(text)) return 'schedule';
    return 'general';
}

function isProfileFieldQuery(prompt) {
    const text = String(prompt || '').toLowerCase();
    const aboutIdentity = /(my|mon|ma|minha|meu|perfil|profile|compte|conta)/.test(text);
    const asksFields = /(year|annee|année|program|programme|curso|college|coll[eè]ge|department|departement|departamento)/.test(text);
    return aboutIdentity && asksFields;
}

function buildProfileFieldAnswer(user, language) {
    const year = user && user.year !== null && user.year !== undefined ? user.year : null;
    const program = user && user.program ? user.program : null;
    const college = user && user.college ? user.college : null;
    const department = user && user.department ? user.department : null;

    if (language === 'fr') {
        const parts = [
            `Annee: ${year !== null ? year : 'non renseignee'}`,
            `Programme: ${program || 'non renseigne'}`,
            `College: ${college || 'non renseigne'}`,
            `Departement: ${department || 'non renseigne'}`
        ];
        return `Voici les informations de votre profil:\n${parts.join('\n')}`;
    }

    if (language === 'pt') {
        const parts = [
            `Ano: ${year !== null ? year : 'nao informado'}`,
            `Programa: ${program || 'nao informado'}`,
            `Colegio: ${college || 'nao informado'}`,
            `Departamento: ${department || 'nao informado'}`
        ];
        return `Aqui estao os dados do seu perfil:\n${parts.join('\n')}`;
    }

    const parts = [
        `Year: ${year !== null ? year : 'not set'}`,
        `Program: ${program || 'not set'}`,
        `College: ${college || 'not set'}`,
        `Department: ${department || 'not set'}`
    ];
    return `Here are your profile details:\n${parts.join('\n')}`;
}

router.use(authMiddleware);

router.post('/assistant', assistantLimiter, async (req, res) => {
    try {
        const requestStartedAt = Date.now();
        const requestId = `ai_${requestStartedAt}_${Math.random().toString(36).slice(2, 8)}`;

        if (!req.user || !allowedRoles.has(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const enabled = String(process.env.AI_ASSISTANT_ENABLED || 'true').toLowerCase() !== 'false';
        const apiKey =
            process.env.GEMINI_API_KEY ||
            process.env.GOOGLE_API_KEY ||
            process.env.GEMINI_KEY ||
            '';
        const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

        if (!enabled) {
            return res.status(503).json({ message: 'AI assistant is disabled in this environment.' });
        }

        if (!apiKey) {
            return res.status(503).json({
                message: 'AI assistant is not configured on the server.',
                details: 'Set GEMINI_API_KEY (or GOOGLE_API_KEY / GEMINI_KEY) in .env and restart server.'
            });
        }

        const fullUser = await User.findByPk(req.user.id, {
            attributes: ['id', 'fullName', 'email', 'role', 'year', 'program', 'college', 'department', 'language']
        });
        const authoritativeUser = fullUser ? fullUser.get({ plain: true }) : null;

        const rawPrompt = validator.trim(String(req.body.prompt || ''));
        const page = validator.trim(String(req.body.page || ''));
        const context = req.body && typeof req.body.context === 'object' ? req.body.context : {};
        const debug = req.body.debug === true; // Debug flag from admin panel
        const preferredLanguage = normalizeLanguage(
            context.preferredLanguage || authoritativeUser?.language || req.user.language || req.body.language || 'en'
        );
        const responseStyle = normalizeResponseStyle(context.responseStyle || req.body.responseStyle);

        if (isProfileFieldQuery(rawPrompt)) {
            return res.status(200).json({
                success: true,
                answer: buildProfileFieldAnswer(authoritativeUser || req.user, preferredLanguage),
                model: 'profile-db'
            });
        }

        if (!rawPrompt) {
            return res.status(400).json({ message: 'Prompt is required' });
        }

        // Validate scope (AI stays within application domain)
        const scopeCheck = validateScope(rawPrompt, req.user.role);
        if (!scopeCheck.isInScope) {
            const errorResponse = {
                success: false,
                answer: scopeCheck.reason,
                scope_validation: scopeCheck,
                model: preferredModel,
                debug: debug ? {
                    requestId,
                    message: 'Scope validation rejected this prompt',
                    request: {
                        endpoint: '/api/ai/assistant',
                        page,
                        promptLength: rawPrompt.length,
                        role: req.user.role,
                        language: preferredLanguage,
                        profile: authoritativeUser
                    },
                    timing: {
                        durationMs: Date.now() - requestStartedAt
                    }
                } : undefined
            };
            return res.status(200).json(errorResponse);
        }

        const safePrompt = rawPrompt.slice(0, 2000);
        const promptIntent = detectPromptIntent(safePrompt);
        const profileSnapshot = authoritativeUser || {
            id: req.user.id,
            fullName: req.user.fullName,
            year: req.user.year || null,
            program: req.user.program || null,
            college: req.user.college || null,
            department: req.user.department || null,
            language: preferredLanguage
        };
        const safeContext = JSON.stringify({
            page,
            role: req.user.role,
            user: profileSnapshot,
            promptIntent,
            pageContext: context
        }, null, 2);

        // Use scoped instruction instead of hardcoded one
        const systemInstruction = [
            buildScopedInstruction(req.user.role, scopeCheck.scopes || []),
            '',
            'COLLABORATIVE CRITIQUE MODE:',
            '1. Do not blindly agree with the user; respectfully challenge weak ideas.',
            '2. If a request can be improved, propose a stronger alternative and explain why.',
            '3. Point out risks, missing context, trade-offs, and practical next steps.',
            '4. Ask at least one clarifying question when requirements are ambiguous.',
            '5. Use context and learned lessons from provided app data before answering.',
            '6. If asked for web research and no web evidence is provided in context, state that live web results are unavailable and provide a concise search plan instead of inventing facts.',
            '7. Keep criticism constructive, specific, and solution-oriented.',
            `8. Respond in language code: ${preferredLanguage} (en=English, fr=French, pt=Portuguese).`,
            '9. Use profile details only when relevant to the user request; avoid repeating the same identity intro in every answer.',
            '10. Vary wording between requests and avoid formulaic openings such as repeating the same first sentence.',
            '11. If the request asks for summary/recap, produce: a) what the data says now, b) what matters most, c) the next best action.',
            '12. For lecturer contexts, give data-driven insights and practical recommendations (timing, engagement, risk groups, attendance interventions).',
            '13. If the profile is incomplete, say exactly which fields are available and which are missing instead of guessing.',
            `14. Response style preference: ${responseStyle}.`,
            '15. If style is concise, keep to 3-5 bullets. If detailed, include deeper explanation and rationale. If action-plan, output clear numbered steps with expected impact.'
        ].join('\n');

        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: `${systemInstruction}\n\nContext:\n${safeContext}\n\nUser request:\n${safePrompt}` }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                topP: 0.8,
                maxOutputTokens: 512
            }
        };
        const modelCandidates = [
            preferredModel,
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-2.0-flash-lite'
        ].filter((value, idx, arr) => value && arr.indexOf(value) === idx);

        let response = null;
        let selectedModel = preferredModel;
        let providerStatus = 0;
        let providerBody = '';

        for (const candidateModel of modelCandidates) {
            selectedModel = candidateModel;
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (response.ok) {
                break;
            }

            providerStatus = response.status;
            providerBody = await response.text();
            console.error('[AI] Gemini error:', candidateModel, response.status, providerBody.slice(0, 500));

            // Try next model when this model path is unavailable or quota-limited.
            if (response.status === 404 || response.status === 429) {
                continue;
            }

            // Other provider errors should stop retries.
            break;
        }

        if (!response || !response.ok) {
            let hint = 'Model provider request failed.';
            if (providerStatus === 400 || providerStatus === 401 || providerStatus === 403) {
                hint = 'Gemini key may be invalid, restricted, or not enabled for this API.';
            } else if (providerStatus === 404) {
                hint = 'Gemini model not available for this key/project. Try setting GEMINI_MODEL=gemini-2.0-flash.';
            } else if (providerStatus === 429) {
                hint = 'Gemini quota/rate limit reached. Try again later or check quota settings.';
            }

            return res.status(200).json({
                success: false,
                answer: 'AI is temporarily unavailable from the model provider. You can retry shortly.',
                message: 'AI assistant failed to respond from the model provider.',
                providerStatus: providerStatus || (response ? response.status : 0),
                hint,
                model: selectedModel,
                debug: debug ? {
                    requestId,
                    providerStatus: providerStatus || (response ? response.status : 0),
                    providerBody: providerBody ? providerBody.slice(0, 800) : '',
                    timing: {
                        durationMs: Date.now() - requestStartedAt
                    }
                } : undefined
            });
        }

        const data = await response.json();
        const answer = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();

        if (!answer) {
            return res.status(200).json({
                success: false,
                answer: 'AI returned an empty response. Please try again.',
                message: 'AI assistant returned an empty response.',
                model: selectedModel
            });
        }

        const responsePayload = {
            success: true,
            answer,
            model: selectedModel,
            usage: data.usageMetadata || null
        };
        
        // Include debug info if requested (admin panel feature)
        if (debug && req.user.role === 'admin') {
            responsePayload.debug = {
                requestId,
                scopes: scopeCheck.scopes,
                confidence: scopeCheck.confidence || 'N/A',
                language: preferredLanguage,
                request_time: new Date().toISOString(),
                request: {
                    endpoint: '/api/ai/assistant',
                    page,
                    promptLength: rawPrompt.length,
                    role: req.user.role,
                    userId: req.user.id
                },
                provider: {
                    name: 'Google Gemini',
                    model: selectedModel,
                    endpoint: `models/${selectedModel}:generateContent`
                },
                timing: {
                    durationMs: Date.now() - requestStartedAt
                },
                model_config: {
                    temperature: 0.3,
                    topP: 0.8,
                    maxOutputTokens: 512
                }
            };
        }
        
        return res.json(responsePayload);
    } catch (err) {
        console.error('[AI] Assistant error:', err);
        return res.status(500).json({ message: 'Error generating assistant response' });
    }
});

module.exports = router;