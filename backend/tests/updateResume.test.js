const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/router/index.js'), 'utf8');

const check = async status => {
    let guard;
    let cleared = false;
    const currentUser = { value: { role: 'admin' } };
    const context = {
        createRouter() { return { beforeEach(fn) { guard = fn; } }; }, createWebHistory() {}, currentUser,
        isAdmin: { get value() { return currentUser.value?.role === 'admin'; } }, isSessionVerified: () => false,
        api: { get: async () => { throw { response: { status } }; } },
        readActiveUpdate: () => ({ id: 'valid-running-update' }),
        clearSession() { cleared = true; currentUser.value = null; }
    };
    for (const match of source.matchAll(/import (\w+) from/g)) context[match[1]] ??= {};
    vm.runInNewContext(source.replace(/^import .*$/gm, '').replace('import.meta.env.BASE_URL', "'/'").replace('export default router', ''), context);
    return { result: await guard({ name: 'manage-system-update', path: '/manage-system-update', meta: { requiresAuth: true, requiresAdmin: true } }), cleared };
};
test('updater resumes after refresh while API is offline, but expired sessions still log out', async () => {
    assert.deepEqual(await check(502), { result: true, cleared: false });
    assert.deepEqual(await check(401), { result: '/', cleared: true });
});
