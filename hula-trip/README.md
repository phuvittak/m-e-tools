# 🌺 ระบบลงทะเบียนทริป Hula Hula

โปรเจกต์นี้ **แยกอิสระจากเว็บร้าน M.E. Tools** ทำสายข้อมูลครบวง:
**Excel → เว็บ → Excel (ของสมาชิกแต่ละคน)**

## ✅ ใช้งานแบบ "เว็บจริง" (แนะนำ — ง่ายสุด)

โฟลเดอร์ **`web/`** คือเว็บไซต์เต็มที่ทำงานในเบราว์เซอร์ล้วน ไม่ต้องมีเซิร์ฟเวอร์/ไม่ต้องตั้ง Apps Script

- **เปิดทันที:** ดับเบิลคลิก `web/index.html` (หรือเปิดในเบราว์เซอร์มือถือก็ได้)
- **URL จริง (หลัง merge เข้า `main`):** `https://phuvittak.github.io/m-e-tools/hula/`
  (deploy อัตโนมัติด้วย GitHub Actions เป็นเว็บแยกคนละ path กับร้าน metools)

**ความสามารถ**
- 🔍 เข้าระบบด้วยเลขทะเบียน → ดูข้อมูลสมาชิก, ประวัติลงทุน, สิทธิ์แพ็กเกจทริป
- 📝 ฟอร์มลงทะเบียนทริป (เจ้าของรหัส + ผู้ติดตามตามโควตา + ประเภทอาหาร + ของรางวัลโทรศัพท์)
- 📥 **นำเข้า Excel** (ปุ่ม "ผู้ดูแล") — อัปโหลด `.xlsx` ที่มีชีต `Members` / `Investments`
- 📤 **ส่งออก Excel/PDF** — ของสมาชิกรายคน, ฐานข้อมูลทั้งระบบ, และรายการลงทะเบียน
- 💾 เก็บข้อมูลใน `localStorage` ของเบราว์เซอร์ + มีข้อมูลตัวอย่าง (เลขทะเบียน `1001`) ให้ลองทันที

