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

    const amPmMatch = trimmed.match(/^([0-2]?\d)(?:\s*[:.]\s*([0-5]\d))?\s*(am|pm)$/i);
    if (amPmMatch) {
        let hour = parseInt(amPmMatch[1], 10);
        const minute = amPmMatch[2] ? parseInt(amPmMatch[2], 10) : 0;
        const suffix = amPmMatch[3].toLowerCase();
        if (suffix === 'pm' && hour < 12) hour += 12;
        if (suffix === 'am' && hour === 12) hour = 0;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    const hourMatch = trimmed.match(/^([0-2]?\d)(?:\s*[:.]\s*00)?$/);
    if (hourMatch) {
        let hour = parseInt(hourMatch[1], 10);
        if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
            if (hour < 8 && hour !== 0) {
                hour += 12;
            }
            return `${String(hour).padStart(2, '0')}:00`;
        }
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

function cellText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
        if (value.text !== undefined && value.text !== null) return String(value.text).trim();
        if (value.result !== undefined && value.result !== null) return String(value.result).trim();
        if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('').trim();
    }
    return String(value).trim();
}

function isBlankRow(values) {
    return !values.some((v) => cellText(v) !== '');
}

function canonicalRowFromValues(values, headerMap, context, rowNumber, sheetName) {
    const get = (key) => {
        const index = headerMap[key];
        return index !== undefined ? cellText(values[index + 1]) : '';
    };

    return {
        rowNumber,
        sheetName,
        course_code: get('course_code'),
        course_name: get('course_name'),
        section: get('section'),
        day: get('day'),
        from_time: get('from_time'),
        to_time: get('to_time'),
        venue: get('venue'),
        lecturer: get('lecturer'),
        lecturerid: get('lecturerid'),
        college: get('college') || context.college || sheetName,
        department: get('department') || context.department || '',
        program: get('program') || context.program || '',
        year_semester: get('year_semester') || context.year_semester || '',
        college_covered: get('college_covered')
    };
}

function createContext(sheetName) {
    const normalizedSheet = String(sheetName || '').trim();
    return {
        college: normalizedSheet === 'University Wide Courses' ? 'ALL' : normalizedSheet,
        department: '',
        program: normalizedSheet === 'University Wide Courses' ? 'ALL' : '',
        year_semester: ''
    };
}

function updateContextFromLine(context, line, sheetName) {
    const text = String(line || '').trim();
    if (!text) return;

    if (!context.college || context.college === sheetName) {
        if (/\bCOLLEGE OF\b/i.test(text) || /\bSCHOOL OF\b/i.test(text) || /\bINTENSIVE ENGLISH\b/i.test(text) || /\bUNIVERSITY WIDE COURSES\b/i.test(text)) {
            context.college = text;
        }
    }

    if (!context.department && /\bDEPARTMENT OF\b/i.test(text)) {
        context.department = text;
    }

    if (!context.program && /(BACHELOR|MASTER|DIPLOMA|HONOURS|HONORS|CERTIFICATE|BSC|MSC|LLB|LLBS|INTENSIVE ENGLISH)/i.test(text) && !/COLLEGE OF|DEPARTMENT OF/i.test(text)) {
        context.program = text;
    }

    const yearMatch = text.match(/Y\s*(\d)\s*S\s*(\d)/i);
    if (yearMatch) {
        context.year_semester = `Y${yearMatch[1]} S${yearMatch[2]}`;
    }
}

