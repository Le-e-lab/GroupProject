/*
 * Admin Dashboard Smoke Script
 * Usage:
 *   node server/scripts/smoke_admin_dashboard.js
 *
 * Optional env:
 *   SMOKE_BASE_URL=http://localhost:3000
 *   ADMIN_TEST_ID=admin
 *   ADMIN_TEST_PASSWORD=admin123
 *   LECTURER_TEST_ID=210153
 *   LECTURER_TEST_PASSWORD=staff123
 */

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const adminId = process.env.ADMIN_TEST_ID || 'admin';
const adminPassword = process.env.ADMIN_TEST_PASSWORD || 'admin123';
const lecturerId = process.env.LECTURER_TEST_ID || '210153';
const lecturerPassword = process.env.LECTURER_TEST_PASSWORD || 'staff123';
const studentId = process.env.STUDENT_TEST_ID || '240101';
const studentPassword = process.env.STUDENT_TEST_PASSWORD || 'password123';

function log(msg) {
    process.stdout.write(`${msg}\n`);
}

function cookieHeader(setCookieHeaders) {
    if (!Array.isArray(setCookieHeaders)) return '';
    return setCookieHeaders.map((c) => String(c).split(';')[0]).join('; ');
}

async function login(id, password) {
    if (!id || !password) {
        return {
            ok: false,
            status: 0,
            cookie: '',
            body: { message: 'Missing login credentials for smoke test' }
        };
    }

    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id, email: id, id, password })
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
    log(`[SMOKE] Admin identity: ${adminId}`);
    log(`[SMOKE] Lecturer identity: ${lecturerId}`);
    log(`[SMOKE] Student identity: ${studentId}`);

    const admin = await login(adminId, adminPassword);
    log(`[SMOKE] admin login status=${admin.status}`);
    if (!admin.ok) {
        failed += 1;
        log(`[SMOKE] admin login failed: ${(admin.body && admin.body.message) || 'unknown error'}`);
    } else {
        const stats = await getWithCookie('/api/admin/stats', admin.cookie);
        log(`[SMOKE] admin stats status=${stats.status}`);
        if (!stats.ok) failed += 1;

        const timetable = await getWithCookie('/api/admin/timetable', admin.cookie);
        log(`[SMOKE] admin timetable status=${timetable.status}`);
        if (!timetable.ok) failed += 1;

        const status = await getWithCookie('/api/admin/timetable/upload-status', admin.cookie);
        log(`[SMOKE] admin upload-status status=${status.status}`);
        if (!status.ok) failed += 1;

        const history = await getWithCookie('/api/admin/timetable/upload-history', admin.cookie);
        log(`[SMOKE] admin upload-history status=${history.status}`);
        if (!history.ok) failed += 1;

        const backups = await getWithCookie('/api/admin/timetable/backups', admin.cookie);
        log(`[SMOKE] admin backups status=${backups.status}`);
        if (!backups.ok) failed += 1;

        const lecturerDupes = await getWithCookie('/api/admin/data-quality/lecturer-duplicates', admin.cookie);
        log(`[SMOKE] admin lecturer-duplicates status=${lecturerDupes.status}`);
        if (!lecturerDupes.ok) failed += 1;

        const studentDupes = await getWithCookie('/api/admin/data-quality/student-duplicates', admin.cookie);
        log(`[SMOKE] admin student-duplicates status=${studentDupes.status}`);
        if (!studentDupes.ok) failed += 1;

        const security = await getWithCookie('/api/admin/security/checks', admin.cookie);
        log(`[SMOKE] admin security-checks status=${security.status}`);
        if (!security.ok) failed += 1;

        const users = await getWithCookie('/api/users', admin.cookie);
        log(`[SMOKE] admin users status=${users.status}`);
        if (!users.ok) failed += 1;
    }

    const lecturer = await login(lecturerId, lecturerPassword);
    log(`[SMOKE] lecturer login status=${lecturer.status}`);
    if (!lecturer.ok) {
        failed += 1;
        log(`[SMOKE] lecturer login failed: ${(lecturer.body && lecturer.body.message) || 'unknown error'}`);
    } else {
        const forbidden = await getWithCookie('/api/admin/timetable/upload-status', lecturer.cookie);
        log(`[SMOKE] lecturer admin endpoint status=${forbidden.status} (expected 403)`);
        if (forbidden.status !== 403) failed += 1;
    }

    const student = await login(studentId, studentPassword);
    log(`[SMOKE] student login status=${student.status}`);
    if (!student.ok) {
        failed += 1;
        log(`[SMOKE] student login failed: ${(student.body && student.body.message) || 'unknown error'}`);
    } else {
        const usersForbidden = await getWithCookie('/api/users', student.cookie);
        log(`[SMOKE] student users endpoint status=${usersForbidden.status} (expected 403)`);
        if (usersForbidden.status !== 403) failed += 1;

        const overviewForbidden = await getWithCookie('/api/users/stats/overview', student.cookie);
        log(`[SMOKE] student users overview endpoint status=${overviewForbidden.status} (expected 403)`);
        if (overviewForbidden.status !== 403) failed += 1;
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
