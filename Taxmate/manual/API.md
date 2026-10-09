# Taxmate v2 — REST API และสิทธิ์

Local base URL: `http://localhost:3000/api` รองรับ endpoint ตามโจทย์ที่ root ด้วย เช่น `/register` และ `/api/register` ทำงานเหมือนกัน ทุก request ที่แก้ข้อมูลต้องใช้ `Content-Type: application/json` บัญชีใช้ cookie `taxmate_session` (HttpOnly, SameSite=Strict, อายุ 24 ชั่วโมง) ไม่ส่ง token ใน JSON

## Authentication และ User Management

| Method | Path (root หรือ /api) | สิทธิ์ | Request / หมายเหตุ |
|---|---|---|---|
| POST | /register | ไม่ต้องล็อกอิน | name, username, email, password; สร้าง role=user เท่านั้น; 201 + cookie |
| POST | /login | ไม่ต้องล็อกอิน | identifier (username หรือ email), password; รองรับฟิลด์ username/email ด้วย |
| POST | /logout | ทุกคน | {} ; ลบเซสชันปัจจุบันและ cookie |
| POST | /change-password | บัญชีส่วนตัว | currentPassword, newPassword; ออกจากทุกเซสชัน แล้ว login ใหม่ |
| GET | /me | ล็อกอิน | ข้อมูลบัญชีตัวเอง ไม่ส่ง hash/salt |
| GET | /users/{id} | เจ้าของหรือ admin | ข้อมูลบัญชี ไม่รวมรายได้หรือบิล |
| GET | /users | admin | page=1&pageSize=20&q=ali&role=user; q เป็น prefix username |
| PUT | /users/{id} | เจ้าของหรือ admin | name, username, email; role/status แก้ได้เฉพาะ admin |
| DELETE | /users/{id} | admin | ลบบัญชีและข้อมูลเกี่ยวข้อง ไม่อนุญาตลบตนเอง/demo |
| GET | /check-username/{name} | ไม่ต้องล็อกอิน | {username, available}; unique index ยืนยันซ้ำตอนบันทึก |

username ไม่สนตัวพิมพ์เล็กใหญ่: 3–32 ตัว เริ่ม a-z ตามด้วย a-z/0-9/_; รหัสผ่าน 8–128 ตัว ใช้ scrypt + salt สุ่ม ไม่เก็บรหัสผ่านดิบ สมัครแล้วได้ cookie ทันที (ไม่มีอีเมลยืนยัน)

ตัวอย่างสมัคร:

```json
{"name":"Student A","username":"student_a","email":"student@example.test","password":"replace-with-your-own-password"}
```

ตัวอย่างผล `/me`:

```json
{"id":"generated-uuid","name":"Student A","username":"student_a","email":"student@example.test","role":"user","status":"active","createdAt":1790000000000,"demo":false}
```

ตัวอย่าง pagination: `{ "items": [...], "total": 125, "page": 1, "pageSize": 20, "pages": 7 }` เฉพาะ users มี pages; รายการอื่นใช้ `ceil(total/pageSize)` ขนาดหน้า 1–100; page 1–100000; เกินขอบเขตตอบ 400

สถานะ: 400 validation, 401 ไม่ได้ล็อกอิน/เซสชันหมด, 403 ไม่มีสิทธิ์, 404 ไม่พบข้อมูลที่มีสิทธิ์, 409 ซ้ำ/ขัดกับข้อจำกัด admin, 413 ใหญ่เกิน, 415 ไม่ใช่ JSON, 429 rate limit

## RBAC

| การทำงาน | user | expert | admin |
|---|---|---|---|
| จัดการบัญชี รายได้ และบิลตัวเอง | ได้ | ได้ | ได้ |
| อ่าน/แก้บัญชีคนอื่น | ไม่ได้ | ไม่ได้ | ได้ |
| เปลี่ยน role/status, ลบผู้ใช้ | ไม่ได้ | ไม่ได้ | ได้ |
| อ่านบิลคนอื่นโดยตรง | ไม่ได้ | ไม่ได้ | ไม่ได้ |
| อ่านบิลที่เจ้าของส่งให้ตรวจ | ไม่ได้ | เฉพาะที่มอบหมาย | ไม่ได้ |
| ให้ผลตรวจบิลที่มอบหมาย | ไม่ได้ | ได้ | ไม่ได้ |
| ส่งบิลตัวเองให้ผู้เชี่ยวชาญ/ถอนสิทธิ์ | ได้ | ได้ (ผู้เชี่ยวชาญคนอื่น) | ได้ |
| ดู audit และข้อมูล index | ไม่ได้ | ไม่ได้ | ได้ |

ตรวจสิทธิ์ที่ server ทุกครั้ง ไม่ใช้การซ่อนปุ่มเป็นมาตรการรักษาความปลอดภัย การเปลี่ยน role/status ยกเลิกเซสชันทั้งหมดของบัญชีนั้น การระงับ/ลดบทบาท expert ลบการมอบหมายเดิมด้วย ต้องเหลือ active admin อย่างน้อยหนึ่งคน

