# Taxmate — เพื่อนช่วยเตรียมภาษี

เว็บภาษาไทยสำหรับถ่าย/อัปโหลดบิล อ่านข้อความ จัดประเภท ตรวจเงื่อนไขลดหย่อน และเตรียมรายงานภาษี ออกแบบให้ทำงานได้ทั้ง **GitHub Pages โดยไม่มี backend ออนไลน์** และ **local พร้อม backend + SQLite**

> นี่คือ functional prototype สำหรับทดลอง ไม่ใช่บริการยื่นภาษีจริง และไม่ใช่ระบบภาษีครบทุกกรณี เครื่องคำนวณจำกัดที่ผู้มีเงินเดือน ม.40(1) ปีภาษี 2568 และหมวดสิทธิที่ระบุด้านล่าง ใช้ข้อมูลสมมติในการสาธิต

## เปิดในเครื่อง Windows — ทางที่ง่ายที่สุด

1. ติดตั้ง **Node.js 24 LTS หรือใหม่กว่า** จาก https://nodejs.org
2. แตก ZIP ทั้งโฟลเดอร์ก่อน ห้ามรันจากภายใน ZIP
3. ดับเบิลคลิก **`run-local.bat`**
4. ครั้งแรกจะติดตั้ง dependencies ผ่านอินเทอร์เน็ต (ไม่ต้องติดตั้ง Python หรือฐานข้อมูลแยก)
5. เมื่อเห็น `Taxmate ready` เปิด **http://localhost:3000** ถ้าหน้าเปิดเร็วเกินไปให้กด Refresh
6. กด **ทดลองด้วยข้อมูลตัวอย่าง** หรือ **สมัครสมาชิก** เพื่อสร้างบัญชีของตนเอง
7. ต้องเปิดหน้าต่าง terminal ไว้ตลอดการใช้งาน กด Ctrl+C เพื่อหยุด

macOS/Linux: เปิด terminal ในโฟลเดอร์ แล้วรัน `bash run-local.sh`

รันด้วยคำสั่งเอง:

```bash
npm ci
npm run build
npm start
```

ฐานข้อมูลถูกสร้างอัตโนมัติที่ `backend/data/taxmate.sqlite` มีข้อมูลตัวอย่าง 6 บิล บัญชีใหม่เริ่มจากข้อมูลว่าง รูปแนบเก็บเป็น data URL ในฐาน SQLite ไม่มี API key หรือบริการเสียเงิน

## ขึ้น GitHub Pages — ไม่ต้องเช่า server

### วิธี A: เปิดได้จากไฟล์ที่ build มาแล้ว (แนะนำสำหรับเริ่มต้น)

1. สร้าง repository ชื่อ `taxmate` ใน GitHub เลือก Public หากใช้ GitHub Free
2. อัปโหลด **ไฟล์และโฟลเดอร์ข้างใน Taxmate** ลง root ของ repository โดยเฉพาะโฟลเดอร์ `docs` อย่าอัปโหลด ZIP ทั้งก้อน
3. ไป **Settings → Pages → Build and deployment**
4. Source เลือก **Deploy from a branch**
5. Branch เลือก **main** และโฟลเดอร์ **/docs** → Save
6. รอ GitHub สร้างเว็บ แล้วเปิด URL ที่แสดงใน Settings → Pages
7. โดยทั่วไป URL จะมีรูปแบบ `https://YOUR_USERNAME.github.io/taxmate/` ให้ใช้ URL จริงที่ GitHub แสดง

โฟลเดอร์ `docs/` มีเว็บที่ build พร้อมใช้แล้ว รวม `.nojekyll` ใช้ HashRouter จึงรีเฟรชหน้าภายใน เช่น `#/receipts` ได้บน Pages และใช้ relative asset paths จึงรองรับชื่อ repository อื่นด้วย

