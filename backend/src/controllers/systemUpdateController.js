const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { logActivity } = require('../utils/logger');
const { createStore } = require('../../scripts/system_update_state');

const projectRoot = path.resolve(__dirname, '../../..');
const stateDir = path.join(projectRoot, 'backend', '.system-update');
const store = createStore(projectRoot);
const lockFile = path.join(stateDir, 'update.lock');
const workerFile = path.join(projectRoot, 'backend', 'scripts', 'run_system_update.js');
const expectedRemote = 'https://github.com/e29ckg/somtop-project.git';

const enabled = () => process.platform === 'win32' && process.env.APP_ENV === 'production' &&
    process.env.ENABLE_WEB_UPDATE === 'true';
const git = (...args) => execFileSync('git', ['-C', projectRoot, ...args], {
    encoding: 'utf8', timeout: 10000, windowsHide: true
}).trim();

const readState = () => store.read();

exports.getStatus = (req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ enabled: enabled(), status: readState() });
    } catch (error) { next(error); }
};

exports.startUpdate = (req, res, next) => {
    if (!enabled()) return res.status(503).json({ message: 'ยังไม่ได้เปิดใช้งานการอัปเดตผ่านหน้าเว็บบนเซิร์ฟเวอร์นี้' });
    let expectedOrigin;
    try { expectedOrigin = new URL(process.env.APP_URL).origin; }
    catch { return res.status(503).json({ message: 'APP_URL ของเซิร์ฟเวอร์ไม่ถูกต้อง' }); }
    if (req.get('Origin') !== expectedOrigin) return res.status(403).json({ message: 'คำขอไม่ได้มาจากหน้าเว็บของระบบ' });
    if (req.body?.confirmation !== 'UPDATE' || !(req.body?.maintenance_confirmed === true || req.body?.backup_confirmed === true)) {
        return res.status(400).json({ message: 'กรุณายืนยันการอัปเดตและพิมพ์ UPDATE ก่อนดำเนินการ' });
    }

    let lockAcquired = false;
    try {
        if (git('branch', '--show-current') !== 'main') {
            return res.status(409).json({ message: 'โปรเจกต์บนเซิร์ฟเวอร์ต้องอยู่ที่ branch main' });
        }
        if (git('remote', 'get-url', 'origin') !== expectedRemote) {
            return res.status(409).json({ message: 'Git origin ไม่ตรงกับ repository ที่อนุญาต' });
        }
        if (git('status', '--porcelain', '--untracked-files=normal')) {
            return res.status(409).json({ message: 'มีไฟล์โค้ดเปลี่ยนอยู่บนเซิร์ฟเวอร์ กรุณาตรวจสอบก่อนอัปเดต' });
        }
        if (!fs.existsSync(path.join(projectRoot, 'update_somtop.bat'))) {
            return res.status(503).json({ message: 'ไม่พบสคริปต์ update_somtop.bat' });
        }
        fs.mkdirSync(stateDir, { recursive: true });
        try {
            fs.writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
            lockAcquired = true;
        }
        catch (error) {
            if (error.code === 'EEXIST') return res.status(409).json({ message: 'มีการอัปเดตอยู่แล้ว ตรวจสถานะก่อนเริ่มใหม่' });
            throw error;
        }
        const state = store.create({
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 12)}`,
            previous_commit: git('rev-parse', '--short', 'HEAD'), requested_by: req.user.username
        });
        const child = spawn(process.execPath, [workerFile], {
            cwd: projectRoot, detached: true, windowsHide: true, stdio: 'ignore',
            env: { ...process.env, SYSTEM_UPDATE_ID: state.id }
        });
        child.once('error', error => {
            try {
                store.fail(state.id, 'เริ่มกระบวนการอัปเดตไม่สำเร็จ');
            } catch (stateError) { console.error('Could not write update status:', stateError); }
            try { fs.rmSync(lockFile, { force: true }); } catch (lockError) { console.error('Could not clear update lock:', lockError); }
            if (!res.headersSent) next(error);
        });
        child.once('spawn', () => {
            child.unref();
            logActivity(req, 'อัปเดตระบบ', 'จัดการระบบ', `เริ่มอัปเดตจาก GitHub งาน ${state.id}`);
            res.status(202).json({ message: 'เริ่มอัปเดตแล้ว', status: state });
        });
    } catch (error) {
        if (lockAcquired) {
            try { fs.rmSync(lockFile, { force: true }); } catch {}
        }
        next(error);
    }
};
