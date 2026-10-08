@echo off
setlocal EnableExtensions
chcp 65001 > nul
cd /d "%~dp0"

set "SOMTOP_PM2_MANAGED=0"
where pm2 > nul 2>&1
if not errorlevel 1 (
  call pm2 describe somtop-api > nul 2>&1
  if not errorlevel 1 (
    echo [INFO] Stopping somtop-api before npm replaces backend dependencies.
    echo [SOMTOP_STEP:stop_api]
    call pm2 stop somtop-api
    if errorlevel 1 exit /b 1
    set "SOMTOP_PM2_MANAGED=1"
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_xampp.ps1" -ConfigureApache
if errorlevel 1 (
  echo [ERROR] Deployment failed.
  if "%SOMTOP_PM2_MANAGED%"=="1" call pm2 restart somtop-api --update-env
  exit /b 1
)

where pm2 > nul 2>&1
if errorlevel 1 (
  echo [INFO] PM2 is not installed. Start the API with node backend\server.js for a local trial.
  echo [INFO] On the server, install PM2 and start backend\server.js from the backend directory.
  exit /b 0
)

echo [SOMTOP_STEP:start_api]
cd /d "%~dp0backend"
call pm2 restart somtop-api --update-env
if errorlevel 1 (
  call pm2 start server.js --name somtop-api
  if errorlevel 1 exit /b 1
)
call pm2 save
exit /b %errorlevel%
