const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createStore } = require('../scripts/system_update_state');
const { runUpdate } = require('../scripts/run_system_update');

const fixture = () => {
    const parent = path.resolve(__dirname, '../.system-update');
    fs.mkdirSync(parent, { recursive: true });
    const root = fs.mkdtempSync(path.join(parent, 'progress-test-'));
    const env = { APACHE_DOCUMENT_ROOT: path.join(root, 'web'), APP_BASE_PATH: '/somtop/' };
    const store = createStore(root, env);
    const jobId = Date.now() + '-test123abc';
    const state = store.create({ id: jobId, requested_by: 'PRIVATE_ACTOR', previous_commit: 'old' });
    fs.writeFileSync(path.join(store.directory, 'update.lock'), 'test');
    const publicFile = path.join(root, 'web', 'somtop', '.update-status', state.progress_token + '.json');
    return { root, env, store, jobId, state, publicFile };
};
const backups = {
    backupDatabase: async ctx => {
        ctx.store.update(ctx.jobId, { backup: { directory: 'PRIVATE_BACKUP_PATH', password: 'PRIVATE_PASSWORD' } });
        ctx.store.completeStep(ctx.jobId, 'backup_database', 'สำรองฐานข้อมูลแล้ว');
    },
    backupFiles: async ctx => ctx.store.completeStep(ctx.jobId, 'backup_files', 'สำรองไฟล์แล้ว')
};
const fakeGit = same => (...args) => {
    if (args[0] === 'branch') return 'main';
    if (args[0] === 'status' || args[0] === 'merge-base') return '';
    if (args[0] === 'rev-parse') return args[1] === 'HEAD' || same ? 'a'.repeat(40) : 'b'.repeat(40);
    throw new Error('Unexpected git command: ' + args);
};

test('a new update cleans expired public progress only, preserving backup data and unrelated files', () => {
    const fx = fixture();
    const expired = path.join(path.dirname(fx.publicFile), 'a'.repeat(64) + '.json');
    const unrelated = path.join(path.dirname(fx.publicFile), 'keep.json');
    const privateBackup = path.join(fx.store.directory, 'backups', 'keep.sql');
    fs.mkdirSync(path.dirname(privateBackup), { recursive: true });
    for (const file of [expired, unrelated, privateBackup]) fs.writeFileSync(file, 'keep');
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    fs.utimesSync(expired, old, old);
    fx.store.create({ id: Date.now() + '-new123abc', requested_by: 'admin', previous_commit: 'old' });
    assert.equal(fs.existsSync(expired), false);
    assert.equal(fs.existsSync(unrelated), true);
    assert.equal(fs.existsSync(privateBackup), true);
});

test('progress continues through Apache feed while the API is offline; every deployment stage completes', async () => {
    const fx = fixture();
    const app = express();
    let apiOffline = false;
    app.get('/api/system-update', (req, res) => res.sendStatus(apiOffline ? 503 : 200));
    app.use('/somtop/.update-status', express.static(path.dirname(fx.publicFile), { index: false }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const seen = [];
    try {
        const state = await runUpdate({ ...fx, ...backups, startupDelay: 0, git: fakeGit(false),
            run: async program => {
                if (program !== 'cmd.exe') {
                    assert.ok(fx.store.read().steps.filter(step => step.key.startsWith('backup_')).every(step => step.status === 'completed'));
                    return;
                }
                for (const key of ['stop_api', 'install_backend', 'install_frontend', 'building', 'configure_apache', 'publish_frontend', 'start_api']) {
                    apiOffline = key !== 'start_api';
                    fx.store.startStep(fx.jobId, key);
                    const response = await fetch(base + fx.state.progress_url);
                    assert.equal(response.status, 200);
                    const feed = await response.json();
                    assert.equal(feed.phase, key);
                    assert.equal(feed.steps.find(step => step.key === key).status, 'running');
                    if (apiOffline) assert.equal((await fetch(base + '/api/system-update')).status, 503);
                    seen.push(key);
                }
            },
            verifyHealth: async ctx => ctx.store.completeStep(ctx.jobId, 'verify_health', 'ผ่านการตรวจสอบ')
        });
        assert.equal(state.status, 'completed');
        assert.equal(state.phase, 'done');
        assert.ok(state.steps.every(step => step.status === 'completed'));
        assert.equal(seen.length, 7);
        const publicText = fs.readFileSync(fx.publicFile, 'utf8');
        for (const secret of ['PRIVATE_ACTOR', 'PRIVATE_BACKUP_PATH', 'PRIVATE_PASSWORD', 'progress_token']) assert.ok(!publicText.includes(secret));
        assert.equal(fs.existsSync(path.join(fx.store.directory, 'update.lock')), false);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('failed backup aborts before GitHub download or deployment and exposes a safe failure message', async () => {
    const fx = fixture();
    let called = false;
    const result = await runUpdate({ ...fx, ...backups, startupDelay: 0, git: fakeGit(false),
        backupDatabase: async () => { throw new Error('PRIVATE_PASSWORD database error'); },
        run: async () => { called = true; }
    });
    assert.equal(called, false);
    assert.equal(result.status, 'failed');
    assert.equal(result.steps.find(step => step.key === 'backup_database').status, 'failed');
    assert.ok(!fs.readFileSync(fx.publicFile, 'utf8').includes('PRIVATE_PASSWORD'));
});

test('up-to-date version still backs up data and explicitly skips installation', async () => {
    const fx = fixture();
    const result = await runUpdate({ ...fx, ...backups, startupDelay: 0, git: fakeGit(true), run: async program => assert.equal(program, 'git') });
    assert.equal(result.phase, 'up_to_date');
    assert.ok(result.steps.slice(0, 4).every(step => step.status === 'completed'));
    assert.ok(result.steps.slice(4).every(step => step.status === 'skipped'));
});

test('failed installation marks the actual step failed and never claims completion', async () => {
    const fx = fixture();
    const result = await runUpdate({ ...fx, ...backups, startupDelay: 0, git: fakeGit(false), run: async program => {
        if (program === 'cmd.exe') {
            fx.store.startStep(fx.jobId, 'stop_api');
            fx.store.startStep(fx.jobId, 'install_backend');
            throw new Error('Dependency installation failed');
        }
    } });
    assert.equal(result.status, 'failed');
    assert.equal(result.steps.find(step => step.key === 'install_backend').status, 'failed');
    assert.equal(result.steps.find(step => step.key === 'verify_health').status, 'pending');
});