หลังแก้โค้ดรัน `npm run build` แล้วอัปโหลด/commit `docs/` ใหม่ วิธี A ไม่ได้ build source ให้อัตโนมัติ

### วิธี B: Build และ deploy อัตโนมัติผ่าน GitHub Actions

1. อัปโหลด source ทั้งหมด รวม **`.github/workflows/deploy.yml`** และ `package-lock.json`
2. ใน Settings → Pages เลือก Source เป็น **GitHub Actions**
3. push เข้า branch `main` หรือไป Actions → Deploy Taxmate to GitHub Pages → Run workflow
4. workflow ติดตั้ง dependencies, รัน tests, build และ deploy เฉพาะ `dist/`

เลือกใช้ A หรือ B อย่างใดอย่างหนึ่ง หากอัปโหลดผ่านเว็บแล้วโฟลเดอร์ซ่อนไม่ติด ให้ใช้ GitHub Desktop หรือ Git เพื่อ push `.github` และ `.gitignore`

```bash
git init
git add .
git commit -m "Build Taxmate local and GitHub Pages demo"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taxmate.git
git push -u origin main
```

แทน `YOUR_USERNAME` ด้วยชื่อของคุณ ไม่ต้องใส่ token ลง source โครงการนี้ยังไม่ได้ถูก push หรือเผยแพร่ไปบัญชี GitHub ของคุณ

## แต่ละโหมดต่างกันอย่างไร

| ความสามารถ | GitHub Pages / static | Local |
|---|---|---|
| หน้าเว็บ React ทุกหน้า | มี | มี |
| สมัครสมาชิก / login | จำลองในเบราว์เซอร์ | Express API + SQLite |
| เก็บบิลและรูป | IndexedDB แยกตามบัญชีจำลอง | SQLite แยกตาม user ID |
| อุปกรณ์อื่นเห็นข้อมูลเดียวกัน | ไม่ได้ | ไม่ได้โดยอัตโนมัติ |
| ยืนยันตัวตนสำหรับบริการจริง | ไม่ใช่ | local prototype; scrypt + HttpOnly session |
| OCR ไทย + อังกฤษ | ประมวลผลใน browser | ประมวลผลใน browser |
| ข้อมูลตัวอย่าง | เปิด dashboard ได้ทันที | ปุ่มทดลองที่หน้า login |
| รายงาน CSV / พิมพ์ PDF / backup JSON | มี | มี |

GitHub Pages เป็น static hosting จึงรัน Node.js, Express, SQLite server หรือ session ฝั่ง server ไม่ได้ การลงทะเบียนบน Pages เป็น demo เท่านั้น ผู้ที่เข้าถึง browser profile เดียวกันสามารถตรวจข้อมูลผ่าน developer tools ได้ ห้ามถือเป็นระบบป้องกันข้อมูลจริง

บน Pages เข้า **ออกจากระบบ** ที่มุมล่างซ้ายเพื่อไปหน้าสมัครสมาชิก/เข้าสู่ระบบ ใช้รหัสผ่านสมมติที่ไม่ซ้ำกับบัญชีจริง

## หน้าและฟีเจอร์

| เส้นทาง | หน้าที่ |
|---|---|
| `#/` | Dashboard, ยอดบิล, ค่าลดหย่อน, ภาษีประหยัดโดยประมาณ, กราฟรายเดือน, checklist |
| `#/receipts` | ค้นหา/กรองบิล เปิดรายละเอียด เพิ่ม แก้ไข ลบ และยืนยันเงื่อนไข |
| `#/deductions` | สรุปสิทธิตามหมวด เพดานรวม และรายการรอตรวจสอบ |
| `#/calculator` | เงินเดือน โบนัส ภาษีหัก ณ ที่จ่าย คำนวณแบบขั้นบันได |
| `#/reports` | สรุป ดาวน์โหลด CSV และ Print / Save as PDF |
| `#/guide` | วิธีใช้งาน ข้อจำกัด และลิงก์กรมสรรพากร |
| `#/settings` | บัญชี สำรอง/นำเข้า JSON รวมรูป และล้างข้อมูลบัญชี |
| หน้าสมาชิก | สมัคร เข้าสู่ระบบ ซ่อน/แสดงรหัสผ่าน ออกจากระบบ |

