function normalizeName(raw) {
    if (!raw) return '';
    return String(raw)
        .toLowerCase()
        // Replace dots with spaces to separate tokens (e.g., "Mr.E.Chikaka" -> "Mr E Chikaka")
        .replace(/\./g, ' ')
        // Remove titles first (now word boundaries will work correctly)
        .replace(/\b(mr|mrs|ms|dr|prof|sir|eng)\b\s*/g, '')
        // Remove non-alphanumeric except spaces
        .replace(/[^a-z\s]/g, '')
        // Normalize multiple spaces to single space
        .replace(/\s+/g, ' ')
        .trim();
}

function splitName(raw) {
    const cleaned = normalizeName(raw);
    const parts = cleaned.split(' ').filter(Boolean);
    if (!parts.length) return { first: '', last: '', parts: [] };
    return {
        first: parts[0] || '',
        last: parts[parts.length - 1] || '',
        parts
    };
}

function shouldGroupNames(nameA, nameB) {
    const a = splitName(nameA);
    const b = splitName(nameB);

    if (!a.last || !b.last) return false;
    if (a.last !== b.last) return false;

    if (!a.first || !b.first) return false;

    // Exact first-name match is safe.
    if (a.first === b.first) return true;

    // Initial-based match, only if one side is an initial (safe for J vs Joseph).
    const aInitialOnly = a.first.length === 1;
    const bInitialOnly = b.first.length === 1;
    if (a.first[0] === b.first[0] && (aInitialOnly || bInitialOnly)) {
        return true;
    }

    // Do not group distinct full names with same surname (husband/wife case).
    return false;
}

function recommendedCanonicalName(names) {
    if (!Array.isArray(names) || !names.length) return '';
    return names
        .slice()
        .sort((x, y) => normalizeName(y).length - normalizeName(x).length)[0];
}

module.exports = {
    normalizeName,
    splitName,
    shouldGroupNames,
    recommendedCanonicalName
};
