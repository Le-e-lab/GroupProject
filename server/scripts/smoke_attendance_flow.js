const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function post(path, body, cookie) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data, headers: response.headers };
}

async function get(path, cookie) {
  const response = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {}
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data, headers: response.headers };
}

function cookieFrom(headers) {
  const setCookie = headers.get('set-cookie') || '';
  return setCookie.split(';')[0] || '';
}

async function run() {
  let failed = 0;

  const adminLogin = await post('/api/auth/login', { email: 'admin', password: 'admin123' });
  if (!adminLogin.ok) {
    console.error('[FAIL] admin login', adminLogin.status, adminLogin.data);
    process.exit(1);
  }
  const adminCookie = cookieFrom(adminLogin.headers);

  const users = await get('/api/auth/users', adminCookie);
  const allClasses = await get('/api/classes', adminCookie);
  if (!users.ok || !allClasses.ok) {
    console.error('[FAIL] prerequisite load', users.status, allClasses.status);
    process.exit(1);
  }

  const lecturer = (users.data.lecturers || [])[0];
  const student = (users.data.students || [])[0];
  if (!lecturer || !student) {
    console.error('[FAIL] seed data missing lecturer/student');
    process.exit(1);
  }

  const lecturerLogin = await post('/api/auth/login', { email: lecturer.id, password: 'staff123' });
  if (!lecturerLogin.ok) {
    console.error('[FAIL] lecturer login', lecturerLogin.status, lecturerLogin.data);
    process.exit(1);
  }
  const lecturerCookie = cookieFrom(lecturerLogin.headers);

  const ownClasses = await get(`/api/classes/lecturer/${lecturer.id}`, lecturerCookie);
  const ownClass = (ownClasses.data || [])[0];
  if (!ownClasses.ok || !ownClass) {
    console.error('[FAIL] lecturer own class unavailable');
    process.exit(1);
  }

  const openOwn = await post('/api/attendance/checkin', { classId: ownClass.id }, lecturerCookie);
  if (!openOwn.ok) {
    console.error('[FAIL] own class checkin open', openOwn.status, openOwn.data);
    failed += 1;
  }

  const ownIds = new Set((ownClasses.data || []).map((c) => c.id));
  const foreign = (allClasses.data || []).find((c) => !ownIds.has(c.id));
  if (foreign) {
    const openForeign = await post('/api/attendance/checkin', { classId: foreign.id }, lecturerCookie);
    if (openForeign.ok) {
      console.error('[FAIL] foreign class was allowed for lecturer');
      failed += 1;
    }
  }

  const mismatch = (allClasses.data || []).find((c) => {
    const studentProgram = String(student.program || '').toLowerCase();
    const classProgram = String(c.program || '').toLowerCase();
    if (!studentProgram || !classProgram) return false;
    return !(studentProgram.startsWith(classProgram) || classProgram.startsWith(studentProgram));
  });

  if (mismatch) {
    const openMismatch = await post('/api/attendance/checkin', { classId: mismatch.id }, adminCookie);
    if (!openMismatch.ok || !openMismatch.data.code) {
      console.error('[FAIL] admin open mismatch class session', openMismatch.status, openMismatch.data);
      failed += 1;
    } else {
      const studentLogin = await post('/api/auth/login', { email: student.id, password: 'password123' });
      if (!studentLogin.ok) {
        console.error('[FAIL] student login', studentLogin.status, studentLogin.data);
        failed += 1;
      } else {
        const studentCookie = cookieFrom(studentLogin.headers);
        const mismatchAttempt = await post('/api/attendance/validate-checkin', {
          classId: mismatch.id,
          studentId: student.id,
          code: openMismatch.data.code
        }, studentCookie);
        if (mismatchAttempt.ok) {
          console.error('[FAIL] mismatched student-class checkin was allowed');
          failed += 1;
        }
      }
    }
  }

  const closeOwn = await post('/api/attendance/close', { classId: ownClass.id }, lecturerCookie);
  if (!closeOwn.ok) {
    console.error('[FAIL] close own class session', closeOwn.status, closeOwn.data);
    failed += 1;
  }

  if (failed > 0) {
    console.error(`[SMOKE] attendance flow failed with ${failed} issue(s)`);
    process.exit(1);
  }

  console.log('[SMOKE] attendance flow passed');
}

run().catch((err) => {
  console.error('[SMOKE] attendance flow crashed', err);
  process.exit(1);
});