## การถ่ายบิลและ OCR

- รับ JPG, PNG และ WebP สูงสุด 4 MB/รูป มีลากวาง เลือกไฟล์ และ `capture=environment` ให้มือถือเรียกกล้องได้ตามเบราว์เซอร์
- บนคอมพิวเตอร์ปุ่มถ่ายรูปอาจเปิดตัวเลือกไฟล์ เป็นพฤติกรรมของเบราว์เซอร์
- เลือกรูป → กด **อ่านข้อมูลจากภาพ (OCR)** → ตรวจชื่อ ยอด วันที่ ประเภท → บันทึก
- ใช้ Tesseract.js 6 (`tha+eng`) จริง ไม่ใช่ผลจำลอง ครั้งแรกดาวน์โหลด worker/core/language ผ่าน CDN ต้องมีอินเทอร์เน็ต
- รูปถูกประมวลผลใน browser ไม่มีการส่งรูปให้ผู้ให้บริการ AI ภายนอก โหมด local จะส่งรูปไป backend ในเครื่องเมื่อกดบันทึก
- การเสนอหมวดเป็น keyword rules ใน `shared/tax.mjs` ไม่ใช่โมเดลรับรองสิทธิ เอกสารไทยคุณภาพต่ำ/ลายมืออาจอ่านผิด
- หาก OCR ดาวน์โหลดไม่ได้หรืออ่านผิด ยังแก้ไข/กรอกเองและเก็บภาพได้
- ไม่รองรับ HEIC, PDF, OCR หลายไฟล์พร้อมกัน และการตรวจลายเซ็นเอกสารดิจิทัล

## ขอบเขตการคำนวณ

ใช้เฉพาะปีภาษี **2568 (2025)** และรายได้เงินเดือน ม.40(1) บิลวันที่นอกปีนี้จะไม่รับเข้าระบบ

- ค่าใช้จ่ายเงินเดือน 50% ไม่เกิน 100,000 บาท และค่าลดหย่อนส่วนตัว 60,000 บาท
- ประกันชีวิตตนเองไม่เกิน 100,000 บาท; ประกันสุขภาพตนเองไม่เกิน 25,000 บาท และเมื่อรวมกันไม่เกิน 100,000 บาท
- ดอกเบี้ยบ้านตามสิทธิ ไม่เกิน 100,000 บาท (ไม่รวมเงินต้น และผู้ใช้ต้องจัดสรรสิทธิกู้ร่วมเอง)
- บริจาคทั่วไปตามจริง ไม่เกิน 10% ของฐานหลังค่าใช้จ่ายและค่าลดหย่อนที่ระบบรองรับ
- ทุกบิลที่ใช้สิทธิต้องให้ผู้ใช้ยืนยันเงื่อนไขก่อน รายการ pending ไม่ถูกนับ
- ภาษีคิดแบบขั้นบันไดถึง 35%; แสดงภาษีทั้งปี หัก ณ ที่จ่าย และยอดชำระเพิ่ม/ขอคืนประมาณการ
- สิทธิพิเศษ 2 เท่า, Easy E-Receipt, Thai ESG, RMF, กองทุนอื่น, ประกันสังคม, คู่สมรส/บุตร/บิดามารดา, รายได้ธุรกิจ และต่างประเทศ **ยังไม่รองรับการคำนวณ**
- บิลซื้อของ/บริจาคพิเศษเก็บได้ แต่ไม่ให้สิทธิอัตโนมัติ ไม่เชื่อม e-Donation หรือกรมสรรพากร และไม่ยื่นแบบแทนผู้ใช้
- ห้ามนำผลไปตีความว่าเป็นการยืนยันสิทธิหรือจำนวนภาษีสุดท้าย ต้องตรวจข้อมูลและสิทธิที่ยังไม่รองรับก่อนยื่นจริง