function normalizeHeaderName(name) {
    return canonicalHeader(name)
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function buildHeaderMap(rowValues) {
    const map = {};
    rowValues.forEach((value, index) => {
        const key = normalizeHeaderName(value);
        if (key) {
            map[key] = index;
        }
    });
    return map;
}

function looksLikeTableHeader(rowValues) {
    const map = buildHeaderMap(rowValues);
    return ['course_code', 'course_name', 'day', 'from_time', 'to_time'].every((key) => Object.prototype.hasOwnProperty.call(map, key));
}

function validateRawData(rawData, rowNumber) {
    const errors = [];
    const data = {};

    const courseCode = String(rawData.course_code || '').trim();
    const courseName = String(rawData.course_name || '').trim();
    const day = String(rawData.day || '').trim();
    const fromTime = normalizeTime(rawData.from_time || '');
    const toTime = normalizeTime(rawData.to_time || '');

    if (!courseCode) {
        errors.push('Course Code is required and cannot be empty');
    } else if (courseCode.length > CONSTRAINTS.maxCourseCodeLength) {
        errors.push(`Course Code exceeds maximum length of ${CONSTRAINTS.maxCourseCodeLength}`);
    } else {
        data.Course_Code = sanitizeInput(courseCode);
    }

    if (!courseName) {
        errors.push('Course Name is required and cannot be empty');
    } else if (courseName.length > CONSTRAINTS.maxCourseNameLength) {
        errors.push(`Course Name exceeds maximum length of ${CONSTRAINTS.maxCourseNameLength}`);
    } else {
        data.Course_Name = sanitizeInput(courseName);
    }

    if (!day) {
        errors.push('Day is required and cannot be empty');
    } else if (!VALID_DAYS.some((d) => d.toLowerCase() === day.toLowerCase())) {
        errors.push(`Invalid day: "${day}". Must be one of: ${VALID_DAYS.join(', ')}`);
    } else {
        data.Day = VALID_DAYS.find((d) => d.toLowerCase() === day.toLowerCase());
    }

    if (!fromTime) {
        errors.push('From_Time (Start Time) is required and cannot be empty');
    } else if (!isValidTimeFormat(fromTime)) {
        errors.push(`Invalid From_Time format: "${rawData.from_time}". Use HH:MM (e.g., "09:00")`);
    } else {
        data.From_Time = fromTime;
    }

    if (!toTime) {
        errors.push('To_Time (End Time) is required and cannot be empty');
    } else if (!isValidTimeFormat(toTime)) {
        errors.push(`Invalid To_Time format: "${rawData.to_time}". Use HH:MM (e.g., "10:00")`);
    } else {
        data.To_Time = toTime;
    }

    if (data.From_Time && data.To_Time && data.From_Time >= data.To_Time) {
        errors.push(`From_Time (${data.From_Time}) must be before To_Time (${data.To_Time})`);
    }

    data.College = rawData.college ? sanitizeInput(String(rawData.college).slice(0, 100)) : '';
    data.Department = rawData.department ? sanitizeInput(String(rawData.department).slice(0, 100)) : '';
    data.Program = rawData.program ? sanitizeInput(String(rawData.program).slice(0, 100)) : '';
    data.Year_Semester = rawData.year_semester ? sanitizeInput(String(rawData.year_semester).slice(0, 50)) : '';
    data.Section = rawData.section ? sanitizeInput(String(rawData.section).slice(0, 20)) : '';

    if (rawData.venue && String(rawData.venue).length > CONSTRAINTS.maxVenueLength) {
        errors.push(`Venue exceeds maximum length of ${CONSTRAINTS.maxVenueLength}`);
    }
    data.Venue = rawData.venue ? sanitizeInput(String(rawData.venue).slice(0, CONSTRAINTS.maxVenueLength)) : 'TBD';

    if (rawData.lecturer && String(rawData.lecturer).length > CONSTRAINTS.maxLecturerNameLength) {
        errors.push(`Lecturer name exceeds maximum length of ${CONSTRAINTS.maxLecturerNameLength}`);
    }
    data.Lecturer = rawData.lecturer ? sanitizeInput(String(rawData.lecturer).slice(0, CONSTRAINTS.maxLecturerNameLength)) : '';

    if (rawData.lecturerid && !/^[a-zA-Z0-9]{1,20}$/.test(String(rawData.lecturerid))) {
        errors.push(`Invalid LecturerId format: "${rawData.lecturerid}". Must be alphanumeric, max 20 characters`);
    }
    data.LecturerId = rawData.lecturerid || '';

    return { data: errors.length ? null : data, errors, rowNumber };
}

function validateRow(row, normalizedHeaders, rowNumber) {
    const rawData = {};

    Object.entries(normalizedHeaders).forEach(([normalized, original]) => {
        rawData[normalized] = row[original] !== undefined ? String(row[original]).trim() : '';
    });

    return validateRawData(rawData, rowNumber);
}

function validateCanonicalRow(row, rowNumber) {
    return validateRawData({
        course_code: row.course_code,
        course_name: row.course_name,
        section: row.section,
        day: row.day,
        from_time: row.from_time,
        to_time: row.to_time,
        venue: row.venue,
        lecturer: row.lecturer,
        lecturerid: row.lecturerid,
        college: row.college,
        department: row.department,
        program: row.program,
        year_semester: row.year_semester
    }, rowNumber);
}

async function parseXlsx(buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const rows = [];
    for (const ws of wb.worksheets) {
        const maxRow = ws.actualRowCount || ws.rowCount || 0;
        if (!maxRow) continue;

        let activeHeaderMap = null;
        let activeContext = createContext(ws.name);

        for (let rowNumber = 1; rowNumber <= maxRow; rowNumber++) {
            const row = ws.getRow(rowNumber);
            const values = row.values || [];
            const rowTexts = [];
            for (let i = 1; i < values.length; i++) {
                rowTexts.push(cellText(values[i]));
            }

            if (isBlankRow(values.slice(1))) {
                continue;
            }

            if (looksLikeTableHeader(rowTexts)) {
                activeHeaderMap = buildHeaderMap(rowTexts);
                activeContext = createContext(ws.name);

                for (let lookback = Math.max(1, rowNumber - 8); lookback < rowNumber; lookback++) {
                    const prevValues = ws.getRow(lookback).values || [];
                    const prevTexts = [];
                    for (let i = 1; i < prevValues.length; i++) {
                        const text = cellText(prevValues[i]);
                        if (text) prevTexts.push(text);
                    }
                    updateContextFromLine(activeContext, prevTexts.join(' '), ws.name);
                }

                continue;
            }

            if (!activeHeaderMap) {
                updateContextFromLine(activeContext, rowTexts.join(' '), ws.name);
                continue;
            }

            const canonical = canonicalRowFromValues(values, activeHeaderMap, activeContext, rowNumber, ws.name);
            const courseCodeLabel = String(canonical.course_code || '').toLowerCase();
            const courseNameLabel = String(canonical.course_name || '').toLowerCase();
            const dayLabel = String(canonical.day || '').toLowerCase();
            const fromLabel = String(canonical.from_time || '').toLowerCase();
            const toLabel = String(canonical.to_time || '').toLowerCase();

            if (courseCodeLabel === 'course code' || courseCodeLabel === 'code') continue;
            if (courseNameLabel === 'course name') continue;
            if (dayLabel === 'day' || fromLabel === 'from' || toLabel === 'to') continue;

            if (canonical.course_code && canonical.course_name && canonical.day && canonical.from_time && canonical.to_time) {
                rows.push(canonical);
            }
        }
    }

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

        let normalizedHeaders = null;
        if (ext !== 'xlsx') {
            const firstRow = rows[0];
            normalizedHeaders = {};
            Object.keys(firstRow).forEach((header) => {
                const canonical = canonicalHeader(header);
                if (!FORBIDDEN_KEYS.has(canonical)) normalizedHeaders[canonical] = header;
                else errors.push(`Unsafe header detected: "${header}"`);
            });

            REQUIRED_COLUMNS.forEach((c) => {
                if (!normalizedHeaders[c]) errors.push(`Missing required column: "${c}"`);
            });

            if (errors.length) return { data: [], errors };
        }

        const data = [];
        rows.forEach((row, index) => {
            const validated = ext === 'xlsx'
                ? validateCanonicalRow(row, row.rowNumber || index + 2)
                : validateRow(row, normalizedHeaders, index + 2);
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
