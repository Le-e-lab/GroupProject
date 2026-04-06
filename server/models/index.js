const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

// 1. User Model
const User = sequelize.define('User', {
    id: { type: DataTypes.STRING, primaryKey: true }, // e.g., '240101'
    fullName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }, // Store hashed in prod
    role: { type: DataTypes.ENUM('student', 'student_rep', 'lecturer', 'admin'), allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: true },     // 1, 2, 3, 4
    department: { type: DataTypes.STRING, allowNull: true }, // e.g., 'Computing'
    program: { type: DataTypes.STRING, allowNull: true },    // e.g., 'NCSC'
    college: { type: DataTypes.STRING, allowNull: true },    // e.g., 'CBMS'
    language: { type: DataTypes.STRING(5), allowNull: false, defaultValue: 'en' }
}, {
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    }
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

// 3. Attendance Model (Extended for Check-in/Check-out)
const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.STRING, allowNull: false }, // '2023-10-25'
    status: { type: DataTypes.ENUM('present', 'absent', 'late'), defaultValue: 'present' },
    method: { type: DataTypes.STRING, defaultValue: 'manual' }, // 'manual', 'qr', 'totp', 'checkin_checkout'
    classId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
    // Check-in/Check-out timestamps
    checkedInAt: { type: DataTypes.DATE, allowNull: true },
    checkedOutAt: { type: DataTypes.DATE, allowNull: true },
    // Identity verification
    verificationMethod: { type: DataTypes.ENUM('biometric', 'face_id', 'manual', 'legacy'), defaultValue: 'legacy' },
    verifiedAt: { type: DataTypes.DATE, allowNull: true },
    // Device/IP traceability for buddy-signing detection
    checkInDeviceId: { type: DataTypes.STRING, allowNull: true },
    checkInIp: { type: DataTypes.STRING, allowNull: true },
    checkOutDeviceId: { type: DataTypes.STRING, allowNull: true },
    checkOutIp: { type: DataTypes.STRING, allowNull: true },
    buddyFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    buddyFlagReason: { type: DataTypes.STRING, allowNull: true }
});

// 4. Session Model (Extended for Check-in/Check-out)
const Session = sequelize.define('Session', {
    id: { type: DataTypes.STRING, primaryKey: true },
    classId: { type: DataTypes.STRING, allowNull: false }, // Added classId
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    secret: { type: DataTypes.STRING, allowNull: true }, // TOTP Secret (legacy)
    checkInSecret: { type: DataTypes.STRING, allowNull: true }, // Check-in TOTP Secret
    checkOutSecret: { type: DataTypes.STRING, allowNull: true }, // Check-out TOTP Secret
    status: { type: DataTypes.ENUM('pending', 'checkin_open', 'checkout_open', 'closed'), defaultValue: 'pending' },
    checkInTime: { type: DataTypes.DATE, allowNull: true }, // When check-in was opened
    checkOutTime: { type: DataTypes.DATE, allowNull: true }, // When check-out was opened
    startTime: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    expiresAt: { type: DataTypes.DATE, allowNull: true }, // Changed from endTime to expiresAt
    lecturerIp: { type: DataTypes.STRING, allowNull: true } // Capture IP of creator
});

// 5. Device Session Model (Track devices per user, max 3)
const DeviceSession = sequelize.define('DeviceSession', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    deviceId: { type: DataTypes.STRING, allowNull: false }, // Device fingerprint (md5 of ua + ip)
    deviceName: { type: DataTypes.STRING, allowNull: true }, // e.g., "Mobile Chrome", "Desktop Firefox"
    lastIp: { type: DataTypes.STRING, allowNull: true },
    lastUserAgent: { type: DataTypes.TEXT, allowNull: true },
    isTrusted: { type: DataTypes.BOOLEAN, defaultValue: false }, // After first verification
    requiresVerification: { type: DataTypes.BOOLEAN, defaultValue: true }, // Unknown device flag
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    lastSeenAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// 6. Biometric Verification Model (Log verifications, do NOT store photos)
const BiometricVerification = sequelize.define('BiometricVerification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    sessionId: { type: DataTypes.STRING, allowNull: true }, // Reference to Session/Class
    method: { type: DataTypes.ENUM('fingerprint', 'face_recognition', 'face_id_comparison', 'manual'), allowNull: false },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    photoMetadata: { type: DataTypes.JSON, allowNull: true }, // {width, height, timestamp} but NOT the photo itself
    notes: { type: DataTypes.TEXT, allowNull: true } // e.g., "Face match confidence: 95%"
});

// 7. Announcement Model
const Announcement = sequelize.define('Announcement', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    lecturerId: { type: DataTypes.STRING, allowNull: false },
    lecturerName: { type: DataTypes.STRING, allowNull: false },
    courseCode: { type: DataTypes.STRING, allowNull: false },
    courseName: { type: DataTypes.STRING, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: true },
    program: { type: DataTypes.STRING, allowNull: true },
    type: { type: DataTypes.ENUM('info', 'delay', 'cancel', 'venue', 'online'), defaultValue: 'info' },
    message: { type: DataTypes.TEXT, allowNull: false },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// 8. Timetable Upload History (Admin audit trail)
const TimetableUploadLog = sequelize.define('TimetableUploadLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    uploadedBy: { type: DataTypes.STRING, allowNull: false },
    filename: { type: DataTypes.STRING, allowNull: false },
    rowsInserted: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    resetAttendance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    deletedAttendanceRecords: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.ENUM('success', 'failed'), allowNull: false, defaultValue: 'success' },
    errorSummary: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'timetable_upload_logs',
    timestamps: true
});

// Associations
User.hasMany(Attendance, { foreignKey: 'userId' });
Attendance.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(DeviceSession, { foreignKey: 'userId' });
DeviceSession.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(BiometricVerification, { foreignKey: 'userId' });
BiometricVerification.belongsTo(User, { foreignKey: 'userId' });

// Timetable is a flat Read-Only table, so we don't strictly need these foreign keys for now.
// If we do want to link them, we must use different aliases.
// Class.belongsTo(User, { as: 'Lecturer', foreignKey: 'lecturerId' }); <--- CONFLICT REMOVED
// Class.hasMany(Attendance, { foreignKey: 'classId' });
// Attendance.belongsTo(Class, { foreignKey: 'classId' });

// Link Attendance to Class logic is handled manually via Composite ID string matching.
// We disable the FK constraint because ClassId in Attendance (Composite) != Course_Code in Timetable (Simple)
// Attendance.belongsTo(Class, { foreignKey: 'classId', targetKey: 'Course_Code', constraints: false });

User.hasMany(Session, { foreignKey: 'userId' });
Session.belongsTo(User, { foreignKey: 'userId' });

// User.hasMany(Class, { foreignKey: 'lecturerId', as: 'Teaches' });
// Class.belongsTo(User, { foreignKey: 'lecturerId', as: 'Lecturer' });

module.exports = { 
    sequelize, 
    User, 
    Class, 
    Attendance,
    Session,
    DeviceSession,
    BiometricVerification,
    Announcement,
    TimetableUploadLog
};