หลักเกณฑ์อ้างอิง:
- https://www.rd.go.th/62777.html — หลักเกณฑ์ค่าลดหย่อน
- https://www.rd.go.th/59670.html — อัตราภาษีตั้งแต่ 2560
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages — ขอบเขต GitHub Pages

กฎในโค้ดเป็น baseline สำหรับ demo ปี 2568 ไม่ได้อ้างว่ารองรับทุกประกาศของปี 2568 หรือปี 2569 เอกสารอ้างอิงบางหน้าเผยแพร่ก่อนปีภาษีดังกล่าว

## โครงสร้างสำหรับพัฒนาต่อ

```text
frontend/src/main.jsx    React pages + components + HashRouter
frontend/src/style.css   Design tokens, layout, responsive, print
frontend/src/data.js     Browser / local API adapter
frontend/public/        Static favicon
backend/server.mjs      Express API, auth, SQLite schema and seed
backend/data/           Runtime database (gitignored)
shared/tax.mjs          Rules, validation, OCR parser, demo data
scripts/build-pages.mjs Copy static build to docs/
tests/                  Tax calculations + API integration tests
manual/                 Architecture, API, test report
.github/workflows/      GitHub Pages workflow
dist/                   Prebuilt frontend for local server
docs/                   Prebuilt frontend for GitHub Pages
run-local.bat           Windows starter
run-local.sh            macOS/Linux starter
```

Framework: React 19 + Vite 6 + React Router 7; backend Express 5; SQLite ผ่าน `node:sqlite` ใน Node 24; icon Lucide; OCR Tesseract.js

UI ภาษาไทย มี sidebar, mobile drawer, native dialog, focus styles, semantic labels, error/empty/loading states และยืนยันก่อนลบ มี Google Fonts และ fallback Tahoma เมื่อออฟไลน์

## Developer commands

```bash
npm ci
npm test
npm run build
npm start
```

แก้ UI แบบ HMR: เปิด `npm start` สำหรับ API ใน terminal แรก แล้ว `npm run dev` อีก terminal หนึ่ง เปิด http://localhost:4173 (proxy `/api` ไป port 3000)

**ถ้าแก้ source ต้อง `npm run build` ใหม่** ก่อนเปิด local production หรืออัปโหลด docs เพราะไฟล์ run-local จะใช้ dist ที่มีแล้ว

พอร์ตอื่น: ตั้ง `PORT` ก่อน `npm start`; กำหนดที่เก็บ DB ผ่าน `TAXMATE_DB` ได้ ค่าเริ่มต้น backend bind `127.0.0.1` เพื่อใช้งานเฉพาะเครื่อง

## การทดสอบและข้อจำกัดก่อนเปิดบริการจริง

ดู `manual/TEST-REPORT.md` และ `manual/ARCHITECTURE.md` รวมเงื่อนไข security ของสองโหมด

Local ใช้ scrypt + random salt, session token แบบสุ่มเก็บ hash, HttpOnly/SameSite cookie, origin checks, login rate limit และ parameterized SQLite แยกเจ้าของข้อมูล แต่ยังไม่มี email verification, password reset, MFA, cloud sync, production hardening, automated tax-law updates หรือ backup encryption

ไม่ควรนำ backend local ไป expose สาธารณะโดยตรง หากจะเปิดเป็นบริการจริงต้องเพิ่มระบบ production และตรวจหลักเกณฑ์ภาษีโดยผู้เชี่ยวชาญ ส่วน GitHub Pages เปิดให้ทดลองข้อมูลสมมติได้ตามโครงสร้างนี้

License: MIT สำหรับโค้ดของโครงการ Dependencies ใช้ license ของแต่ละแพ็กเกจ
