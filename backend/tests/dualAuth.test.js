const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const express = require('express');
const cookieParser = require('cookie-parser');

process.env.JWT_SECRET = 'dual-login-test-secret-at-least-32-characters';
process.env.AUTH_HUB_URL = 'http://localhost/auth';
process.env.APP_URL = 'http://localhost/somtop';
process.env.AUTH_HUB_SYSTEM_CODE = 'somtop';
process.env.AUTH_HUB_USER_MAP = '{"42":"local-user"}';
process.env.COOKIE_SECURE = 'false';
let account;
let hubStatus = 200;
let hubCalls = [];
const dbPath = require.resolve('../src/config/db');
const query = async (sql, params = []) => {
    if (sql.includes('login_rate_limits')) return sql.includes('SELECT') ? [[{ attempt_count: 1, retry_after: 900 }]] : [{ affectedRows: 1 }];
    if (sql.includes('SELECT') && sql.includes('FROM users')) return [[{ ...account }]];
    if (sql.includes('SET failed_login_attempts = ?')) account.failed_login_attempts = params[0];
    if (sql.includes('auth_version = auth_version + 1')) account.auth_version++;
    if (sql.includes('SET full_name = ?, password_hash')) account.password_hash = params[1];
    return [{ affectedRows: 1 }];
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    query,
    getConnection: async () => ({ query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} })
} };
const realFetch = global.fetch;
global.fetch = async (url, options) => {
    if (!String(url).startsWith('http://localhost/auth/api/sso/')) return realFetch(url, options);
    hubCalls.push(String(url));
    return { ok: hubStatus === 200, status: hubStatus,
        json: async () => String(url).endsWith('/token') ? { appSession: 'h'.repeat(43) } :
            { userId: 42, username: 'hub-user', systemCode: 'somtop', role: 'admin' } };
};
const { verifyToken } = require('../src/middlewares/authMiddleware');
const app = express();
app.use(express.json()); app.use(cookieParser());
app.use('/api/auth', require('../src/routes/authRoutes'));
app.put('/api/users/profile', verifyToken, require('../src/controllers/userController').updateProfile);
app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
const cookiesFrom = res => Object.fromEntries(res.headers.getSetCookie().map(cookie => {
    const first = cookie.split(';')[0]; const index = first.indexOf('=');
    return [first.slice(0, index), first.slice(index+1)];
}));

