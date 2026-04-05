const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function post(path, body, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body || {})
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
  const response = await fetch(`${baseUrl}${path}`, {
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
  const login = await post('/api/auth/login', { email: 'admin', password: 'admin123' });
  if (!login.ok) {
    console.error('[FAIL] admin login', login.status, login.data);
    process.exit(1);
  }

  const cookie = cookieFrom(login.headers);
  const meBefore = await get('/api/users/me', cookie);
  if (!meBefore.ok) {
    console.error('[FAIL] auth before logout', meBefore.status, meBefore.data);
    process.exit(1);
  }

  const logout = await post('/api/auth/logout', {}, cookie);
  if (!logout.ok) {
    console.error('[FAIL] logout request', logout.status, logout.data);
    process.exit(1);
  }

  const setCookie = String(logout.headers.get('set-cookie') || '');
  if (!/upath_token=;/i.test(setCookie)) {
    console.error('[FAIL] logout did not clear cookie', setCookie);
    process.exit(1);
  }

  const meAfter = await get('/api/users/me', '');
  if (meAfter.status !== 401) {
    console.error('[FAIL] auth still available after logout', meAfter.status, meAfter.data);
    process.exit(1);
  }

  console.log('[SMOKE] logout flow passed');
}

run().catch((err) => {
  console.error('[SMOKE] logout flow crashed', err);
  process.exit(1);
});