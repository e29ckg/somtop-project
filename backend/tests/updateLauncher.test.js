const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { createStore } = require('../scripts/system_update_state');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Windows process-tree termination of the API does not terminate the update worker', { skip: process.platform !== 'win32' }, async () => {
    const parent = path.resolve(__dirname, '../.system-update');
    fs.mkdirSync(parent, { recursive: true });
    const root = fs.mkdtempSync(path.join(parent, 'launcher-test-'));
    const scripts = path.join(root, 'backend/scripts');
    fs.mkdirSync(scripts, { recursive: true });
    for (const file of ['launch_system_update.js', 'system_update_state.js']) fs.copyFileSync(path.join(__dirname, '../scripts', file), path.join(scripts, file));
    const heartbeat = path.join(root, 'heartbeat.txt');
    const launched = path.join(root, 'launcher-exited.txt');
    fs.writeFileSync(path.join(scripts, 'run_system_update.js'), `const fs=require('fs');let n=0;const timer=setInterval(()=>fs.writeFileSync(${JSON.stringify(heartbeat)},String(++n)),100);setTimeout(()=>{clearInterval(timer)},8000);`);
    const apiFile = path.join(root, 'fake-api.cjs');
    fs.writeFileSync(apiFile, `const fs=require('fs');const cp=require('child_process');const child=cp.spawn(process.execPath,[${JSON.stringify(path.join(scripts, 'launch_system_update.js'))}],{stdio:'ignore',windowsHide:true,env:process.env});child.once('exit',code=>{if(code===0)fs.writeFileSync(${JSON.stringify(launched)},'ok')});setInterval(()=>{},1000);`);
    const env = { ...process.env, APACHE_DOCUMENT_ROOT: path.join(root, 'web'), APP_BASE_PATH: '/somtop/', SYSTEM_UPDATE_ID: Date.now() + '-launch123abc' };
    const store = createStore(root, env);
    store.create({ id: env.SYSTEM_UPDATE_ID, requested_by: 'test', previous_commit: 'test' });
    const child = spawn(process.execPath, [apiFile], { windowsHide: true, stdio: 'ignore', env });
    let workerPid;
    try {
        const deadline = Date.now() + 10000;
        while ((!fs.existsSync(launched) || !fs.existsSync(heartbeat)) && Date.now() < deadline) await pause(100);
        assert.ok(fs.existsSync(launched), 'intermediary must exit before API stop');
        assert.ok(fs.existsSync(heartbeat), 'worker must start');
        workerPid = store.read().worker_pid;
        assert.ok(Number.isSafeInteger(workerPid));
        assert.equal(child.exitCode, null, 'the fixture API must still be running');
        const before = Number(fs.readFileSync(heartbeat, 'utf8'));
        execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
        await pause(1000);
        const after = Number(fs.readFileSync(heartbeat, 'utf8'));
        assert.ok(after > before, 'worker must keep running after API process-tree termination');
    } finally {
        if (child.exitCode === null) { try { child.kill(); } catch {} }
        if (workerPid) { try { process.kill(workerPid); } catch {} }
    }
});
