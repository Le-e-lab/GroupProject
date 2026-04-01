/**
 * Timetable Parser & Validator
 * Parses .xlsx, .csv, .txt, .tsv into normalized timetable rows.
 */

const ExcelJS = require('exceljs');
const { parse: parseCsv } = require('csv-parse/sync');
const validator = require('validator');

const REQUIRED_COLUMNS = ['course_code', 'course_name', 'day', 'from_time', 'to_time'];

const HEADER_ALIASES = {
    coursecode: 'course_code',
    course_code: 'course_code',
    coursename: 'course_name',
    course_name: 'course_name',
    yearsemester: 'year_semester',
    year_semester: 'year_semester',
    fromtime: 'from_time',
    from_time: 'from_time',
    starttime: 'from_time',
    to_time: 'to_time',
    totime: 'to_time',
    endtime: 'to_time',
    lecturerid: 'lecturerid',
    lecturer_id: 'lecturerid'
};

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CONSTRAINTS = {
    maxRowsPerUpload: 1000,
    maxCourseCodeLength: 50,
    maxCourseNameLength: 200,
    maxVenueLength: 100,
    maxLecturerNameLength: 100,
    fileMaxSizeBytes: 5 * 1024 * 1024
};

function normalizeColumnName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function canonicalHeader(name) {
    const normalized = normalizeColumnName(name);
    return HEADER_ALIASES[normalized] || normalized;
}

function sanitizeInput(input) {
    if (!input && input !== 0) return '';
    return validator.escape(validator.trim(String(input)));
}

function isValidTimeFormat(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return false;
    return /^([0-1]?\d|2[0-3]):[0-5]\d$/.test(timeStr.trim());
}

function normalizeTime(timeStr) {
    const trimmed = String(timeStr || '').trim();
    if (isValidTimeFormat(trimmed)) {
        const [h, m] = trimmed.split(':');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    }

    const n = Number(trimmed);
    if (!Number.isNaN(n) && n > 0 && n < 1) {
        const totalMinutes = Math.round(n * 24 * 60);
        const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
        const mm = String(totalMinutes % 60).padStart(2, '0');
        const candidate = `${hh}:${mm}`;
        if (isValidTimeFormat(candidate)) return candidate;
    }

    return trimmed;
}

function validateRow(row, normalizedHeaders, rowNumber) {
    const errors = [];
    const data = {};
    const rawData = {};

    Object.entries(normalizedHeaders).forEach(([normalized, original]) => {
        rawData[normalized] = row[original] !== undefined ? String(row[original]).trim() : '';
    });

    if (!rawData.course_code) {
        errors.push('Course Code is required and cannot be empty');
    } else if (rawData.course_code.length > CONSTRAINTS.maxCourseCodeLength) {
        errors.push(`Course Code exceeds maximum length of ${CONSTRAINTS.maxCourseCodeLength}`);
    } else {
        data.Course_Code = sanitizeInput(rawData.course_code);
    }

    if (!rawData.course_name) {
        errors.push('Course Name is required and cannot be empty');
    } else if (rawData.course_name.length > CONSTRAINTS.maxCourseNameLength) {
        errors.push(`Course Name exceeds maximum length of ${CONSTRAINTS.maxCourseNameLength}`);
    } else {
        data.Course_Name = sanitizeInput(rawData.course_name);
    }

    if (!rawData.day) {
        errors.push('Day is required and cannot be empty');
    } else if (!VALID_DAYS.some((d) => d.toLowerCase() === rawData.day.toLowerCase())) {
        errors.push(`Invalid day: "${rawData.day}". Must be one of: ${VALID_DAYS.join(', ')}`);
    } else {
        data.Day = VALID_DAYS.find((d) => d.toLowerCase() === rawData.day.toLowerCase());
    }

    if (!rawData.from_time) {
        errors.push('From_Time (Start Time) is required and cannot be empty');
    } else {
        const from = normalizeTime(rawData.from_time);
        if (!isValidTimeFormat(from)) {
            errors.push(`Invalid From_Time format: "${rawData.from_time}". Use HH:MM (e.g., "09:00")`);
        } else {
            data.From_Time = from;
        }
    }

    if (!rawData.to_time) {
        errors.push('To_Time (End Time) is required and cannot be empty');
    } else {
        const to = normalizeTime(rawData.to_time);
        if (!isValidTimeFormat(to)) {
            errors.push(`Invalid To_Time format: "${rawData.to_time}". Use HH:MM (e.g., "10:00")`);
        } else {
            data.To_Time = to;
        }
    }

    if (data.From_Time && data.To_Time && data.From_Time >= data.To_Time) {
        errors.push(`From_Time (${data.From_Time}) must be before To_Time (${data.To_Time})`);
    }

    data.College = rawData.college ? sanitizeInput(rawData.college.slice(0, 100)) : '';
    data.Department = rawData.department ? sanitizeInput(rawData.department.slice(0, 100)) : '';
    data.Program = rawData.program ? sanitizeInput(rawData.program.slice(0, 100)) : '';
    data.Year_Semester = rawData.year_semester ? sanitizeInput(rawData.year_semester.slice(0, 50)) : '';
    data.Section = rawData.section ? sanitizeInput(rawData.section.slice(0, 20)) : '';

    if (rawData.venue && rawData.venue.length > CONSTRAINTS.maxVenueLength) {
        errors.push(`Venue exceeds maximum length of ${CONSTRAINTS.maxVenueLength}`);
    }
    data.Venue = rawData.venue ? sanitizeInput(rawData.venue.slice(0, CONSTRAINTS.maxVenueLength)) : 'TBD';

    if (rawData.lecturer && rawData.lecturer.length > CONSTRAINTS.maxLecturerNameLength) {
        errors.push(`Lecturer name exceeds maximum length of ${CONSTRAINTS.maxLecturerNameLength}`);
    }
    data.Lecturer = rawData.lecturer ? sanitizeInput(rawData.lecturer.slice(0, CONSTRAINTS.maxLecturerNameLength)) : '';

    if (rawData.lecturerid && !/^[a-zA-Z0-9]{1,20}$/.test(rawData.lecturerid)) {
        errors.push(`Invalid LecturerId format: "${rawData.lecturerid}". Must be alphanumeric, max 20 characters`);
    }
    data.LecturerId = rawData.lecturerid || '';

    return { data: errors.length ? null : data, errors, rowNumber };
}