test('two login methods use local accounts and retain separate session behavior', async t => {
    account = { id: 7, username: 'local-user', password_hash: await bcrypt.hash('local-password', 4), full_name: 'Local User',
        role: 'admin', court_code: 'pkk', auth_version: 2, failed_login_attempts: 0, is_locked: 0 };
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = (path, { method = 'GET', cookies = {}, body, origin } = {}) => realFetch(base + path, {
        method, redirect: 'manual', headers: {
            Cookie: Object.entries(cookies).map(([key,value]) => `${key}=${value}`).join('; '),
            ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {})
        }, ...(body ? { body: JSON.stringify(body) } : {})
    });
    const localLogin = cookies => call('/api/auth/login', { method: 'POST', cookies, body: { username: 'local-user', password: 'local-password' } });
    const ssoLogin = async cookies => {
        hubStatus = 200;
        const start = await call('/api/auth/sso/login');
        const url = new URL(start.headers.get('location'));
        const res = await call(`/api/auth/sso/callback?state=${url.searchParams.get('state')}&code=${'c'.repeat(43)}`,
            { cookies: { ...cookies, ...cookiesFrom(start) } });
        assert.equal(res.headers.get('location'),'http://localhost/somtop/dashboard');
        return cookiesFrom(res);
    };
    let local;
    let sso;
    try {
        await t.test('config advertises both options; local credentials work during Hub outage', async () => {
            const config = await (await call('/api/auth/config')).json();
            assert.equal(config.provider, 'dual'); assert.deepEqual(config.providers, ['local','auth-hub']);
            hubStatus = 500; hubCalls = [];
            const res = await localLogin(); assert.equal(res.status,200);
            local = cookiesFrom(res);
            assert.ok(local.jwt); assert.equal(local.somtop_sso,'');
            assert.equal((await res.json()).user.auth_provider,'local');
            const me = await (await call('/api/auth/me',{cookies:{jwt:local.jwt}})).json();
            assert.equal(me.user.id,7); assert.equal(me.user.role,'admin');
            assert.equal(me.user.court_code,'pkk'); assert.equal(me.user.auth_provider,'local');
            assert.equal(hubCalls.length,0);
        });
        await t.test('wrong local password is rejected without changing the active session', async () => {
            const res = await call('/api/auth/login',{method:'POST',cookies:{jwt:local.jwt},body:{username:'local-user',password:'wrong'}});
            assert.equal(res.status,401); assert.equal(account.failed_login_attempts,1);
            assert.equal(res.headers.getSetCookie().length,0);
        });
        await t.test('SSO uses the mapped local account and clears local JWT', async () => {
            sso = await ssoLogin({jwt:local.jwt});
            assert.equal(sso.jwt,''); assert.ok(sso.somtop_sso);
            const me = await (await call('/api/auth/me',{cookies:{somtop_sso:sso.somtop_sso}})).json();
            assert.equal(me.user.username,'local-user'); assert.equal(me.user.auth_provider,'auth-hub');
            const profile = await call('/api/users/profile',{method:'PUT',cookies:{somtop_sso:sso.somtop_sso},
                body:{id:7,full_name:'Local User',old_password:'local-password',new_password:'changed'}});
            assert.equal(profile.status,400);
        });
        await t.test('Hub failure or revocation never falls back to a supplied valid local JWT', async () => {
            const cookies={somtop_sso:sso.somtop_sso,jwt:local.jwt};
            hubStatus=500;
            assert.equal((await call('/api/auth/me',{cookies})).status,503);
            hubStatus=401;
            assert.equal((await call('/api/auth/me',{cookies})).status,401);
            hubStatus=200;
            assert.equal((await call('/api/auth/me',{cookies})).status,401);
        });
        await t.test('explicit local login clears app SSO session without logging out Hub', async () => {
            sso=await ssoLogin(); hubCalls=[];
            const res=await localLogin({somtop_sso:sso.somtop_sso}); assert.equal(res.status,200);
            local=cookiesFrom(res);
            assert.equal(local.somtop_sso,''); assert.equal(hubCalls.length,0);
            assert.equal((await call('/api/auth/me',{cookies:{somtop_sso:sso.somtop_sso}})).status,401);
            account.role='view';
            assert.equal((await (await call('/api/auth/me',{cookies:{jwt:local.jwt}})).json()).user.role,'view');
            account.role='admin';
        });
        await t.test('local profile password change works with Hub enabled and revokes prior session', async () => {
            const res=await call('/api/users/profile',{method:'PUT',cookies:{jwt:local.jwt},body:{id:7,full_name:'Local User',old_password:'local-password',new_password:'local-password'}});
            assert.equal(res.status,200);
            assert.equal((await call('/api/auth/me',{cookies:{jwt:local.jwt}})).status,401);
            assert.equal(hubCalls.length,0);
            local=cookiesFrom(await localLogin());
        });
        await t.test('local logout revokes local session without calling Hub', async () => {
            hubCalls=[];
            const res=await call('/api/auth/logout',{method:'POST',cookies:{jwt:local.jwt},origin:'http://localhost'});
            assert.equal(res.status,200); assert.equal(cookiesFrom(res).jwt,'');
            assert.equal((await call('/api/auth/me',{cookies:{jwt:local.jwt}})).status,401);
            assert.equal(hubCalls.length,0);
        });
        await t.test('SSO logout requires app origin, ends central session and clears both cookies', async () => {
            sso=await ssoLogin(); const cookies={somtop_sso:sso.somtop_sso,jwt:local.jwt};
            hubCalls=[];
            assert.equal((await call('/api/auth/logout',{method:'POST',cookies,origin:'https://evil.example'})).status,403);
            assert.equal(hubCalls.length,0);
            const res=await call('/api/auth/logout',{method:'POST',cookies,origin:'http://localhost'});
            assert.equal(res.status,200); assert.ok(hubCalls.at(-1).endsWith('/end-session'));
            assert.equal(cookiesFrom(res).jwt,''); assert.equal(cookiesFrom(res).somtop_sso,'');
            assert.equal((await call('/api/auth/me',{cookies:{somtop_sso:sso.somtop_sso}})).status,401);
        });
        await t.test('with Hub disabled only local option is advertised and local sessions still work', async () => {
            delete process.env.AUTH_HUB_URL;
            const config=await (await call('/api/auth/config')).json();
            assert.deepEqual(config.providers,['local']); assert.equal(config.provider,'local');
            assert.equal((await call('/api/auth/sso/login')).status,404);
            assert.equal((await localLogin()).status,200);
        });
    } finally { await new Promise(resolve=>server.close(resolve)); }
});
