# M.E. Tools

🌐 **เว็บไซต์จริง (Live):** https://phuvittak.github.io/m-e-tools/
(deploy อัตโนมัติด้วย GitHub Actions ทุกครั้งที่ push ขึ้น `main`)

ร้านเช่า–ซื้อเครื่องมือช่าง DEWALT & แบรนด์โปร ที่แยกท่ารั่ว เชียงใหม่
รวมเว็บไซต์หน้าร้านสำหรับลูกค้า + ระบบหลังร้านสำหรับพนักงาน และเครื่องมือบรรทัดคำสั่งส่วนตัว

## เว็บไซต์ร้านค้า (`webapp/`)

เว็บไซต์ทำงานได้เต็มรูปแบบโดยไม่ต้องมีเซิร์ฟเวอร์ — เก็บข้อมูลด้วย `localStorage`
ของเบราว์เซอร์ ทุกปุ่มกดใช้งานได้จริง (ซื้อ/เช่า/ตัดสต็อก/บันทึกคำสั่งซื้อ)

### หน้าสำหรับลูกค้า
| หน้า | ไฟล์ | ทำอะไรได้ |
|------|------|-----------|
| หน้าแรก | `webapp/index.html` | ค้นหา ดูหมวดหมู่ สินค้าแนะนำ |
| สินค้า | `webapp/shop.html` | กรองตามหมวด/แบรนด์/เช่า-ซื้อ ค้นหา เรียงราคา |
| รายละเอียด | `webapp/product.html` | เลือกซื้อสินค้าหรือเช่าสินค้ารายวัน ใส่ตะกร้า |
| ตะกร้า | `webapp/cart.html` | แก้จำนวน เลือกจัดส่ง/รับเอง กรอกที่อยู่ (จังหวัด→อำเภอ→ตำบล→ไปรษณีย์) คิดค่าส่ง+มัดจำ จ่ายผ่าน QR |
| ติดตามคำสั่งซื้อ | `webapp/orders.html` | ดูสถานะ: ชำระแล้ว · รอรับสินค้า → ได้รับสินค้าแล้ว |
| เข้าสู่ระบบ / สมัครสมาชิก | `webapp/login.html`, `register.html` | บัญชีพนักงาน → เข้าหลังร้าน · บัญชีลูกค้า → หน้าเว็บปกติ |

### หน้าสำหรับพนักงาน (`webapp/admin/`)
เข้าผ่านหน้า **เข้าสู่ระบบ** ด้วยบัญชีพนักงาน — ทดลอง: `staff@metools.co.th` / `metools123`

| หน้า | ไฟล์ | ทำอะไรได้ |
|------|------|-----------|
| แดชบอร์ด | `webapp/admin/dashboard.html` | รายได้ ต้นทุน กำไร มูลค่าสต็อก กราฟเส้น 7 วัน |
| คลัง/สต็อก | `webapp/admin/inventory.html` | เพิ่ม/แก้ไข/ลบสินค้า อัปโหลดรูปสินค้า จำนวนคงเหลือ ที่จัดเก็บ ต้นทุน-ราคา |
| คำสั่งซื้อ | `webapp/admin/orders.html` | ค้นหาลูกค้า เปลี่ยนสถานะ ตั้งค่าค่าจัดส่งรายจังหวัด |
| ตั้งค่าเว็บไซต์ | `webapp/admin/settings.html` | แก้ Hero, แบรนด์, Footer/ติดต่อ/โซเชียล, QR ชำระเงิน, FAQ — หน้าร้านอัปเดตทันที |

### วิธีเปิดดู
เปิดไฟล์ `webapp/index.html` ด้วยเบราว์เซอร์ได้เลย หรือรันเซิร์ฟเวอร์ทดสอบ:

```powershell
powershell -ExecutionPolicy Bypass -File .claude\serve.ps1
# จากนั้นเปิด http://localhost:8080/
```

> ปุ่ม **"รีเซ็ตข้อมูลตัวอย่าง"** ในหน้าหลังร้าน ใช้ล้างข้อมูลกลับเป็นค่าตั้งต้นได้ทุกเมื่อ

