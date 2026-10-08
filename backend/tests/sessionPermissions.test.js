const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'deployment-session-test-secret-at-least-32-chars';
let account = { id: 1, role: 'admin', court_code: 'court-a', auth_version: 3 };
let files = [];
let fileParams;
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    query: async (sql, params) => {
        if (sql.includes('FROM users')) return [[account].filter(Boolean)];
        fileParams = params;
        return [files];
    }
} };
const { verifyToken, verifyAdmin } = require('../src/middlewares/authMiddleware');
const authorizeUpload = require('../src/middlewares/authorizeUpload');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } });
const request = version => ({ cookies: { jwt: jwt.sign({ auth_version: version, data: { id: 1, role: 'admin' } }, process.env.JWT_SECRET,
    { algorithm: 'HS256', issuer: 'somtop-api', audience: 'somtop-web' }) } });

test('session checks current role, account existence and revocation version', async () => {
    let req = request(3);
    let res = response();
    let accepted = false;
    await verifyToken(req, res, error => { assert.ifError(error); accepted = true; });
    assert.equal(accepted, true);
    account.role = 'view';
    req = request(3); res = response();
    await verifyToken(req, res, error => assert.ifError(error));
    assert.equal(req.user.role, 'view');
    verifyAdmin(req, res, () => assert.fail('revoked admin must not be allowed'));
    assert.equal(res.statusCode, 403);
    account.auth_version = 4;
    res = response();
    await verifyToken(request(3), res, () => assert.fail('revoked session accepted'));
    assert.equal(res.statusCode, 401);
    account = null; res = response();
    await verifyToken(request(4), res, () => assert.fail('deleted account accepted'));
    assert.equal(res.statusCode, 401);
});

test('uploaded files must belong to the account court; global admin can access recorded files', async () => {
    files = [{ stored_path: 'http://old.invalid/uploads/leaves/approval.pdf' }];
    let accepted = false;
    let res = response();
    await authorizeUpload({ path: '/leaves/approval.pdf', user: { role: 'view', court_code: 'court-a' } }, res, error => { assert.ifError(error); accepted = true; });
    assert.equal(accepted, true);
    assert.equal(fileParams[0], 'court-a');
    files = []; res = response();
    await authorizeUpload({ path: '/leaves/approval.pdf', user: { role: 'view', court_code: 'court-b' } }, res, () => assert.fail('another court file accepted'));
    assert.equal(res.statusCode, 404);
    res = response();
    await authorizeUpload({ path: '/leaves/approval.pdf', user: { role: 'view', court_code: null } }, res, () => assert.fail('unscoped view accepted'));
    assert.equal(res.statusCode, 403);
    files = [{ stored_path: '/uploads/leaves/approval.pdf' }]; accepted = false;
    await authorizeUpload({ path: '/leaves/approval.pdf', user: { role: 'admin', court_code: null } }, response(), error => { assert.ifError(error); accepted = true; });
    assert.equal(accepted, true);
    assert.equal(fileParams.length, 1);
});
