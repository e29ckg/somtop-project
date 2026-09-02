@echo off
setlocal
chcp 65001 > nul

:: ==========================================
:: ⚙️ 1. ตั้งค่าตัวแปร (ปรับแก้ Path ให้ตรงกับเครื่องจริง)
:: ==========================================
set BACKUP_ROOT=C:\project\somtop-project
set XAMPP_MYSQL=C:\xampp\mysql\bin\mysqldump.exe
set BACKEND_DIR=C:\project\somtop-project\backend

:: ตั้งค่ารหัสผ่านฐานข้อมูล (ถ้า XAMPP ไม่ได้ตั้งรหัสผ่าน ให้เอา -prootpassword ออก)
set DB_USER=root
set DB_PASS=
set DB_NAME=somtop_db

:: สร้างชื่อโฟลเดอร์ตามวันที่และเวลา (เช่น 2026-09-03_06-14)
set DATETIME=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%
set DATETIME=%DATETIME: =0%
set BACKUP_FOLDER=%BACKUP_ROOT%\backup\backup_%DATETIME%

:: ==========================================
:: 🚀 2. เริ่มกระบวนการ Backup
:: ==========================================
echo ----------------------------------------
echo เริ่มการสำรองข้อมูลโปรแกรมบริหารจัดการ พ.สมทบ
echo วันที่และเวลา: %DATETIME%
echo ----------------------------------------

:: สร้างโฟลเดอร์สำหรับเก็บข้อมูลวันนี้
mkdir "%BACKUP_FOLDER%"
mkdir "%BACKUP_FOLDER%\secrets"

:: 🗄️ ก. สำรองฐานข้อมูล (Database)
echo [1/3] กำลัง Export ฐานข้อมูล %DB_NAME%...
:: "%XAMPP_MYSQL%" -u%DB_USER% -p%DB_PASS% %DB_NAME% > "%BACKUP_FOLDER%\%DB_NAME%.sql"
"%XAMPP_MYSQL%" -u%DB_USER% %DB_NAME% > "%BACKUP_FOLDER%\%DB_NAME%.sql"

:: 📁 ข. สำรองไฟล์อัปโหลด (รูปโปรไฟล์ และ ใบลา)
echo [2/3] กำลังคัดลอกไฟล์อัปโหลด...
xcopy "%BACKEND_DIR%\uploads" "%BACKUP_FOLDER%\uploads" /E /I /C /Y /Q > nul

:: ⚙️ ค. สำรองไฟล์ตั้งค่าและรหัสลับ
echo [3/3] กำลังคัดลอกไฟล์ตั้งค่าความลับ...
copy "%BACKEND_DIR%\.env" "%BACKUP_FOLDER%\secrets\.env" > nul
copy "%BACKEND_DIR%\src\config\google-service-account.json" "%BACKUP_FOLDER%\secrets\google-service-account.json" > nul

echo ----------------------------------------
echo ✅ สำรองข้อมูลเสร็จสมบูรณ์! ไฟล์เก็บไว้ที่: %BACKUP_FOLDER%
echo ----------------------------------------
timeout /t 5