การแยกข้อมูลนี้เป็นสิทธิ์ระดับแอป ผู้ที่เข้าถึงไฟล์ SQLite/เครื่อง local ในระดับระบบปฏิบัติการยังอ่านข้อมูลได้

## สร้าง admin และทดลอง 3 บทบาท

1. `npm ci` แล้ว `npm run create-admin` (Windows ใช้ `create-admin.bat`) กรอกชื่อ/email/username/password ผ่าน Terminal รหัสผ่านไม่แสดงบนจอ สร้างได้เมื่อยังไม่มี active admin เท่านั้น
2. `npm start` เปิดเว็บแล้ว login ด้วยบัญชี admin
3. สมัครบัญชีสำหรับนิสิตและผู้เชี่ยวชาญผ่านหน้าสมัคร ทั้งคู่เริ่ม role=user
4. กลับเข้า admin → จัดการผู้ใช้ → แก้ไขบัญชีผู้เชี่ยวชาญ → expert → บันทึก
5. เข้าบัญชีนิสิต เพิ่มบิล → เปิดรายละเอียด → เลือก expert → ยืนยันส่งบิล
6. เข้าบัญชี expert → ปรึกษาผู้เชี่ยวชาญ → งานที่ได้รับมอบหมาย → ให้ผลพร้อมเหตุผล
7. กลับบัญชีนิสิต → ดูผล/ถอนสิทธิ์ ทดสอบว่า expert เปิดงานเดิมไม่ได้หลังถอนสิทธิ์

ไม่มี username/password admin สำเร็จรูปฝังในโครงการ การทดสอบใช้บัญชีชั่วคราวและลบทิ้งตอนจบ

## Endpoint เพิ่มเติม (ใช้ /api เท่านั้น)

| Method / Path | สิทธิ์/การทำงาน |
|---|---|
| GET /health, GET /tax-rules | public; metadata และ ruleset พร้อมแหล่งทางการ |
| POST /auth/demo | เข้าบัญชีข้อมูลตัวอย่างส่วนกลางในเครื่อง |
| GET /data | เจ้าของ; profile, summary, stats, monthly, taxRows และ 100 บิลล่าสุด ไม่มีรูป/OCR |
| GET /summary | ผลรวมจากบิลทั้งหมดของเจ้าของ |
| GET /receipts | page/pageSize, category, status, q ค้นชื่อร้าน; metadata ไม่แนบรูป |
| GET /receipts/{id} | รายละเอียดเต็มรวมรูป เฉพาะเจ้าของ |
| POST /receipts | สร้างบิล; merchant, date (2025), amount, category, verified, notes, image, ocrText |
| PUT, DELETE /receipts/{id} | เจ้าของ; แก้ไขแล้วรีเซ็ตผล expert เป็น pending |
| PUT /profile | salary, bonus, withheld, scopeConfirmed |
| GET /experts | รายชื่อ id/name/username ของ active experts แบบ pagination |
| POST /receipts/{id}/review-request | เจ้าของส่ง `{expertId}` ให้คนเดียวต่อบิล เปลี่ยนผู้รับได้ |
| DELETE /receipts/{id}/review-request | ถอนสิทธิ์ ลบผลตรวจ |
| GET /reviews?scope=owned | งานที่ตัวเองส่งตรวจ แบบ pagination |
| GET /reviews?scope=assigned | expert เท่านั้น งานที่ตนได้รับ |
| GET /reviews/{id} | เจ้าของหรือ expert ผู้รับ ดูบิลและผลตรวจ |
| PUT /reviews/{id} | expert ผู้รับ; status=eligible/ineligible/needs-info และ comment 1–2000 ตัว |
| GET /admin/indexes | admin; index SQL จริง, query plan และผล lab ล่าสุด |
| GET /admin/audit | admin; ประวัติ action ไม่มีรหัสผ่าน/เนื้อหาบิล แบบ pagination |
| GET /export | CSV ของบิลทั้งหมด ไม่รวมรูป |
| GET /backup | JSON ของบิลทั้งหมดรวมรูป |
| POST /import | profile + receipts ≤1000; validate ก่อน transaction แทนข้อมูลเดิม |
| DELETE /data | ล้างบิลและรายได้ตนเอง ยังเก็บบัญชี |

`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/change-password` เป็น alias รองรับ client เวอร์ชันเดิม (การสมัครใหม่ต้องมี username)

## ทดลองผ่าน curl / Postman

Import `manual/Taxmate.postman_collection.json` ตั้ง `baseUrl` เป็น `http://localhost:3000` และใช้ cookie jar ของ Postman หรือ curl `-b/-c`

```bash
curl -c cookies.txt -H "Content-Type: application/json" -d '{"identifier":"YOUR_USERNAME","password":"YOUR_PASSWORD"}' http://localhost:3000/login
curl -b cookies.txt http://localhost:3000/me
curl -b cookies.txt "http://localhost:3000/users?page=1&pageSize=20"
```

ไฟล์ cookies.txt เป็นความลับในเครื่อง ไม่ commit ขึ้น GitHub; auth/availability จำกัดรวม 30 requests/IP/นาทีใน local demo; pagination แบบ OFFSET ยังมีต้นทุนเมื่อเปิดหน้าลึกมาก ดู INDEXING-LAB.md
