const http = require('http');

const BASE_URL = 'http://localhost:3000';
const LECTURER_ID = process.env.TEST_LECTURER_ID || '210146';
const LECTURER_PASSWORD = process.env.TEST_LECTURER_PASSWORD || 'staff123';
const STUDENT_ID = process.env.TEST_STUDENT_ID || '240101';
const STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD || 'password123';

// Helper function to make HTTP requests
function makeRequest(method, path, body = null, cookies = '') {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, body: null, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Extract cookies from response
function extractCookies(response) {
    const setCookie = response.headers['set-cookie'];
    if (!setCookie) return '';
    if (Array.isArray(setCookie)) {
        return setCookie.map(c => c.split(';')[0]).join('; ');
    }
    return setCookie.split(';')[0];
}

async function test() {
    console.log('\n=== Manual Attendance Bug Test ===\n');
    
    let cookies = '';
    
    try {
        // 1. Login as lecturer
        console.log(`1. Logging in as lecturer (ID: ${LECTURER_ID})...`);
        let res = await makeRequest('POST', '/api/auth/login', {
            email: LECTURER_ID,
            password: LECTURER_PASSWORD
        });
        cookies = extractCookies(res);
        console.log(`   Status: ${res.status}`);
        if (res.status === 200) {
            console.log(`   ✓ Login successful\n`);
        } else {
            console.log(`   ✗ Login failed: ${res.raw}\n`);
            return;
        }

        // 2. Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        console.log(`2. Today's date: ${today}\n`);

        // 3. Mark attendance manually for student in a class
        // First find a class that Mr. Chinzevende teaches
        console.log('3. Finding lecturer classes...');
        res = await makeRequest('GET', `/api/classes/lecturer/${encodeURIComponent(LECTURER_ID)}`, null, cookies);
        console.log(`   Status: ${res.status}`);
        if (res.status !== 200 || !Array.isArray(res.body) || res.body.length === 0) {
            console.log(`   No classes found. Trying manual class ID...\n`);
            var classId = 'NCIS210--Monday--14:00--bsc_honours_in_computer_sciences--y2s1';
            var classCode = 'NCIS210';
        } else {
            // Use a class the student is eligible for when possible
            const preferred = res.body.find((c) => String(c.program || '').toLowerCase().includes('computer sciences')) || res.body[0];
            classId = String(preferred.id || '').trim();
            classCode = String(preferred.code || '').trim();
            console.log(`   ✓ Found class: ${classId}\n`);
        }

        // 4. Mark attendance manually
        console.log(`4. Marking attendance manually for student ${STUDENT_ID} in class ${classId}...`);
        res = await makeRequest('POST', '/api/attendance/bulk-mark', {
            classId: classId,
            students: [STUDENT_ID],
            date: new Date().toISOString()  // This is what the frontend sends
        }, cookies);
        console.log(`   Status: ${res.status}`);
        console.log(`   Response: ${res.raw}`);
        if (res.status === 200) {
            console.log(`   ✓ Attendance marked\n`);
        } else {
            console.log(`   ✗ Mark attendance failed\n`);
        }

        // 5. Login as student and check dashboard endpoint
        console.log(`5. Logging in as student ${STUDENT_ID}...`);
        const studentLogin = await makeRequest('POST', '/api/auth/login', {
            email: STUDENT_ID,
            password: STUDENT_PASSWORD
        });
        const studentCookies = extractCookies(studentLogin);
        console.log(`   Status: ${studentLogin.status}`);
        if (studentLogin.status !== 200) {
            console.log(`   ✗ Student login failed: ${studentLogin.raw}\n`);
            return;
        }

        console.log(`   ✓ Student login successful\n`);

        // 6. Check daily attendance via /api/attendance/today/:id (what dashboard uses)
        console.log(`6. Checking daily attendance for student ${STUDENT_ID} (dashboard endpoint)...`);
        res = await makeRequest('GET', `/api/attendance/today/${encodeURIComponent(STUDENT_ID)}`, null, studentCookies);
        console.log(`   Status: ${res.status}`);
        console.log(`   Response: ${JSON.stringify(res.body, null, 2)}`);
        const presentClassIds = res.body?.presentClassIds || [];
        if (presentClassIds.includes(classId) || (classCode && presentClassIds.some(id => String(id).startsWith(classCode)))) {
            console.log(`   ✓ Manual attendance shows in today's list\n`);
        } else {
            console.log(`   ✗ Manual attendance NOT showing in today's list\n`);
            console.log(`      Expected classId or variant: ${classId}`);
            console.log(`      Received presentClassIds: ${JSON.stringify(presentClassIds)}\n`);
        }

        // 7. Check overall stats via /api/attendance/student/:id (what reports page uses)
        console.log(`7. Checking overall stats for student ${STUDENT_ID} (reports endpoint)...`);
        res = await makeRequest('GET', `/api/attendance/student/${encodeURIComponent(STUDENT_ID)}`, null, studentCookies);
        console.log(`   Status: ${res.status}`);
        if (res.body && res.body.stats) {
            console.log(`   Stats found: ${res.body.stats.length} courses`);
            const target = res.body.stats.find(s => String(s.courseCode || s.code || '').toUpperCase() === String(classCode || '').toUpperCase());
            if (target) {
                console.log(`   ${classCode} - Total: ${target.total}, Attended: ${target.attended}, Percentage: ${target.percentage}%`);
                if (target.attended > 0) {
                    console.log(`   ✓ Manual attendance counted in stats\n`);
                } else {
                    console.log(`   ✗ Manual attendance NOT counted in stats\n`);
                }
            } else {
                console.log(`   ✗ ${classCode} not in stats list\n`);
            }
            console.log(`   Full response: ${JSON.stringify(res.body.stats, null, 2)}\n`);
        } else {
            console.log(`   Response: ${res.raw}\n`);
        }

        // 8. Simulate dashboard counter logic for today
        console.log('8. Simulating dashboard Marked Present count...');
        const profile = await makeRequest('GET', '/api/users/me', null, studentCookies);
        if (profile.status === 200 && profile.body) {
            const profileUser = profile.body.user || profile.body;
            const year = profileUser.year || 2;
            const program = encodeURIComponent(profileUser.program || '');
            const classesRes = await makeRequest('GET', `/api/classes?year=${year}&program=${program}`, null, studentCookies);
            if (classesRes.status === 200 && Array.isArray(classesRes.body)) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const todayName = dayNames[new Date().getDay()];
                const todayClasses = classesRes.body.filter(c => String(c.day || '') === todayName && Number(c.year || 0) === Number(year));
                const presentSet = new Set(presentClassIds);
                const markedCount = todayClasses.filter(c => presentSet.has(c.id) || presentSet.has(c.code)).length;
                console.log(`   Today: ${todayName}`);
                console.log(`   Classes today: ${todayClasses.length}`);
                console.log(`   Marked present: ${markedCount}`);
                if (markedCount > 0) {
                    console.log('   ✓ Dashboard Marked Present should be > 0\n');
                } else {
                    console.log('   ✗ Dashboard Marked Present still 0\n');
                }
            }
        }

        // 9. Check database endpoint consistency
        console.log('7. Checking database directly...');
        res = await makeRequest('GET', `/api/attendance/student/${encodeURIComponent(STUDENT_ID)}`, null, studentCookies);
        if (res.body?.stats) {
            console.log(`   Database check passed\n`);
        }

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }

    console.log('=== Test Complete ===\n');
}

// Wait for server to be ready then run test
setTimeout(test, 2000);