## ติดตั้งเป็นแอป (PWA — Android & iOS)

เว็บนี้เป็น **PWA** ติดตั้งลงหน้าจอมือถือได้ ชื่อแอปคือ **M.E.Tools**

- **Android (Chrome):** เปิดเว็บ → เมนู ⋮ → "เพิ่มลงในหน้าจอหลัก / ติดตั้งแอป"
- **iOS (Safari):** เปิดเว็บ → ปุ่มแชร์ → "เพิ่มลงในหน้าจอโฮม"

ทำงานออฟไลน์ได้บางส่วน (service worker `webapp/sw.js`) และพร้อมต่อยอดเป็นแอปจริง
ด้วย **PWABuilder / Capacitor / TWA** (ใช้ `webapp/assets/icon.svg` สร้างไอคอนทุกขนาด)

## โดเมนของตัวเอง (เช่น metools.co.th)

URL ปัจจุบันคือ `phuvittak.github.io/m-e-tools`. ถ้าต้องการชื่อแบบ `metools.co.th`:
1. ซื้อโดเมน (เช่น `.co.th` / `.com`) จากผู้ให้บริการโดเมน
2. ตั้งค่า DNS ของโดเมน: apex → A records `185.199.108–111.153` (และ AAAA), หรือ `www` → CNAME `phuvittak.github.io`
3. GitHub → repo Settings → Pages → **Custom domain** ใส่โดเมน แล้วรอออก HTTPS

## แชทออนไลน์จริง (ข้ามเครื่อง · เรียลไทม์)

แชทลูกค้า–ร้าน ทำงาน **ข้ามอุปกรณ์แบบเรียลไทม์** ได้เมื่อต่อ **Firebase Firestore** (ฟรี):

1. สร้างโปรเจกต์ที่ https://console.firebase.google.com → Add project
2. เปิด **Firestore Database** (Build → Firestore Database → Create) เลือกโหมดทดสอบ
3. Project settings → Your apps → Web (`</>`) → คัดลอกก้อน `firebaseConfig` (JSON)
4. นำไปวางในเว็บ: **ระบบหลังร้าน → ตั้งค่าเว็บไซต์ → ความปลอดภัย & เชื่อมต่อบัญชี → Firebase Config** แล้วบันทึก
5. เพิ่ม domain ของเว็บใน Firebase → Authentication/Hosting authorized domains (ถ้าจำเป็น)

จากนั้นลูกค้าทุกเครื่องกับเจ้าของร้านจะเห็นข้อความกันแบบเรียลไทม์ทันที
(ถ้าไม่ใส่ Firebase แชทจะทำงานแบบเฉพาะเครื่องเหมือนเดิม)

> **กฎความปลอดภัย Firestore (เริ่มต้น):** โหมดทดสอบเปิดให้อ่าน/เขียนได้ชั่วคราว —
> ก่อนใช้จริงควรตั้งกฎจำกัดสิทธิ์ คอลเลกชัน `chats` ให้เหมาะสม

## บอท LINE ตอบอัตโนมัติ (`api/line-webhook.js`)

ระบบตอบ LINE อัตโนมัติทำงานบน **Vercel Edge Function** — ไม่ต้องมีเซิร์ฟเวอร์แยก
ตอนนี้ตอบได้: ทักทาย · เวลาเปิด-ปิด · ที่อยู่ · เบอร์โทร · ลิงก์สินค้า · ขอคุยกับแอดมิน

### ตั้งค่าครั้งแรก (ทำครั้งเดียว)

**1) สร้าง Messaging API channel ที่ LINE Developers Console**
- เข้า https://developers.line.biz/console/ → เลือก/สร้าง Provider → **Create a Messaging API channel**
- กรอกชื่อ + รูป + คำอธิบาย → สร้างเสร็จจะได้ channel ใหม่
- ในหน้า channel:
  - แท็บ **Basic settings** → คัดลอก **Channel secret**
  - แท็บ **Messaging API** → กดปุ่ม **Issue** ใต้ "Channel access token (long-lived)" → คัดลอก token

