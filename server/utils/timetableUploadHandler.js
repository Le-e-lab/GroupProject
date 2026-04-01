/**
 * ============================================================================
 * Timetable Upload Handler
 * ============================================================================
 * 
 * Handles the complete workflow of uploading and migrating a new timetable:
 * 1. Parse and validate the file
 * 2. Validate against current database schema
 * 3. Optionally reset attendance records
 * 4. Replace timetable with new data
 * 5. Return detailed report
 * 
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { sequelize, Attendance, Session } = require('../models');
const parser = require('./timetableParser');

const backupsDir = path.join(__dirname, '../uploads/timetable_backups');

function ensureBackupsDir() {
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }
}

function backupFilePath(backupId) {
    return path.join(backupsDir, `${backupId}.json`);
}

async function createTimetableBackup(transaction) {
    ensureBackupsDir();
    const [rows] = await sequelize.query(
        `SELECT College, Department, Program, Year_Semester, Course_Code, Course_Name, Section, Day, From_Time, To_Time, Venue, Lecturer, LecturerId
         FROM timetable
         ORDER BY Course_Code, Day, From_Time`,
        { transaction }
    );

    const backupId = `tt_backup_${Date.now()}`;
    const payload = {
        backupId,
        createdAt: new Date().toISOString(),
        rowCount: rows.length,
        rows
    };

    fs.writeFileSync(backupFilePath(backupId), JSON.stringify(payload), 'utf8');
    return {
        backupId,
        rowCount: rows.length
    };
}

/**
 * Execute complete timetable upload workflow
 * @param {Buffer} fileBuffer - File content
 * @param {string} filename - Original filename
 * @param {Object} options - { resetAttendance: boolean, semesterId: string }
 * @returns {Promise<Object>} { success: boolean, message: string, data: Object, errors: Array }
 */
async function uploadTimetable(fileBuffer, filename, options = {}) {
    const report = {
        success: false,
        message: '',
        data: {
            summary: null,
            rowsInserted: 0,
            rowsReplaced: 0,
            attendanceReset: false,
            sessionsCleared: false,
            timestamp: new Date().toISOString()
        },
        errors: [],
        warnings: []
    };

    try {
        // Step 1: Parse and validate file
        console.log(`[TIMETABLE UPLOAD] Starting upload for file: ${filename}`);
        
        const parseResult = await parser.parseFile(fileBuffer, filename);
        if (parseResult.errors.length > 0) {
            report.errors = parseResult.errors;
            report.message = `File validation failed with ${parseResult.errors.length} error(s)`;
            console.error(`[TIMETABLE UPLOAD] Parse errors:`, parseResult.errors);
            return report;
        }

        if (parseResult.data.length === 0) {
            report.errors.push('No valid data rows found in file after validation');
            report.message = 'File contains no valid data';
            return report;
        }

        // Step 2: Generate summary
        const summary = parser.generateSummary(parseResult.data);
        report.data.summary = summary;
        console.log(`[TIMETABLE UPLOAD] Summary:`, summary);

        // Step 3: Database operations (wrapped in transaction)
        const transaction = await sequelize.transaction();

        try {
            // Step 3a: Create backup of current timetable for rollback safety
            const backup = await createTimetableBackup(transaction);
            report.data.backupId = backup.backupId;
            report.data.backupRows = backup.rowCount;

            // Step 3b: Clear old timetable
            console.log('[TIMETABLE UPLOAD] Clearing existing timetable...');
            const [countRows] = await sequelize.query('SELECT COUNT(*) as count FROM timetable', { transaction });
            report.data.rowsReplaced = Number((countRows && countRows[0] && countRows[0].count) || 0);
            await sequelize.query('DELETE FROM timetable', { transaction });

            // Step 3c: Insert new timetable rows
            console.log(`[TIMETABLE UPLOAD] Inserting ${parseResult.data.length} new rows...`);
            for (const row of parseResult.data) {
                await sequelize.query(
                    `INSERT INTO timetable (College, Department, Program, Year_Semester, Course_Code, Course_Name, Section, Day, From_Time, To_Time, Venue, Lecturer, LecturerId)
                     VALUES (:College, :Department, :Program, :Year_Semester, :Course_Code, :Course_Name, :Section, :Day, :From_Time, :To_Time, :Venue, :Lecturer, :LecturerId)`,
                    {
                        replacements: row,
                        transaction
                    }
                );
            }
            report.data.rowsInserted = parseResult.data.length;

            // Step 3d: Handle attendance reset if requested
            if (options.resetAttendance === true) {
                console.log('[TIMETABLE UPLOAD] Resetting attendance records...');
                
                const deletedCount = await Attendance.destroy({ transaction });
                report.data.attendanceReset = true;
                report.data.deletedAttendanceRecords = deletedCount;
                report.warnings.push(`Deleted ${deletedCount} attendance records as requested`);
                
                console.log(`[TIMETABLE UPLOAD] Deleted ${deletedCount} attendance records`);
            }

            // Step 3e: Clear active sessions (they expire with the semester change)
            console.log('[TIMETABLE UPLOAD] Clearing active TOTP sessions...');
            const deletedSessions = await Session.destroy({ transaction });
            report.data.sessionsCleared = true;
            report.data.deletedSessions = deletedSessions;
            console.log(`[TIMETABLE UPLOAD] Cleared ${deletedSessions} active sessions`);

            // Commit transaction
            await transaction.commit();
            console.log('[TIMETABLE UPLOAD] Transaction committed successfully');

        } catch (transactionError) {
            // Rollback on any error
            await transaction.rollback();
            console.error('[TIMETABLE UPLOAD] Transaction error, rolling back:', transactionError);
            report.errors.push(`Database error: ${transactionError.message}`);
            report.message = 'Failed to update database. Transaction rolled back.';
            return report;
        }

        // Success
        report.success = true;
        report.message = `Successfully uploaded timetable with ${report.data.rowsInserted} classes. ${report.warnings.length} optional actions completed.`;
        
        console.log(`[TIMETABLE UPLOAD] SUCCESS: ${report.message}`);
        return report;

    } catch (err) {
        console.error('[TIMETABLE UPLOAD] Unexpected error:', err);
        report.errors.push(`Unexpected error: ${err.message}`);
        report.message = 'An unexpected error occurred during upload';
        return report;
    }
}

