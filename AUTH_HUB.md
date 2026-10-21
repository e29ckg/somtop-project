# เชื่อม Somtop กับ Auth-Hub

อัปเดต: 21 ตุลาคม 2569 (2026-10-21) เครื่องนี้ใช้พอร์ต 80 ที่ `http://localhost/somtop/` แก้ซอร์สใน worktree และ deploy ไป `C:\project\somtop-project` ดู [DEVELOPMENT.md](DEVELOPMENT.md)

ใช้ SSO authorization code + PKCE S256 ตาม `Auth-Hub/docs/SSO.md` ไม่ต้องแชร์ JWT secret ของ Hub และรองรับ MFA ที่หน้า Portal กลาง Browser เก็บเฉพาะ cookie HttpOnly ของ Somtop; appSession ของ Hub อยู่ใน backend

## ตั้งค่า Somtop

เพิ่มใน `.env` จริงของเครื่อง (ตัวอย่างสำหรับ XAMPP บนเครื่องเดียวกัน):

```dotenv
APP_URL=http://localhost/somtop
FRONTEND_URL=http://localhost
APP_BASE_PATH=/somtop/
COOKIE_PATH=/somtop
COOKIE_SECURE=false
AUTH_HUB_URL=http://localhost/auth
AUTH_HUB_CLIENT_ID=somtop
AUTH_HUB_SYSTEM_CODE=somtop
AUTH_HUB_USER_MAP={"1":"admin"}
```

ค่าบนเครื่องนี้จับคู่ Hub ID `1` (username `admin-local`) กับ Somtop `admin` และกำหนด role ระบบ `somtop` ใน Hub เป็น `admin` แล้ว เครื่องอื่นต้องใช้ ID และ username จริงของเครื่องนั้น ตัวอย่างหลายบัญชี: `AUTH_HUB_USER_MAP={"12":"admin","34":"court_user"}` จับคู่ด้วย ID ถาวรอย่างชัดเจน ไม่จับคู่จากชื่อที่ตรงกัน ไม่สร้างผู้ใช้หรือยกระดับสิทธิ์อัตโนมัติ และไม่ต้องแก้ schema เพื่อเก็บ mapping

ต้องมี `JWT_SECRET` ของ Somtop ตามเดิมเพื่อให้ backend เริ่มทำงานได้ แต่ไม่ใช้ยืนยัน session ในโหมด Auth-Hub

ทดสอบผ่าน Vite ให้ตั้ง `APP_URL=http://localhost:5173`, `FRONTEND_URL=http://localhost:5173` และ `COOKIE_PATH=/` ใช้ client ID แยก เช่น `somtop-dev` และลงทะเบียน callback `http://localhost:5173/api/auth/sso/callback` ให้ตรงกัน ไม่เปลี่ยน callback ของ client production เพื่อทดลอง ใช้ hostname เดียวกันตลอด flow; localhost กับ 127.0.0.1 มี cookie คนละชุด

เครื่องจริงต้องใช้ HTTPS ทั้ง APP_URL และ AUTH_HUB_URL และตั้ง COOKIE_SECURE=true อนุญาต HTTP เฉพาะ loopback

## ลงทะเบียนฝั่ง Auth-Hub

รันในโฟลเดอร์ Auth-Hub ที่ใช้ `.env` ฐานข้อมูลของ Hub:

```powershell
$env:SSO_CLIENT_ID = 'somtop'
$env:SSO_SYSTEM_CODE = 'somtop'
$env:SSO_SYSTEM_NAME = 'ระบบผู้พิพากษาสมทบ'
$env:SSO_REDIRECT_URI = 'http://localhost/somtop/api/auth/sso/callback'
$env:SSO_PORTAL_URL = 'http://localhost/somtop/'
node src/register-sso-client.js
```

กำหนด role ระบบ `somtop` ให้ผู้ใช้ในหน้า Admin ของ Hub แล้ว restart backend Somtop และ build frontend สำหรับ production Apache ต้อง proxy `/somtop/api/` ไป backend ตามการติดตั้งเดิม Callback ต้องตรงกับ APP_URL + `/api/auth/sso/callback` ทุกตัวอักษร

คำสั่งลงทะเบียนข้างต้นใช้เพิ่ม client ใหม่ ไม่แก้ callback ของ client เดิมที่มีค่าต่างกัน หากย้าย URL ให้สำรองค่าจาก `sso_clients`/`systems` และปรับ redirect_uri กับ portal_url ของระบบ somtop ที่มีอยู่โดยตรงหรือผ่านเครื่องมือดูแลของ Hub ไม่สร้าง client ID เดิมซ้ำเพื่อหวังเขียนทับ

## เปลี่ยน URL และค่าใน PM2

แก้ `.env` ของโปรแกรมที่ deploy: APP_URL ต้องมี `/somtop` ส่วน FRONTEND_URL เป็น origin ที่ไม่มี path จากนั้นปรับ callback และ portal URL ใน Hub ให้ตรงกัน พอร์ต API ภายในยังเป็น 8088 การเปลี่ยนพอร์ตหน้าเว็บไม่จำเป็นต้องเปลี่ยน PORT ของ Node

PM2 อาจเก็บ APP_URL/FRONTEND_URL เดิมไว้ และ dotenv จะไม่เขียนทับตัวแปรที่มีอยู่แล้ว หลังแก้ `.env` บนเครื่องนี้ให้รัน PowerShell:

```powershell
Set-Location C:\project\somtop-project\backend
$env:APP_URL = 'http://localhost/somtop'
$env:FRONTEND_URL = 'http://localhost'
pm2.cmd restart somtop-api --update-env
pm2.cmd save
```