async function parseXlsx(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];

    const headerRow = ws.getRow(1);
    const headers = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '').trim();
    });

    const rows = [];
    ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        let hasValue = false;
        headers.forEach((h, idx) => {
            const cell = row.getCell(idx + 1).value;
            const raw = cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'text') ? cell.text : cell;
            const val = raw === null || raw === undefined ? '' : String(raw).trim();
            obj[h] = val;
            if (val !== '') hasValue = true;
        });
        if (hasValue) rows.push(obj);
    });

    return rows;
}

function parseDelimited(buffer, delimiter) {
    const text = buffer.toString('utf8');
    return parseCsv(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter
    });
}

async function parseFile(buffer, filename) {
    const errors = [];

    try {
        if (buffer.length > CONSTRAINTS.fileMaxSizeBytes) {
            return { data: [], errors: [`File size exceeds ${CONSTRAINTS.fileMaxSizeBytes / 1024 / 1024}MB`] };
        }

        const ext = String(filename || '').toLowerCase().split('.').pop();
        let rows = [];

        if (ext === 'xlsx') {
            rows = await parseXlsx(buffer);
        } else if (ext === 'csv') {
            rows = parseDelimited(buffer, ',');
        } else if (ext === 'tsv' || ext === 'txt') {
            rows = parseDelimited(buffer, '\t');
            if (!rows.length) rows = parseDelimited(buffer, ',');
        } else if (ext === 'xls') {
            return { data: [], errors: ['Legacy .xls is not supported for security reasons. Please re-save as .xlsx or .csv and upload again.'] };
        } else {
            return { data: [], errors: [`Unsupported file format: .${ext}. Supported formats: .xlsx, .csv, .tsv, .txt`] };
        }

        if (!rows.length) {
            return { data: [], errors: ['No data rows found in file'] };
        }

        if (rows.length > CONSTRAINTS.maxRowsPerUpload) {
            return { data: [], errors: [`File contains ${rows.length} rows. Maximum allowed: ${CONSTRAINTS.maxRowsPerUpload}`] };
        }

        const firstRow = rows[0];
        const normalizedHeaders = {};
        Object.keys(firstRow).forEach((header) => {
            const canonical = canonicalHeader(header);
            if (!FORBIDDEN_KEYS.has(canonical)) normalizedHeaders[canonical] = header;
            else errors.push(`Unsafe header detected: "${header}"`);
        });

        REQUIRED_COLUMNS.forEach((c) => {
            if (!normalizedHeaders[c]) errors.push(`Missing required column: "${c}"`);
        });

        if (errors.length) return { data: [], errors };

        const data = [];
        rows.forEach((row, index) => {
            const validated = validateRow(row, normalizedHeaders, index + 2);
            if (validated.errors.length) {
                validated.errors.forEach((err) => errors.push(`Row ${validated.rowNumber}: ${err}`));
            } else {
                data.push(validated.data);
            }
        });

        return { data, errors };
    } catch (err) {
        return { data: [], errors: [`Error parsing file: ${err.message}`] };
    }
}

function generateSummary(data) {
    return {
        totalRows: data.length,
        courses: new Set(data.map((r) => r.Course_Code)).size,
        days: new Set(data.map((r) => r.Day)).size,
        colleges: new Set(data.map((r) => r.College).filter(Boolean)).size,
        programs: new Set(data.map((r) => r.Program).filter(Boolean)).size
    };
}

module.exports = {
    parseFile,
    validateRow,
    sanitizeInput,
    generateSummary,
    CONSTRAINTS,
    VALID_DAYS
};
