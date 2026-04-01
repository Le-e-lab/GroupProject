/*
 * Admin Dashboard Smoke Script
 * Usage:
 *   node server/scripts/smoke_admin_dashboard.js
 *
 * Optional env:
 *   SMOKE_BASE_URL=http://localhost:3000
 *   ADMIN_TEST_ID=admin
 *   ADMIN_TEST_PASSWORD=...
 *   LECTURER_TEST_ID=210153
 *   LECTURER_TEST_PASSWORD=staff123
 */

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const adminId = process.env.ADMIN_TEST_ID || '';
const adminPassword = process.env.ADMIN_TEST_PASSWORD || '';
const lecturerId = process.env.LECTURER_TEST_ID || '210153';
const lecturerPassword = process.env.LECTURER_TEST_PASSWORD || 'staff123';

function log(msg) {
    process.stdout.write(`${msg}\n`);
}

function cookieHeader(setCookieHeaders) {
    if (!Array.isArray(setCookieHeaders)) return '';
    return setCookieHeaders.map((c) => String(c).split(';')[0]).join('; ');
}

async function login(id, password) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: id, password })
    });

    const body = await res.json().catch(() => ({}));
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    return {
        ok: res.ok,
        status: res.status,
        cookie: cookieHeader(setCookie),
        body
    };
}

async function getWithCookie(path, cookie) {
    const res = await fetch(`${baseUrl}${path}`, {
        headers: cookie ? { Cookie: cookie } : {}
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body };
}

async function run() {
    let failed = 0;

    log(`[SMOKE] Base URL: ${baseUrl}`);

    if (adminId && adminPassword) {
        const admin = await login(adminId, adminPassword);
        log(`[SMOKE] admin login status=${admin.status}`);
        if (!admin.ok) {
            failed += 1;
            log('[SMOKE] admin login failed');
        } else {
            const status = await getWithCookie('/api/admin/timetable/upload-status', admin.cookie);
            log(`[SMOKE] admin upload-status status=${status.status}`);
            if (!status.ok) failed += 1;

            const backups = await getWithCookie('/api/admin/timetable/backups', admin.cookie);
            log(`[SMOKE] admin backups status=${backups.status}`);
            if (!backups.ok) failed += 1;
        }
    } else {
        log('[SMOKE] admin credential env not set; skipping admin-authenticated checks');
    }

    const lecturer = await login(lecturerId, lecturerPassword);
    log(`[SMOKE] lecturer login status=${lecturer.status}`);
    if (!lecturer.ok) {
        failed += 1;
    } else {
        const forbidden = await getWithCookie('/api/admin/timetable/upload-status', lecturer.cookie);
        log(`[SMOKE] lecturer admin endpoint status=${forbidden.status} (expected 403)`);
        if (forbidden.status !== 403) failed += 1;
    }

    if (failed > 0) {
        log(`[SMOKE] FAILED checks=${failed}`);
        process.exit(1);
    }

    log('[SMOKE] PASSED');
}

run().catch((err) => {
    log(`[SMOKE] ERROR ${err.message}`);
    process.exit(1);
});
