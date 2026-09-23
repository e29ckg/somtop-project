@echo off
setlocal EnableExtensions
chcp 65001 > nul

title อัปเดตระบบ Somtop
set "PROJECT_DIR=%~dp0"
set "XAMPP_ROOT=C:\xampp"
set "FRONTEND_DEPLOY_DIR=%XAMPP_ROOT%\htdocs\somtop"
set "PM2_APP_NAME=somtop-api"
cd /d "%PROJECT_DIR%"

echo ========================================
echo   อัปเดตระบบบริหารจัดการ พ.สมทบ
echo ========================================
echo.

if not exist ".git" (
  echo [ERROR] ไม่พบโฟลเดอร์ Git ใน %PROJECT_DIR%
  pause
  exit /b 1
)

echo [1/4] ตรวจสอบสถานะไฟล์ก่อนอัปเดต...
git status --short
echo.
choice /M "ต้องการดึงโค้ดล่าสุดจาก Git หรือไม่"
if errorlevel 2 goto install

echo [2/4] กำลังดึงโค้ดล่าสุด...
git pull --ff-only
if errorlevel 1 (
  echo [ERROR] ดึงโค้ดไม่สำเร็จ กรุณาตรวจสอบการแก้ไขค้างอยู่หรือ conflict
  pause
  exit /b 1
)

:install
echo [3/4] กำลังติดตั้ง dependency...
call npm install
if errorlevel 1 goto fail
call npm --prefix backend install
if errorlevel 1 goto fail
call npm --prefix frontend install
if errorlevel 1 goto fail

echo [4/4] กำลัง build Frontend สำหรับ XAMPP...
call npm --prefix frontend run build
if errorlevel 1 goto fail

if not exist "%XAMPP_ROOT%" (
  echo [ERROR] ไม่พบ XAMPP ที่ %XAMPP_ROOT%
  echo กรุณาแก้ค่า XAMPP_ROOT ด้านบนของไฟล์นี้
  pause
  exit /b 1
)
if not exist "%FRONTEND_DEPLOY_DIR%" mkdir "%FRONTEND_DEPLOY_DIR%"
echo กำลังคัดลอก Frontend ไปยัง %FRONTEND_DEPLOY_DIR% ...
xcopy "%PROJECT_DIR%frontend\dist\*" "%FRONTEND_DEPLOY_DIR%\" /E /I /Y > nul

echo กำลังตรวจสอบ MySQL ของ XAMPP...
if exist "%XAMPP_ROOT%\mysql\bin\mysqladmin.exe" (
  "%XAMPP_ROOT%\mysql\bin\mysqladmin.exe" ping -h 127.0.0.1 -u root > nul 2>&1
  if errorlevel 1 echo [WARN] MySQL ยังไม่ตอบสนอง กรุณาเปิด MySQL ใน XAMPP Control Panel
) else echo [WARN] ไม่พบ mysqladmin.exe ใน XAMPP

echo กำลัง restart Backend ด้วย PM2...
where pm2 > nul 2>&1
if errorlevel 1 (
  echo [ERROR] ไม่พบคำสั่ง PM2 ใน PATH
  pause
  exit /b 1
)
cd /d "%PROJECT_DIR%backend"
pm2 restart "%PM2_APP_NAME%" --update-env
if errorlevel 1 (
  echo [WARN] restart ไม่สำเร็จ อาจยังไม่มี process ชื่อนี้
  echo หากต้องเริ่มครั้งแรก ให้รัน: pm2 start server.js --name "%PM2_APP_NAME%"
)
cd /d "%PROJECT_DIR%"

echo.
echo ========================================
echo อัปเดตระบบเสร็จสมบูรณ์
echo Frontend: ผ่าน Apache/XAMPP ตามโดเมนหรือ http://localhost/somtop
echo Backend : http://localhost:8088
echo ========================================
pause
exit /b 0

:fail
echo [ERROR] ติดตั้ง dependency ไม่สำเร็จ
pause
exit /b 1
