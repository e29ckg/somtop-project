const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'web-update-test-secret-at-least-32-chars';
process.env.APP_ENV = 'production';
process.env.ENABLE_WEB_UPDATE = 'true';

let role = 'admin';
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { query: async () => [[{ id: 1, username: 'admin', role, court_code: 'court-a', auth_version: 0 }]] }
};
const routes = require('../src/routes/systemUpdateRoutes');

test('system update requires admin role, origin and explicit confirmation', async () => {
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/system-update', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    process.env.APP_URL = `${base}/somtop`;
    const headers = () => ({ Cookie: 'jwt=' + jwt.sign({ auth_version: 0, data: { id: 1, role } }, process.env.JWT_SECRET, { algorithm: 'HS256', issuer: 'somtop-api', audience: 'somtop-web' }), 'Content-Type': 'application/json' });
    try {
        let response = await fetch(`${base}/api/system-update`);
        assert.equal(response.status, 401);

        role = 'admin';
        response = await fetch(`${base}/api/system-update`, { headers: headers() });
        assert.equal(response.status, 200);

        for (const deniedRole of ['view', 'viewer', 'finance', 'central_admin']) {
            role = deniedRole;
            response = await fetch(`${base}/api/system-update`, { headers: headers() });
            assert.equal(response.status, deniedRole === 'view' ? 403 : 401);
        }

        role = 'admin';
        response = await fetch(`${base}/api/system-update`, { headers: headers() });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).enabled, process.platform === 'win32');

        role = 'admin';
        if (process.platform === 'win32') {
            response = await fetch(`${base}/api/system-update`, {
                method: 'POST', headers: { ...headers(), Origin: 'http://other.example' },
                body: JSON.stringify({ confirmation: 'UPDATE', backup_confirmed: true })
            });
            assert.equal(response.status, 403);

            response = await fetch(`${base}/api/system-update`, {
                method: 'POST', headers: { ...headers(), Origin: base },
                body: JSON.stringify({ confirmation: 'UPDATE', backup_confirmed: false })
            });
            assert.equal(response.status, 400);
        }
    } finally {
        server.close();
    }
});
