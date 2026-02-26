const { sequelize, User, Class, Attendance, Session } = require('../models');
const seedData = require('../data/seed_data');

async function seedAll() {
    try {
        console.log('🌱 Starting Master Seeding...');
        console.log('   DB Path:', sequelize.options.storage);
        
        await sequelize.sync({ force: true }); // WARNING: Clears DB
        console.log('   ✓ Database synced (cleared)');

        // 1. Seed Lecturers
        const lecturers = seedData.generateLecturers();
        console.log(`   ✓ Generated ${lecturers.length} lecturers`);
        await User.bulkCreate(lecturers, { individualHooks: true });
        console.log('   ✓ Lecturers saved to DB');

        // 2. Seed Classes
        const classes = seedData.generateClasses();
        console.log(`   ✓ Generated ${classes.length} classes`);
        
        // Map seed class format to Timetable model format
        const timetableData = classes.map(c => ({
           Course_Code: c.code,
           Course_Name: c.name,
           Day: c.day,
           // Time is "HH:MM - HH:MM", split safely
           From_Time: c.time.includes(' - ') ? c.time.split(' - ')[0] : c.time,
           To_Time: c.time.includes(' - ') ? c.time.split(' - ')[1] : '',
           Venue: c.room,
           Lecturer: c.lecturerName,
           LecturerId: c.lecturerId,
           Year_Semester: c.rawYearSemester || `Y${c.year}S1`, 
           Program: c.rawProgram || c.code.substring(0, 4), 
           Section: c.rawSection || 'A',
           College: c.rawCollege || 'Computing',
           Department: c.rawCollege || 'Computing'
        }));

        await Class.bulkCreate(timetableData);
        console.log('   ✓ Classes saved to DB');

        // 3. Seed Students
        const students = seedData.generateStudents();
        console.log(`   ✓ Generated ${students.length} students`);
        console.log('   Student Sample:', students[0]);
        
        console.log(`   • Seeding ${students.length} students...`);
        let successCount = 0;
        for (const stu of students) {
            try {
                await User.create(stu);
                successCount++;
            } catch (e) {
                console.error(`     Failed to seed student ${stu.id}:`, e.message);
            }
        }
        console.log(`   ✓ ${successCount} Students saved to DB`);

        // Summary
        console.log('\n✅ Master Seeding Complete!');
        console.log(`   • Users: ${lecturers.length + students.length}`);
        console.log(`   • Classes: ${classes.length}`);
        
        // Force WAL checkpoint
        console.log('   Stats before checkpoint:', await User.count());
        await sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
        console.log('   Stats after checkpoint:', await User.count());

        // Verify file on disk
        const fs = require('fs');
        const dbPath = sequelize.options.storage;
        console.log(`\n🔍 INTERNAL FILE CHECK:`);
        console.log(`   Path: ${dbPath}`);
        if (fs.existsSync(dbPath)) {
            console.log(`   Size: ${fs.statSync(dbPath).size} bytes`);
        } else {
            console.log(`   ❌ File does not exist at this path!`);
        }

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        console.log('   Closing connection...');
        await sequelize.close();
        console.log('   ✓ Connection closed.');
    }
}

seedAll();
