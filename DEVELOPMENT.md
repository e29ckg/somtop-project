# แก้โค้ด ส่ง GitHub และ deploy Somtop

อัปเดต: 21 ตุลาคม 2569 (2026-10-21)

## โฟลเดอร์ที่ใช้

| งาน | ตำแหน่งบนเครื่องนี้ |
| --- | --- |
| พัฒนาในแชตนี้ | `C:\Users\PKKJC-IT-519\.codex\worktrees\f40b\somtop-project` |
| ซอร์สที่บริการจริงใช้ | `C:\project\somtop-project` |
| เว็บที่ Apache เสิร์ฟ | `C:\xampp\htdocs\somtop` |
| ระบบยืนยันตัวตนกลาง | `C:\project\Auth-Hub` |

Worktree เป็น checkout แยกสำหรับพัฒนา ตำแหน่งอาจเปลี่ยนตามงานและใช้ Git metadata ร่วมกับ repository หลัก เริ่มด้วย `Get-Location`, `git status --short` และ `git branch --show-current` เพื่อตรวจว่าจะเปลี่ยนไฟล์ใน checkout ใด

แก้ Vue ใน `frontend/src` และ API ใน `backend/src` ของ checkout พัฒนา การบันทึกไฟล์หรือ push GitHub ยังไม่เปลี่ยนเว็บผ่าน Apache ส่วน `frontend/dist` และ `htdocs\somtop` เป็นผลลัพธ์ build ไม่ใช้เป็นต้นฉบับแก้โปรแกรม

ไฟล์ `.env` ของบริการจริงคือ `C:\project\somtop-project\.env` ไม่ใช่ `.env` ใน worktree ห้าม commit ค่าลับ ข้อมูลสำรอง ไฟล์อัปโหลด หรือ Google service-account

## ตรวจและส่งโค้ด

1. แก้ใน branch ของงาน ถ้ายังไม่ได้อยู่ใน branch ให้สร้างชื่อ `codex/<ชื่องาน>`
2. รันทดสอบให้ตรงส่วนที่แก้ พร้อม build เมื่อเปลี่ยนหน้าเว็บ ตัวอย่างสำหรับ auth:

```powershell
node --test backend/tests/authHub.test.js backend/tests/authConcurrency.test.js backend/tests/sessionPermissions.test.js backend/tests/dualAuth.test.js
npm --prefix frontend run build
git diff --check
git diff --stat
```

3. ตรวจ diff แล้ว stage เฉพาะไฟล์ของงาน commit และ push branch นั้น ตัวอย่าง branch ของงาน SSO:

```powershell
git push -u origin codex/auth-hub-login
```

4. รวมงานเข้า main ผ่านขั้นตอน review ของโครงการก่อนอัปเดตจาก origin/main งาน SSO รอบนี้ใช้ commit `11d7555` บน branch `codex/auth-hub-login` ให้ตรวจว่า main มีงานนี้แล้วก่อนใช้การอัปเดตปกติ

## Deploy บนเครื่องนี้

1. ที่ `C:\project\somtop-project` ตรวจ Git และสำรองฐานข้อมูล ไฟล์อัปโหลด เทมเพลต `.env` เว็บเดิม และ config Apache
2. ตรวจไฟล์ที่แก้เฉพาะเครื่อง เครื่องนี้พบ `backend\templates\duty_order_template.docx` ที่แก้ไว้ ให้เก็บสำรองและจัดการแยก ห้ามทิ้งการแก้ไขเพื่อทำให้ checkout สะอาด
3. นำ commit ที่ต้องการมาใช้แบบ fast-forward เช่น `git pull --ff-only origin main` เมื่อ main พร้อม หากมีความขัดแย้งให้หยุดตรวจ ไม่เขียนทับไฟล์ local
4. ตรวจ `.env` และ migration ที่จำเป็น แล้วรัน `update_somtop.bat` จาก checkout ที่ deploy สคริปต์ติดตั้ง dependency, build, เผยแพร่เว็บ และ restart PM2
5. ตรวจ `http://localhost/somtop/`, `/somtop/api/health`, `/somtop/api/auth/config` และเส้นทาง SSO รวมถึง login ด้วยบัญชีที่เชื่อมไว้

หากแก้เฉพาะ Markdown ที่ไม่มีหน้าเว็บนำเข้า ไม่ต้อง restart API แต่ `CHANGELOG.md` ถูกนำเข้าในหน้า **การอัพเดท** ตอน build จึงต้อง build/publish frontend เพื่อให้รายการใหม่ปรากฏบนเว็บ

การอัปเดตผ่านหน้าเว็บต้องเป็น branch main ที่สะอาดและ origin ถูกต้อง ไฟล์เทมเพลตที่ Git ติดตามและยังแก้อยู่จะทำให้เริ่มอัปเดตผ่านหน้าเว็บไม่ได้ ดูคำสั่งและการสำรองใน [DEPLOY_XAMPP.md](DEPLOY_XAMPP.md)

## เปลี่ยน URL และคืนรุ่น

เครื่องนี้ใช้ APP_URL `http://localhost/somtop`, FRONTEND_URL `http://localhost` และ API ภายในพอร์ต 8088 เปลี่ยน callback/portal ใน Hub พร้อมกันและตรวจค่าที่ PM2 เก็บไว้หลัง restart ตาม [AUTH_HUB.md](AUTH_HUB.md)

การ restart API ล้าง session ใน memory จึงต้องกด SSO ใหม่ การคืนรุ่นให้เลือก source/config/database/files จากชุดสำรองที่สัมพันธ์กัน โดยตรวจผลต่างและไฟล์ที่แก้เฉพาะเครื่องก่อนดำเนินการ
