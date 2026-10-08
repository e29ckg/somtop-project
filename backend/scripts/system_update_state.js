const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STEPS = [
    ['preparing', 'ตรวจความพร้อมของระบบ'],
    ['backup_database', 'สำรองฐานข้อมูล'],
    ['backup_files', 'สำรองไฟล์และค่าระบบ'],
    ['fetching', 'ดาวน์โหลดเวอร์ชันจาก GitHub'],
    ['pulling', 'นำโค้ดใหม่มาใช้งาน'],
    ['stop_api', 'หยุด API ชั่วคราว'],
    ['install_backend', 'ติดตั้ง dependency ของ API'],
    ['install_frontend', 'ติดตั้ง dependency ของหน้าเว็บ'],
    ['building', 'สร้างหน้าเว็บเวอร์ชันใหม่'],
    ['configure_apache', 'ตรวจตั้งค่าเว็บเซิร์ฟเวอร์'],
    ['publish_frontend', 'เผยแพร่หน้าเว็บ'],
    ['start_api', 'เริ่ม API ใหม่'],
    ['verify_health', 'ตรวจสอบเว็บและ API']
];
const iso = () => new Date().toISOString();
const atomicWrite = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    for (let attempt = 0; ; attempt++) {
        try { fs.renameSync(temp, file); return; }
        catch (error) {
            if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
        }
    }
};
const publicState = state => Object.fromEntries([
    'id', 'status', 'phase', 'started_at', 'finished_at', 'updated_at', 'previous_commit',
    'target_commit', 'message', 'steps', 'events'
].filter(key => state[key] !== undefined).map(key => [key, state[key]]));

const createStore = (projectRoot, env = process.env) => {
    const directory = path.join(projectRoot, 'backend/.system-update');
    const stateFile = path.join(directory, 'state.json');
    const read = () => {
        try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    };
    const feedPath = state => {
        if (!/^[a-f0-9]{64}$/.test(state.progress_token || '')) throw new Error('Invalid progress token');
        const documentRoot = env.APACHE_DOCUMENT_ROOT || (env.XAMPP_ROOT && path.join(env.XAMPP_ROOT, 'htdocs'));
        const base = env.APP_BASE_PATH || '/somtop/';
        if (!documentRoot || !path.isAbsolute(documentRoot) || !/^\/[a-z0-9/_-]+\/$/i.test(base)) {
            throw new Error('Progress feed requires a valid Apache document root and app base path');
        }
        const root = path.resolve(documentRoot);
        const target = path.resolve(root, base.replace(/^\/|\/$/g, ''), '.update-status');
        if (!target.toLowerCase().startsWith(root.toLowerCase() + path.sep)) throw new Error('Progress path outside document root');
        return path.join(target, state.progress_token + '.json');
    };
    const write = state => {
        state.updated_at = iso();
        const feed = feedPath(state);
        fs.mkdirSync(path.dirname(feed), { recursive: true });
        if (!fs.existsSync(path.join(path.dirname(feed), '.htaccess'))) fs.writeFileSync(path.join(path.dirname(feed), '.htaccess'), 'Options -Indexes\n<IfModule mod_headers.c>\nHeader always set Cache-Control "no-store, max-age=0"\nHeader always set X-Content-Type-Options "nosniff"\n</IfModule>\n');
        atomicWrite(stateFile, state);
        atomicWrite(feed, publicState(state));
        return state;
    };
    const update = (jobId, changes) => {
        const current = read();
        if (!current || current.id !== jobId) throw new Error('Update job changed while worker was running');
        return write(typeof changes === 'function' ? changes(current) : { ...current, ...changes });
    };
    const event = (state, message, level = 'info') => {
        state.events = [...(state.events || []), { at: iso(), message, level }].slice(-150);
    };
    const startStep = (jobId, key, detail = '') => update(jobId, state => {
        const index = STEPS.findIndex(([step]) => step === key);
        if (index < 0) throw new Error('Unknown update step');
        const active = state.steps.findIndex(step => step.status === 'running');
        if (active > index || state.steps[index].status === 'completed') return state;
        if (active >= 0 && active !== index) {
            state.steps[active].status = 'completed'; state.steps[active].finished_at = iso();
            event(state, 'เสร็จแล้ว: ' + state.steps[active].label, 'success');
        }
        const step = state.steps[index];
        if (step.status !== 'running') {
            step.status = 'running'; step.started_at = iso();
            event(state, 'เริ่ม: ' + step.label);
        }
        step.detail = detail;
        state.phase = key;
        return state;
    });
    const completeStep = (jobId, key, detail = '') => update(jobId, state => {
        const step = state.steps.find(step => step.key === key);
        if (!step) throw new Error('Unknown update step');
        step.status = 'completed'; step.finished_at = iso(); step.detail = detail;
        event(state, 'เสร็จแล้ว: ' + step.label, 'success');
        return state;
    });
    return {
        directory, stateFile, read, update, startStep, completeStep,
        create({ id, requested_by, previous_commit }) {
            const progress_token = crypto.randomBytes(32).toString('hex');
            const state = write({ id, requested_by, previous_commit, status: 'running', phase: 'queued', started_at: iso(),
                progress_token, progress_url: (env.APP_BASE_PATH || '/somtop/') + '.update-status/' + progress_token + '.json',
                steps: STEPS.map(([key, label]) => ({ key, label, status: 'pending' })),
                events: [{ at: iso(), message: 'ได้รับคำสั่งเริ่มสำรองข้อมูลและอัปเดต', level: 'info' }] });
            const publicDirectory = path.dirname(feedPath(state));
            for (const name of fs.readdirSync(publicDirectory)) {
                if (!/^[a-f0-9]{64}\.json$/.test(name) || name === progress_token + '.json') continue;
                const file = path.join(publicDirectory, name);
                try {
                    if (fs.statSync(file).mtimeMs < Date.now() - 24 * 60 * 60 * 1000) fs.unlinkSync(file);
                } catch { /* Retention cleanup must not prevent a new job. */ }
            }
            return state;
        },
        detail(jobId, key, detail) {
            return update(jobId, state => { const step = state.steps.find(step => step.key === key); if (step) step.detail = detail; return state; });
        },
        finish(jobId, phase = 'done') {
            return update(jobId, state => {
                for (const step of state.steps) {
                    if (step.status === 'running') { step.status = 'completed'; step.finished_at = iso(); }
                    else if (step.status === 'pending') { step.status = 'skipped'; step.detail = phase === 'up_to_date' ? 'เป็นเวอร์ชันล่าสุด ไม่ต้องทำขั้นตอนนี้' : 'ไม่จำเป็นต้องทำขั้นตอนนี้'; }
                }
                state.status = 'completed'; state.phase = phase; state.finished_at = iso();
                state.message = phase === 'up_to_date' ? 'สำรองข้อมูลแล้ว โปรเจกต์เป็นเวอร์ชันล่าสุด' : 'สำรองข้อมูลและอัปเดตระบบสำเร็จ ตรวจสอบเว็บและ API ผ่านแล้ว';
                event(state, state.message, 'success');
                return state;
            });
        },
        fail(jobId, message) {
            return update(jobId, state => {
                const active = state.steps.find(step => step.status === 'running');
                if (active) { active.status = 'failed'; active.finished_at = iso(); active.detail = message; }
                state.failed_phase = state.phase; state.phase = 'failed'; state.status = 'failed'; state.message = message; state.finished_at = iso();
                event(state, message, 'error'); return state;
            });
        }
    };
};
module.exports = { createStore, STEPS, publicState };
