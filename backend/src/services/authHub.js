const crypto = require('node:crypto');
const pool = require('../config/db');

const enabled = () => Boolean(process.env.AUTH_HUB_URL);
const random = () => crypto.randomBytes(32).toString('base64url');
const hash = value => crypto.createHash('sha256').update(value).digest('base64url');
const pending = new Map();
const sessions = new Map();
const cookiePath = () => process.env.COOKIE_PATH || '/';
const cookieOptions = () => ({ httpOnly: true, secure: process.env.COOKIE_SECURE === 'true' ||
    (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production'), sameSite: 'lax', path: cookiePath() });
const sessionCookie = 'somtop_sso';
const stateCookie = 'somtop_sso_state';
const hasSessionCookie = req => Object.hasOwn(req.cookies || {}, sessionCookie);
// Forget this app's SSO session when explicitly switching to local login.
// Switching login methods does not end the user's central Hub session.
function clearLocalSession(req, res) {
    const value = req.cookies?.[sessionCookie];
    if (typeof value === 'string') sessions.delete(hash(value));
    res.clearCookie(sessionCookie, { ...cookieOptions(), sameSite: 'strict' });
    res.clearCookie(stateCookie, cookieOptions());
}
const prune = map => {
    for (const [key, value] of map) if (value.expires <= Date.now()) map.delete(key);
};
function config() {
    const hub = new URL(process.env.AUTH_HUB_URL);
    const app = new URL(process.env.APP_URL);
    for (const url of [hub, app]) {
        if (url.username || url.password || url.search || url.hash ||
            (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
            throw new Error('Auth Hub and APP_URL require HTTPS (HTTP allowed on loopback only)');
        }
    }
    const base = app.toString().replace(/\/$/, '');
    const users = JSON.parse(process.env.AUTH_HUB_USER_MAP || '{}');
    if (!users || Array.isArray(users) || typeof users !== 'object' || Object.values(users).some(v => typeof v !== 'string' || !v)) {
        throw new Error('AUTH_HUB_USER_MAP must map Hub user IDs to local usernames');
    }
    return { hub: hub.toString().replace(/\/$/, ''), app: base,
        callback: `${base}/api/auth/sso/callback`, client: process.env.AUTH_HUB_CLIENT_ID || 'somtop',
        system: process.env.AUTH_HUB_SYSTEM_CODE || 'somtop', users };
}
async function request(path, { token, body } = {}) {
    try {
        const response = await fetch(`${config().hub}/api/sso/${path}`, {
            method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(5000),
            headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        if (!response.ok) {
            const error = new Error('ไม่สามารถยืนยันสิทธิ์กับ Auth-Hub ได้');
            error.status = [400, 401, 403].includes(response.status) ? response.status : 503;
            throw error;
        }
        return await response.json();
    } catch (error) {
        if (!error.status) error.status = 503;
        throw error;
    }
}
async function resolveUser(token) {
    const profile = await request('userinfo', { token });
    const settings = config();
    const username = Object.hasOwn(settings.users, String(profile.userId)) ? settings.users[String(profile.userId)] : null;
    if (profile.systemCode !== settings.system || !['admin', 'view', 'user'].includes(profile.role) || !username) {
        throw Object.assign(new Error('บัญชีนี้ยังไม่ได้เชื่อมกับ Somtop หรือไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ'), { status: 403 });
    }
    const [rows] = await pool.query('SELECT id, username, full_name, role, court_code, auth_version FROM users WHERE username = ? LIMIT 1', [username]);
    const local = rows[0];
    if (!local || !['admin', 'view'].includes(local.role)) {
        throw Object.assign(new Error('ไม่พบบัญชี Somtop ที่เชื่อมไว้'), { status: 403 });
    }
    const role = local.role === 'admin' && profile.role === 'admin' ? 'admin' : 'view';
    if (role === 'view' && !local.court_code) {
        throw Object.assign(new Error('กรุณาให้ผู้ดูแลกำหนดศาลให้บัญชี Somtop ก่อนเข้าใช้งาน'), { status: 403 });
    }
    return { ...local, role };
}
function start(req, res) {
    const settings = config();
    prune(pending);
    if (pending.size >= 10000) return res.status(503).json({ message: 'กรุณาลองใหม่ภายหลัง' });
    const state = random();
    const verifier = random();
    pending.set(hash(state), { verifier, expires: Date.now() + 300000 });
    res.cookie(stateCookie, state, { ...cookieOptions(), maxAge: 300000 });
    const target = new URL(`${settings.hub}/api/sso/authorize`);
    target.search = new URLSearchParams({ client_id: settings.client, redirect_uri: settings.callback,
        state, code_challenge: hash(verifier), code_challenge_method: 'S256' }).toString();
    res.redirect(303, target.toString());
}
async function callback(req, res) {
    const settings = config();
    const { state, code } = req.query;
    res.clearCookie(stateCookie, cookieOptions());
    try {
        if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || state !== req.cookies?.[stateCookie]) throw new Error('Invalid state');
        const transaction = pending.get(hash(state));
        pending.delete(hash(state));
        if (!transaction || transaction.expires <= Date.now() || typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new Error('Invalid callback');
        const result = await request('token', { body: { code, client_id: settings.client,
            redirect_uri: settings.callback, code_verifier: transaction.verifier } });
        if (typeof result.appSession !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.appSession)) throw new Error('Invalid session');
        const user = await resolveUser(result.appSession);
        prune(sessions);
        if (sessions.size >= 10000) throw new Error('Session limit reached');
        const value = random();
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        clearLocalSession(req, res);
        sessions.set(hash(value), { token: result.appSession, userId: user.id, version: user.auth_version, expires: Date.now() + 8 * 3600000 });
        res.cookie(sessionCookie, value, { ...cookieOptions(), sameSite: 'strict', maxAge: 8 * 3600000 });
        res.clearCookie('jwt', { ...cookieOptions(), sameSite: 'strict' });
        res.redirect(303, `${settings.app}/dashboard`);
    } catch (error) {
        res.redirect(303, `${settings.app}/?auth_error=${error.status === 403 ? 'access_denied' : error.status === 503 ? 'unavailable' : 'failed'}`);
    }
}
async function verify(req, res, next) {
    const value = req.cookies?.[sessionCookie];
    const session = typeof value === 'string' ? sessions.get(hash(value)) : null;
    if (!session || session.expires <= Date.now()) {
        if (value) sessions.delete(hash(value));
        return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบผ่าน Auth-Hub' });
    }
    try {
        const { auth_version, ...user } = await resolveUser(session.token);
        if (session.userId !== user.id || session.version !== auth_version) {
            throw Object.assign(new Error('เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่'), { status: 401 });
        }
        req.user = { ...user, auth_provider: 'auth-hub' };
        next();
    } catch (error) {
        if (![401, 403, 503].includes(error.status)) return next(error);
        if (error.status !== 503) sessions.delete(hash(value));
        res.status(error.status).json({ message: error.status === 503 ? 'ไม่สามารถเชื่อมต่อ Auth-Hub ได้ กรุณาลองใหม่' : error.message });
    }
}
async function logout(req, res, next) {
    // Explicit Origin check is required before revoking a central browser session.
    if (req.get('origin') !== new URL(config().app).origin) return res.status(403).json({ message: 'Origin not allowed' });
    const value = req.cookies?.[sessionCookie];
    const session = typeof value === 'string' ? sessions.get(hash(value)) : null;
    try {
        if (session) {
            try { await request('end-session', { token: session.token, body: {} }); }
            catch (error) { if (error.status !== 401) throw error; }
        }
        clearLocalSession(req, res);
        res.clearCookie('jwt', { ...cookieOptions(), sameSite: 'strict' });
        res.json({ message: 'ออกจากระบบทุกแอปของเซสชัน Auth-Hub นี้แล้ว' });
    } catch (error) { next(error); }
}
module.exports = { enabled, config, start, callback, verify, logout, hasSessionCookie, clearLocalSession };
