/**
 * ========================================
 * ATTENDANCE DATA SEEDING SCRIPT
 * ========================================
 * Seeds realistic attendance data for demo purposes.
 * 
 * Features:
 * - Uses actual student IDs from Users table
 * - Uses composite class IDs (e.g., "NCSC211-Monday-8")
 * - Creates random attendance records (70-90% rate)
 * - Stores studentId for student tracking
 * - Stores classId for lecturer analytics
 * 
 * Run: node server/scripts/seed_attendance.js
 */

const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');

// Initialize Sequelize with the timetable database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../timetable.sqlite'),
    logging: false
});

// Define models inline to match existing schema
const User = sequelize.define('User', {
    id: { type: DataTypes.STRING, primaryKey: true },
    fullName: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    password: { type: DataTypes.STRING },
    role: { type: DataTypes.STRING },
    year: { type: DataTypes.INTEGER },
    department: { type: DataTypes.STRING },
    program: { type: DataTypes.STRING },
    college: { type: DataTypes.STRING }
}, { tableName: 'Users', timestamps: true });

const Timetable = sequelize.define('Timetable', {
    College: { type: DataTypes.STRING },
    Department: { type: DataTypes.STRING },
    Program: { type: DataTypes.STRING },
    Year_Semester: { type: DataTypes.STRING },
    Course_Code: { type: DataTypes.STRING },
    Course_Name: { type: DataTypes.STRING },
    Section: { type: DataTypes.STRING },
    Day: { type: DataTypes.STRING },
    From_Time: { type: DataTypes.STRING },
    To_Time: { type: DataTypes.STRING },
    Venue: { type: DataTypes.STRING },
    Lecturer: { type: DataTypes.STRING },
    LecturerId: { type: DataTypes.STRING }
}, {
    tableName: 'timetable',
    timestamps: false,
    id: false
});
Timetable.removeAttribute('id');

const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    classId: { type: DataTypes.STRING },
    studentId: { type: DataTypes.STRING },
    date: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: 'present' },
    method: { type: DataTypes.STRING, defaultValue: 'totp' }
}, { tableName: 'Attendances', timestamps: true });

// Valid weekdays for filtering
const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Generate random dates over past 6 weeks
function generateSessionDates(numSessions = 12) {
    const dates = [];
    const today = new Date();
    
    for (let weekOffset = 0; weekOffset < 6; weekOffset++) {
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) { // Mon-Fri
            const date = new Date(today);
            date.setDate(date.getDate() - (weekOffset * 7) - dayOffset);
            if (date < today) {
                dates.push(date.toISOString().split('T')[0]);
            }
        }
    }
    
    // Return first N dates (up to numSessions)
    return dates.slice(0, numSessions);
}

async function seedAttendance() {
    try {
        console.log('🌱 Starting Attendance Seeding...');
        
        // 1. Clear existing attendance data
        await Attendance.destroy({ where: {} });
        console.log('   ✓ Cleared existing attendance records');
        
        // 2. Get all students grouped by program
        const students = await User.findAll({
            where: { role: 'student' }
        });
        console.log(`   ✓ Found ${students.length} students`);
        
        // 3. Get all valid classes (with proper weekdays)
        const classes = await Timetable.findAll({
            where: {
                Day: { [Op.in]: validDays }
            }
        });
        console.log(`   ✓ Found ${classes.length} valid classes`);
        
        // 4. Group classes by program
        const classesByProgram = {};
        classes.forEach(c => {
            const program = c.Program;
            if (!classesByProgram[program]) {
                classesByProgram[program] = [];
            }
            classesByProgram[program].push(c);
        });
        
        // 5. Generate session dates
        const sessionDates = generateSessionDates(12);
        console.log(`   ✓ Generated ${sessionDates.length} session dates`);
        
        // 6. Create attendance records
        let totalRecords = 0;
        const attendanceRecords = [];
        
        for (const student of students) {
            const studentProgram = student.program;
            const studentYear = student.year || 2;
            
            // Get classes for this student's program
            const studentClasses = classesByProgram[studentProgram] || [];
            
            // Filter by year
            const yearClasses = studentClasses.filter(c => {
                if (!c.Year_Semester) return false;
                const match = c.Year_Semester.match(/Y(\d+)/);
                return match && parseInt(match[1]) === studentYear;
            });
            
            // For each class, randomly mark attendance for some sessions
            for (const classObj of yearClasses) {
                const compositeId = `${classObj.Course_Code}-${classObj.Day}-${classObj.From_Time}`;
                
                // Random attendance rate between 60-95%
                const attendanceRate = 0.6 + (Math.random() * 0.35);
                
                for (const date of sessionDates) {
                    // Check if this date falls on the class's day
                    const dateObj = new Date(date);
                    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    
                    if (dayOfWeek === classObj.Day) {
                        // Roll dice for attendance
                        if (Math.random() < attendanceRate) {
                            attendanceRecords.push({
                                classId: compositeId,
                                studentId: student.id,
                                date: date,
                                status: 'present',
                                method: Math.random() > 0.3 ? 'totp' : 'manual'
                            });
                            totalRecords++;
                        }
                    }
                }
            }
        }
        
        // 7. Bulk insert attendance records
        if (attendanceRecords.length > 0) {
            await Attendance.bulkCreate(attendanceRecords);
            console.log(`   ✓ Created ${totalRecords} attendance records`);
        } else {
            console.log('   ⚠ No attendance records to create');
        }
        
        // 8. Summary stats
        const uniqueStudents = new Set(attendanceRecords.map(r => r.studentId)).size;
        const uniqueClasses = new Set(attendanceRecords.map(r => r.classId)).size;
        
        console.log('\n📊 Seeding Summary:');
        console.log(`   • Students with attendance: ${uniqueStudents}`);
        console.log(`   • Classes with records: ${uniqueClasses}`);
        console.log(`   • Total attendance entries: ${totalRecords}`);
        
        console.log('\n✅ Attendance seeding complete!');
        
    } catch (err) {
        console.error('❌ Error seeding attendance:', err);
    } finally {
        await sequelize.close();
    }
}

// Run the seeding
seedAttendance();
