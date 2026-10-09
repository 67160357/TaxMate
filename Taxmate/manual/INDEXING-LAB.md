# แบบฝึก Database Indexing สำหรับนิสิต

เป้าหมาย: อธิบายความสัมพันธ์ระหว่าง WHERE/ORDER BY กับลำดับคอลัมน์ใน composite index วัดประสิทธิภาพจริง และมองเห็นต้นทุนการเขียน/พื้นที่ ไม่สรุปจากเวลารันครั้งเดียว

## เริ่มทดลอง

ต้องมี Node.js 24+ เปิด Terminal ที่ root โครงการ:

```bash
npm ci
npm run lab:index
npm run lab:index -- --rows=1000000
```

ค่าเริ่มต้น 300,000 แถว เลือกได้ 10,000–2,000,000 สคริปต์สร้าง **ฐานข้อมูลสังเคราะห์แยกใหม่ทุกครั้ง** ใน `lab-output/` ไม่มีข้อมูลจริงและไม่เปิด DB ของแอป ลบไฟล์ lab เก่าเองได้เมื่อไม่ใช้ (ไม่ถูก commit)

ผลล่าสุด: `manual/indexing-results.json` (เครื่องอ่านได้) และ `manual/INDEXING-RESULTS.md` นำไปส่งรายงานได้ admin ดูผลในเว็บที่ **ทดลอง Indexing** แล้วกดโหลดผลล่าสุดได้ด้วย ต้องรันคำสั่งใน Terminal ก่อน ไม่มีปุ่มสร้างข้อมูลหลักล้านใน API

## ขั้นตอนที่สคริปต์ทำจริง

1. สร้าง receipts ของผู้ใช้จำลอง 1,000 คน บันทึก transaction เดียว ข้อมูล deterministic
2. ใช้ prepared statement และพารามิเตอร์เหมือนกันก่อน/หลัง ทำ warm-up 5 ครั้ง แล้ววัด 50 ครั้ง
3. เก็บ `EXPLAIN QUERY PLAN` และ median/p95; เวลา query ไม่รวมการสร้างข้อมูลและสร้าง index
4. สร้าง composite index และ `ANALYZE` แล้ววัดซ้ำ ตรวจผลลัพธ์เหมือนเดิมทุกแถว
5. วัด insert 5,000 แถวทั้งก่อน/หลัง (ไม่รวม commit; rollback หลังวัด) และขนาดไฟล์ฐานข้อมูล

Query ที่ทดลอง:

```sql
SELECT id, receipt_date, amount
FROM receipts
WHERE user_id = ? AND receipt_date >= ? AND receipt_date <= ?
ORDER BY receipt_date DESC, id
LIMIT 20;

CREATE INDEX idx_receipts_user_date
ON receipts(user_id, receipt_date DESC, id);

ANALYZE;
EXPLAIN QUERY PLAN
SELECT id, receipt_date, amount FROM receipts
WHERE user_id = 'u42'
  AND receipt_date >= '2025-03-01' AND receipt_date <= '2025-12-31'
ORDER BY receipt_date DESC, id LIMIT 20;
```

ก่อน: `SCAN receipts` และ sort ด้วย temporary B-tree; หลัง: `SEARCH receipts USING INDEX ...` ลำดับคอลัมน์เริ่ม user_id เพราะ query จำกัดเจ้าของด้วย equality แล้วตามด้วยช่วงวันที่และลำดับผล การค้นข้ามทุก user ด้วยวันที่อย่างเดียวไม่ได้รับประโยชน์เท่ากันจาก index นี้

## งานที่ให้นิสิตส่ง

- รัน 10,000 / 300,000 / 1,000,000 แถว เก็บสำเนาผลแต่ละรอบ เพราะผลล่าสุดจะเขียนทับรายงานเดิม
- บันทึกจำนวนแถว CPU เวอร์ชัน SQLite, query plan, median/p95, จำนวนผลลัพธ์ และขนาด DB
- อธิบายว่าค่าใดเป็นเวลาสร้างข้อมูล/สร้าง index และค่าใดเป็นเวลาค้นหา
- ทดลองสำเนา script เปลี่ยน index เป็น `(receipt_date,user_id)` หรือถอด user_id จาก WHERE แล้วเทียบแผน อย่ารัน DROP INDEX ใน DB แอปจริง
- เปลี่ยน LIMIT และเปรียบเทียบการอ่านหน้าลึกด้วย OFFSET กับแนวทาง keyset pagination
- อธิบายว่าทำไม insert หลังเพิ่ม index อาจช้าลง และเหตุใดไม่ควร index ทุกคอลัมน์
- ระบุข้อจำกัด: warmed cache, ไม่มี concurrent users, ข้อมูลกระจายตามสูตรสังเคราะห์, index build cost, ผลไม่ใช่หลักฐาน production throughput

## ดัชนีในแอปจริง

| Index | Query / ข้อบังคับ |
|---|---|
| ux_users_username | username ไม่ซ้ำ case-insensitive, check-username และ login |
| idx_users_created | รายชื่อผู้ใช้เรียงเวลา/ID |
| idx_users_role_created | กรอง role และเรียงเวลา/ID |
| idx_receipts_user_date | บิลของเจ้าของเรียงวัน และรวมยอดตามปี |
| idx_receipts_user_category_date | เจ้าของ + หมวด + เรียงวัน |
| idx_sessions_user, idx_sessions_expires | revoke เซสชัน/ลบเซสชันหมดอายุ |
| idx_reviews_owner | งานที่เจ้าของส่งตรวจ |
| idx_reviews_expert_status | รองรับค้นงานตาม expert/status; การเรียงรวมทุก status อาจต้อง sort |
| idx_audit_created | ประวัติเรียงใหม่ก่อน |

receipt_date/category/amount/verified ใน DB จริงเป็น generated columns จาก JSON ทำให้ index ตามฟิลด์ที่ใช้ query ได้โดยไม่ต้องโหลดรูปทั้งหมด ส่งรายการครั้งละสูงสุด100แถว รูป/OCR โหลดเฉพาะ detail สรุปยอดคำนวณจาก SQL aggregates ครบทุกบิล ไม่ใช่รวมเฉพาะหน้าแรก

ข้อจำกัดที่ต้องวิเคราะห์: ค้นชื่อร้านแบบ substring ใช้ `instr` จึงยังสแกนข้อมูลภายในบัญชี; OFFSET หน้าลึกมีต้นทุน; GROUP BY ยอดทั้งบัญชียังอ่านรายการ; รูปยังอยู่ใน JSON ทำให้ DB โต ไม่ใช่ระบบเก็บรูปขนาดใหญ่แบบ object storage; SQLite synchronous บน process เดียวไม่ได้ออกแบบรับงานหนักพร้อมกันหลายเครื่อง

อ้างอิงทางเทคนิค: [SQLite Query Planner](https://www.sqlite.org/queryplanner.html), [EXPLAIN QUERY PLAN](https://www.sqlite.org/eqp.html), [Generated Columns](https://www.sqlite.org/gencol.html)