**2) ใส่ค่าใน Vercel**
- ไปที่ https://vercel.com → โปรเจกต์ของคุณ → **Settings → Environment Variables** → เพิ่ม 2 ตัว:
  - `LINE_CHANNEL_SECRET` = (channel secret จากข้อ 1)
  - `LINE_CHANNEL_ACCESS_TOKEN` = (long-lived token จากข้อ 1)
- กด **Save** แล้ว **Redeploy** (Deployments → คลิกล่าสุด → ⋯ → Redeploy)

**3) เชื่อม Webhook URL กลับเข้า LINE**
- กลับไปที่ channel ใน LINE Console → แท็บ **Messaging API**
- ช่อง **Webhook URL** ใส่: `https://<โดเมน-vercel-ของคุณ>/api/line-webhook`
- กด **Verify** — ถ้าขึ้น Success คือใช้ได้
- เปิดสวิตช์ **Use webhook**
- เลื่อนลงไปหา **Auto-reply messages / Greeting messages** → กด **Edit** → ปิดทั้งสองอันใน LINE Official Account Manager (ไม่งั้นจะตอบทับกัน)

**4) ทดสอบ**
- สแกน QR ของ Official Account จากแท็บ Messaging API → เพิ่มเพื่อน → ทักไปคำว่า "เวลาเปิด"
- ถ้าไม่ตอบ ดู log ที่ Vercel → โปรเจกต์ → **Logs** กรอง `/api/line-webhook`

### แก้คำตอบ
- ข้อมูลร้าน (เวลา/ที่อยู่/เบอร์) แก้ที่ตัวแปร `SHOP` ในไฟล์ `api/line-webhook.js`
- เพิ่มคีย์เวิร์ดใหม่ในฟังก์ชัน `buildReply()` ใต้คอมเมนต์ "ตัวจัดการคำตอบ"

### 📦 ให้บอท LINE ตอบราคา/สเป็ก/สต๊อกสินค้า (Phase 2)

บอทตอบเรื่องสินค้าได้ — ลูกค้าพิมพ์ชื่อหรือรหัสสินค้า เช่น "สว่าน DCD805" บอทจะตอบราคา สเป็ก คงเหลือ พร้อมลิงก์หน้าสินค้า

**ตั้งค่าครั้งแรก (ทำครั้งเดียว)**

1) อัปเดต Firestore Rules ใน Firebase Console:
   - เปิด https://console.firebase.google.com → โปรเจกต์ `metools-724dc` → **Firestore Database → Rules**
   - คัดลอกเนื้อหาจากไฟล์ `firestore.rules` ในโปรเจกต์ทั้งหมด → วาง → **Publish**
   - (จะเพิ่มกฎใหม่ให้ `products/*` อ่านสาธารณะ เขียนได้เฉพาะผู้ที่ผ่านเว็บ)

**ใช้งาน (ทุกครั้งที่แก้สินค้า)**

1) เข้าระบบหลังร้าน → **คลัง / สต็อก**
2) แก้สินค้า/ราคา/สต๊อกตามปกติ
3) กดปุ่ม **⤴ ซิงค์ไปบอท LINE** (มุมขวาบน) → รอ 2-3 วินาที จะขึ้น "ซิงค์สินค้า N รายการไปบอท LINE แล้ว ✓"
4) บอทจะใช้ข้อมูลใหม่ภายใน 5 นาที (cache TTL)

> ลูกค้าพิมพ์ใน LINE ได้เลย เช่น "ราคาสว่าน" "DCD805" "เลื่อยวงเดือน" — บอทจะค้นหาและตอบกลับเอง

> **เร็ว ๆ นี้:** Phase 3 จะแจ้งเตือนแอดมินเมื่อมีออเดอร์ใหม่

## เครื่องมือบรรทัดคำสั่ง (`tools/`)

| Tool | Description |
|------|-------------|
| `tools/Get-WordCount.ps1` | Counts the words in a text file. |

```powershell
.\tools\Get-WordCount.ps1 -Path notes.txt
```

## Status

This repository is a work in progress — more tools will be added over time.

## License

MIT
