const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.AUTH_HUB_URL = 'http://localhost/auth';
process.env.APP_URL = 'http://localhost/somtop';
process.env.AUTH_HUB_SYSTEM_CODE = 'somtop';
process.env.AUTH_HUB_USER_MAP = '{"42":"court-user"}';
let account = { id: 7, username: 'court-user', full_name: 'Court User', role: 'admin', court_code: 'pkk', auth_version: 2 };
let profile = { userId: 42, username: 'hub-user', role: 'admin', systemCode: 'somtop' };
let hubStatus = 200;
const calls = [];
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    query: async sql => sql.startsWith('SELECT') ? [[account].filter(Boolean)] : [{ affectedRows: 1 }]
} };
global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: hubStatus === 200, status: hubStatus,
        json: async () => url.endsWith('/token') ? { appSession: 'a'.repeat(43) } : profile };
};
const hub = require('../src/services/authHub');
const response = () => ({
    statusCode: 200, cookies: {}, cleared: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(name, value, options) { this.cookies[name] = { value, options }; },
    clearCookie(name) { this.cleared.push(name); },
    redirect(status, url) { this.statusCode = status; this.url = url; }
});
const start = () => {
    const res = response(); hub.start({}, res);
    return { res, url: new URL(res.url), state: res.cookies.somtop_sso_state.value };
};
const callback = async (state, cookie = state) => {
    const res = response();
    await hub.callback({ query: { state, code: 'c'.repeat(43) }, cookies: { somtop_sso_state: cookie } }, res);
    return res;
};
const verify = async cookie => {
    const req = { cookies: { somtop_sso: cookie } }; const res = response(); let accepted = false;
    await hub.verify(req, res, error => { assert.ifError(error); accepted = true; });
    return { req, res, accepted };
};

test('SSO code flow, authorization, revocation and logout', async t => {
    let session;
    await t.test('local login still validates input and rejects malformed JWT with Hub enabled', async () => {
        const res = response();
        await require('../src/controllers/authController').login({ body: {} }, res);
        assert.equal(res.statusCode, 400);
        const legacy = response();
        await require('../src/middlewares/authMiddleware').verifyToken({ cookies: { jwt: 'legacy' } }, legacy,
            () => assert.fail('malformed JWT must not be accepted'));
        assert.equal(legacy.statusCode, 401);
    });
    await t.test('browser-bound state, PKCE and clean subpath redirect; no Hub token in browser', async () => {
        const flow = start();
        assert.equal(flow.url.pathname, '/auth/api/sso/authorize');
        assert.equal(flow.url.searchParams.get('redirect_uri'), 'http://localhost/somtop/api/auth/sso/callback');
        assert.equal(flow.url.searchParams.get('code_challenge_method'), 'S256');
        assert.equal(flow.res.cookies.somtop_sso_state.options.sameSite, 'lax');
        assert.equal(flow.res.cookies.somtop_sso_state.options.httpOnly, true);
        const invalid = await callback(flow.state, 'wrong');
        assert.match(invalid.url, /auth_error=failed$/);
        assert.equal(calls.length, 0);
        const res = await callback(flow.state);
        const exchange = JSON.parse(calls[0].options.body);
        assert.equal(crypto.createHash('sha256').update(exchange.code_verifier).digest('base64url'), flow.url.searchParams.get('code_challenge'));
        assert.equal(res.url, 'http://localhost/somtop/dashboard');
        session = res.cookies.somtop_sso.value;
        assert.notEqual(session, 'a'.repeat(43));
        assert.equal(res.cookies.somtop_sso.options.sameSite, 'strict');
        assert.equal(res.cookies.somtop_sso.options.httpOnly, true);
        assert.match((await callback(flow.state)).url, /auth_error=failed$/);
    });
    await t.test('reads current local scope and caps admin privileges by both systems', async () => {
        let result = await verify(session);
        assert.equal(result.accepted, true);
        assert.equal(result.req.user.id, 7);
        assert.equal(result.req.user.court_code, 'pkk');
        assert.equal(result.req.user.role, 'admin');
        assert.equal(result.req.user.auth_version, undefined);
        profile.role = 'user';
        result = await verify(session);
        assert.equal(result.req.user.role, 'view');
        profile.role = 'admin'; account.role = 'view';
        assert.equal((await verify(session)).req.user.role, 'view');
        account.role = 'admin';
    });
    await t.test('Hub outage fails closed and can recover', async () => {
        hubStatus = 500;
        const result = await verify(session);
        assert.equal(result.accepted, false); assert.equal(result.res.statusCode, 503);
        hubStatus = 200;
        assert.equal((await verify(session)).accepted, true);
    });
    await t.test('local auth_version invalidates session', async () => {
        account.auth_version++;
        assert.equal((await verify(session)).res.statusCode, 401);
        assert.equal((await verify(session)).res.statusCode, 401);
    });
    await t.test('rejects wrong system, unmapped identity, unsupported role and unscoped viewer', async () => {
        profile.systemCode = 'other';
        assert.match((await callback(start().state)).url, /auth_error=access_denied$/);
        profile.systemCode = 'somtop'; profile.userId = 99;
        assert.match((await callback(start().state)).url, /auth_error=access_denied$/);
        profile.userId = 42; profile.role = 'superadmin';
        assert.match((await callback(start().state)).url, /auth_error=access_denied$/);
        profile.role = 'view'; account.court_code = null;
        assert.match((await callback(start().state)).url, /auth_error=access_denied$/);
        profile.role = 'admin'; account.court_code = 'pkk';
    });
    await t.test('central revocation denies existing session immediately', async () => {
        const res = await callback(start().state);
        hubStatus = 401;
        assert.equal((await verify(res.cookies.somtop_sso.value)).res.statusCode, 401);
        hubStatus = 200;
        assert.equal((await verify(res.cookies.somtop_sso.value)).res.statusCode, 401);
    });
    await t.test('logout requires exact app origin and revokes central session', async () => {
        const sessionRes = await callback(start().state);
        const cookie = sessionRes.cookies.somtop_sso.value;
        const req = { cookies: { somtop_sso: cookie }, get: () => 'https://evil.example' };
        let res = response(); const before = calls.length;
        await hub.logout(req, res, assert.ifError);
        assert.equal(res.statusCode, 403); assert.equal(calls.length, before);
        req.get = () => 'http://localhost';
        res = response(); await hub.logout(req, res, assert.ifError);
        assert.equal(calls.at(-1).url, 'http://localhost/auth/api/sso/end-session');
        assert.equal(calls.at(-1).options.headers.Authorization, `Bearer ${'a'.repeat(43)}`);
        assert.ok(res.cleared.includes('somtop_sso'));
        assert.equal((await verify(cookie)).res.statusCode, 401);
    });
    await t.test('expired callback and local session are rejected', async () => {
        const flow = start();
        const sessionRes = await callback(start().state);
        const now = Date.now;
        try {
            Date.now = () => now() + 9 * 3600000;
            assert.match((await callback(flow.state)).url, /auth_error=failed$/);
            assert.equal((await verify(sessionRes.cookies.somtop_sso.value)).res.statusCode, 401);
        } finally { Date.now = now; }
    });
});
