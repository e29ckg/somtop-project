const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('Windows deployment batch continues through stop, deploy, restart and save', { skip: process.platform !== 'win32' }, () => {
    const parent = path.resolve(__dirname, '../.system-update');
    fs.mkdirSync(parent, { recursive: true });
    const fixture = fs.mkdtempSync(path.join(parent, 'batch-test-'));
    fs.mkdirSync(path.join(fixture, 'backend'));
    const log = path.join(fixture, 'operations.txt');
    fs.copyFileSync(path.resolve(__dirname, '../../update_somtop.bat'), path.join(fixture, 'update_somtop.bat'));
    fs.writeFileSync(path.join(fixture, 'pm2.cmd'), '@echo off\r\n>>"%SOMTOP_BATCH_TEST_LOG%" echo pm2 %*\r\nexit /b 0\r\n');
    fs.writeFileSync(path.join(fixture, 'deploy_xampp.ps1'), 'param([switch]$ConfigureApache)\nAdd-Content -LiteralPath $env:SOMTOP_BATCH_TEST_LOG -Value "deploy"\n');
    const env = { ...process.env, SOMTOP_BATCH_TEST_LOG: log };
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = fixture + ';' + (env[pathKey] || '');
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', path.join(fixture, 'update_somtop.bat')], { cwd: fixture, env, windowsHide: true, timeout: 30000 });
    const steps = fs.readFileSync(log, 'utf8').trim().split(/\r?\n/).map(line => line.trim());
    assert.deepEqual(steps, ['pm2 describe somtop-api', 'pm2 stop somtop-api', 'deploy', 'pm2 restart somtop-api --update-env', 'pm2 save']);
});
