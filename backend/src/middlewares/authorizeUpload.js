const pool = require('../config/db');

// Every public upload URL must resolve to a database record in the selected court.
const sources = {
    somtop: { table: 'somtop', column: 'photo_path' },
    leaves: { table: 'leave_requests', column: 'file_path' },
    events: { table: 'events', column: 'file_paths' },
    terms: { table: 'working_terms', column: 'file_paths' },
    'duty-orders': { table: 'duty_orders', column: 'signed_order_file_path' },
    decorations: {
        table: 'somtop_decorations sd JOIN somtop s ON s.id = sd.somtop_id',
        column: 'sd.file_path', courtColumn: 's.court_code'
    }
};

const storedPaths = value => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [value];
    }
};

const matchesFile = (stored, folder, filename) => {
    if (typeof stored !== 'string') return false;
    try {
        const pathname = new URL(stored, 'http://local.invalid').pathname;
        return pathname.endsWith(`/uploads/${folder}/${filename}`) || pathname === `uploads/${folder}/${filename}`;
    } catch {
        return false;
    }
};

const authorizeUpload = async (req, res, next) => {
    const parts = req.path.split('/').filter(Boolean);
    if (parts.length !== 2 || !sources[parts[0]] || !/^[a-zA-Z0-9._-]+$/.test(parts[1]) ||
        parts[1] === '.' || parts[1] === '..') {
        return res.status(404).json({ message: 'ไม่พบไฟล์' });
    }

    const [folder, filename] = parts;
    const courtCode = req.user.court_code;
    if (!courtCode && req.user.role !== 'admin') return res.status(403).json({ message: 'กรุณาเลือกศาลก่อนเปิดไฟล์' });

    const source = sources[folder];
    const courtColumn = source.courtColumn || 'court_code';
    try {
        // LIKE narrows legacy URL/JSON values; exact path comparison below decides access.
        const [rows] = await pool.query(
            `SELECT ${source.column} AS stored_path FROM ${source.table} WHERE ${courtCode ? courtColumn + ' = ? AND ' : ''}${source.column} LIKE ?`,
            [...(courtCode ? [courtCode] : []), `%${filename.replace(/[\\%_]/g, '\\$&')}%`]
        );
        if (!rows.some(row => storedPaths(row.stored_path).some(stored => matchesFile(stored, folder, filename)))) {
            return res.status(404).json({ message: 'ไม่พบไฟล์' });
        }
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = authorizeUpload;
