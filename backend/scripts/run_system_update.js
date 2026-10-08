const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { createStore, STEPS } = require('./system_update_state');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const runProcess = (program, args, context, { label = program, outputFile, markers = false } = {}) => new Promise((resolve, reject) => {
    context.log('\n[' + new Date().toISOString() + '] ' + label + '\n');
    const decoder = new StringDecoder('utf8');
    let pending = '';
    const consume = chunk => {
        context.log(chunk);
        if (!markers) return;
        pending += decoder.write(chunk);
        let end;
        while ((end = pending.indexOf('\n')) >= 0) {
            const line = pending.slice(0, end).trim(); pending = pending.slice(end + 1);
            const match = line.match(/^\[SOMTOP_STEP:([a-z_]+)\]$/);
            if (match && STEPS.some(([key]) => key === match[1])) context.store.startStep(context.jobId, match[1]);
        }
        if (pending.length > 16000) pending = pending.slice(-2000);
    };
    const child = spawn(program, args, { cwd: context.root, windowsHide: true,
        env: context.env, stdio: ['ignore', outputFile ?? 'pipe', 'pipe'] });
    if (outputFile === undefined) child.stdout.on('data', consume);
    child.stderr.on('data', chunk => context.log(chunk));
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(label + ' failed (' + code + ')')));
});

