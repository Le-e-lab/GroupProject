(function () {
    const PAGE_CONFIG = {
        'student-dashboard': {
            title: 'Student Helper',
            subtitle: 'Quick answers for classes, attendance, and next steps.',
            placeholder: 'Ask about your timetable, attendance, or what to do next...',
            defaultPrompt: 'Summarize this page for me and tell me the next best action.',
            prompts: [
                'Summarize my today classes and attendance status.',
                'Explain what I should check on this dashboard.',
                'Give me a short recap of my schedule and next action.'
            ]
        },
        'lecturer-dashboard': {
            title: 'Lecturer Helper',
            subtitle: 'Keep attendance, classes, and reports in view.',
            placeholder: 'Ask about classes, reports, attendance, or exports...',
            defaultPrompt: 'Summarize this lecturer dashboard and tell me the next useful action.',
            prompts: [
                'Summarize my classes and what needs attention today.',
                'Explain the fastest way to mark attendance for a class.',
                'Give me a concise overview of my teaching workload.'
            ]
        },
        'manual-attendance': {
            title: 'Attendance Helper',
            subtitle: 'Help with today’s check-ins, export lists, and class status.',
            placeholder: 'Ask about today’s check-ins or export options...',
            defaultPrompt: 'Summarize today\'s check-ins for this class and mention the export option.',
            prompts: [
                'Summarize today\'s check-ins for the selected class.',
                'Explain how the green tick and export list work.',
                'Give me a short checklist before I save attendance.'
            ]
        },
        'student-reports': {
            title: 'Attendance Reports Helper',
            subtitle: 'Interpret percentages and highlight what changed today.',
            placeholder: 'Ask about attendance percentages or trends...',
            defaultPrompt: 'Summarize this attendance report page in plain language.',
            prompts: [
                'Explain my attendance percentages in simple terms.',
                'Tell me which courses need the most attention.',
                'Summarize the report page and the next action to take.'
            ]
        },
        'student-schedule': {
            title: 'Schedule Helper',
            subtitle: 'Understand classes, timing conflicts, and attendance priorities.',
            placeholder: 'Ask about your weekly schedule and where to focus...',
            defaultPrompt: 'Review my weekly classes and suggest what to prioritize.',
            prompts: [
                'Summarize my busiest days and what to prepare for.',
                'Which classes are at risk based on attendance?',
                'Suggest a plan to avoid being late this week.'
            ]
        },
        'lecturer-classes': {
            title: 'Classes Helper',
            subtitle: 'Get practical suggestions for class management and attendance flow.',
            placeholder: 'Ask about your classes, sessions, and teaching priorities...',
            defaultPrompt: 'Summarize my classes and suggest the best actions for this week.',
            prompts: [
                'Which classes need the most attention this week?',
                'How can I improve attendance consistency?',
                'Give me a practical checklist for next sessions.'
            ]
        },
        'lecturer-schedule': {
            title: 'Teaching Schedule Helper',
            subtitle: 'Optimize schedule flow and reduce teaching friction.',
            placeholder: 'Ask about timetable pressure, sequencing, or improvements...',
            defaultPrompt: 'Analyze my teaching schedule and suggest improvements.',
            prompts: [
                'Highlight possible timetable bottlenecks for me.',
                'Suggest how to reduce late starts between sessions.',
                'What should I prepare first for tomorrow?'
            ]
        },
        'lecturer-reports': {
            title: 'Analytics Helper',
            subtitle: 'Turn attendance analytics into actionable decisions.',
            placeholder: 'Ask what the analytics imply and what to do next...',
            defaultPrompt: 'Summarize my analytics and recommend next actions.',
            prompts: [
                'Which courses show attendance risk trends?',
                'Give me actions to improve low attendance classes.',
                'What data quality checks should I run next?'
            ]
        },
        'student-map': {
            title: 'Campus Guide',
            subtitle: 'Help for new students: buildings, routes, and navigation tips.',
            placeholder: 'Ask for building directions, route tips, or class venue guidance...',
            defaultPrompt: 'Help me find my next class building and suggest the fastest walking route.',
            prompts: [
                'I am new. How do I find ICT Complex from the main gate?',
                'Explain how to use this map to get to my class venue.',
                'Give me safe walking tips between evening classes.'
            ]
        },
        'admin-dashboard': {
            title: 'Admin Helper',
            subtitle: 'A quick guide for data quality, uploads, and security checks.',
            placeholder: 'Ask about duplicates, uploads, or security settings...',
            defaultPrompt: 'Summarize this admin page and tell me what needs attention first.',
            prompts: [
                'Summarize the data quality issues on this page.',
                'Explain what I should check before uploading a timetable.',
                'Give me a short security and maintenance recap.'
            ]
        },
        default: {
            title: 'AI Helper',
            subtitle: 'A light assistant for page-specific guidance.',
            placeholder: 'Ask a question about this page...',
            defaultPrompt: 'Summarize this page and suggest the next useful step.',
            prompts: [
                'Summarize this page.',
                'What should I check next?',
                'Explain the important actions here.'
            ]
        }
    };

    function getConfig(context) {
        return PAGE_CONFIG[context] || PAGE_CONFIG.default;
    }

    const ROLE_LABELS = {
        en: {
            student: 'Student',
            student_rep: 'Student Rep',
            lecturer: 'Lecturer',
            admin: 'Admin'
        },
        fr: {
            student: 'Etudiant',
            student_rep: 'Représentant étudiant',
            lecturer: 'Enseignant',
            admin: 'Administrateur'
        },
        pt: {
            student: 'Estudante',
            student_rep: 'Representante estudantil',
            lecturer: 'Professor',
            admin: 'Administrador'
        }
    };

    const UI_COPY = {
        en: {
            openTitle: 'Open AI helper',
            closeTitle: 'Close assistant',
            ask: 'Ask AI',
            reset: 'Reset',
            styleLabel: 'Response style',
            styleBalanced: 'Balanced',
            styleConcise: 'Concise',
            styleDetailed: 'Detailed',
            styleActionPlan: 'Action Plan',
            thinking: 'Thinking...',
            defaultOutput: 'Ask a question to get a short, grounded answer.',
            meta: 'Your Gemini key stays on the server.',
            introPrefix: 'You are currently on',
            introAs: 'as',
            introProfile: 'Profile snapshot',
            introMissing: 'Some profile details are missing from your account.',
            introLanguage: 'Replies follow your selected language.'
        },
        fr: {
            openTitle: 'Ouvrir l’assistant IA',
            closeTitle: 'Fermer l’assistant',
            ask: 'Demander à l’IA',
            reset: 'Réinitialiser',
            styleLabel: 'Style de reponse',
            styleBalanced: 'Equilibre',
            styleConcise: 'Concis',
            styleDetailed: 'Detaille',
            styleActionPlan: 'Plan daction',
            thinking: 'Réflexion en cours...',
            defaultOutput: 'Posez une question pour obtenir une réponse courte et fiable.',
            meta: 'Votre clé Gemini reste sur le serveur.',
            introPrefix: 'Vous êtes actuellement sur',
            introAs: 'en tant que',
            introProfile: 'Aperçu du profil',
            introMissing: 'Certaines informations du profil manquent dans votre compte.',
            introLanguage: 'Les réponses suivent la langue choisie.'
        },
        pt: {
            openTitle: 'Abrir assistente de IA',
            closeTitle: 'Fechar assistente',
            ask: 'Perguntar à IA',
            reset: 'Redefinir',
            styleLabel: 'Estilo de resposta',
            styleBalanced: 'Equilibrado',
            styleConcise: 'Conciso',
            styleDetailed: 'Detalhado',
            styleActionPlan: 'Plano de acao',
            thinking: 'Pensando...',
            defaultOutput: 'Faça uma pergunta para receber uma resposta curta e objetiva.',
            meta: 'Sua chave Gemini fica no servidor.',
            introPrefix: 'Você está atualmente na',
            introAs: 'como',
            introProfile: 'Resumo do perfil',
            introMissing: 'Alguns dados do perfil estão ausentes na sua conta.',
            introLanguage: 'As respostas seguem o idioma escolhido.'
        }
    };

    function normalizeLanguage(language) {
        const value = String(language || 'en').toLowerCase();
        if (value.startsWith('fr')) return 'fr';
        if (value.startsWith('pt')) return 'pt';
        return 'en';
    }

    function getLanguageCode(user) {
        if (user && user.language) {
            return normalizeLanguage(user.language);
        }
        if (window.I18N && typeof I18N.currentLanguage === 'function') {
            return normalizeLanguage(I18N.currentLanguage());
        }
        return normalizeLanguage(navigator.language || 'en');
    }

    function getCopy(language) {
        return UI_COPY[language] || UI_COPY.en;
    }

    function getRoleLabel(role, language) {
        const labels = ROLE_LABELS[language] || ROLE_LABELS.en;
        return labels[role] || labels.student;
    }

    function buildProfileSummary(user, language) {
        const copy = getCopy(language);
        const parts = [];
        if (user && user.year) parts.push(`Year ${user.year}`);
        if (user && user.program) parts.push(user.program);
        if (user && user.college) parts.push(user.college);
        if (user && user.department && !parts.includes(user.department)) parts.push(user.department);
        return parts.length ? parts.join(' · ') : copy.introMissing;
    }

    function buildIntro(user, context, language) {
        const copy = getCopy(language);
        const name = user && user.fullName ? user.fullName : 'there';
        const roleLabel = getRoleLabel(user && user.role, language);
        const pageLabel = getConfig(context).title;
        const idLabel = user && user.id ? `ID: ${user.id}` : '';
        const profileSummary = buildProfileSummary(user, language);
        const parts = [
            `${copy.introPrefix} ${pageLabel}`,
            `${copy.introAs} ${name}${roleLabel ? ` (${roleLabel})` : ''}${idLabel ? ` (${idLabel})` : ''}.`,
            `${copy.introProfile}: ${profileSummary}.`,
            copy.introLanguage
        ];
        return parts.join(' ');
    }

    function readStoredUser() {
        try {
            const raw = sessionStorage.getItem('upath_user');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function writeStoredUser(user) {
        if (!user) return;
        try {
            sessionStorage.setItem('upath_user', JSON.stringify(user));
        } catch (_) {
            // Ignore storage failures and continue with the in-memory object.
        }
    }

    async function getAssistantUser() {
        const storedUser = readStoredUser();
        try {
            if (window.API && typeof API.getCurrentUser === 'function') {
                const response = await API.getCurrentUser();
                const user = response && response.user ? response.user : response;
                if (user && user.id) {
                    const merged = { ...(storedUser || {}), ...user };
                    writeStoredUser(merged);
                    return merged;
                }
            }
        } catch (_) {
            // Fall back to session data when the live request fails.
        }
        return storedUser;
    }

    function create(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function injectStyles() {
        if (document.getElementById('ai-assistant-styles')) return;
        const style = document.createElement('style');
        style.id = 'ai-assistant-styles';
        style.textContent = `
            .ai-fab {
                position: fixed;
                right: 22px;
                bottom: 22px;
                z-index: 2147483647;
                width: 58px;
                height: 58px;
                border: none;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--primary, #DC2626), #111827);
                color: #fff;
                font-weight: 800;
                box-shadow: 0 18px 40px rgba(0,0,0,0.22);
                cursor: pointer;
            }
            .ai-fab:hover { transform: translateY(-2px); }
            .ai-panel {
                position: fixed;
                right: 22px;
                bottom: 88px;
                width: min(480px, calc(100vw - 44px));
                max-height: min(68vh, 640px);
                display: none;
                flex-direction: column;
                z-index: 2147483646;
                background: var(--surface, #fff);
                color: var(--text, #111827);
                border: 1px solid var(--border, #E5E7EB);
                border-radius: 18px;
                box-shadow: 0 24px 60px rgba(0,0,0,0.22);
                overflow: hidden;
            }
            .ai-panel, .ai-panel * {
                box-sizing: border-box;
                min-width: 0;
                max-width: 100%;
            }
            .ai-panel.open { display: flex; }
            .ai-panel-header {
                padding: 16px 18px;
                border-bottom: 1px solid var(--border, #E5E7EB);
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                background: linear-gradient(135deg, rgba(220,38,38,0.08), rgba(17,24,39,0.04));
            }
            .ai-panel-header > div {
                min-width: 0;
                flex: 1;
            }
            .ai-panel-title { font-weight: 800; font-size: 0.98rem; margin-bottom: 4px; }
            .ai-panel-subtitle { font-size: 0.8rem; color: var(--text-muted, #6B7280); }
            .ai-close {
                border: none;
                background: transparent;
                color: var(--text-muted, #6B7280);
                font-size: 1.7rem;
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                cursor: pointer;
            }
            .ai-close:hover {
                background: var(--bg, #F3F4F6);
                color: var(--text, #111827);
            }
            .ai-panel-body {
                padding: 16px 18px 18px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                overflow: auto;
                min-width: 0;
                max-width: 100%;
            }
            .ai-prompt-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .ai-chip {
                border: 1px solid var(--border, #E5E7EB);
                background: var(--bg, #F9FAFB);
                color: var(--text, #111827);
                padding: 8px 10px;
                border-radius: 999px;
                font-size: 0.76rem;
                cursor: pointer;
                max-width: 100%;
                white-space: normal;
            }
            .ai-chip:hover { border-color: var(--primary, #DC2626); color: var(--primary, #DC2626); }
            .ai-input {
                width: 100%;
                min-height: 88px;
                border: 1px solid var(--border, #E5E7EB);
                border-radius: 12px;
                padding: 12px;
                resize: vertical;
                font: inherit;
                overflow-wrap: anywhere;
            }
            .ai-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            .ai-style-wrap {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .ai-style-label {
                font-size: 0.76rem;
                color: var(--text-muted, #6B7280);
                font-weight: 600;
            }
            .ai-style {
                border: 1px solid var(--border, #E5E7EB);
                border-radius: 10px;
                padding: 8px 10px;
                font: inherit;
                background: var(--surface, #fff);
                color: var(--text, #111827);
            }
            .ai-send, .ai-reset {
                border: none;
                border-radius: 10px;
                padding: 10px 14px;
                font-weight: 700;
                cursor: pointer;
            }
            .ai-send {
                background: var(--primary, #DC2626);
                color: #fff;
            }
            .ai-reset {
                background: var(--bg, #F3F4F6);
                color: var(--text, #111827);
            }
            .ai-output {
                white-space: pre-wrap;
                overflow-wrap: break-word;
                word-break: break-word;
                background: var(--bg, #F9FAFB);
                border: 1px solid var(--border, #E5E7EB);
                border-radius: 12px;
                padding: 12px;
                font-size: 0.93rem;
                line-height: 1.6;
                min-height: 160px;
                max-height: min(38vh, 360px);
                overflow-y: auto;
                max-width: 100%;
                overflow-x: hidden;
            }
            .ai-meta {
                font-size: 0.75rem;
                color: var(--text-muted, #6B7280);
                overflow-wrap: anywhere;
                word-break: break-word;
            }
            @media (max-width: 640px) {
                .ai-panel { right: 12px; left: 12px; width: auto; bottom: 82px; }
                .ai-fab { right: 12px; left: auto; bottom: 12px; }
                .ai-close { width: 44px; height: 44px; font-size: 1.9rem; }
            }
        `;
        document.head.appendChild(style);
    }

    function init() {
        if (!document.body) return;

        const context = document.body.dataset.aiContext || 'default';
        const config = getConfig(context);
        let activeUser = null;
        let activeLanguage = getLanguageCode(null);
        const copy = getCopy(activeLanguage);
        let panel = document.getElementById('ai-assistant-panel');
        if (!panel) {
            panel = create('div', 'ai-panel');
            panel.id = 'ai-assistant-panel';
        }
        let fab = document.getElementById('ai-assistant-fab');
        if (!fab) {
            fab = create('button', 'ai-fab', 'AI');
            fab.id = 'ai-assistant-fab';
            fab.type = 'button';
        }
        fab.classList.add('ai-fab');
        fab.type = 'button';
        fab.title = copy.openTitle;

        let title = panel.querySelector('.ai-panel-title');
        let subtitle = panel.querySelector('.ai-panel-subtitle');
        let closeBtn = panel.querySelector('.ai-close');
        let header = panel.querySelector('.ai-panel-header');
        let body = panel.querySelector('.ai-panel-body');

        if (!header || !body) {
            header = create('div', 'ai-panel-header');
            const titleWrap = create('div');
            title = create('div', 'ai-panel-title', config.title);
            subtitle = create('div', 'ai-panel-subtitle', config.subtitle);
            titleWrap.append(title, subtitle);
            closeBtn = create('button', 'ai-close', '×');
            closeBtn.type = 'button';
            header.append(titleWrap, closeBtn);
            body = create('div', 'ai-panel-body');
            panel.append(header, body);
        }

        if (!panel.isConnected) document.body.appendChild(panel);
        if (!fab.isConnected) document.body.appendChild(fab);

        const chipWrap = body.querySelector('.ai-prompt-chips') || create('div', 'ai-prompt-chips');
        const promptBox = body.querySelector('.ai-input') || create('textarea', 'ai-input');
        promptBox.placeholder = config.placeholder;
        promptBox.value = promptBox.value || config.defaultPrompt;

        config.prompts.forEach((prompt) => {
            const chip = create('button', 'ai-chip', prompt);
            chip.type = 'button';
            chip.addEventListener('click', () => {
                promptBox.value = prompt;
                promptBox.focus();
            });
            chipWrap.appendChild(chip);
        });

        const actions = body.querySelector('.ai-actions') || create('div', 'ai-actions');
        const styleWrap = actions.querySelector('.ai-style-wrap') || create('div', 'ai-style-wrap');
        const styleLabel = styleWrap.querySelector('.ai-style-label') || create('label', 'ai-style-label', copy.styleLabel);
        const styleSelect = styleWrap.querySelector('.ai-style') || create('select', 'ai-style');
        styleSelect.innerHTML = '';
        const styleOptions = [
            { value: 'balanced', label: copy.styleBalanced },
            { value: 'concise', label: copy.styleConcise },
            { value: 'detailed', label: copy.styleDetailed },
            { value: 'action-plan', label: copy.styleActionPlan }
        ];
        styleOptions.forEach((opt) => {
            const option = create('option');
            option.value = opt.value;
            option.textContent = opt.label;
            styleSelect.appendChild(option);
        });
        const storedStyle = localStorage.getItem('upath_ai_response_style') || 'balanced';
        styleSelect.value = ['balanced', 'concise', 'detailed', 'action-plan'].includes(storedStyle) ? storedStyle : 'balanced';
        styleSelect.addEventListener('change', () => {
            localStorage.setItem('upath_ai_response_style', styleSelect.value);
        });
        if (!styleLabel.isConnected) styleWrap.appendChild(styleLabel);
        if (!styleSelect.isConnected) styleWrap.appendChild(styleSelect);
        if (!styleWrap.isConnected) actions.append(styleWrap);
        const sendBtn = actions.querySelector('.ai-send') || create('button', 'ai-send', copy.ask);
        sendBtn.type = 'button';
        const resetBtn = actions.querySelector('.ai-reset') || create('button', 'ai-reset', copy.reset);
        resetBtn.type = 'button';
        if (!sendBtn.isConnected) actions.append(sendBtn);
        if (!resetBtn.isConnected) actions.append(resetBtn);

        const output = body.querySelector('.ai-output') || create('div', 'ai-output', copy.defaultOutput);
        const meta = body.querySelector('.ai-meta') || create('div', 'ai-meta', `${copy.meta} ${copy.introLanguage}`);

        if (!chipWrap.isConnected) body.append(chipWrap);
        if (!promptBox.isConnected) body.append(promptBox);
        if (!actions.isConnected) body.append(actions);
        if (!output.isConnected) body.append(output);
        if (!meta.isConnected) body.append(meta);

        function syncLocalizedCopy(user) {
            activeUser = user || activeUser;
            activeLanguage = getLanguageCode(activeUser);
            const localized = getCopy(activeLanguage);
            fab.title = localized.openTitle;
            closeBtn.title = localized.closeTitle;
            sendBtn.textContent = localized.ask;
            resetBtn.textContent = localized.reset;
            styleLabel.textContent = localized.styleLabel;
            const currentStyle = styleSelect.value || 'balanced';
            styleSelect.innerHTML = '';
            [
                { value: 'balanced', label: localized.styleBalanced },
                { value: 'concise', label: localized.styleConcise },
                { value: 'detailed', label: localized.styleDetailed },
                { value: 'action-plan', label: localized.styleActionPlan }
            ].forEach((opt) => {
                const option = create('option');
                option.value = opt.value;
                option.textContent = opt.label;
                styleSelect.appendChild(option);
            });
            styleSelect.value = currentStyle;
            promptBox.placeholder = config.placeholder;
            if (!promptBox.value.trim()) {
                promptBox.value = config.defaultPrompt;
            }
            if (!panel.classList.contains('open') && output.textContent === copy.defaultOutput) {
                output.textContent = buildIntro(activeUser, context, activeLanguage);
            }
            meta.textContent = `${localized.meta} ${localized.introLanguage}`;
        }

        fab.style.position = 'fixed';
        fab.style.right = '12px';
        fab.style.left = 'auto';
        fab.style.bottom = '12px';
        fab.style.zIndex = '2147483647';
        fab.style.display = 'flex';
        fab.style.alignItems = 'center';
        fab.style.justifyContent = 'center';
        fab.style.pointerEvents = 'auto';
        fab.style.touchAction = 'manipulation';
        fab.style.userSelect = 'none';

        syncLocalizedCopy(null);

        function openPanel() {
            syncLocalizedCopy(activeUser);
            panel.classList.add('open');
            promptBox.focus();
        }

        function closePanel() {
            panel.classList.remove('open');
        }

        async function ask() {
            const prompt = promptBox.value.trim();
            if (!prompt) return;

            if (!window.API || typeof API.askAssistant !== 'function') {
                output.textContent = 'AI service is still loading. Please try again in a moment.';
                return;
            }

            sendBtn.disabled = true;
            resetBtn.disabled = true;
            output.textContent = getCopy(activeLanguage).thinking;

            try {
                const user = await getAssistantUser();
                activeUser = user || activeUser;
                syncLocalizedCopy(activeUser);
                const userContext = {
                    ...(window.AI_ASSISTANT_CONTEXT || {})
                };
                if (user) {
                    userContext.userId = user.id || userContext.userId;
                    userContext.fullName = user.fullName || userContext.fullName;
                    userContext.year = user.year ?? userContext.year ?? null;
                    userContext.program = user.program ?? userContext.program ?? null;
                    userContext.college = user.college ?? userContext.college ?? null;
                    userContext.department = user.department ?? userContext.department ?? null;
                    userContext.preferredLanguage = user.language || userContext.preferredLanguage;
                }
                const response = await API.askAssistant({
                    page: context,
                    prompt,
                    language: user && user.language ? user.language : undefined,
                    responseStyle: styleSelect.value,
                    context: {
                        ...userContext,
                        collaborativeMode: true,
                        preferredLanguage: user && user.language ? user.language : undefined,
                        responseStyle: styleSelect.value
                    }
                });

                output.textContent = response && response.answer
                    ? response.answer
                    : (response && response.message ? response.message : buildIntro(activeUser, context, activeLanguage));
            } catch (err) {
                output.textContent = err && err.message ? err.message : 'AI assistant request failed.';
            } finally {
                sendBtn.disabled = false;
                resetBtn.disabled = false;
            }
        }

        fab.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (panel.classList.contains('open')) closePanel();
            else openPanel();
        });
        
        closeBtn.addEventListener('click', closePanel);
        sendBtn.addEventListener('click', ask);
        
        // Enter key to send (Shift+Enter for newline)
        promptBox.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                ask();
            }
        });
        
        resetBtn.addEventListener('click', () => {
            promptBox.value = config.defaultPrompt;
            output.textContent = buildIntro(activeUser, context, activeLanguage);
        });

        // Escape to close panel
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && panel.classList.contains('open')) closePanel();
        });
        
        // Click outside to close (but not on the panel itself)
        document.addEventListener('click', (event) => {
            const isClickOnPanel = panel.contains(event.target);
            const isClickOnFab = fab.contains(event.target);
            const isOpen = panel.classList.contains('open');
            
            if (isOpen && !isClickOnPanel && !isClickOnFab) {
                closePanel();
            }
        });
    }

    function safeInit() {
        try {
            injectStyles();
            init();
        } catch (error) {
            console.error('AI assistant initialization failed:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInit);
    } else {
        safeInit();
    }
})();
