// The short-lived intermediary must exit before PM2 stops the API on Windows.
// A direct detached child of the API is still killed by Windows process-tree termination.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { createStore } = require('./system_update_state');

async function launch() {
    const root = path.resolve(__dirname, '../..');
    const jobId = process.env.SYSTEM_UPDATE_ID;
    const store = createStore(root);
    if (!/^[0-9]+-[a-z0-9]{6,20}$/i.test(jobId || '') || store.read()?.id !== jobId) throw new Error('Invalid launch job');
    const child = spawn(process.execPath, [path.join(__dirname, 'run_system_update.js')], {
        cwd: root, detached: true, windowsHide: true, stdio: 'ignore', env: process.env
    });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    store.update(jobId, { worker_pid: child.pid });
    child.unref();
}
if (require.main === module) launch().catch(error => {
    try {
        const store = createStore(path.resolve(__dirname, '../..'));
        if (store.read()?.id === process.env.SYSTEM_UPDATE_ID) {
            fs.appendFileSync(path.join(store.directory, 'update.log'), '\nLauncher error: ' + error.message + '\n');
            store.fail(process.env.SYSTEM_UPDATE_ID, 'เปิดตัวอัปเดตไม่สำเร็จ กรุณาตรวจ log บนเซิร์ฟเวอร์');
            const lock = path.join(store.directory, 'update.lock');
            if (fs.existsSync(lock)) fs.unlinkSync(lock);
        }
    } catch {}
    process.exitCode = 1;
});
module.exports = { launch };
