
const path = require('path');
const { sequelize, User, Class, Attendance } = require(path.join(__dirname, 'models')); // Robust path
const { Op } = require('sequelize');

async function seedAttendance() {
    try {
        console.log('Connecting to database...');
        await sequelize.sync(); 

        console.log('Fetching students and classes...');
        const students = await User.findAll({ where: { role: 'student' } });
        const classes = await Class.findAll();

        if (students.length === 0 || classes.length === 0) {
            console.error('No students or classes found. Run initial seed first.');
            return;
        }

        console.log(`Found ${students.length} students and ${classes.length} classes.`);

        const records = [];
        const today = new Date();
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(today.getDate() - 14);

        // Iterate last 14 days
        for (let d = 0; d < 14; d++) {
            const date = new Date(twoWeeksAgo);
            date.setDate(date.getDate() + d);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

            if (dayName === 'Saturday' || dayName === 'Sunday') continue;

            const dailyClasses = classes.filter(c => c.Day === dayName);

            for (const cls of dailyClasses) {
                // Determine year from class data
                let classYear = 2;
                if (cls.Year_Semester && cls.Year_Semester.includes('Y1')) classYear = 1;
                else if (cls.Year_Semester && cls.Year_Semester.includes('Y2')) classYear = 2;

                // Filter relevant students
                const relevantStudents = students.filter(s => {
                    // 1. Year Check
                    let sYear = s.year || (s.id.startsWith('25') ? 1 : 2);
                    if (sYear !== classYear) return false;

                    // 2. Program Check
                    if (cls.College === 'University Wide') return true;
                    if (cls.Program && s.program && cls.Program.toLowerCase().includes(s.program.toLowerCase())) return true;
                    
                    // Fallback randomness for demo
                    return Math.random() > 0.3;
                });

                for (const student of relevantStudents) {
                    // 90% chance to be present
                    if (Math.random() > 0.1) {
                        records.push({
                            id: Date.now() + Math.random().toString(), 
                            classId: `${cls.Course_Code}-${cls.Day}-${cls.From_Time}`,
                            studentId: student.id,
                            status: 'present',
                            date: date
                        });
                    }
                }
            }
        }

        console.log(`Generating ${records.length} records...`);
        
        // Batch Insert
        const chunkSize = 100;
        for (let i = 0; i < records.length; i += chunkSize) {
            await Attendance.bulkCreate(records.slice(i, i + chunkSize));
        }

        console.log('Done! Attendance simulated.');
        
    } catch (err) {
        console.error('Error:', err);
    }
}

seedAttendance();
