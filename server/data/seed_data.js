const seedData = {
    // Colleges and their programs
    colleges: {
        'Computing': {
            programs: ['NCSC', 'NCIS'],
            lecturers: [
                { name: 'Dr. T. Zengeni', email: 'tzengeni@upath.ac.zw' },
                { name: 'Mr. B. Makambwa', email: 'bmakambwa@upath.ac.zw' },
                { name: 'Mr. P. Chinzvende', email: 'pchinzvende@upath.ac.zw' },
                { name: 'Mrs. S. Moyo', email: 'smoyo@upath.ac.zw' },
                { name: 'Dr. K. Dube', email: 'kdube@upath.ac.zw' }
            ],
            classes: {
                'NCSC': ['Operating Systems', 'Network Security', 'Data Structures', 'Software Engineering', 'Intro to Programming', 'Calculus I', 'Advanced Database', 'AI Fundamentals'],
                'NCIS': ['Group Project', 'Computer Essentials', 'Business Systems', 'Web Development', 'IT Auditing', 'Information Security']
            }
        },
        'Business': {
            programs: ['BACC', 'BMKT', 'BMAN'],
            lecturers: [
                { name: 'Dr. M. Phiri', email: 'mphiri@upath.ac.zw' },
                { name: 'Mrs. L. Gumbo', email: 'lgumbo@upath.ac.zw' },
                { name: 'Mr. K. Banda', email: 'kbanda@upath.ac.zw' },
                { name: 'Dr. J. Ndlovu', email: 'jndlovu@upath.ac.zw' }
            ],
            classes: {
                'BACC': ['Financial Accounting', 'Cost Accounting', 'Auditing Principles', 'Taxation', 'Corporate Finance'],
                'BMKT': ['Marketing Principles', 'Consumer Behavior', 'Digital Marketing', 'Brand Management'],
                'BMAN': ['Management Theory', 'Organizational Behavior', 'Strategic Management', 'HR Management']
            }
        },
        'Law': {
            programs: ['LLBS'],
            lecturers: [
                { name: 'Justice G. Malaba', email: 'gmalaba@upath.ac.zw' },
                { name: 'Adv. T. Mpofu', email: 'tmpofu@upath.ac.zw' },
                { name: 'Dr. L. Madhuku', email: 'lmadhuku@upath.ac.zw' }
            ],
            classes: {
                'LLBS': ['Constitutional Law', 'Criminal Law', 'Contract Law', 'Legal Ethics', 'Human Rights Law', 'Property Law', 'Evidence']
            }
        },
        'Health': {
            programs: ['NURS', 'MEDI'],
            lecturers: [
                { name: 'Dr. S. Masuka', email: 'smasuka@upath.ac.zw' },
                { name: 'Matron P. Dlamini', email: 'pdlamini@upath.ac.zw' },
                { name: 'Dr. A. Mutize', email: 'amutize@upath.ac.zw' }
            ],
            classes: {
                'NURS': ['Anatomy & Physiology', 'Community Health', 'Pediatric Nursing', 'Surgical Nursing'],
                'MEDI': ['Pathology', 'Pharmacology', 'Internal Medicine', 'Surgery Clerkship', 'Public Health']
            }
        }
    },

    // Generated Data Storage
    lecturers: [],
    classes: [],
    
    // Generate Lecturers
    generateLecturers: function() {
        let lecIdCounter = 210100;
        
        Object.keys(this.colleges).forEach(collegeName => {
            const college = this.colleges[collegeName];
            college.lecturers.forEach(lec => {
                lecIdCounter++;
                this.lecturers.push({
                    id: lecIdCounter.toString(),
                    fullName: lec.name,
                    email: lec.email,
                    role: 'lecturer',
                    password: 'staff123',
                    department: collegeName
                });
            });
        });
        
        // Ensure hardcoded demo lecturers exist with specific IDs if needed, otherwise verify above covers it.
        // The above generates clean new IDs.
        return this.lecturers;
    },

    // Generate Classes
    generateClasses: function() {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const rooms = ['Room 101', 'Room 204', 'Hall A', 'Hall B', 'ICT Lab', 'Lab 2B', 'Smart Class 4'];
        
        // Helper to generate unique course names if static list runs out
        const getCourseName = (prog, year, index, staticList) => {
            // Try to set unique names for specific years if possible, otherwise generic
            // We need 5 per year => indices 0-4
            // Map global index to year-based index
            return `[${prog}${year}] Module ${index + 1}`; 
        };

        // Specific Curricula (5 courses per year * 4 years = 20 courses per program)
        const curricula = {
            'NCSC': {
                1: ['Intro to Computer Science', 'Programming I', 'Digital Logic', 'Mathematics for CS', 'Communication Skills'],
                2: ['Data Structures', 'Operating Systems', 'Computer Arch', 'Web Development', 'Linear Algebra'],
                3: ['Software Engineering', 'Database Systems', 'Network Security', 'Algorithms', 'AI Fundamentals'],
                4: ['Distributed Systems', 'Cloud Computing', 'Final Year Project', 'Mobile Dev', 'IT Governance']
            },
            'NCIS': {
                1: ['Intro to IT', 'Business Information', 'Programming I', 'Statistics', 'Hardware Fundamentals'],
                2: ['System Analysis', 'Database Design', 'Web Design', 'Networking Essentials', 'IT Support'],
                3: ['IT Project Mgmt', 'E-Commerce', 'Info Security', 'Data Analytics', 'Enterprise Systems'],
                4: ['Strategic IT', 'Audit & Control', 'Capstone Project', 'User Experience', 'Cyber Law']
            },
            // Generics for others for brevity, but still 5 distinct per year
            'DEFAULT': (prog, year) => [
                `${prog} Principles ${year}`, 
                `${prog} Practice ${year}`, 
                `${prog} Theory ${year}`, 
                `${prog} Application ${year}`, 
                `${prog} Elective ${year}`
            ]
        };

        Object.keys(this.colleges).forEach(collegeName => {
            const college = this.colleges[collegeName];
            const collegeLecturers = this.lecturers.filter(l => l.department === collegeName);
            
            college.programs.forEach(prog => {
                // Generate for Years 1 to 4
                for (let year = 1; year <= 4; year++) {
                    // Get course names for this specific year
                    let courseNames = (curricula[prog] && curricula[prog][year]) 
                        ? curricula[prog][year] 
                        : curricula['DEFAULT'](prog, year);

                    courseNames.forEach((className, i) => {
                        const randomLec = collegeLecturers[Math.floor(Math.random() * collegeLecturers.length)];
                        // Spread 5 courses across 5 days if possible, or random
                        const day = days[i % 5]; 
                        const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
                        
                        // Time slots: Mon 8-10, Tue 10-12... simple pattern to avoid total overlap
                        const startHour = 8 + (i * 2); 
                        const time = `${startHour.toString().padStart(2,'0')}:00 - ${(startHour+2).toString().padStart(2,'0')}:00`;

                        this.classes.push({
                            id: `${prog.toLowerCase()}-${year}-${i}`,
                            code: `${prog}${year}0${i+1}`, // e.g. NCSC201
                            name: className,
                            year: year,
                            day: day,
                            time: time,
                            room: randomRoom,
                            lecturerId: randomLec.id,
                            lecturerName: randomLec.fullName
                        });
                    });
                }
            });
        });
        return this.classes;
    },

    generateStudents: (count = 200) => {
        const students = [];
        const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Donald', 'Margaret', 'Mark', 'Sandra'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
        
        const collegeKeys = Object.keys(seedData.colleges);
        
        // Structured Generation: 15 students per College per Year
        // Total = 4 Colleges * 4 Years * 15 Students = 240 Students
        const studentsPerGroup = 15;

        for (let year = 1; year <= 4; year++) {
            // Year prefix logic (Target: YY0XXX - 6 digits total)
            const yearPrefix = (26 - year).toString(); 

            collegeKeys.forEach(collegeName => {
                const collegeProgs = seedData.colleges[collegeName].programs;

                for (let i = 0; i < studentsPerGroup; i++) {
                     // ID Generation: YY0[CollegeIndex][Index]
                     // This ensures IDs are somewhat ordered by college too logic-wise, 
                     // but mostly ensures uniqueness combined with Year.
                     // Actually, keeping it simple random suffix is safer for collision avoidance if not tracking used.
                     // But user asked for "organized". 
                     // Let's use a counter per year-college maybe?
                     // Format: YY0 + Random(100-999).
                     // To avoid collisions in this loop, we can just check existence or use a large range.
                     
                     let id;
                     let unique = false;
                     while (!unique) {
                        const randomSuffix = Math.floor(100 + Math.random() * 900);
                        id = `${yearPrefix}0${randomSuffix}`;
                        if (!students.find(s => s.id === id)) unique = true;
                     }

                     const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
                     const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
                     const program = collegeProgs[Math.floor(Math.random() * collegeProgs.length)];

                     // Email Generation: LastName + FirstInitial + @africau.edu
                     // Handle duplicates by appending a number if necessary
                     let emailBase = `${lname.toLowerCase()}${fname.charAt(0).toLowerCase()}`;
                     let email = `${emailBase}@africau.edu`;
                     let counter = 1;
                     
                     // Check against existing generated students (and potentially demo students later)
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
                        year: year,
                        program: program,
                        department: collegeName
                    });
                }
            });
        }
        
        // Ensure Demo Students exist for testing and override if random gen took their ID
        const demoStudents = [
            { id: '240101', name: 'Demo Student', year: 2, prog: 'NCSC', dept: 'Computing' },
            { id: '220101', name: 'Legal Eagle', year: 4, prog: 'LLBS', dept: 'Law' }
        ];

        demoStudents.forEach(demo => {
            // Remove any random collision
            const idx = students.findIndex(s => s.id === demo.id);
            if (idx !== -1) students.splice(idx, 1);

            students.unshift({
                id: demo.id,
                fullName: demo.name,
                email: `${demo.id}@upath.ac.zw`,
                password: 'password123',
                role: 'student',
                year: demo.year,
                program: demo.prog,
                department: demo.dept
            });
        });

        return students;
    },

    generateAttendance: (students, classes) => {
        const attendance = [];
        const today = new Date();
        
        // Generate for past 2 weeks
        for (let i = 0; i < 14; i++) {
             const date = new Date(today);
             date.setDate(date.getDate() - i);
             const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
             
             // Find classes on this day
             const dailyClasses = classes.filter(c => c.day === dayName);

             dailyClasses.forEach(cls => {
                 // Get eligible students (Matching program logic: Class Code Prefix == Student Program)
                 const progPrefix = cls.code.substring(0, 4);
                 
                 const eligibleStudents = students.filter(s => 
                    s.year === cls.year && 
                    s.program === progPrefix
                 );
                 
                 eligibleStudents.forEach(stu => {
                     // 80% attendance rate
                     if (Math.random() > 0.2) {
                         attendance.push({
                             date: date.toISOString().split('T')[0],
                             status: 'present',
                             method: Math.random() > 0.5 ? 'qr' : 'manual',
                             studentId: stu.id,
                             classId: cls.id
                         });
                     }
                 });
             });
        }
        return attendance;
    }
};

// Auto-run generators to populate internal arrays
seedData.generateLecturers();
seedData.generateClasses();

module.exports = seedData;
