const crypto = require('crypto');
const pool = require('../config/db');

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 20;
let requestsSinceCleanup = 0;

module.exports = async (req, res, next) => {
    const ipHash = crypto.createHash('sha256').update(req.ip).digest();
    try {
        // MySQL serializes duplicate-key updates, so all backend workers share one counter.
        await pool.query(
            `INSERT INTO login_rate_limits (ip_hash, attempt_count, reset_at)
             VALUES (?, 1, DATE_ADD(NOW(3), INTERVAL ${WINDOW_MINUTES} MINUTE))
             ON DUPLICATE KEY UPDATE
               attempt_count = IF(reset_at <= NOW(3), 1, attempt_count + 1),
               reset_at = IF(reset_at <= NOW(3), DATE_ADD(NOW(3), INTERVAL ${WINDOW_MINUTES} MINUTE), reset_at)`,
            [ipHash]
        );
        const [rows] = await pool.query(
            `SELECT attempt_count,
                    GREATEST(1, CEIL(TIMESTAMPDIFF(MICROSECOND, NOW(3), reset_at) / 1000000)) AS retry_after
             FROM login_rate_limits WHERE ip_hash = ?`,
            [ipHash]
        );
        if (rows[0].attempt_count > MAX_ATTEMPTS) {
            res.setHeader('Retry-After', rows[0].retry_after);
            return res.status(429).json({ message: 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ภายหลัง' });
        }

        requestsSinceCleanup += 1;
        if (requestsSinceCleanup >= 1000) {
            requestsSinceCleanup = 0;
            try {
                await pool.query('DELETE FROM login_rate_limits WHERE reset_at < DATE_SUB(NOW(3), INTERVAL 1 DAY) LIMIT 1000');
            } catch (cleanupError) {
                console.error('Login rate limit cleanup failed:', cleanupError);
            }
        }
        next();
    } catch (error) {
        next(error);
    }
};
