const fs = require('fs');
const path = require('path');

// We will paste the raw text from the user into a file and parse it.
const rawDataPath = path.join(__dirname, 'raw_timetable.txt');
const outputPath = path.join(__dirname, 'parsed_timetable.json');

function parseTimetable() {
    if (!fs.existsSync(rawDataPath)) {
        console.error("raw_timetable.txt not found. Please create it and paste the data.");
        return;
    }

    const lines = fs.readFileSync(rawDataPath, 'utf8').split('\n');
    
    const classes = [];
    let currentCollege = '';
    let currentProgram = '';
    let currentYearSemester = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Detect College
        if (line.startsWith('COLLEGE:')) {
            currentCollege = line.replace('COLLEGE:', '').trim();
            continue;
        }

        // Detect Program
        if (line.startsWith('PROGRAM:')) {
            currentProgram = line.replace('PROGRAM:', '').trim();
            continue;
        }

        // Detect Year/Semester
        if (line.startsWith('YEAR/SEMESTER:')) {
            currentYearSemester = line.replace('YEAR/SEMESTER:', '').trim();
            continue;
        }

        // Detect Data Row (starts with Course Code, usually alphanumeric without spaces)
        // Look for typical format: CourseCode CourseName Section Day Time Venue Lecturer
        // Since CourseName can have spaces, we can split by multiple spaces or tabs if available.
        // Looking at the data, it's padded with spaces. We can use a regex to split by 2 or more spaces.
        const rowMatch = line.split(/\s{2,}/);
        
        // A valid row usually has 6 or 7 parts depending on how the spaces align.
        // Let's be more specific based on the headers:
        // Course Code (1), Course Name (2), Section (3), Day (4), Time (5), Venue (6), Lecturer (7)
        if (rowMatch.length >= 6 && !line.startsWith('Course Code') && !line.startsWith('---') && !line.startsWith('===')) {
            // Some names like "AI, Critical Thinking," might mess up simple splits if not spaced right.
            // Let's map it out manually or clean it.
            try {
                // If it split into 7 exactly
                if (rowMatch.length >= 7) {
                    classes.push({
                        college: currentCollege,
                        program: currentProgram,
                        yearSemester: currentYearSemester,
                        courseCode: rowMatch[0].trim(),
                        courseName: rowMatch[1].trim(),
                        section: rowMatch[2].trim(),
                        day: rowMatch[3].trim(),
                        time: rowMatch[4].trim(),
                        venue: rowMatch[5].trim(),
                        lecturer: rowMatch.slice(6).join(' ').trim() // Handle names with long spaces
                    });
                } else if (rowMatch.length === 6) {
                    // Sometimes Section and Day merge if not spaced?
                     classes.push({
                        college: currentCollege,
                        program: currentProgram,
                        yearSemester: currentYearSemester,
                        courseCode: rowMatch[0].trim(),
                        courseName: rowMatch[1].trim(),
                        section: rowMatch[2] === 'A' || rowMatch[2] === 'B' ? rowMatch[2].trim() : 'A', 
                        day: rowMatch[2] !== 'A' && rowMatch[2] !== 'B' ? rowMatch[2].trim() : rowMatch[3].trim(),
                        time: rowMatch[3].trim(), // Might be off by 1
                        venue: rowMatch[4].trim(),
                        lecturer: rowMatch[5].trim()
                    });
                }
            } catch (e) {
                console.warn(`Could not parse line: ${line}`);
            }
        } else if (line.match(/^[A-Z]{3,4}\d{3,4}\s/)) {
            // If it starts with Course code string but split failed due to single spaces
            // We use fixed substring parsing based on the header alignment:
            // 0-14: Code | 16-60: Name | 62-69: Section | 71-82: Day | 84-95: Time | 97-121: Venue | 123+: Lecturer
            const code = line.substring(0, 15).trim();
            const name = line.substring(16, 61).trim();
            const section = line.substring(62, 70).trim();
            const day = line.substring(71, 83).trim();
            const time = line.substring(84, 96).trim();
            const venue = line.substring(97, 122).trim();
            const lec = line.substring(123).trim();
            
            if (code && name && day && time) {
                classes.push({
                    college: currentCollege,
                    program: currentProgram,
                    yearSemester: currentYearSemester,
                    courseCode: code,
                    courseName: name,
                    section: section || 'A',
                    day: day,
                    time: time,
                    venue: venue,
                    lecturer: lec
                });
            }
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(classes, null, 2));
    console.log(`Successfully parsed ${classes.length} distinct class blocks.`);
    
    // Extract unique lecturers
    const lecturers = [...new Set(classes.map(c => c.lecturer))].filter(Boolean);
    console.log(`Found ${lecturers.length} unique lecturers.`);
    
    // Extract unique programs
    const programs = [...new Set(classes.map(c => c.program))].filter(Boolean);
    console.log(`Found ${programs.length} unique programs.`);
}

parseTimetable();