async function listBackups(limit = 20) {
    ensureBackupsDir();
    const files = fs.readdirSync(backupsDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
            const filePath = path.join(backupsDir, f);
            const stats = fs.statSync(filePath);
            return { f, filePath, mtimeMs: stats.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .slice(0, limit);

    return files.map(({ f, filePath, mtimeMs }) => {
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            return {
                backupId: parsed.backupId || path.basename(f, '.json'),
                createdAt: parsed.createdAt || new Date(mtimeMs).toISOString(),
                rowCount: Number(parsed.rowCount || 0)
            };
        } catch (e) {
            return {
                backupId: path.basename(f, '.json'),
                createdAt: new Date(mtimeMs).toISOString(),
                rowCount: 0
            };
        }
    });
}

async function restoreBackup(backupId) {
    if (!backupId) throw new Error('backupId is required');
    ensureBackupsDir();

    const filePath = backupFilePath(backupId);
    if (!fs.existsSync(filePath)) {
        throw new Error('Backup not found');
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const payload = JSON.parse(raw);
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    const transaction = await sequelize.transaction();
    try {
        await sequelize.query('DELETE FROM timetable', { transaction });

        for (const row of rows) {
            await sequelize.query(
                `INSERT INTO timetable (College, Department, Program, Year_Semester, Course_Code, Course_Name, Section, Day, From_Time, To_Time, Venue, Lecturer, LecturerId)
                 VALUES (:College, :Department, :Program, :Year_Semester, :Course_Code, :Course_Name, :Section, :Day, :From_Time, :To_Time, :Venue, :Lecturer, :LecturerId)`,
                {
                    replacements: {
                        College: row.College || '',
                        Department: row.Department || '',
                        Program: row.Program || '',
                        Year_Semester: row.Year_Semester || '',
                        Course_Code: row.Course_Code || '',
                        Course_Name: row.Course_Name || '',
                        Section: row.Section || '',
                        Day: row.Day || '',
                        From_Time: row.From_Time || '',
                        To_Time: row.To_Time || '',
                        Venue: row.Venue || '',
                        Lecturer: row.Lecturer || '',
                        LecturerId: row.LecturerId || ''
                    },
                    transaction
                }
            );
        }

        const deletedSessions = await Session.destroy({ transaction });
        await transaction.commit();
        return { restoredRows: rows.length, deletedSessions };
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
}

/**
 * Validate that timetable exists and has data
 * @returns {Promise<Object>} { hasData: boolean, rowCount: number }
 */
async function validateTimetableExists() {
    try {
        const result = await sequelize.query('SELECT COUNT(*) as count FROM timetable LIMIT 1');
        const count = result[0][0].count || 0;
        return { hasData: count > 0, rowCount: count };
    } catch (err) {
        console.error('Error validating timetable:', err);
        return { hasData: false, rowCount: 0, error: err.message };
    }
}

/**
 * Get timetable statistics
 * @returns {Promise<Object>} Statistics about current timetable
 */
async function getTimetableStats() {
    try {
        const [stats] = await sequelize.query(`
            SELECT 
                COUNT(*) as totalClasses,
                COUNT(DISTINCT Course_Code) as uniqueCourses,
                COUNT(DISTINCT Program) as uniquePrograms,
                COUNT(DISTINCT Lecturer) as uniqueLecturers,
                COUNT(DISTINCT Day) as classesOnDays
            FROM timetable
        `);

        return stats[0] || {
            totalClasses: 0,
            uniqueCourses: 0,
            uniquePrograms: 0,
            uniqueLecturers: 0,
            classesOnDays: 0
        };
    } catch (err) {
        console.error('Error getting timetable stats:', err);
        return null;
    }
}

module.exports = {
    uploadTimetable,
    validateTimetableExists,
    getTimetableStats,
    listBackups,
    restoreBackup
};