> ใช้ไลบรารี [SheetJS](https://sheetjs.com) (โหลดจาก CDN) สำหรับอ่าน/เขียนไฟล์ Excel ในเบราว์เซอร์

---

## (ทางเลือก) เวอร์ชัน Google Apps Script

ถ้าต้องการให้ข้อมูลอยู่บน **Google Sheets** จริง (หลายคนแก้พร้อมกัน, ข้อมูลไม่หายตามเครื่อง)
ยังมีเวอร์ชัน Apps Script ให้ — เป็น **Google Apps Script Web App**
ที่ทำสายข้อมูล: **Excel → Google Sheets → เว็บ → Excel (ของสมาชิกแต่ละคน)**

```
  Excel (.xlsx)        Google Sheets            เว็บ (มือถือ)            Excel / PDF
  ┌──────────┐  นำเข้า  ┌──────────────┐  ดึงข้อมูล  ┌──────────────┐  ส่งออก  ┌──────────────┐
  │ รายชื่อ    │ ──────▶ │ Members      │ ───────▶  │ ข้อมูลสมาชิก   │ ──────▶ │ ไฟล์เฉพาะของ  │
  │ ยอดโอน    │         │ Investments  │           │ ประวัติลงทุน   │         │ สมาชิกคนนั้น   │
  └──────────┘         │ Registrations│ ◀───────  │ ฟอร์มลงทะเบียน │         └──────────────┘
                       └──────────────┘  เขียนกลับ  └──────────────┘
```

## ไฟล์ในโปรเจกต์

| ไฟล์ | หน้าที่ |
|------|---------|
| `Code.gs` | โค้ดฝั่งเซิร์ฟเวอร์: อ่าน/เขียนชีต, นำเข้า Excel, ส่งออก Excel/PDF |
| `Index.html` | หน้าเว็บ (เข้าระบบด้วยเลขทะเบียน, การ์ดสมาชิก, ประวัติลงทุน, ฟอร์มลงทะเบียนทริป) |
| `appsscript.json` | manifest + สิทธิ์ (scopes) + เปิดเป็น Web App |
| `templates/members.csv` | เทมเพลตคอลัมน์ชีต Members (เปิด/บันทึกเป็น .xlsx ได้) |
| `templates/investments.csv` | เทมเพลตคอลัมน์ชีต Investments |

## วิธีติดตั้ง (ครั้งเดียว)

### ทางที่ 1 — วางโค้ดเอง (ง่ายสุด)
1. สร้าง **Google Sheet** ใหม่ (นี่คือฐานข้อมูล) → จด`Spreadsheet ID` จาก URL
2. เมนู **ส่วนขยาย → Apps Script**
3. ลบไฟล์ตัวอย่าง แล้ววางเนื้อหา `Code.gs` และสร้างไฟล์ HTML ชื่อ `Index` วางเนื้อหา `Index.html`
4. คัดลอกเนื้อหา `appsscript.json` ทับ (กดไอคอน ⚙️ → ติ๊ก "แสดงไฟล์ manifest")
5. เปิด **Advanced Drive Service**: เมนู Services (＋) → เพิ่ม **Drive API**
6. (ไม่บังคับ) ถ้าสคริปต์ไม่ได้ผูกกับชีต ให้ตั้ง Script Property ชื่อ
   `HULA_SPREADSHEET_ID` = ค่า Spreadsheet ID
7. รันฟังก์ชัน `seedSampleData` หนึ่งครั้งเพื่อสร้างชีตและข้อมูลทดสอบ (เลขทะเบียน `1001`)
8. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (หรือ Anyone with Google account)
9. คัดลอก URL `…/exec` → เปิดในมือถือได้เลย

### ทางที่ 2 — ใช้ clasp (ดีพลอยจากเครื่อง)
```bash
npm i -g @google/clasp
clasp login
cd hula-trip
clasp create --type sheets --title "Hula Hula Trip"   # หรือ clasp clone <scriptId>
clasp push
clasp deploy
```

## วิธีนำเข้าข้อมูลจาก Excel

ฟอร์มหน้าเว็บยังไม่มีปุ่มแอดมินอัปโหลด (เพื่อความปลอดภัย) — เลือกได้ 2 วิธี:

- **วิธีเร็ว:** ใน Google Sheets ใช้ **ไฟล์ → นำเข้า → อัปโหลด** ไฟล์ Excel ของคุณ
  โดยให้แท็บชื่อ `Members` และ `Investments` ตรงกับเทมเพลตใน `templates/`
- **วิธีผ่านโค้ด:** เรียก `importExcel(base64, filename)` (รับไฟล์ .xlsx เป็น base64
  แล้วแทนที่ข้อมูลในชีต `Members` / `Investments` ให้อัตโนมัติ) — ต่อปุ่มอัปโหลดเองได้ภายหลัง

## โครงสร้างชีต

**Members**

| RegCode | Name | IDCard | Phone | Bank |
|---------|------|--------|-------|------|
| 1001 | นางสาวกนกทิพย์ ปฐมกนกพงศ์ | 3-7301-00471-39-9 | 098-592-4564 | ไทยพาณิชย์ … 854-2-46671-0 |

**Investments**

| RegCode | Date | Time | Amount |
|---------|------|------|--------|
| 1001 | 2026-05-10 | 11:39 | 1000 |

**Registrations** (เว็บเขียนกลับให้เอง)

`Timestamp · RegCode · OwnerName · OwnerFood · PhonePrize · F1Name · F1Food … F4Name · F4Food`

## ตรรกะสิทธิ์แพ็กเกจทริป (ปรับได้ในตัวแปร `TIERS` ของ `Code.gs`)

| ยอดรวมลงทุน (บาท) | ห้องพัก | ผู้ติดตาม |
|---|---|---|
| ≥ 30,000 | Presidential suite | 6 |
| ≥ 20,000 | Family suite (Premium) | 5 |
| ≥ 15,000 | **Family suite** | **4** |
| ≥ 10,000 | Deluxe room | 3 |
| ≥ 5,000 | Superior room | 2 |
| ≥ 3,000 | Standard room | 1 |
| ≥ 1,000 | Standard room | 0 |

> ตัวอย่างจากภาพหน้าจอ: ยอดรวม **19,000 บาท → Family suite, ผู้ติดตาม 4 ท่าน** ✓

## ฟังก์ชันหลักใน `Code.gs`

| ฟังก์ชัน | หน้าที่ |
|----------|---------|
| `getMemberData(code)` | อ่านข้อมูลสมาชิก + รวมยอด + คำนวณสิทธิ์ทริป (Sheets → เว็บ) |
| `submitRegistration(payload)` | บันทึกฟอร์มลงทะเบียนกลับเข้าชีต `Registrations` |
| `importExcel(base64, name)` | นำเข้า Excel ทับชีต Members/Investments |
| `exportMemberExcel(code)` | สร้าง .xlsx เฉพาะข้อมูลสมาชิกคนนั้น |
| `exportMemberPdf(code)` | สร้าง .pdf เฉพาะข้อมูลสมาชิกคนนั้น |
| `getSpreadsheetUrl()` | ลิงก์เปิด Google Sheet |
| `seedSampleData()` | สร้างชีต + ข้อมูลตัวอย่าง (รันครั้งเดียว) |
