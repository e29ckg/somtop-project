const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');

const evaluate = (filename, imports) => {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports, require: imports, process, console
    }, { filename });
    return module.exports;
};
const { verifyAdmin, verifyCentralAdmin } = evaluate(path.join(__dirname, '../src/middlewares/authMiddleware.js'), name => {
    if (name === '../config/db') return {};
    if (name === 'dotenv') return { config() {} };
    return require(name);
});
const upload = { single: () => (req, res, next) => next(), array: () => (req, res, next) => next() };
const controller = new Proxy({}, { get: () => (req, res) => res.json({ reached: true }) });
const cases = [
    ['titleRoutes', '/admin', 'GET'], ['positionRoutes', '/admin', 'GET'],
    ['decorationRoutes', '/admin', 'GET'], ['eventTypeRoutes', '/admin', 'GET'],
    ['leaveTypeRoutes', '/admin', 'GET'], ['logRoutes', '/', 'GET'],
    ['settingRoutes', '/calendar', 'GET'], ['systemUpdateRoutes', '/', 'GET'],
    ['templateRoutes', '/upload', 'POST']
];

test('admin can use every formerly central-only menu API; view accounts remain blocked', async () => {
    const app = express();
    for (const [name] of cases) {
        const router = evaluate(path.join(__dirname, '../src/routes', `${name}.js`), dependency => {
            if (dependency === 'express') return express;
            if (dependency.includes('authMiddleware')) return {
                verifyToken(req, res, next) { req.user = { role: req.get('X-Test-Role') }; next(); },
                verifyAdmin, verifyCentralAdmin
            };
            if (dependency.includes('controllers/')) return controller;
            if (dependency.includes('upload')) return { ...upload, uploadDecoration: upload };
            throw new Error(`Unexpected import: ${dependency}`);
        });
        app.use(`/${name}`, router);
    }
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        for (const [name, endpoint, method] of cases) {
            for (const role of ['admin', 'central_admin', 'view', 'viewer', 'finance']) {
                const response = await fetch(`http://127.0.0.1:${server.address().port}/${name}${endpoint}`, {
                    method, headers: { 'X-Test-Role': role }
                });
                assert.equal(response.status, role === 'admin' ? 200 : 403, `${role}: ${name}`);
            }
        }
    } finally { server.close(); }
});

test('admin can navigate to every authenticated page, including direct URLs', async () => {
    const filename = path.join(__dirname, '../../frontend/src/router/index.js');
    const source = fs.readFileSync(filename, 'utf8');
    let guard;
    let routes;
    const currentUser = { value: { role: 'admin' } };
    const context = {
        createRouter(options) { routes = options.routes; return { beforeEach(fn) { guard = fn; } }; },
        createWebHistory() {}, currentUser, activeCourtCode: { value: 'court-a' },
        isAdmin: { get value() { return currentUser.value?.role === 'admin'; } },
        isFinance: { get value() { return currentUser.value?.role === 'admin'; } },
        isSessionVerified: () => true
    };
    for (const match of source.matchAll(/import (\w+) from/g)) context[match[1]] ??= {};
    vm.runInNewContext(source.replace(/^import .*$/gm, '').replace('import.meta.env.BASE_URL', "'/'").replace('export default router', ''), context, { filename });
    const pages = routes.find(route => route.children).children;
    for (const page of pages) {
        assert.equal(await guard({ path: `/${page.path}`, meta: { requiresAuth: true, ...page.meta } }), true, page.path);
    }
    currentUser.value.role = 'view';
    for (const page of pages.filter(page => page.meta?.requiresAdmin)) {
        assert.equal(await guard({ path: `/${page.path}`, meta: { requiresAuth: true, ...page.meta } }), '/dashboard', page.path);
    }
});
