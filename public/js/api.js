/**
 * ========================================
 * UPath API Module
 * ========================================
 * 
 * This module provides all data access and authentication functionality
 * for the UPath attendance system.
 * 
 * HYBRID VERSION (FIXED):
 * - Fixes Blank Lecturer Dashboard (Matches by Name if ID missing)
 * - Fixes Student Dashboard (Aliases getTimetable to getClasses)
 * - Robust Error Handling (Server -> Hardcoded Fallback)
 */

const API = {
    // Base URL for server API (relative for network access from phones)
    baseUrl: '/api',
    
    // Cache settings
    cache: {},
    cacheTimeout: 5 * 60 * 1000, // 5 minutes

    /**
     * ========================================
     * CACHE MANAGEMENT
     * ========================================
     */
    async getCached(key, fetchFn) {
        const cached = this.cache[key];
        if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
            return cached.data;
        }
        try {
            const data = await fetchFn();
            this.cache[key] = { data, timestamp: Date.now() };
            return data;
        } catch (error) {
            console.warn(`Failed to fetch ${key}, returning cached if available.`);
            if (cached) return cached.data;
            throw error;
        }
    },

    clearCache(key) {
        if (key) delete this.cache[key];
        else this.cache = {};
    },

    /**
     * ========================================
     * AUTHENTICATION METHODS
     * ========================================
     */
    async login(idNumber, password) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: idNumber, password })
            });
            const data = await response.json();
            
            if (response.ok) {
                if (typeof Toast !== 'undefined') Toast.success(`Welcome back, ${data.user.fullName}`);
                return data;
            } else {
                if (typeof Toast !== 'undefined') Toast.error(data.message || 'Login failed');
                return { error: data.message };
            }
        } catch (e) {
            console.error("Login Error:", e);
            if (typeof Toast !== 'undefined') Toast.error('Server unavailable. Please check connection.');
            return { error: 'Server unavailable' };
        }
    },

    async register(userData) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            return response.json();
        } catch (e) {
            return { error: 'Server error' };
        }
    },

    /**
     * ========================================
     * CLASS DATA METHODS
     * ========================================
     */

    /**
     * SMAER getClasses:
     * 1. Try Server (All classes)
     * 2. Fallback to Hardcoded
     * 3. Apply Fuzzy Filter
     */
    async getClasses(year = null, program = null) {
        const cacheKey = 'classes_' + (year || 'all') + '_' + (program || 'all');
        
        return this.getCached(cacheKey, async () => {
            let classes = [];
            try {
                // FIX: Pass PROGRAM to server for exact filtering
                const url = `${this.baseUrl}/classes?year=${year || ''}&program=${encodeURIComponent(program || '')}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error('API error');
                const rawClasses = await response.json();
                
                // NORMALIZE: Map Server DB columns to Client Schema
                classes = rawClasses.map(c => ({
                    ...c, // Keep originals
                    code: c.Course_Code || c.code,
                    name: c.Course_Name || c.name,
                    day: c.Day || c.day,
                    time: c.Time || c.time || (c.From_Time ? `${c.From_Time} - ${c.To_Time}` : '00:00 - 00:00'),
                    room: c.Venue || c.room,
                    lecturerName: c.Lecturer_Name || c.lecturerName,
                    year: c.Year || c.year,
                    program: c.Program || c.program
                }));
            } catch (e) {
                console.warn('Server offline/error, using fallback timetable');
                classes = this.getLocalTimetable();
                if (year) classes = classes.filter(c => c.year === year);
                // Only apply client-side filter if server is offline
                if (program) {
                    classes = this.filterClassesByProgram(classes, program);
                }
            }

            // Server already did exact program filter - no client-side filter needed
            let filtered = classes;

            // Deduplication Logic
            const unique = [];
            const seen = new Set();
            filtered.forEach(c => {
                const key = `${c.code}-${c.day}-${c.time}-${c.room}`.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(c);
                }
            });

            return unique;
        });
    },

    /**
     * Legacy Alias for Student Dashboard compatibility
     * The dashboard calls getTimetable(year, program) expecting a Promise
     */
    async getTimetable(year = null, program = null) {
        return this.getClasses(year, program);
    },

    /**
     * Get Classes for Lecturer
     * CRITICAL FIX: Server doesn't return lecturerId sometimes, so we match by Name too.
     */
    async getClassesByLecturer(lecturerId) {
        try {
            // Use the dedicated backend endpoint which handles:
            // 1. Efficient filtering (DB side)
            // 2. Fuzzy name matching
            // 3. Deduplication (Critical fix)
            const response = await fetch(`${this.baseUrl}/classes/lecturer/${lecturerId}`);
            
            if (response.ok) {
                const classes = await response.json();
                // map to client schema (backend already returns formatted data, but let's be safe)
                return classes.map(c => ({
                    ...c,
                    // Backend returns 'code', 'name', 'day', 'time', 'room' etc.
                    // Just ensure strict schema match if needed, or pass through
                    id: c.id || `${c.code}-${c.day}-${c.time}`, // Ensure ID exists
                    code: c.code || c.Course_Code,
                    name: c.name || c.Course_Name,
                    day: c.day || c.Day,
                    time: c.time || c.Time,
                    room: c.room || c.Venue,
                    lecturerName: c.lecturerName || c.Lecturer,
                    year: c.year || c.Year,
                    program: c.program || c.Program
                }));
            } else {
                throw new Error("Server Error");
            }
        } catch (e) {
            console.warn('[API] Lecturer fetch failed, using fallback:', e);
            // Fallback to local filtering if server fails
            const allClasses = this.getLocalTimetable();
            const user = this.getCurrentUser();
            
            return allClasses.filter(c => {
                 // A. Match by ID (if available)
                 if (c.lecturerId && String(c.lecturerId) === String(lecturerId)) return true;
                 if (c.LecturerId && String(c.LecturerId) === String(lecturerId)) return true;

                 // B. Match by Name (Fallback)
                 if (user && user.fullName && c.lecturerName) {
                     const surname = user.fullName.split(' ').pop();
                     if (c.lecturerName.includes(surname)) return true;
                 }
                 return false;
            });
        }
    },

    /**
     * Fuzzy matching logic for programs
     */
    filterClassesByProgram(classes, userProgram) {
        if (!userProgram) return classes;
        const p = userProgram.toLowerCase();
        
        // Define program keywords for code prefix matching (STRICT - only unambiguous codes)
        const keywords = [];
        if (p.includes('computer') || p.includes('software') || p.includes('ai') || p.includes('artificial')) {
            keywords.push('NCSC', 'CSC', 'CIS'); // NCIS removed - ambiguous with Health Services
        }
        if (p.includes('agri') || p.includes('natural')) keywords.push('AGR');
        if (p.includes('business') || p.includes('accounting') || p.includes('finance')) {
            keywords.push('BBS', 'ACC', 'FIN', 'MGT', 'MKT');
        }
        if (p.includes('humanities') || p.includes('english') || p.includes('media')) {
            keywords.push('HUM', 'ENG', 'IRD');
        }
        
        // Define program name patterns for direct matching
        const programPatterns = [];
        if (p.includes('computer')) programPatterns.push('computer sciences', 'computer information');
        if (p.includes('software')) programPatterns.push('software engineering');
        if (p.includes('ai') || p.includes('artificial')) programPatterns.push('artificial intelligence');

        return classes.filter(c => {
            // Guard: Skip if code is missing
            if (!c.code) {
                console.warn('[API] Skipping class with no code:', c);
                return false;
            }
            
            // 1. Mandatory Courses (NTEV - Ethics)
            if (c.code.startsWith('NTEV')) return true;
            
            // 2. PRIORITY: Check if course's Program field matches user's program
            if (c.program) {
                const courseProgram = c.program.toLowerCase();
                // Direct program matching
                for (const pattern of programPatterns) {
                    if (courseProgram.includes(pattern)) return true;
                }
                // User's program name in course's program field
                if (courseProgram.includes(p.substring(0, 20))) return true;
            }

            // 3. Match Code Prefix against STRICT Program Keywords
            const codeMatch = c.code.match(/^[A-Z]+/);
            if (!codeMatch) return false;
            const codePrefix = codeMatch[0];
            if (keywords.includes(codePrefix)) {
                // Double-check: if it has a program field, make sure it's not for a different faculty
                if (c.program) {
                    const cp = c.program.toLowerCase();
                    // Exclude if clearly from different faculty
                    if (cp.includes('health') || cp.includes('nursing') || cp.includes('agri')) {
                        return false;
                    }
                }
                return true;
            }
            
            return false;
        });
    },

    /**
     * HARDCODED TIMETABLE (Restored for Fallback)
     */
    getLocalTimetable() {
        return [
            // ============ YEAR 2 (Y2S2) ============
            { id: 'y2-1a', code: 'NCSC211', name: 'Operating Systems', year: 2, day: 'Monday', time: '08:00 - 10:00', room: 'ICT Mai Mugabe Lab', lecturerName: 'Mr. Makambwa', lecturerId: '210101' },
            { id: 'y2-2a', code: 'NCSC312', name: 'Network Security', year: 2, day: 'Wednesday', time: '11:00 - 01:00', room: 'ICT Smart Classroom 4', lecturerName: 'Dr. Tendai Zengeni', lecturerId: '210102' },
            { id: 'y2-2b', code: 'NCSC312', name: 'Network Security', year: 2, day: 'Tuesday', time: '02:00 - 03:00', room: 'ICT Mai Mugabe Lab', lecturerName: 'Dr. Tendai Zengeni', lecturerId: '210102' },
            { id: 'y2-3a', code: 'NCIS210', name: 'Group Project', year: 2, day: 'Monday', time: '02:00 - 04:00', room: 'ICT Mai Mugabe Lab', lecturerName: 'Mr. Joseph Chinzvende', lecturerId: '210103' },
            { id: 'y2-3b', code: 'NCIS210', name: 'Group Project', year: 2, day: 'Thursday', time: '09:00 - 10:00', room: 'ICT Mai Mugabe Lab', lecturerName: 'Mr. Joseph Chinzvende', lecturerId: '210103' },
            { id: 'y2-4a', code: 'NCSC303', name: 'Human Computer Interactions', year: 2, day: 'Tuesday', time: '09:00 - 11:00', room: 'ICT Smart Classroom 1', lecturerName: 'Mr. Joseph Chinzvende', lecturerId: '210103' },
            { id: 'y2-4b', code: 'NCSC303', name: 'Human Computer Interactions', year: 2, day: 'Friday', time: '08:00 - 09:00', room: 'ICT Smart Classroom 1', lecturerName: 'Mr. Joseph Chinzvende', lecturerId: '210103' },
            { id: 'y2-5a', code: 'NTEV200', name: 'Ethics and Christian Values', year: 2, day: 'Wednesday', time: '09:00 - 11:00', room: 'DHSG19', lecturerName: 'Rev. N. Bondo', lecturerId: '210104' },
            { id: 'y2-5b', code: 'NTEV200', name: 'Ethics and Christian Values', year: 2, day: 'Friday', time: '11:00 - 12:00', room: 'TMLT', lecturerName: 'Rev. N. Bondo', lecturerId: '210104' },
            
            // ============ YEAR 1 (Y1S2) ============
            { id: 'y1-1a', code: 'HUM1202', name: 'French for Beginners II', year: 1, day: 'Wednesday', time: '12:00 - 01:00', room: 'TMLT', lecturerName: 'Dr. M. Kayembe', lecturerId: '210108' },
            { id: 'y1-1b', code: 'HUM1202', name: 'French for Beginners II', year: 1, day: 'Friday', time: '09:00 - 11:00', room: 'TMLT', lecturerName: 'Dr. M. Kayembe', lecturerId: '210108' },
            { id: 'y1-2a', code: 'HUM1201', name: 'Portuguese for Beginners II', year: 1, day: 'Wednesday', time: '11:00 - 01:00', room: 'DHSG19', lecturerName: 'Dr. M. Mzite', lecturerId: '210109' },
            { id: 'y1-2b', code: 'HUM1201', name: 'Portuguese for Beginners II', year: 1, day: 'Friday', time: '09:00 - 10:00', room: 'DHSG19', lecturerName: 'Dr. M. Mzite', lecturerId: '210109' },
            { id: 'y1-3a', code: 'HUM1203', name: 'English as a Second Language II', year: 1, day: 'Wednesday', time: '09:00 - 11:00', room: 'TMLT', lecturerName: 'Ms. J. Muzamhindo', lecturerId: '210110' },
            { id: 'y1-3b', code: 'HUM1203', name: 'English as a Second Language II', year: 1, day: 'Friday', time: '10:00 - 11:00', room: 'AEG4', lecturerName: 'Ms. J. Muzamhindo', lecturerId: '210110' },
            { id: 'y1-4a', code: 'HUM1204', name: 'AI & Critical Thinking', year: 1, day: 'Monday', time: '02:00 - 03:00', room: 'Old Library 1/2', lecturerName: 'Dr. R. Makoni', lecturerId: '210107' },
            { id: 'y1-4b', code: 'HUM1204', name: 'AI & Critical Thinking', year: 1, day: 'Tuesday', time: '08:00 - 10:00', room: 'Old Library 1/2', lecturerName: 'Dr. R. Makoni', lecturerId: '210107' },
            { id: 'y1-5a', code: 'CIS1204', name: 'OOP', year: 1, day: 'Thursday', time: '09:00 - 11:00', room: 'ICT Gen Lab', lecturerName: 'Mr. L. Dhlakama', lecturerId: '210105' },
            { id: 'y1-5b', code: 'CIS1204', name: 'OOP', year: 1, day: 'Monday', time: '03:00 - 04:00', room: 'ICT Gen Lab', lecturerName: 'Mr. L. Dhlakama', lecturerId: '210105' },
            { id: 'y1-6a', code: 'CIS1201', name: 'Software Engineering', year: 1, day: 'Monday', time: '09:00 - 11:00', room: 'AEG4', lecturerName: 'Prof. Yogesh Awasthi', lecturerId: '210106' },
            { id: 'y1-6b', code: 'CIS1201', name: 'Software Engineering', year: 1, day: 'Tuesday', time: '02:00 - 03:00', room: 'AEG4', lecturerName: 'Prof. Yogesh Awasthi', lecturerId: '210106' },
            { id: 'y1-7a', code: 'CSC1201', name: 'Tech Comm', year: 1, day: 'Tuesday', time: '10:00 - 12:00', room: 'TMLT', lecturerName: 'Mr. Makambwa', lecturerId: '210101' },
            { id: 'y1-7b', code: 'CSC1201', name: 'Tech Comm', year: 1, day: 'Thursday', time: '11:00 - 12:00', room: 'Old Library 1/2', lecturerName: 'Mr. Makambwa', lecturerId: '210101' }
        ];
    },

    /**
     * ========================================
     * STUDENT DATA METHODS
     * ========================================
     */
    async fetchUsers() {
        return this.getCached('users', async () => {
             const response = await fetch(`${this.baseUrl}/auth/users`);
             if (!response.ok) return { students: [], lecturers: [] };
             return response.json();
        });
    },

    async fetchUser(id) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/user/${id}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            return null;
        }
    },

    async getStudentsForClass(year = 2) {
        const data = await this.fetchUsers();
        if (!data || !data.students) return [];
        return data.students.filter(u => u.year === year);
    },

    async getAllStudents() {
        const data = await this.fetchUsers();
        return data.students || [];
    },

    async getAllLecturers() {
       const data = await this.fetchUsers();
       return data.lecturers || [];
    },

    /**
     * ========================================
     * ATTENDANCE METHODS
     * ========================================
     */
    async saveBulkAttendance(classId, studentIds) {
        try {
            const response = await fetch(`${this.baseUrl}/attendance/bulk-mark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    classId, 
                    students: studentIds,
                    date: new Date().toISOString() 
                })
            });
            const res = await response.json();
            if (response.ok) {
                 if (typeof Toast !== 'undefined') Toast.success(`Marked ${studentIds.length} students present`);
            }
            return res;
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.warning('Saved locally (Server offline)');
            return { success: true, message: 'Attendance saved successfully' };
        }
    },

    async generateSessionCode(classId) {
        try {
            const response = await fetch(`${this.baseUrl}/attendance/generate-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId })
            });
            return response.json();
        } catch (e) {
            console.error("Generate session failed:", e);
            throw e;
        }
    },

    async validateSessionCode(classId, code, userLat = null, userLon = null) {
        const user = this.getCurrentUser();
        if (!user) return { error: 'Not logged in' };

        try {
            const response = await fetch(`${this.baseUrl}/attendance/validate-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    classId, 
                    studentId: user.id,
                    code,
                    userLat,
                    userLon
                })
            });
            return response.json();
        } catch (e) {
             return { error: 'Connection failed' };
        }
    },

    getCurrentUser() {
        const str = sessionStorage.getItem('upath_user');
        return str ? JSON.parse(str) : null;
    },

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
     * ANALYTICS / STATS
     * ========================================
     */
    async fetchCourseStats(courseCode) {
        try {
            const res = await fetch(`/api/attendance/stats/course/${courseCode}`);
            if (!res.ok) throw new Error('Failed to fetch stats');
            return await res.json();
        } catch (err) {
            return { totalSessions: 12, avgAttendance: 85, presentCount: 0 }; 
        }
    },

    async fetchStudentStats(studentId) {
        try {
            const res = await fetch(`/api/attendance/student/${studentId}`);
            if (res.ok) {
                const data = await res.json();
                // Normalize Server Stats to match Client Schema
                if (data.stats) {
                    data.stats = data.stats.map(s => ({
                        ...s,
                        code: s.courseCode || s.code, // Normalize courseCode -> code
                        name: s.name,
                        total: s.total,
                        attended: s.attended,
                        percentage: s.percentage !== undefined ? s.percentage : (s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0)
                    }));
                }
                return data;
            }
        } catch (e) {}

        const user = (this.users && this.users[studentId]) ? this.users[studentId] : this.getCurrentUser() || { year: 2 };
        
        // Strict Filtering: Pass Program
        const classes = await this.getClasses(user.year, user.program);
        
        const stats = {};
        classes.forEach(c => {
             if (!stats[c.code]) {
                 stats[c.code] = {
                    code: c.code,
                    name: c.name,
                    lecturerName: c.lecturerName,
                    total: 12,
                    attended: 0
                };
             }
        });
        
        // Return as List
        return { stats: Object.values(stats) };
    },

    async getTodayAttendance(studentId) {
        try {
            const res = await fetch(`${this.baseUrl}/attendance/today/${studentId}`);
            if (res.ok) {
                const data = await res.json();
                return data.presentClassIds || [];
            }
            return [];
        } catch (e) {
            return [];
        }
    },

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
            return true;
        }
    },

    /**
     * Save Bulk Attendance for Manual Marking
     * @param {string} classId - The course code
     * @param {string[]} studentIds - Array of student IDs to mark present
     */
    async saveBulkAttendance(classId, studentIds) {
        try {
            const res = await fetch('/api/attendance/bulk-mark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    classId,
                    students: studentIds,
                    date: new Date().toISOString().split('T')[0]
                })
            });
            
            if (!res.ok) {
                throw new Error('Failed to save attendance');
            }
            
            return await res.json();
        } catch (err) {
            console.error('Bulk attendance error:', err);
            throw err;
        }
    },

    /**
     * ========================================
     * ANNOUNCEMENT METHODS
     * ========================================
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
        if (typeof Toast !== 'undefined') Toast.success('Announcement Posted');
        return { success: true };
    },

    getAnnouncementsForStudent(year) {
        const announcements = JSON.parse(localStorage.getItem('upath_announcements') || '[]');
        return announcements.filter(a => !a.year || a.year === year);
    },

    getAnnouncementsByLecturer(lecturerId) {
        const announcements = JSON.parse(localStorage.getItem('upath_announcements') || '[]');
        return announcements.filter(a => a.lecturerId === lecturerId);
    },

    /**
     * ========================================
     * UI HELPER METHODS
     * ========================================
     */
    initMobileNav() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        if (navbar.querySelector('.mobile-nav-toggle')) return;

        const toggle = document.createElement('button');
        toggle.className = 'mobile-nav-toggle';
        toggle.innerHTML = '☰';
        toggle.ariaLabel = 'Menu';
        
        const actions = navbar.querySelector('.navbar-actions');
        if (actions) {
            navbar.insertBefore(toggle, actions);
        } else {
            navbar.appendChild(toggle);
        }

        toggle.onclick = () => {
            const nav = navbar.querySelector('.navbar-nav');
            if (nav) {
                nav.classList.toggle('active');
                toggle.innerHTML = nav.classList.contains('active') ? '✕' : '☰';
                
                if (nav.classList.contains('active') && !nav.querySelector('.mobile-actions') && actions) {
                    const mobileActions = actions.cloneNode(true);
                    mobileActions.className = 'navbar-actions mobile-actions';
                    mobileActions.style.display = 'flex';
                    const logoutBtn = mobileActions.querySelector('.navbar-logout');
                    if (logoutBtn) logoutBtn.onclick = () => API.logout();
                    nav.appendChild(mobileActions);
                }
            }
        };
    },

    logout() {
        sessionStorage.removeItem('upath_user');
        window.location.href = '../../pages/auth.html';
    },

    getCurrentTime() {
        return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    },
    getCurrentDate() {
        return new Date().toLocaleDateString('en-US', { day: 'numeric' });
    }
};

// Auto-init mobile nav if DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (API.initMobileNav) API.initMobileNav();
    });
}

// Export for Node/Tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}

// Expose to window for browser
if (typeof window !== 'undefined') {
    window.API = API;
}
