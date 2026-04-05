const { Attendance, sequelize } = require('../models');
const { Op } = require('sequelize');

function parseCourseCode(classId) {
    const safe = String(classId || '').trim();
    if (!safe) return '';
    if (safe.includes('--')) return safe.split('--')[0].trim();
    return safe.split('-')[0].trim();
}

function toDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDate(value) {
    const parsed = new Date(String(value || ''));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function run() {
    const studentId = '240101';
    const courseCode = 'NCSC312';
    const targetTotal = 8;
    const targetUniqueDates = 8;
    const targetPresent = 3;

    const transaction = await sequelize.transaction();
    try {
        let records = await Attendance.findAll({
            where: {
                userId: studentId,
                classId: { [Op.like]: `${courseCode}%` }
            },
            order: [['date', 'ASC'], ['id', 'ASC']],
            transaction
        });

        const preferredClassId = records[0]?.classId || courseCode;

        let maxDate = null;
        const uniqueDates = new Set();
        for (const record of records) {
            const parsed = parseDate(record.date);
            if (parsed && (!maxDate || parsed > maxDate)) {
                maxDate = parsed;
            }
            if (record.date) {
                uniqueDates.add(String(record.date));
            }
        }
        if (!maxDate) {
            maxDate = new Date();
            maxDate.setHours(0, 0, 0, 0);
        }

        while (uniqueDates.size < targetUniqueDates) {
            maxDate.setDate(maxDate.getDate() + 1);
            const dateStr = toDateString(maxDate);
            const created = await Attendance.create({
                userId: studentId,
                classId: preferredClassId,
                date: dateStr,
                status: 'absent',
                method: 'manual',
                checkedInAt: null,
                checkedOutAt: null,
                verificationMethod: 'legacy',
                verifiedAt: null
            }, { transaction });
            records.push(created);
            uniqueDates.add(dateStr);
        }

        records = records.sort((a, b) => {
            const da = parseDate(a.date);
            const db = parseDate(b.date);
            const ta = da ? da.getTime() : 0;
            const tb = db ? db.getTime() : 0;
            if (ta !== tb) return tb - ta;
            return Number(b.id || 0) - Number(a.id || 0);
        });

        for (let i = 0; i < records.length; i += 1) {
            const record = records[i];
            if (i < targetPresent) {
                const day = parseDate(record.date) || new Date();
                day.setHours(10, 0, 0, 0);
                const checkout = new Date(day);
                checkout.setHours(11, 0, 0, 0);

                record.status = 'present';
                record.method = 'checkin_checkout';
                record.checkedInAt = day;
                record.checkedOutAt = checkout;
                record.verificationMethod = record.verificationMethod || 'legacy';
                record.verifiedAt = record.verifiedAt || checkout;
            } else {
                record.status = 'absent';
                record.method = 'manual';
                record.checkedInAt = null;
                record.checkedOutAt = null;
                record.verificationMethod = 'legacy';
                record.verifiedAt = null;
            }
            await record.save({ transaction });
        }

        await transaction.commit();

        console.log(JSON.stringify({
            message: 'Test attendance prepared',
            studentId,
            courseCode,
            targetPresent,
            targetTotal,
            targetUniqueDates,
            expectedPercentage: Math.floor((targetPresent / targetUniqueDates) * 100)
        }, null, 2));
    } catch (error) {
        await transaction.rollback();
        throw error;
    } finally {
        await sequelize.close();
    }
}

run().catch((error) => {
    console.error('Failed to prepare test attendance:', error);
    process.exit(1);
});
