@echo off
setlocal EnableExtensions
chcp 65001 > nul
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_xampp.ps1" -ConfigureApache
if errorlevel 1 exit /b 1

where pm2 > nul 2>&1
if errorlevel 1 (
  echo [INFO] PM2 is not installed. Start the API with node backend\server.js for a local trial.
  echo [INFO] On the server, install PM2 and start backend\server.js from the backend directory.
  exit /b 0
)

cd /d "%~dp0backend"
pm2 restart somtop-api --update-env
if errorlevel 1 (
  pm2 start server.js --name somtop-api
  if errorlevel 1 exit /b 1
)
pm2 save
exit /b %errorlevel%
