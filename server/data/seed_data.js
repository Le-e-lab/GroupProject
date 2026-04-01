const fs = require('fs');
const path = require('path');
const { shouldGroupNames, recommendedCanonicalName } = require('../utils/lecturerIdentity');

// Read the parsed timetable JSON
const rawDataPath = path.join(__dirname, 'parsed_timetable.json');
let jsonData = [];
if (fs.existsSync(rawDataPath)) {
    jsonData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
} else {
    console.error("parsed_timetable.json not found! Run parse_raw.js first.");
}

const seedData = {
    lecturers: [],
    classes: [],
    
    generateLecturers: function() {
        // Extract unique lecturers from json and canonicalize safe initial/full-name variants.
        const uniqueLecs = [...new Set(jsonData.map(c => c.lecturer))].filter(Boolean);
        const canonicalMap = new Map();

        // Group lecturer names conservatively by surname + first-name/initial compatibility.
        const groups = [];
        for (const name of uniqueLecs) {
            let placed = false;
            for (const g of groups) {
                if (g.some((existing) => shouldGroupNames(existing, name))) {
                    g.push(name);
                    placed = true;
                    break;
                }
            }
            if (!placed) groups.push([name]);
        }

        for (const g of groups) {
            const canonical = recommendedCanonicalName(g);
            g.forEach((name) => canonicalMap.set(name, canonical));
        }
        
        let lecIdCounter = 210100;

        const canonicalNames = [...new Set(uniqueLecs.map((name) => canonicalMap.get(name) || name))];

        canonicalNames.forEach(lecName => {
            // Find finding their primary college from the data
            const lecsClass = jsonData.find(c => (canonicalMap.get(c.lecturer) || c.lecturer) === lecName);
            const collegeName = lecsClass ? lecsClass.college : 'Computing';
            
            lecIdCounter++;
            
            // Clean names to simple chars for email
            const safeName = lecName.replace(/[^a-zA-Z ]/g, "").split(' ');
            const emailPrefix = safeName.length > 1 ? safeName.pop().toLowerCase() + lecIdCounter : `lecturer${lecIdCounter}`;

            this.lecturers.push({
                id: lecIdCounter.toString(),
                fullName: lecName,
                email: `${emailPrefix}@africau.edu`,
                role: 'lecturer',
                password: 'staff123',
                department: collegeName
            });
        });
        
        return this.lecturers;
    },

    generateClasses: function() {
        this.classes = jsonData.map((c, i) => {
            // Find matched lecturer ID
            const canonicalLecturerName = this.lecturers.find((l) => {
                const cname = l.fullName;
                return shouldGroupNames(cname, c.lecturer) || cname === c.lecturer;
            })?.fullName || c.lecturer;

            const lec = this.lecturers.find(l => l.fullName === canonicalLecturerName);
            const lecId = lec ? lec.id : '210000';
            
            // Extract roughly the "Year" from "Y1 S2" => 1
            const yearMatch = c.yearSemester.match(/Y(\d)/);
            const year = yearMatch ? parseInt(yearMatch[1]) : 1;
            
            // The JSON time is usually "11-12", "9-11", "2-4" etc. Need to format to "11:00 - 12:00"
            // Let's create a small helper for this parser
            let formattedTime = c.time;
            try {
                if (c.time.includes('-')) {
                    const parts = c.time.split('-');
                    const startRaw = parts[0].trim().toLowerCase().replace('pm','').replace('am','');
                    const endRaw = parts[1].trim().toLowerCase().replace('pm','').replace('am','');
                    
                    // Simple AM/PM logic: 8, 9, 10, 11, 12 are usually standard. 1, 2, 3, 4, 5, 6, 7 are PM (+12)
                    const formatHour = (hrStr) => {
                        let hr = parseInt(hrStr);
                        if (hr < 8 && hr !== 0) hr += 12; // 1 becomes 13, 2 becomes 14
                        return `${hr.toString().padStart(2, '0')}:00`;
                    };
                    
                    formattedTime = `${formatHour(startRaw)} - ${formatHour(endRaw)}`;
                } else if (c.time.includes('pm-')) { // edge cases like 4pm-6pm
                    const str = c.time.replace(/pm/g,'').replace(/am/g,'');
                    const parts = str.split('-');
                    formattedTime = `${(parseInt(parts[0])+12).toString().padStart(2,'0')}:00 - ${(parseInt(parts[1])+12).toString().padStart(2,'0')}:00`;
                }
            } catch (e) { }

            return {
                id: `cls-${i}`,
                code: c.courseCode,
                name: c.courseName,
                year: year,
                day: c.day,
                time: formattedTime,
                room: c.venue,
                lecturerId: lecId,
                lecturerName: canonicalLecturerName,
                
                // Keep the raw program & section & college so `seed_all.js` or others can access it
                rawCollege: c.college,
                rawProgram: c.program,
                rawYearSemester: c.yearSemester,
                rawSection: c.section
            };
        });
        return this.classes;
    },

    generateStudents: function(count = 2500) { // Large cap as there are 800+ courses
        const students = [];
        const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Tendai', 'Kudzai', 'Nyasha', 'Tatenda', 'Farai', 'Chipo', 'Rudo'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Moyo', 'Ndlovu', 'Sibanda', 'Dube', 'Ncube', 'Gumbo', 'Mutasa', 'Chifamba', 'Banda', 'Phiri'];
        
        // Use the actual programs extracted from the JSON
        const programsAndColleges = {};
        jsonData.forEach(c => {
             if (c.program && c.college) {
                 programsAndColleges[c.program] = c.college;
             }
        });
        
        const programs = Object.keys(programsAndColleges);
        if (programs.length === 0) return students;

        // Spread students across all programs and years
        let studentCount = 0;
        for (const prog of programs) {
            const college = programsAndColleges[prog];
            // Get valid years for this program from data
            const progClasses = jsonData.filter(c => c.program === prog);
            const years = [...new Set(progClasses.map(c => {
                 const m = c.yearSemester.match(/Y(\d)/);
                 return m ? parseInt(m[1]) : 1;
            }))];
            
            years.forEach(yr => {
                // Generate ~10-15 students per program per year
                const numStudents = Math.floor(Math.random() * 6) + 10;
                const yearPrefix = (26 - yr).toString(); 
                
                for(let i=0; i<numStudents; i++) {
                     let id;
                     let unique = false;
                     while (!unique) {
                        const randomSuffix = Math.floor(100 + Math.random() * 900);
                        id = `${yearPrefix}0${randomSuffix}`;
                        if (!students.find(s => s.id === id)) unique = true;
                     }

                     const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
                     const lname = lastNames[Math.floor(Math.random() * lastNames.length)];

                     let emailBase = `${lname.toLowerCase()}${fname.charAt(0).toLowerCase()}`;
                     let email = `${emailBase}@africau.edu`;
                     let counter = 1;
                     while (students.some(s => s.email === email)) {
                         email = `${emailBase}${counter}@africau.edu`;
                         counter++;
                     }

                     students.push({
                        id: id,
                        fullName: `${fname} ${lname}`,
                        email: email, 
                        password: 'password123',
                        role: 'student',
                        year: yr,
                        program: prog,
                        department: college,
                        college: college // Keep aligned with backend expectations
                    });
                    
                    studentCount++;
                    if (studentCount >= count) return students; // Cap at requested count
                }
            });
        }
        
        // Ensure Demo Students exist for testing and override if random gen took their ID
        const demoStudents = [
            { id: '240101', name: 'Demo Rep', year: 2, prog: 'BSc Honours in Computer Sciences', dept: 'CEAS', role: 'student_rep' },
            { id: '240102', name: 'Demo AI Student', year: 2, prog: 'BSc Honours in Artificial Intelligence', dept: 'CEAS', role: 'student' },
            { id: '220101', name: 'Legal Eagle', year: 4, prog: 'LLBS', dept: 'Law', role: 'student' }
        ];

        demoStudents.forEach(demo => {
            const idx = students.findIndex(s => s.id === demo.id);
            if (idx !== -1) students.splice(idx, 1);

            students.unshift({
                id: demo.id,
                fullName: demo.name,
                email: `${demo.id}@upath.ac.zw`,
                password: 'password123',
                role: demo.role,
                year: demo.year,
                program: demo.prog,
                department: demo.dept,
                college: demo.dept
            });
        });

        return students;
    }
};

module.exports = seedData;
