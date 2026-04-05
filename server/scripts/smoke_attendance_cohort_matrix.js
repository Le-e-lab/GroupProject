const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data, headers: response.headers };
}

function cookieFrom(headers) {
  const setCookie = headers.get('set-cookie') || '';
  return setCookie.split(';')[0] || '';
}

async function login(id, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: id, password })
  });
  return { ...res, cookie: cookieFrom(res.headers) };
}

async function getWithCookie(path, cookie) {
  return request(path, { headers: cookie ? { Cookie: cookie } : {} });
}

async function postWithCookie(path, body, cookie) {
  return request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body || {})
  });
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function courseCodeFromClassId(classId) {
  const safe = String(classId || '').trim();
  if (!safe) return '';
  if (safe.includes('--')) return safe.split('--')[0].trim();
  return safe.split('-')[0].trim();
}

function studentMatchesClass(student, cls) {
  const sp = normalize(student.program);
  const cp = normalize(cls.program);
  const sy = Number(student.year || 0);
  const cy = Number(cls.year || 0);
  const programMatch = sp && cp && (sp === cp);
  const yearMatch = sy > 0 && cy > 0 ? sy === cy : true;
  return programMatch && yearMatch;
}

function isCheckinAccepted(result) {
  const message = String((result && result.message) || '').toLowerCase();
  if (result && (result.attendanceId || result.checkedInAt || result.requiresVerification)) return true;
  return /already completed|check-in recorded|attendance successfully recorded/.test(message);
}

function pickUniqueByCode(classes) {
  const map = new Map();
  for (const cls of classes) {
    const code = String(cls.code || '').trim().toUpperCase();
    if (!code) continue;
    if (!map.has(code)) map.set(code, cls);
  }
  return Array.from(map.values());
}

function lecturerForClassRow(lecturers, cls) {
  const byId = lecturers.find((l) => String(l.id || '') === String(cls.lecturerId || ''));
  if (byId) return byId;

  const classLecturer = normalize(cls.lecturerName);
  if (!classLecturer) return null;
  return lecturers.find((l) => {
    const full = normalize(l.fullName);
    if (!full) return false;
    return full.includes(classLecturer) || classLecturer.includes(full) || full.split(' ').some((part) => part && classLecturer.includes(part));
  }) || null;
}

async function runScenario({ name, cls, lecturer, students }) {
  const lecturerLogin = await login(lecturer.id, 'staff123');
  if (!lecturerLogin.ok) {
    return { name, classId: cls.id, course: cls.code, error: `lecturer login failed (${lecturerLogin.status})`, results: [] };
  }

  const open = await postWithCookie('/api/attendance/checkin', { classId: cls.id }, lecturerLogin.cookie);
  if (!open.ok || !open.data.code) {
    return { name, classId: cls.id, course: cls.code, error: `checkin open failed (${open.status})`, results: [] };
  }

  const classScopedRoster = await getWithCookie(`/api/attendance/students/${encodeURIComponent(cls.code)}?classId=${encodeURIComponent(cls.id)}`, lecturerLogin.cookie);
  const rosterCount = classScopedRoster.ok && Array.isArray(classScopedRoster.data.students)
    ? classScopedRoster.data.students.length
    : 0;

  const results = [];
  for (const student of students) {
    const studentLogin = await login(student.id, 'password123');
    if (!studentLogin.ok) {
      results.push({ studentId: student.id, visible: false, checkin: false, reason: `login ${studentLogin.status}` });
      continue;
    }

    const active = await getWithCookie('/api/attendance/active-sessions', studentLogin.cookie);
    const sessions = active.ok && Array.isArray(active.data.sessions) ? active.data.sessions : [];
    const visible = sessions.some((s) => String(s.classId || '') === String(cls.id));

    const mark = await postWithCookie('/api/attendance/validate-checkin', {
      classId: cls.id,
      studentId: student.id,
      code: open.data.code
    }, studentLogin.cookie);

    results.push({
      studentId: student.id,
      visible,
      checkin: mark.ok && isCheckinAccepted(mark.data),
      reason: mark.ok ? 'ok' : `${mark.status} ${(mark.data && mark.data.message) || ''}`.trim()
    });
  }

  await postWithCookie('/api/attendance/close', { classId: cls.id }, lecturerLogin.cookie);

  return {
    name,
    classId: cls.id,
    course: cls.code,
    lecturer: lecturer.fullName,
    rosterCount,
    results
  };
}

