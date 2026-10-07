const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'central-admin-test-secret-at-least-32-chars';
const dbPath = require.resolve('../src/config/db');
let account;
require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: {
        query: async (sql, params) => {
            if (sql.includes('FROM users')) return [[account]];
            if (sql.includes('FROM courts')) return [[params[0] === 'court-a' ? { court_code: 'court-a' } : null].filter(Boolean)];
            throw new Error(`Unexpected query: ${sql}`);
        }
    }
};
const { verifyToken, verifyAdmin, verifyCentralAdmin } = require('../src/middlewares/authMiddleware');
const userController = require('../src/controllers/userController');

const token = () => jwt.sign({ data: { id: 1, role: 'admin', court_code: 'court-a' } }, process.env.JWT_SECRET, {
    algorithm: 'HS256', issuer: 'somtop-api', audience: 'somtop-web'
});
const request = (url, courtCode) => ({
    cookies: { jwt: token() }, originalUrl: url,
    get: name => name === 'X-Court-Code' ? courtCode : undefined
});
const response = () => ({
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

test('central admin context and role checks use current database permissions', async () => {
    account = { id: 1, username: 'one', full_name: 'One', role: 'admin', court_code: 'court-a' };
    let req = request('/api/somtop', 'court-b');
    let res = response();
    let called = false;
    await verifyToken(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.user.court_code, 'court-a', 'court admin cannot change scope with a header');
    verifyCentralAdmin(req, res, () => {});
    assert.equal(res.statusCode, 403);

    account = { id: 1, username: 'one', full_name: 'One', role: 'central_admin', court_code: null };
    req = request('/api/somtop');
    res = response();
    await verifyToken(req, res, () => {});
    assert.equal(res.statusCode, 400, 'court data requires a selected court');

    req = request('/api/somtop', 'court-a');
    res = response();
    called = false;
    await verifyToken(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(req.user.court_code, 'court-a');
    verifyAdmin(req, res, () => {});
    assert.equal(res.statusCode, 200);

    req = request('/api/duties/holidays');
    res = response();
    called = false;
    await verifyToken(req, res, () => { called = true; });
    assert.equal(called, true, 'national holidays do not need a selected court');
    assert.equal(req.user.court_code, null);

    account = { id: 1, username: 'one', full_name: 'One', role: 'viewer', court_code: 'court-a' };
    req = request('/api/users');
    res = response();
    await verifyToken(req, res, () => {});
    verifyAdmin(req, res, () => {});
    assert.equal(res.statusCode, 403, 'the old admin token cannot retain revoked rights');
});

test('court admin cannot grant central access or change another court account', async () => {
    const actor = { id: 5, role: 'admin', court_code: 'court-a' };
    let res = response();
    await userController.createUser({ user: actor, body: {
        username: 'new', password: 'secret', full_name: 'New', role: 'central_admin', court_code: null
    } }, res);
    assert.equal(res.statusCode, 403);

    account = { id: 8, role: 'admin', court_code: 'court-b' };
    res = response();
    await userController.updateUser({ user: actor, body: {
        id: 8, full_name: 'Other', role: 'admin', court_code: 'court-b'
    } }, res);
    assert.equal(res.statusCode, 403);

    res = response();
    await userController.deleteUser({ user: actor, body: { id: 8 } }, res);
    assert.equal(res.statusCode, 403);
});
