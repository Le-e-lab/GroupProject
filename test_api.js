async function test() {
    try {
        console.log("--- Testing POST /api/announcements ---");
        const res1 = await fetch('http://localhost:3000/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lecturerId: "210153", 
                lecturerName: "Test DB Lecturer", 
                courseCode: "CS101", 
                type: "info", 
                message: "This is a DB persistence test."
            })
        });
        const data1 = await res1.json();
        console.log(data1);

        console.log("\n--- Testing GET /api/announcements ---");
        const res2 = await fetch('http://localhost:3000/api/announcements');
        const data2 = await res2.json();
        console.log(`Found ${data2.announcements.length} announcements.`);

        console.log("\n--- Testing Rate Limiter (POST /api/auth/login) ---");
        // Fire 12 rapid requests to trigger the 10-request limit
        for (let i = 0; i < 12; i++) {
            const r = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: "invalid", password: "invalid" })
            });
            console.log(`Req ${i+1}: Status ${r.status}`);
        }
    } catch (e) {
        console.error("Test failed", e);
    }
}
test();