const backupDatabase = async context => {
    const env = context.env;
    const executable = env.MYSQLDUMP_PATH || path.join(env.XAMPP_ROOT || 'C:/xampp', 'mysql/bin/mysqldump.exe');
    if (!fs.existsSync(executable)) throw new Error('mysqldump is unavailable');
    const database = env.DB_NAME || 'somtop_db';
    if (!/^[a-z0-9_]+$/i.test(database)) throw new Error('Invalid database name');
    const quote = value => '"' + String(value || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\r', '\\r').replaceAll('\n', '\\n') + '"';
    const optionFile = path.join(context.backupDir, '.mysql.cnf');
    const dumpFile = path.join(context.backupDir, 'database.sql');
    fs.writeFileSync(optionFile, '[client]\nhost=' + quote(env.DB_HOST || '127.0.0.1') + '\nport=' + (env.DB_PORT || 3306) + '\nuser=' + quote(env.DB_USER || 'root') + '\npassword=' + quote(env.DB_PASSWORD || '') + '\n');
    const fd = fs.openSync(dumpFile, 'wx');
    try {
        await runProcess(executable, ['--defaults-extra-file=' + optionFile, '--single-transaction', '--routines', '--events', '--triggers', database], context, { label: 'database backup', outputFile: fd });
    } finally { fs.closeSync(fd); fs.unlinkSync(optionFile); }
    const bytes = fs.statSync(dumpFile).size;
    if (bytes < 100) throw new Error('Database backup is empty');
    context.store.update(context.jobId, { backup: { directory: context.backupDir, database_bytes: bytes } });
    context.store.completeStep(context.jobId, 'backup_database', 'สำรองฐานข้อมูลสำเร็จ (' + Math.ceil(bytes / 1024) + ' KB)');
};

const backupFiles = async context => {
    const files = [];
    const visited = new Set();
    const collect = (source, relative) => {
        if (!fs.existsSync(source)) return;
        const stat = fs.statSync(source);
        if (stat.isDirectory()) {
            const real = fs.realpathSync(source);
            if (visited.has(real)) return;
            visited.add(real);
            for (const entry of fs.readdirSync(source)) {
                if (entry !== '.update-status') collect(path.join(source, entry), path.join(relative, entry));
            }
        } else if (stat.isFile()) files.push([source, relative]);
    };
    for (const relative of ['backend/uploads', 'backend/templates', '.env', 'backend/.env', 'backend/src/config/google-service-account.json']) collect(path.join(context.root, relative), relative);
    const documentRoot = context.env.APACHE_DOCUMENT_ROOT || path.join(context.env.XAMPP_ROOT, 'htdocs');
    const appDirectory = path.join(documentRoot, (context.env.APP_BASE_PATH || '/somtop/').replace(/^\/|\/$/g, ''));
    collect(appDirectory, 'web');
    collect(path.join(context.env.XAMPP_ROOT || 'C:/xampp', 'apache/conf/httpd.conf'), 'apache/httpd.conf');
    collect(path.join(context.env.XAMPP_ROOT || 'C:/xampp', 'apache/conf/extra/somtop.conf'), 'apache/somtop.conf');
    let copied = 0;
    let lastReport = 0;
    for (const [source, relative] of files) {
        const destination = path.resolve(context.backupDir, 'files', relative);
        if (!destination.toLowerCase().startsWith(path.resolve(context.backupDir).toLowerCase() + path.sep)) throw new Error('Backup path outside job directory');
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        copied++;
        if (Date.now() - lastReport > 500 || copied === files.length) {
            context.store.detail(context.jobId, 'backup_files', 'สำรองไฟล์แล้ว ' + copied + '/' + files.length + ' ไฟล์');
            lastReport = Date.now();
            await sleep(0);
        }
    }
    context.git('archive', '--format=tar', '--output=' + path.join(context.backupDir, 'source.tar'), 'HEAD');
    context.store.update(context.jobId, state => ({ ...state, backup: { ...state.backup, file_count: copied } }));
    context.store.completeStep(context.jobId, 'backup_files', 'สำรองไฟล์และค่าระบบสำเร็จ ' + copied + ' ไฟล์');
};

const verifyHealth = async context => {
    const base = context.env.APP_URL.replace(/\/$/, '');
    const expectedIndex = fs.readFileSync(path.join(context.root, 'frontend/dist/index.html'), 'utf8');
    const script = expectedIndex.match(/src="([^"]+\.js)"/);
    if (!script) throw new Error('Frontend script is missing');
    const deadline = Date.now() + 90000;
    const began = Date.now();
    while (Date.now() < deadline) {
        try {
            const health = await fetch(base + '/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
            if (health.status !== 200 || (await health.json()).status !== 'ok') throw new Error('API not ready');
            const page = await fetch(base + '/', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
            if (page.status !== 200 || !(await page.text()).includes(script[1])) throw new Error('Frontend does not match this build');
            const asset = await fetch(new URL(script[1], base), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
            if (asset.status !== 200 || (await asset.arrayBuffer()).byteLength < 100) throw new Error('Frontend asset unavailable');
            context.store.completeStep(context.jobId, 'verify_health', 'เว็บ หน้า JavaScript และการเชื่อมต่อฐานข้อมูลผ่านการตรวจสอบ');
            return;
        } catch {
            context.store.detail(context.jobId, 'verify_health', 'รอเว็บและ API พร้อมใช้งาน (' + Math.floor((Date.now() - began) / 1000) + ' วินาที)');
            await sleep(2000);
        }
    }
    throw new Error('Health verification timed out');
};

async function runUpdate(options = {}) {
    const root = options.root || path.resolve(__dirname, '../..');
    const env = options.env || process.env;
    const jobId = options.jobId || env.SYSTEM_UPDATE_ID;
    if (!/^[0-9]+-[a-z0-9]{6,20}$/i.test(jobId || '')) throw new Error('Invalid update job');
    const store = createStore(root, env);
    if (store.read()?.id !== jobId) throw new Error('Update job changed before launch');
    const logFile = path.join(store.directory, 'update.log');
    const logFd = fs.openSync(logFile, 'a');
    const context = { root, env, jobId, store, backupDir: path.join(store.directory, 'backups', jobId), log: data => fs.writeSync(logFd, data) };
    context.git = options.git || ((...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim());
    const run = options.run || ((program, args, settings) => runProcess(program, args, context, settings));
    try {
        await sleep(options.startupDelay ?? 2000);
        store.startStep(jobId, 'preparing');
        if (context.git('branch', '--show-current') !== 'main' || context.git('status', '--porcelain', '--untracked-files=normal')) throw new Error('Checkout is not clean main');
        store.completeStep(jobId, 'preparing', 'พร้อมอัปเดตจาก main');
        fs.mkdirSync(context.backupDir, { recursive: true });
        store.startStep(jobId, 'backup_database');
        await (options.backupDatabase || backupDatabase)(context);
        store.startStep(jobId, 'backup_files');
        await (options.backupFiles || backupFiles)(context);
        store.startStep(jobId, 'fetching');
        await run('git', ['-C', root, 'fetch', '--prune', 'origin', 'main'], { label: 'git fetch' });
        const current = context.git('rev-parse', 'HEAD');
        const target = context.git('rev-parse', 'origin/main');
        store.update(jobId, { previous_commit: current.slice(0, 12), target_commit: target.slice(0, 12) });
        store.completeStep(jobId, 'fetching', 'ตรวจสอบเวอร์ชัน GitHub แล้ว');
        if (current === target) return store.finish(jobId, 'up_to_date');
        context.git('merge-base', '--is-ancestor', current, target);
        store.startStep(jobId, 'pulling');
        await run('git', ['-C', root, 'pull', '--ff-only', 'origin', 'main'], { label: 'git pull' });
        store.completeStep(jobId, 'pulling', 'นำโค้ดเวอร์ชันใหม่มาใช้งานแล้ว');
        await run('cmd.exe', ['/d', '/c', path.join(root, 'update_somtop.bat')], { label: 'deploy', markers: true });
        store.startStep(jobId, 'verify_health');
        await (options.verifyHealth || verifyHealth)(context);
        return store.finish(jobId);
    } catch (error) {
        context.log('\n[' + new Date().toISOString() + '] ERROR: ' + error.message + '\n');
        const active = store.read()?.steps.find(step => step.status === 'running');
        const message = active?.key === 'backup_database' || active?.key === 'backup_files'
            ? 'สำรองข้อมูลไม่สำเร็จ จึงยกเลิกการอัปเดต กรุณาตรวจฐานข้อมูลและสิทธิ์เขียนไฟล์บนเซิร์ฟเวอร์'
            : 'ขั้นตอน ' + (active?.label || 'เริ่มอัปเดต') + ' ไม่สำเร็จ กรุณาตรวจ log บนเซิร์ฟเวอร์';
        return store.fail(jobId, message);
    } finally {
        fs.closeSync(logFd);
        if (store.read()?.id === jobId) {
            const lock = path.join(store.directory, 'update.lock');
            if (fs.existsSync(lock)) fs.unlinkSync(lock);
        }
    }
}
if (require.main === module) runUpdate().then(state => { if (state.status === 'failed') process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { runUpdate, runProcess, backupDatabase, backupFiles, verifyHealth };