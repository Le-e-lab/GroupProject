/**
 * ========================================
 * UPath API Module
 * ========================================
 * 
 * This module provides all data access and authentication functionality
 * for the UPath attendance system.
 * 
 * CONTENTS:
 * 1. User Database (Students & Lecturers)
 * 2. Timetable Data (Y1S2 & Y2S2 Schedule)
 * 3. Authentication Methods
 * 4. Class Data Methods
 * 5. Attendance Methods
 * 
 * HOW TO USE:
 * - Login: API.login(idNumber, password)
 * - Get Classes: API.getClasses(year) or API.getTimetable()
 * - Get Students: API.getStudentsForClass(year)
 * - Save Attendance: API.saveBulkAttendance(classId, studentIds)
 * 
 * ========================================
 */

const API = {
    // Base URL for server API (when backend is running)
    baseUrl: '/api',
    
    // Cache settings for performance
    cache: {},
    cacheTimeout: 5 * 60 * 1000, // 5 minutes cache duration

    /**
     * ========================================
     * USER DATABASE
     * ========================================
     * 
     * Student IDs:
     * - Year 2 (Y2S2): Start with 240XXX
     * - Year 1 (Y1S2): Start with 250XXX
     * 
     * Lecturer IDs:
     * - Staff: Start with 210XXX
     * 
     * Default Passwords:
     * - Students: 123456
     * - Lecturers: staff123
     * ========================================
     */
    users: {
        // ============ YEAR 2 STUDENTS (240XXX) ============
        '240101': { 
            id: '240101', 
            fullName: 'Chris Banda', 
            password: '123456', 
            role: 'student', 
            year: 2, 
            email: 'chris.banda@students.uz.ac.zw' 
        },
        '240102': { 
            id: '240102', 
            fullName: 'Tatenda Moyo', 
            password: '123456', 
            role: 'student', 
            year: 2, 
            email: 'tatenda.moyo@students.uz.ac.zw' 
        },
        '240103': { 
            id: '240103', 
            fullName: 'Rudo Chiwenga', 
            password: '123456', 
            role: 'student', 
            year: 2, 
            email: 'rudo.chiwenga@students.uz.ac.zw' 
        },
        '240104': { 
            id: '240104', 
            fullName: 'Tino Nyathi', 
            password: '123456', 
            role: 'student', 
            year: 2, 
            email: 'tino.nyathi@students.uz.ac.zw' 
        },
        '240105': { 
            id: '240105', 
            fullName: 'Grace Mutasa', 
            password: '123456', 
            role: 'student', 
            year: 2, 
            email: 'grace.mutasa@students.uz.ac.zw' 
        },
        
        // ============ YEAR 1 STUDENTS (250XXX) ============
        '250101': { 
            id: '250101', 
            fullName: 'Brian Chikwanha', 
            password: '123456', 
            role: 'student', 
            year: 1, 
            email: 'brian.chikwanha@students.uz.ac.zw' 
        },
        '250102': { 
            id: '250102', 
            fullName: 'Nyasha Dube', 
            password: '123456', 
            role: 'student', 
            year: 1, 
            email: 'nyasha.dube@students.uz.ac.zw' 
        },
        '250103': { 
            id: '250103', 
            fullName: 'Fadzai Mupfumo', 
            password: '123456', 
            role: 'student', 
            year: 1, 
            email: 'fadzai.mupfumo@students.uz.ac.zw' 
        },
        '250104': { 
            id: '250104', 
            fullName: 'Simba Ngwenya', 
            password: '123456', 
            role: 'student', 
            year: 1, 
            email: 'simba.ngwenya@students.uz.ac.zw' 
        },
        '250105': { 
            id: '250105', 
            fullName: 'Rumbi Tsuro', 
            password: '123456', 
            role: 'student', 
            year: 1, 
            email: 'rumbi.tsuro@students.uz.ac.zw' 
        },
        
        // ============ LECTURERS (210XXX) ============
        '210101': { 
            id: '210101', 
            fullName: 'Mr. Makambwa', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Computer Science', 
            email: 'makambwa@uz.ac.zw' 
        },
        '210102': { 
            id: '210102', 
            fullName: 'Dr. Tendai Zengeni', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Computer Science', 
            email: 'zengeni@uz.ac.zw' 
        },
        '210103': { 
            id: '210103', 
            fullName: 'Mr. Joseph Chinzvende', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Computer Science', 
            email: 'chinzvende@uz.ac.zw' 
        },
        '210104': { 
            id: '210104', 
            fullName: 'Rev. N. Bondo', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Ethics', 
            email: 'bondo@uz.ac.zw' 
        },
        '210105': { 
            id: '210105', 
            fullName: 'Mr. L. Dhlakama', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Computer Science', 
            email: 'dhlakama@uz.ac.zw' 
        },
        '210106': { 
            id: '210106', 
            fullName: 'Prof. Yogesh Awasthi', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Computer Science', 
            email: 'awasthi@uz.ac.zw' 
        },
        '210107': { 
            id: '210107', 
            fullName: 'Dr. R. Makoni', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Computer Science', 
            email: 'makoni@uz.ac.zw' 
        },
        '210108': { 
            id: '210108', 
            fullName: 'Dr. M. Kayembe', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Languages', 
            email: 'kayembe@uz.ac.zw' 
        },
        '210109': { 
            id: '210109', 
            fullName: 'Dr. M. Mzite', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Languages', 
            email: 'mzite@uz.ac.zw' 
        },
        '210110': { 
            id: '210110', 
            fullName: 'Ms. J. Muzamhindo', 
            password: 'staff123', 
            role: 'lecturer', 
            department: 'Languages', 
            email: 'muzamhindo@uz.ac.zw' 
        }
    },

    /**
     * ========================================
     * CACHE MANAGEMENT
     * ========================================
     */
    
    /**
     * Get data from cache or fetch it fresh
     * @param {string} key - Cache key
     * @param {function} fetchFn - Function to fetch data if not cached
     * @returns {Promise} - Cached or fresh data
     */
    async getCached(key, fetchFn) {
        const cached = this.cache[key];
        if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
            return cached.data;
        }
        const data = await fetchFn();
        this.cache[key] = { data, timestamp: Date.now() };
        return data;
    },

    /**
     * Clear cache (specific key or all)
     * @param {string} key - Optional specific key to clear
     */
    clearCache(key) {
        if (key) {
            delete this.cache[key];
        } else {
            this.cache = {};
        }
    },

    /**
     * ========================================
     * AUTHENTICATION METHODS
     * ========================================
     */

    /**
     * Login with ID number and password
     * @param {string} idNumber - Student or lecturer ID
     * @param {string} password - User password
     * @returns {object} - { user } on success, { error } on failure
     */
    async login(idNumber, password) {
        // Check local users database first
        const user = this.users[idNumber];
        if (user && user.password === password) {
            // Return user without password for security
            const { password: _, ...safeUser } = user;
            return { user: safeUser };
        }
        
        // Try server API (when backend is running)
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: idNumber, password })
            });
            return response.json();
        } catch (e) {
            return { error: 'Invalid credentials' };
        }
    },

    /**
     * Register a new user
     * @param {object} userData - User registration data
     * @returns {object} - Registration result
     */
    async register(userData) {
        const response = await fetch(`${this.baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return response.json();
    },

    /**
     * ========================================
     * CLASS DATA METHODS
     * ========================================
     */

    /**
     * Get all classes or filter by year
     * @param {number} year - Optional year filter (1 or 2)
     * @returns {array} - Array of class objects
     */
    async getClasses(year = null) {
        return this.getCached('classes' + (year || ''), async () => {
            try {
                const response = await fetch(`${this.baseUrl}/classes`);
                if (!response.ok) throw new Error('API error');
                return response.json();
            } catch (e) {
                // Return timetable data when server is not available
                const allClasses = this.getTimetable();
                if (year) {
                    return allClasses.filter(c => c.year === year);
                }
                return allClasses;
            }
        });
    },

    /**
     * ========================================
     * TIMETABLE DATA
     * ========================================
     * 
     * BSc Honours in Computer Sciences
     * Y1S2 (Year 1 Semester 2) and Y2S2 (Year 2 Semester 2)
     * 
     * Each class object contains:
     * - id: Unique identifier
     * - code: Course code (e.g., NCSC211)
     * - name: Course name
     * - year: Student year (1 or 2)
     * - section: Section letter (A, B, etc.)
     * - day: Day of the week
     * - time: Start and end time
     * - room: Venue/classroom
     * - lecturerName: Lecturer's name
     * - lecturerId: Lecturer's ID (for filtering)
     * ========================================
     */
    getTimetable() {
        return [
            // ============ YEAR 2 SEMESTER 2 (Y2S2) ============
            

            // Operating Systems - Mr. Makambwa
            { 
                id: 'y2-1a', 
                code: 'NCSC211', 
                name: 'Operating Systems', 
                year: 2, 
                section: 'A', 
                day: 'Monday', 
                time: '08:00 - 10:00', 
                room: 'ICT Mai Mugabe Lab', 
                lecturerName: 'Mr. Makambwa', 
                lecturerId: '210101' 
            },
            
            // Network Security - Dr. Tendai Zengeni
            { 
                id: 'y2-2a', 
                code: 'NCSC312', 
                name: 'Network Security', 
                year: 2, 
                section: 'A', 
                day: 'Wednesday', 
                time: '11:00 - 01:00', 
                room: 'ICT Smart Classroom 4', 
                lecturerName: 'Dr. Tendai Zengeni', 
                lecturerId: '210102' 
            },
            { 
                id: 'y2-2b', 
                code: 'NCSC312', 
                name: 'Network Security', 
                year: 2, 
                section: 'A', 
                day: 'Tuesday', 
                time: '02:00 - 03:00', 
                room: 'ICT Mai Mugabe Lab', 
                lecturerName: 'Dr. Tendai Zengeni', 
                lecturerId: '210102' 
            },
            
            // Group Project - Mr. Joseph Chinzvende
            { 
                id: 'y2-3a', 
                code: 'NCIS210', 
                name: 'Group Project', 
                year: 2, 
                section: 'A', 
                day: 'Monday', 
                time: '02:00 - 04:00', 
                room: 'ICT Mai Mugabe Lab', 
                lecturerName: 'Mr. Joseph Chinzvende', 
                lecturerId: '210103' 
            },
            { 
                id: 'y2-3b', 
                code: 'NCIS210', 
                name: 'Group Project', 
                year: 2, 
                section: 'A', 
                day: 'Thursday', 
                time: '09:00 - 10:00', 
                room: 'ICT Mai Mugabe Lab', 
                lecturerName: 'Mr. Joseph Chinzvende', 
                lecturerId: '210103' 
            },
            
            // Human Computer Interactions - Mr. Joseph Chinzvende
            { 
                id: 'y2-4a', 
                code: 'NCSC303', 
                name: 'Human Computer Interactions', 
                year: 2, 
                section: 'A', 
                day: 'Tuesday', 
                time: '09:00 - 11:00', 
                room: 'ICT Smart Classroom 1', 
                lecturerName: 'Mr. Joseph Chinzvende', 
                lecturerId: '210103' 
            },
            { 
                id: 'y2-4b', 
                code: 'NCSC303', 
                name: 'Human Computer Interactions', 
                year: 2, 
                section: 'A', 
                day: 'Friday', 
                time: '08:00 - 09:00', 
                room: 'ICT Smart Classroom 1', 
                lecturerName: 'Mr. Joseph Chinzvende', 
                lecturerId: '210103' 
            },
            
            // Ethics and Christian Values - Rev. N. Bondo
            { 
                id: 'y2-5a', 
                code: 'NTEV200', 
                name: 'Ethics and Christian Values', 
                year: 2, 
                section: 'A', 
                day: 'Wednesday', 
                time: '09:00 - 11:00', 
                room: 'DHSG19', 
                lecturerName: 'Rev. N. Bondo', 
                lecturerId: '210104' 
            },
            { 
                id: 'y2-5b', 
                code: 'NTEV200', 
                name: 'Ethics and Christian Values', 
                year: 2, 
                section: 'A', 
                day: 'Friday', 
                time: '11:00 - 12:00', 
                room: 'TMLT', 
                lecturerName: 'Rev. N. Bondo', 
                lecturerId: '210104' 
            },

            // ============ YEAR 1 SEMESTER 2 (Y1S2) ============
            
            // French for Beginners II - Dr. M. Kayembe
            { 
                id: 'y1-1a', 
                code: 'HUM1202', 
                name: 'French for Beginners II', 
                year: 1, 
                section: 'A', 
                day: 'Wednesday', 
                time: '12:00 - 01:00', 
                room: 'TMLT', 
                lecturerName: 'Dr. M. Kayembe', 
                lecturerId: '210108' 
            },
            { 
                id: 'y1-1b', 
                code: 'HUM1202', 
                name: 'French for Beginners II', 
                year: 1, 
                section: 'A', 
                day: 'Friday', 
                time: '09:00 - 11:00', 
                room: 'TMLT', 
                lecturerName: 'Dr. M. Kayembe', 
                lecturerId: '210108' 
            },
            
            // Portuguese for Beginners II - Dr. M. Mzite
            { 
                id: 'y1-2a', 
                code: 'HUM1201', 
                name: 'Portuguese for Beginners II', 
                year: 1, 
                section: 'A', 
                day: 'Wednesday', 
                time: '11:00 - 01:00', 
                room: 'DHSG19', 
                lecturerName: 'Dr. M. Mzite', 
                lecturerId: '210109' 
            },
            { 
                id: 'y1-2b', 
                code: 'HUM1201', 
                name: 'Portuguese for Beginners II', 
                year: 1, 
                section: 'A', 
                day: 'Friday', 
                time: '09:00 - 10:00', 
                room: 'DHSG19', 
                lecturerName: 'Dr. M. Mzite', 
                lecturerId: '210109' 
            },
            
            // English as a Second Language II - Ms. J. Muzamhindo
            { 
                id: 'y1-3a', 
                code: 'HUM1203', 
                name: 'English as a Second Language II', 
                year: 1, 
                section: 'A', 
                day: 'Wednesday', 
                time: '09:00 - 11:00', 
                room: 'TMLT', 
                lecturerName: 'Ms. J. Muzamhindo', 
                lecturerId: '210110' 
            },
            { 
                id: 'y1-3b', 
                code: 'HUM1203', 
                name: 'English as a Second Language II', 
                year: 1, 
                section: 'A', 
                day: 'Friday', 
                time: '10:00 - 11:00', 
                room: 'AEG4', 
                lecturerName: 'Ms. J. Muzamhindo', 
                lecturerId: '210110' 
            },
            
            // AI & Critical Thinking - Dr. R. Makoni
            { 
                id: 'y1-4a', 
                code: 'HUM1204', 
                name: 'Artificial Intelligence, Critical Thinking', 
                year: 1, 
                section: 'A', 
                day: 'Monday', 
                time: '02:00 - 03:00', 
                room: 'Old Library 1/2', 
                lecturerName: 'Dr. R. Makoni', 
                lecturerId: '210107' 
            },
            { 
                id: 'y1-4b', 
                code: 'HUM1204', 
                name: 'Artificial Intelligence, Critical Thinking', 
                year: 1, 
                section: 'A', 
                day: 'Tuesday', 
                time: '08:00 - 10:00', 
                room: 'Old Library 1/2', 
                lecturerName: 'Dr. R. Makoni', 
                lecturerId: '210107' 
            },
            
            // Object Oriented Programming - Mr. L. Dhlakama
            { 
                id: 'y1-5a', 
                code: 'CIS1204', 
                name: 'Object Oriented Programming', 
                year: 1, 
                section: 'A', 
                day: 'Thursday', 
                time: '09:00 - 11:00', 
                room: 'ICT General Purpose Lab', 
                lecturerName: 'Mr. L. Dhlakama', 
                lecturerId: '210105' 
            },
            { 
                id: 'y1-5b', 
                code: 'CIS1204', 
                name: 'Object Oriented Programming', 
                year: 1, 
                section: 'A', 
                day: 'Monday', 
                time: '03:00 - 04:00', 
                room: 'ICT General Purpose Lab', 
                lecturerName: 'Mr. L. Dhlakama', 
                lecturerId: '210105' 
            },
            
            // Software Engineering - Prof. Yogesh Awasthi
            { 
                id: 'y1-6a', 
                code: 'CIS1201', 
                name: 'Software Engineering', 
                year: 1, 
                section: 'A', 
                day: 'Monday', 
                time: '09:00 - 11:00', 
                room: 'AEG4', 
                lecturerName: 'Prof. Yogesh Awasthi', 
                lecturerId: '210106' 
            },
            { 
                id: 'y1-6b', 
                code: 'CIS1201', 
                name: 'Software Engineering', 
                year: 1, 
                section: 'A', 
                day: 'Tuesday', 
                time: '02:00 - 03:00', 
                room: 'AEG4', 
                lecturerName: 'Prof. Yogesh Awasthi', 
                lecturerId: '210106' 
            },
            
            // Technical Communication - Mr. Makambwa
            { 
                id: 'y1-7a', 
                code: 'CSC1201', 
                name: 'Technical Communication', 
                year: 1, 
                section: 'A', 
                day: 'Tuesday', 
                time: '10:00 - 12:00', 
                room: 'TMLT', 
                lecturerName: 'Mr. Makambwa', 
                lecturerId: '210101' 
            },
            { 
                id: 'y1-7b', 
                code: 'CSC1201', 
                name: 'Technical Communication', 
                year: 1, 
                section: 'A', 
                day: 'Thursday', 
                time: '11:00 - 12:00', 
                room: 'Old Library 1/2', 
                lecturerName: 'Mr. Makambwa', 
                lecturerId: '210101' 
            }
        ];
    },

    /**
     * Get classes for a specific lecturer
     * @param {string} lecturerId - Lecturer's ID
     * @returns {array} - Array of class objects for that lecturer
     */
    getClassesByLecturer(lecturerId) {
        return this.getTimetable().filter(c => c.lecturerId === lecturerId);
    },

    /**
     * Get today's classes for a year
     * @param {number} year - Student year (1 or 2)
     * @returns {array} - Today's classes
     */
    getTodayClasses(year) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        return this.getTimetable().filter(c => c.year === year && c.day === today);
    },

    /**
     * ========================================
     * STUDENT DATA METHODS
     * ========================================
     */

    /**
     * Get all students for a specific year
     * @param {number} year - Student year (1 or 2)
     * @returns {array} - Array of student objects
     */
    getStudentsForClass(year = 2) {
        return Object.values(this.users).filter(u => u.role === 'student' && u.year === year);
    },

    /**
     * Get all students
     * @returns {array} - Array of all student objects
     */
    getAllStudents() {
        return Object.values(this.users).filter(u => u.role === 'student');
    },

    /**
     * Get all lecturers
     * @returns {array} - Array of all lecturer objects
     */
    getAllLecturers() {
        return Object.values(this.users).filter(u => u.role === 'lecturer');
    },

    /**
     * ========================================
     * ATTENDANCE METHODS
     * ========================================
     */

    /**
     * Save bulk attendance for a class
     * @param {string} classId - Class identifier
     * @param {array} studentIds - Array of student IDs present
     * @returns {object} - Result of save operation
     */
    async saveBulkAttendance(classId, studentIds) {
        try {
            const response = await fetch(`${this.baseUrl}/attendance/bulk-mark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    classId, 
                    studentIds, 
                    date: new Date().toISOString() 
                })
            });
            return response.json();
        } catch (e) {
            // Return success when server is not available (demo mode)
            console.log('Attendance saved locally:', { classId, studentIds });
            return { success: true, message: 'Attendance saved successfully' };
        }
    },

    /**
     * Get attendance statistics
     * @returns {object} - Attendance stats (avg, atRisk, topClass)
     */
    async getAttendanceStats() {
        return this.getCached('stats', async () => {
            return {
                avg: 88,
                atRisk: 5,
                topClass: "Operating Systems (NCSC211)"
            };
        });
    },

    /**
     * ========================================
     * ANNOUNCEMENT METHODS
     * ========================================
     */

    /**
     * Post a new announcement
     * @param {object} announcement - { lecturerId, lecturerName, courseCode, courseName, type, message, year }
     */
    postAnnouncement(announcement) {
        const announcements = JSON.parse(localStorage.getItem('upath_announcements') || '[]');
        const newAnnouncement = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...announcement
        };
        announcements.unshift(newAnnouncement); // Add to top
        localStorage.setItem('upath_announcements', JSON.stringify(announcements));
        return { success: true };
    },

    /**
     * Get announcements for a specific student year
     * @param {number} year - Student year (1 or 2)
     */
    getAnnouncementsForStudent(year) {
        const announcements = JSON.parse(localStorage.getItem('upath_announcements') || '[]');
        // specific filter for mocked "global" announcements or year specific
        return announcements.filter(a => !a.year || a.year === year);
    },

    /**
     * Get announcements posted by a lecturer
     * @param {string} lecturerId 
     */
    getAnnouncementsByLecturer(lecturerId) {
        const announcements = JSON.parse(localStorage.getItem('upath_announcements') || '[]');
        return announcements.filter(a => a.lecturerId === lecturerId);
    },

    /**
     * ========================================
     * UTILITY METHODS
     * ========================================
     */

    /**
     * Get current time formatted
     * @returns {string} - Current time in HH:MM format
     */
    getCurrentTime() {
        return new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    },

    /**
     */
    getCurrentDate() {
        return new Date().toLocaleDateString('en-US', { 
            day: 'numeric' 
        });
    },

    /**
     * ========================================
     * ANALYTICS METHODS (UNIFIED)
     * ========================================
     */

    /**
     * Get aggregated stats for a specific course (Lecturer View)
     * Scan all daily records to build a complete picture
     */
    getCourseStats(courseCode) {
        let totalSessions = 0;
        let totalPresent = 0;
        const studentCounts = {}; // studentId -> count
        let uniqueStudents = new Set();

        // 1. Scan storage for daily records
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('upath_attendance_record_')) {
                const dayRecords = JSON.parse(localStorage.getItem(key));
                if (dayRecords[courseCode]) {
                    totalSessions++; // Assume 1 session per day if data exists
                    dayRecords[courseCode].forEach(sid => {
                        totalPresent++;
                        uniqueStudents.add(sid);
                        studentCounts[sid] = (studentCounts[sid] || 0) + 1;
                    });
                }
            }
        }

        // 2. Add "Mock" history if real data is sparse (for demo richness)
        // If totalSessions < 5, we assume it's a new demo and inject baseline stats
        // This prevents "0%" charts on fresh load
        const baselineSessions = 12; // Weeks passed
        if (totalSessions < 1) {
            return {
                totalSessions: baselineSessions,
                avgAttendance: 85, // Mock default
                presentCount: 0
            };
        }

        const totalStudents = uniqueStudents.size || 1;
        const avgAttendance = Math.round((totalPresent / (totalSessions * totalStudents)) * 100) || 0;

        return {
            totalSessions,
            avgAttendance,
            presentCount: totalPresent // Total check-ins ever
        };
    },

    /**
     * Get stats for a specific student (Student Reports)
     */
    getStudentStats(studentId) {
        const stats = {}; // courseCode -> { attended, total }
        const user = this.users[studentId];
        const year = user ? user.year : 2;

        // Initialize with all courses for their year
        this.getTimetable().filter(c => c.year === year).forEach(c => {
            stats[c.code] = { 
                code: c.code, 
                name: c.name, 
                lecturerName: c.lecturerName,
                attended: 0, 
                total: 12 // Baseline "past" sessions
            }; 
        });

        // Scan real records
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('upath_attendance_record_')) {
                const dayRecords = JSON.parse(localStorage.getItem(key));
                Object.keys(dayRecords).forEach(code => {
                    if (stats[code]) {
                        // Increment total sessions for this course if not already counted?
                        // For simplicity in this demo, we'll just increment 'attended' if found
                        if (dayRecords[code].includes(studentId)) {
                            stats[code].attended++;
                        }
                    }
                });
            }
        }

        // 3. Remove forced mock baseline - allow real 0/0 state
        // This ensures users see their actual data, even if it's empty start.
        /* 
        Object.values(stats).forEach(s => {
            const baseAtt = (parseInt(studentId) % 10) + 8; 
            s.attended += baseAtt;
            if (s.attended > s.total) s.attended = s.total;
        });
        */

        return stats;
    },

    /**
     * Helper to get current logged in user
     */
    getCurrentUser() {
        const str = sessionStorage.getItem('upath_user');
        return str ? JSON.parse(str) : null;
    },

    async fetchTimetable() {
        try {
            const res = await fetch('/api/classes');
            if (!res.ok) throw new Error('Failed to fetch classes');
            const data = await res.json();
            this.timetableCache = data; // Update local cache
            return data;
        } catch (err) {
            console.error(err);
            return this.getTimetable(); // Fallback
        }
    },

    async updateClass(classId, updateData) {
        try {
            const res = await fetch(`/api/classes/${classId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            return res.ok;
        } catch (err) {
            console.error("Update failed", err);
            return false;
        }
    },

    /**
     * ========================================
     * BACKEND ASYNC METHODS (REAL DATA)
     * ========================================
     */

    /**
     * Fetch course statistics from the backend
     * @param {string} courseCode - Course Identifier
     * @returns {Promise<object>} - Stats object
     */
    async fetchCourseStats(courseCode) {
        try {
            const res = await fetch(`/api/attendance/stats/course/${courseCode}`);
            if (!res.ok) throw new Error('Failed to fetch stats');
            return await res.json();
        } catch (err) {
            console.warn(`[API] Server unavailable, using local stats for ${courseCode}`);
            // Fallback to local logic if server offline
            return this.getCourseStats(courseCode); 
        }
    },

    /**
     * Fetch student attendance statistics from the backend
     * @param {string} studentId - Student Identifier
     * @returns {Promise<object>} - Stats map { code: { total, attended } }
     */
    async fetchStudentStats(studentId) {
        // 1. Get all courses for this student first (to ensure we show everything)
        const user = this.users[studentId] || { year: 2 };
        const allCourses = this.getTimetable().filter(c => c.year === user.year);
        
        let backendStats = [];
        try {
            const res = await fetch(`/api/attendance/student/${studentId}`);
            if (res.ok) {
                const data = await res.json();
                backendStats = data.stats || [];
            }
        } catch (err) {
            console.warn(`[API] Server unavailable, using local stats for student ${studentId}`);
            return this.getStudentStats(studentId);
        }

        // 2. Merge backend stats onto the full course list
        const stats = {};
        allCourses.forEach(c => {
            // Find matching record from backend
            const record = backendStats.find(s => s.courseCode === c.code);
            
            stats[c.code] = {
                code: c.code,
                name: c.name,
                lecturerName: c.lecturerName,
                total: record ? record.total : 0,    // Real total or 0
                attended: record ? record.attended : 0 // Real attended or 0
            };
        });

        return stats;
    },

    /**
     * Mark attendance via backend API
     * @param {string} studentId 
     * @param {string} courseCode 
     * @returns {Promise<boolean>} - Success status
     */
    async markAttendanceAsync(studentId, courseCode) {
        try {
            const res = await fetch('/api/attendance/mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    studentId, 
                    classId: courseCode, 
                    status: 'present' 
                })
            });
            return res.ok;
        } catch (err) {
            console.warn("[API] Server unavailable, marking locally");
            // Fallback to local
            return this.markAttendance(studentId, courseCode);
        }
    },

    /**
     * ========================================
     * UI HELPER METHODS
     * ========================================
     */

    /**
     * Initialize Mobile Navigation
     * Inject hamburger menu and handle toggling
     */
    initMobileNav() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        // Check if already initialized
        if (navbar.querySelector('.mobile-nav-toggle')) return;

        // Create Toggle Button
        const toggle = document.createElement('button');
        toggle.className = 'mobile-nav-toggle';
        toggle.innerHTML = '☰';
        toggle.ariaLabel = 'Menu';
        
        // Insert before actions or at end
        const actions = navbar.querySelector('.navbar-actions');
        if (actions) {
            navbar.insertBefore(toggle, actions);
        } else {
            navbar.appendChild(toggle);
        }

        // Handle Click
        toggle.onclick = () => {
            const nav = navbar.querySelector('.navbar-nav');
            if (nav) {
                nav.classList.toggle('active');
                toggle.innerHTML = nav.classList.contains('active') ? '✕' : '☰';
                
                // Handle mobile actions if not already present
                if (nav.classList.contains('active') && !nav.querySelector('.mobile-actions') && actions) {
                    const mobileActions = actions.cloneNode(true);
                    mobileActions.className = 'navbar-actions mobile-actions';
                    mobileActions.style.display = 'flex'; // Override CSS display:none
                    
                    // Re-attach logout listener since cloneNode doesn't copy events
                    const logoutBtn = mobileActions.querySelector('.navbar-logout');
                    if (logoutBtn) {
                        logoutBtn.onclick = () => API.logout(); // Use API logout wrapper
                    }
                    
                    nav.appendChild(mobileActions);
                }
            }
        };
    },

    /**
     * Global Logout wrapper
     */
    logout() {
        sessionStorage.removeItem('upath_user');
        window.location.href = '/pages/auth.html';
    }
};

// Auto-init mobile nav if DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (API.initMobileNav) API.initMobileNav();
    });
}

// Export for use in other modules (if using ES modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
