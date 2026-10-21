# เชื่อม Somtop กับ Auth-Hub

ใช้ SSO authorization code + PKCE S256 ตาม `Auth-Hub/docs/SSO.md` ไม่ต้องแชร์ JWT secret ของ Hub และรองรับ MFA ที่หน้า Portal กลาง Browser เก็บเฉพาะ cookie HttpOnly ของ Somtop; appSession ของ Hub อยู่ใน backend

## ตั้งค่า Somtop

เพิ่มใน `.env` จริงของเครื่อง (ตัวอย่างสำหรับ XAMPP บนเครื่องเดียวกัน):

```dotenv
APP_URL=http://localhost:8099/somtop
COOKIE_PATH=/somtop
COOKIE_SECURE=false
AUTH_HUB_URL=http://localhost/auth
AUTH_HUB_CLIENT_ID=somtop
AUTH_HUB_SYSTEM_CODE=somtop
AUTH_HUB_USER_MAP={"12":"admin","34":"court_user"}
```

แทนเลข `12`, `34` ด้วย ID ผู้ใช้จริงจาก Auth-Hub และค่าด้านขวาด้วย username บัญชี Somtop ที่มีอยู่ จับคู่ด้วย ID ถาวรอย่างชัดเจนเพื่อไม่ให้ชื่อที่ตรงกันโดยบังเอิญเข้าบัญชีเดิมได้ ไม่สร้างผู้ใช้หรือยกระดับสิทธิ์อัตโนมัติ ไม่ต้องแก้ schema ฐานข้อมูล

ต้องมี `JWT_SECRET` ของ Somtop ตามเดิมเพื่อให้ backend เริ่มทำงานได้ แต่ไม่ใช้ยืนยัน session ในโหมด Auth-Hub

ทดสอบผ่าน Vite ให้ตั้ง `APP_URL=http://localhost:5173` และ `COOKIE_PATH=/` โดยลงทะเบียน callback ของพอร์ตนี้แยกให้ตรงกัน ใช้ hostname เดียวกันตลอด flow; localhost กับ 127.0.0.1 มี cookie คนละชุด

เครื่องจริงต้องใช้ HTTPS ทั้ง APP_URL และ AUTH_HUB_URL และตั้ง COOKIE_SECURE=true อนุญาต HTTP เฉพาะ loopback

## ลงทะเบียนฝั่ง Auth-Hub

รันในโฟลเดอร์ Auth-Hub ที่ใช้ `.env` ฐานข้อมูลของ Hub:

```powershell
$env:SSO_CLIENT_ID = 'somtop'
$env:SSO_SYSTEM_CODE = 'somtop'
$env:SSO_SYSTEM_NAME = 'ระบบผู้พิพากษาสมทบ'
$env:SSO_REDIRECT_URI = 'http://localhost:8099/somtop/api/auth/sso/callback'
$env:SSO_PORTAL_URL = 'http://localhost:8099/somtop/'
node src/register-sso-client.js
```

กำหนด role ระบบ `somtop` ให้ผู้ใช้ในหน้า Admin ของ Hub แล้ว restart backend Somtop และ build frontend สำหรับ production Apache ต้อง proxy `/somtop/api/` ไป backend ตามการติดตั้งเดิม Callback ต้องตรงกับ APP_URL + `/api/auth/sso/callback` ทุกตัวอักษร

## สิทธิ์และ session

- เมื่อกำหนด AUTH_HUB_URL หน้า login จะแสดงปุ่ม Auth-Hub และปิด password login รวมถึงไม่รับ JWT เก่าของ Somtop หากเว้นว่างจะใช้ login เดิม
- ใช้ role `admin` ได้เมื่อทั้ง Hub และบัญชี Somtop ให้ `admin`; role Hub `view` หรือ `user` ใช้สิทธิ์ `view` เท่านั้น Role อื่นปฏิเสธการเข้าถึง
- ใช้ court_code และชื่อแสดงผลจากบัญชี Somtop ผู้ใช้สิทธิ์ view ต้องมี court_code ผู้ดูแลยังแก้สิทธิ์/ศาลของบัญชี Somtop ได้ตามเดิม
- ทุก protected API เรียก `/api/sso/userinfo` เพื่อตรวจการถอนสิทธิ์/ปิดระบบ/logout กลาง เมื่อ Hub ติดต่อไม่ได้ตอบ 503 โดยไม่ให้เข้าถึงข้อมูล หน้าเปิดค้างตรวจ session เมื่อกลับมา focus และทุก 60 วินาทีขณะที่มองเห็น
- Logout เรียก `/api/sso/end-session` จึงออกจากทุกแอปใน session กลางเดียวกัน คำขอต้องมี Origin ตรงกับ APP_URL หาก Hub ใช้งานไม่ได้จะแจ้งข้อผิดพลาดให้ลองออกจากระบบใหม่
- Session ของ Somtop และรายการ PKCE เก็บใน memory ใช้ backend **หนึ่ง process/instance** ต่อ deployment อายุ session สูงสุด 8 ชั่วโมง Restart backend ต้องกด SSO ใหม่ แต่ไม่ต้องกรอกรหัสซ้ำถ้า session กลางยังอยู่ ก่อนขยายหลาย instance ต้องเปลี่ยนเป็น shared session store
- หน้าโปรไฟล์ Somtop ซ่อนช่องเปลี่ยนรหัสผ่านเมื่อใช้ SSO และ backend ปฏิเสธการเปลี่ยนรหัสผ่านส่วนตัวผ่าน API ให้จัดการรหัสผ่าน/MFA ที่ Hub

## ตรวจสอบหลังตั้งค่า

1. เปิดหน้า Somtop กด Auth-Hub ล็อกอินที่ Portal แล้วกลับ `/somtop/dashboard` โดยไม่มี code/token ใน URL
2. Reload แล้วลองใช้เมนูตามสิทธิ์และศาลของบัญชีที่จับคู่ไว้
3. ถอน role ของระบบ somtop ใน Hub แล้วเรียก API เดิม ต้องถูกปฏิเสธทันที
4. กดออกจากระบบและตรวจว่าแอปอื่นใน session กลางเดียวกันถูกตัดด้วย

ทดสอบโค้ดด้วย `node --test backend/tests/authHub.test.js backend/tests/authConcurrency.test.js backend/tests/sessionPermissions.test.js` และ `npm --prefix frontend run build` การทดสอบอัตโนมัติจำลอง Hub; ขั้นตอนข้างต้นยังต้องทำกับ Hub และฐานข้อมูลจริงของเครื่องปลายทาง
