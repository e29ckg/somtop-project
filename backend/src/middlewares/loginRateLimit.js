const attempts = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

module.exports = (req, res, next) => {
    const now = Date.now();
    if (attempts.size > 10000) {
        for (const [storedKey, value] of attempts) {
            if (value.resetAt <= now) attempts.delete(storedKey);
        }
    }
    const key = req.ip;
    const current = attempts.get(key);

    if (!current || current.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return next();
    }

    current.count += 1;
    if (current.count > MAX_ATTEMPTS) {
        res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
        return res.status(429).json({ message: 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ภายหลัง' });
    }

    next();
};
