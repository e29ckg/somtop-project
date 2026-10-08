// Detached worker: the API can restart under PM2 while this process keeps the update running.
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '../..');
const stateDir = path.join(projectRoot, 'backend', '.system-update');
const stateFile = path.join(stateDir, 'state.json');
const lockFile = path.join(stateDir, 'update.lock');
const logFile = path.join(stateDir, 'update.log');
const jobId = process.env.SYSTEM_UPDATE_ID;

const readState = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const writeState = changes => {
    const current = readState();
    if (current.id !== jobId) throw new Error('Update job changed while worker was running');
    const temp = `${stateFile}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ ...current, ...changes }, null, 2));
    fs.renameSync(temp, stateFile);
};
const git = (...args) => execFileSync('git', ['-C', projectRoot, ...args], {
    encoding: 'utf8', timeout: 10000, windowsHide: true
}).trim();

const run = (program, args, label, logFd) => new Promise((resolve, reject) => {
    fs.writeSync(logFd, `\n[${new Date().toISOString()}] ${label}\n`);
    const child = spawn(program, args, {
        cwd: projectRoot, windowsHide: true, stdio: ['ignore', logFd, logFd]
    });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`${label} failed (${code})`)));
});

(async () => {
    if (!jobId || readState().id !== jobId) throw new Error('Invalid update job');
    const logFd = fs.openSync(logFile, 'a');
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (git('branch', '--show-current') !== 'main' || git('status', '--porcelain', '--untracked-files=normal')) {
            throw new Error('Git checkout changed before update started');
        }
        writeState({ phase: 'fetching' });
        await run('git', ['-C', projectRoot, 'fetch', '--prune', 'origin', 'main'], 'git fetch', logFd);
        const current = git('rev-parse', 'HEAD');
        const target = git('rev-parse', 'origin/main');
        writeState({ previous_commit: current.slice(0, 12), target_commit: target.slice(0, 12) });
        if (current === target) {
            writeState({ status: 'completed', phase: 'up_to_date', finished_at: new Date().toISOString(), message: 'โปรเจกต์เป็นเวอร์ชันล่าสุดแล้ว' });
            return;
        }
        try { git('merge-base', '--is-ancestor', current, target); }
        catch { throw new Error('Local commit is not an ancestor of origin/main'); }
        writeState({ phase: 'pulling' });
        await run('git', ['-C', projectRoot, 'pull', '--ff-only', 'origin', 'main'], 'git pull', logFd);
        writeState({ phase: 'deploying' });
        await run('cmd.exe', ['/d', '/c', path.join(projectRoot, 'update_somtop.bat')], 'update_somtop.bat', logFd);
        writeState({ status: 'completed', phase: 'done', finished_at: new Date().toISOString(), message: 'อัปเดตระบบสำเร็จ' });
    } catch (error) {
        try {
            fs.writeSync(logFd, `\n[${new Date().toISOString()}] ERROR: ${error.message}\n`);
            writeState({ status: 'failed', phase: 'failed', finished_at: new Date().toISOString(), message: 'อัปเดตไม่สำเร็จ กรุณาตรวจ backend/.system-update/update.log บนเซิร์ฟเวอร์' });
        } catch (stateError) {
            fs.writeSync(logFd, `Could not update status: ${stateError.message}\n`);
        }
        process.exitCode = 1;
    } finally {
        fs.closeSync(logFd);
        fs.rmSync(lockFile, { force: true });
    }
})().catch(error => {
    try { fs.appendFileSync(logFile, `Worker startup failed: ${error.message}\n`); } catch {}
    try {
        writeState({ status: 'failed', phase: 'launch', finished_at: new Date().toISOString(), message: 'เริ่มกระบวนการอัปเดตไม่สำเร็จ' });
    } catch {}
    try { fs.rmSync(lockFile, { force: true }); } catch {}
    process.exitCode = 1;
});
