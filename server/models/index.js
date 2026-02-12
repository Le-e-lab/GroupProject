const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 1. User Model
const User = sequelize.define('User', {
    id: { type: DataTypes.STRING, primaryKey: true }, // e.g., '240101'
    fullName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }, // Store hashed in prod
    role: { type: DataTypes.ENUM('student', 'lecturer'), allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: true },     // 1, 2, 3, 4
    department: { type: DataTypes.STRING, allowNull: true }, // e.g., 'Computing'
    program: { type: DataTypes.STRING, allowNull: true },    // e.g., 'NCSC'
    college: { type: DataTypes.STRING, allowNull: true }     // e.g., 'CBMS'
});

// 2. Class Model
// 2. Timetable Model (Maps to existing 'timetable' table)
const Timetable = sequelize.define('Timetable', {
    // No single PK in existing schema, so we might need a composite or rely on rowid if needed.
    // For read-only access, we can define attributes.
    College: { type: DataTypes.STRING },
    Department: { type: DataTypes.STRING },
    Program: { type: DataTypes.STRING },
    Year_Semester: { type: DataTypes.STRING }, // 'Y1 S1'
    Course_Code: { type: DataTypes.STRING },
    Course_Name: { type: DataTypes.STRING },
    Section: { type: DataTypes.STRING },
    Day: { type: DataTypes.STRING },
    From_Time: { type: DataTypes.STRING },
    To_Time: { type: DataTypes.STRING },
    Venue: { type: DataTypes.STRING },
    Lecturer: { type: DataTypes.STRING },
    LecturerId: { type: DataTypes.STRING },
    latitude: { type: DataTypes.FLOAT, allowNull: true },
    longitude: { type: DataTypes.FLOAT, allowNull: true },
    allowedIPs: { type: DataTypes.STRING, allowNull: true } // JSON string or comma-separated
}, {
    tableName: 'timetable',
    timestamps: false,
    id: false // Existing table might not have 'id' column
});
Timetable.removeAttribute('id');

// We can add the 'Class' alias for backward compatibility or refactor
const Class = Timetable; 

// 3. Attendance Model
const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.STRING, allowNull: false }, // '2023-10-25'
    status: { type: DataTypes.ENUM('present', 'absent', 'late'), defaultValue: 'present' },
    method: { type: DataTypes.STRING, defaultValue: 'manual' } // 'manual', 'qr', 'totp'
});

// 4. Session Model (For TOTP / Active Classes)
// 4. Session Model (For TOTP / Active Classes)
const Session = sequelize.define('Session', {
    id: { type: DataTypes.STRING, primaryKey: true },
    classId: { type: DataTypes.STRING, allowNull: false }, // Added classId
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    secret: { type: DataTypes.STRING, allowNull: false }, // TOTP Secret
    startTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    expiresAt: { type: DataTypes.DATE, allowNull: true }, // Changed from endTime to expiresAt
    lecturerIp: { type: DataTypes.STRING, allowNull: true } // Capture IP of creator
});

// Associations
User.hasMany(Attendance, { foreignKey: 'userId' });
Attendance.belongsTo(User, { foreignKey: 'userId' });

// Timetable is a flat Read-Only table, so we don't strictly need these foreign keys for now.
// If we do want to link them, we must use different aliases.
// Class.belongsTo(User, { as: 'Lecturer', foreignKey: 'lecturerId' }); <--- CONFLICT REMOVED
// Class.hasMany(Attendance, { foreignKey: 'classId' });
// Attendance.belongsTo(Class, { foreignKey: 'classId' });

// Link Attendance to Class logic is handled manually via Composite ID string matching.
// We disable the FK constraint because ClassId in Attendance (Composite) != Course_Code in Timetable (Simple)
Attendance.belongsTo(Class, { foreignKey: 'classId', targetKey: 'Course_Code', constraints: false });

User.hasMany(Session, { foreignKey: 'userId' });
Session.belongsTo(User, { foreignKey: 'userId' });

// User.hasMany(Class, { foreignKey: 'lecturerId', as: 'Teaches' });
// Class.belongsTo(User, { foreignKey: 'lecturerId', as: 'Lecturer' });

module.exports = { 
    sequelize, 
    User, 
    Class, 
    Attendance,
    Session
};
