const DEFAULT_TIMEOUT_MS = 20000;

function getProviderConfig() {
    const providerUrl = process.env.IDENTITY_PROVIDER_URL || '';
    const apiKey = process.env.IDENTITY_PROVIDER_API_KEY || '';
    return {
        enabled: Boolean(providerUrl),
        providerUrl,
        apiKey,
        timeoutMs: Number(process.env.IDENTITY_PROVIDER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
    };
}

async function verifyWithProvider(payload) {
    const cfg = getProviderConfig();
    if (!cfg.enabled) {
        return {
            verified: false,
            reason: 'provider_not_configured'
        };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
        const response = await fetch(cfg.providerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {})
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                verified: false,
                reason: data.reason || `provider_http_${response.status}`,
                details: data
            };
        }

        return {
            verified: Boolean(data.verified),
            reason: data.reason || (data.verified ? 'verified' : 'provider_rejected'),
            confidence: typeof data.confidence === 'number' ? data.confidence : null,
            details: data
        };
    } catch (error) {
        return {
            verified: false,
            reason: error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_error',
            error: error.message
        };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    getProviderConfig,
    verifyWithProvider
};