async function main() {
  const adminLogin = await login('admin', 'admin123');
  if (!adminLogin.ok) {
    console.error('[FAIL] admin login failed', adminLogin.status, adminLogin.data);
    process.exit(1);
  }

  const usersRes = await getWithCookie('/api/users', adminLogin.cookie);
  const classesRes = await getWithCookie('/api/classes', adminLogin.cookie);
  if (!usersRes.ok || !classesRes.ok) {
    console.error('[FAIL] unable to load users/classes', usersRes.status, classesRes.status);
    process.exit(1);
  }

  const users = Array.isArray(usersRes.data)
    ? usersRes.data
    : (Array.isArray(usersRes.data && usersRes.data.users) ? usersRes.data.users : []);
  const students = users.filter((u) => ['student', 'student_rep'].includes(String(u.role || '').toLowerCase()));
  const lecturers = users.filter((u) => String(u.role || '').toLowerCase() === 'lecturer');
  const classes = Array.isArray(classesRes.data) ? classesRes.data : [];

  const byCode = (code) => classes.filter((c) => String(c.code || '').toUpperCase() === String(code).toUpperCase());
  const nsClasses = byCode('NCSC312');
  if (!nsClasses.length) {
    console.error('[FAIL] NCSC312 not found');
    process.exit(1);
  }

  const nsPreferred = nsClasses.find((c) => String(c.lecturerId || '') === '210153') || nsClasses[0];
  const nsPrimary = nsClasses.find((c) => lecturerForClassRow(lecturers, c)) || nsPreferred;
  const nsLecturer = lecturerForClassRow(lecturers, nsPrimary);
  if (!nsLecturer) {
    console.error('[FAIL] NCSC312 lecturer not found', nsPrimary);
    process.exit(1);
  }

  const nsEligible = students.filter((s) => studentMatchesClass(s, nsPrimary)).slice(0, 5);
  const nsLecturerClasses = classes.filter((c) => String(c.lecturerId || '') === String(nsLecturer.id || ''));
  const nsLecturerOther = pickUniqueByCode(nsLecturerClasses)
    .find((c) => String(c.code || '').toUpperCase() !== 'NCSC312');

  const mrChinz = lecturers.find((l) => normalize(l.fullName).includes('chinz')) || null;
  const mrChinzCourses = mrChinz
    ? pickUniqueByCode(classes.filter((c) => String(c.lecturerId || '') === String(mrChinz.id || ''))).slice(0, 2)
    : [];

  const scenarios = [];
  scenarios.push({
    name: 'NCSC312 (5 students)',
    cls: nsPrimary,
    lecturer: nsLecturer,
    students: nsEligible
  });

  if (nsLecturerOther) {
    scenarios.push({
      name: `${nsLecturerOther.code} (same lecturer, 5 students)`,
      cls: nsLecturerOther,
      lecturer: nsLecturer,
      students: students.filter((s) => studentMatchesClass(s, nsLecturerOther)).slice(0, 5)
    });
  }

  for (const c of mrChinzCourses) {
    scenarios.push({
      name: `Mr Chinzvende ${c.code} (5 students)`,
      cls: c,
      lecturer: mrChinz,
      students: students.filter((s) => studentMatchesClass(s, c)).slice(0, 5)
    });
  }

  const outputs = [];
  for (const scenario of scenarios) {
    if (!scenario.lecturer || !scenario.cls || !scenario.students.length) {
      outputs.push({
        name: scenario.name,
        classId: scenario.cls ? scenario.cls.id : '',
        course: scenario.cls ? scenario.cls.code : '',
        error: 'insufficient fixtures (lecturer/class/students)',
        results: []
      });
      continue;
    }
    outputs.push(await runScenario(scenario));
  }

  console.log('=== Cohort Matrix Smoke Results ===');
  for (const out of outputs) {
    console.log(`\n[${out.name}]`);
    console.log(`course=${out.course} classId=${out.classId}`);
    if (out.error) {
      console.log(`error=${out.error}`);
      continue;
    }
    console.log(`lecturer=${out.lecturer}`);
    console.log(`rosterCount(class-scoped)=${out.rosterCount}`);
    for (const row of out.results) {
      console.log(`student=${row.studentId} visible=${row.visible} checkin=${row.checkin} note=${row.reason}`);
    }
  }

  // Sanity negative probe: a non-matching student should not see active session for NCSC312 class.
  const negative = students.find((s) => !studentMatchesClass(s, nsPrimary));
  if (negative && nsEligible.length) {
    const lecturerLogin = await login(nsLecturer.id, 'staff123');
    const open = await postWithCookie('/api/attendance/checkin', { classId: nsPrimary.id }, lecturerLogin.cookie);
    const negLogin = await login(negative.id, 'password123');
    const active = await getWithCookie('/api/attendance/active-sessions', negLogin.cookie);
    const sessions = active.ok && Array.isArray(active.data.sessions) ? active.data.sessions : [];
    const visible = sessions.some((s) => String(s.classId || '') === String(nsPrimary.id));
    console.log('\n[Negative Probe]');
    console.log(`student=${negative.id} class=${nsPrimary.id} visible=${visible}`);
    await postWithCookie('/api/attendance/close', { classId: nsPrimary.id }, lecturerLogin.cookie);
  }
}

main().catch((error) => {
  console.error('[FAIL] smoke_attendance_cohort_matrix crashed', error);
  process.exit(1);
});