ไม่ต้อง restart Hub สำหรับการเปลี่ยน callback/role ในฐานข้อมูล แต่การ restart Somtop ทำให้ session ใน memory หาย ผู้ใช้ต้องกดเข้า SSO ใหม่

## สิทธิ์และ session

- หน้า login แสดงแบบฟอร์มบัญชี Somtop เสมอ เมื่อกำหนด AUTH_HUB_URL จะแสดงปุ่ม Auth-Hub เป็นอีกทางเลือก `/api/auth/config` คืน provider `dual` และ providers `["local","auth-hub"]` หากเว้นว่างจะคืน provider `local` และ providers `["local"]`
- บัญชี Somtop ตรวจ username/password กับฐาน Somtop และใช้ JWT โดยไม่เรียก Hub จึงยังใช้ได้เมื่อ Hub ติดต่อไม่ได้ ส่วนผู้ที่เลือก SSO ต้องผ่านการตรวจ Hub ตามเดิม ไม่เปลี่ยนวิธียืนยันตัวตนอัตโนมัติเมื่อ Hub ล่มหรือถอนสิทธิ์
- หลัง login สำเร็จ ระบบล้าง cookie ของอีกวิธีเพื่อให้ browser ใช้วิธีล่าสุดเพียงวิธีเดียว การเลือกเข้าสู่บัญชี Somtop จะล้าง app session SSO ของ browser นี้โดยไม่ logout กลาง หากมี SSO cookie ค้างพร้อม JWT จะตรวจ SSO และไม่ย้อนใช้ JWT เมื่อ SSO ไม่ผ่าน ให้เริ่ม login ด้วยวิธีที่ต้องการใหม่
- ใช้ role `admin` ได้เมื่อทั้ง Hub และบัญชี Somtop ให้ `admin`; role Hub `view` หรือ `user` ใช้สิทธิ์ `view` เท่านั้น Role อื่น เช่น `user-admin` และ `superadmin` ปฏิเสธการเข้าถึง ต้องกำหนด role ของระบบ somtop เอง ไม่อาศัย role ของระบบ central
- ใช้ court_code และชื่อแสดงผลจากบัญชี Somtop ผู้ใช้สิทธิ์ view ต้องมี court_code ผู้ดูแลยังแก้สิทธิ์/ศาลของบัญชี Somtop ได้ตามเดิม
- ทุก protected API เรียก `/api/sso/userinfo` เพื่อตรวจการถอนสิทธิ์/ปิดระบบ/logout กลาง เมื่อ Hub ติดต่อไม่ได้ตอบ 503 โดยไม่ให้เข้าถึงข้อมูล หน้าเปิดค้างตรวจ session เมื่อกลับมา focus และทุก 60 วินาทีขณะที่มองเห็น
- Logout ตามวิธีเข้าใช้งาน: บัญชี Somtop เพิ่ม auth_version และล้าง cookie โดยไม่เรียก Hub; SSO เรียก `/api/sso/end-session` จึงออกจากทุกแอปใน session กลางเดียวกัน คำขอ SSO logout ต้องมี Origin ตรง APP_URL หาก Hub ใช้งานไม่ได้จะแจ้งข้อผิดพลาดให้ลองออกจากระบบใหม่
- Session ของ Somtop และรายการ PKCE เก็บใน memory ใช้ backend **หนึ่ง process/instance** ต่อ deployment อายุ session สูงสุด 8 ชั่วโมง Restart backend ต้องกด SSO ใหม่ แต่ไม่ต้องกรอกรหัสซ้ำถ้า session กลางยังอยู่ ก่อนขยายหลาย instance ต้องเปลี่ยนเป็น shared session store
- หน้าโปรไฟล์สำหรับ session SSO ซ่อนช่องเปลี่ยนรหัสผ่านและปฏิเสธการเปลี่ยนผ่าน API ให้จัดการที่ Hub หากเข้าด้วยบัญชี Somtop จะแสดงช่องเปลี่ยนรหัสผ่าน Somtop ตามเดิมแม้เปิดใช้งาน Hub อยู่

## ตรวจสอบหลังตั้งค่า

1. เปิดหน้า Somtop กด Auth-Hub ล็อกอินที่ Portal แล้วกลับ `/somtop/dashboard` โดยไม่มี code/token ใน URL
2. Reload แล้วลองใช้เมนูตามสิทธิ์และศาลของบัญชีที่จับคู่ไว้
3. ถอน role ของระบบ somtop ใน Hub แล้วเรียก API เดิม ต้องถูกปฏิเสธทันที
4. กดออกจากระบบและตรวจว่าแอปอื่นใน session กลางเดียวกันถูกตัดด้วย

ทดสอบโค้ดด้วย `node --test backend/tests/authHub.test.js backend/tests/authConcurrency.test.js backend/tests/sessionPermissions.test.js backend/tests/dualAuth.test.js` และ `npm --prefix frontend run build` การทดสอบอัตโนมัติจำลอง Hub; ขั้นตอนข้างต้นยังต้องทำกับ Hub และฐานข้อมูลจริงของเครื่องปลายทาง

ตรวจโดยไม่เปิดเผย token: `/somtop/api/health` ต้องได้ 200, `/somtop/api/auth/config` คืน provider dual และ providers ทั้งสองวิธี, `/somtop/api/auth/me` ก่อน login ต้องได้ 401 และ `/somtop/api/auth/sso/login` ต้อง redirect ไป Hub พร้อม redirect_uri `http://localhost/somtop/api/auth/sso/callback` ถ้ายังเห็น `:8099` ให้ตรวจทั้ง `.env`, ค่าที่ PM2 เก็บไว้ และ client ใน Hub
