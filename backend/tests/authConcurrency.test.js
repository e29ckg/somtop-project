const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

process.env.JWT_SECRET = 'auth-concurrency-test-secret-at-least-32-chars';

let account;
let rowLock = Promise.resolve();
const counters = new Map();
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
        getConnection: async () => {
            let releaseLock;
            return {
                beginTransaction: async () => {},
                query: async (sql, params) => {
                    if (sql.includes('FOR UPDATE')) {
                        const prior = rowLock;
                        rowLock = new Promise(resolve => { releaseLock = resolve; });
                        await prior;
                        return [[{
                            ...account,
                            is_locked: account.locked ? 1 : 0
                        }]];
                    }
                    if (sql.includes('SET failed_login_attempts = ?')) {
                        account.failed_login_attempts = params[0];
                        if (sql.includes('lockout_until = DATE_ADD')) account.locked = true;
                        return [{ affectedRows: 1 }];
                    }
                    throw new Error(`Unexpected transaction query: ${sql}`);
                },
                commit: async () => { releaseLock?.(); releaseLock = null; },
                rollback: async () => { releaseLock?.(); releaseLock = null; },
                release: () => {}
            };
        },
        query: async (sql, params) => {
            if (sql.includes('INSERT INTO login_rate_limits')) {
                const key = params[0].toString('hex');
                counters.set(key, (counters.get(key) || 0) + 1);
                return [{ affectedRows: 1 }];
            }
            if (sql.includes('FROM login_rate_limits')) {
                return [[{ attempt_count: counters.get(params[0].toString('hex')), retry_after: 900 }]];
            }
            if (sql.startsWith('DELETE FROM login_rate_limits')) return [{ affectedRows: 0 }];
            throw new Error(`Unexpected pool query: ${sql}`);
        }
    }
};

const authController = require('../src/controllers/authController');
const limiterPath = require.resolve('../src/middlewares/loginRateLimit');
const response = () => ({
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; }
});

test('simultaneous wrong passwords count once each and lock at five', async () => {
    account = {
        id: 1, username: 'one', password_hash: await bcrypt.hash('correct', 4),
        failed_login_attempts: 0, lockout_until: null, locked: false, auth_version: 0
    };
    const responses = await Promise.all(Array.from({ length: 6 }, async () => {
        const res = response();
        await authController.login({ body: { username: 'one', password: 'wrong' } }, res);
        return res.statusCode;
    }));
    assert.equal(account.failed_login_attempts, 5);
    assert.equal(responses.filter(code => code === 401).length, 4);
    assert.equal(responses.filter(code => code === 403).length, 2);
});

test('login limit survives middleware reload through the shared database counter', async () => {
    let loginRateLimit = require(limiterPath);
    const call = async () => {
        const res = response();
        let accepted = false;
        await loginRateLimit({ ip: '192.0.2.10' }, res, error => {
            if (error) throw error;
            accepted = true;
        });
        return { res, accepted };
    };
    for (let i = 0; i < 20; i++) assert.equal((await call()).accepted, true);
    delete require.cache[limiterPath];
    loginRateLimit = require(limiterPath);
    const blocked = await call();
    assert.equal(blocked.accepted, false);
    assert.equal(blocked.res.statusCode, 429);
    assert.equal(blocked.res.headers['Retry-After'], 900);
});
