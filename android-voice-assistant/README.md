# ผู้ช่วยเสียง — Android Voice Assistant (ไทย/English)

แอป Android ที่ฟัง **คำปลุก** ("ผู้ช่วย" / "assistant") ต่อเนื่องผ่าน foreground
service แล้วทำตามคำสั่งภาษาไทยหรืออังกฤษ เช่น เปิด YouTube, ค้นหา Google,
โทรออก, บอกเวลา/วันที่ — พร้อมตอบกลับเป็นเสียง (TTS) ในภาษาเดียวกับที่พูด

## วิธีเปิด/รัน

1. เปิด **Android Studio** (Hedgehog ขึ้นไป) → `File ▸ Open` → เลือกโฟลเดอร์
   `android-voice-assistant/`
2. รอ Gradle sync (Android Studio จะดาวน์โหลด Gradle wrapper ให้เอง)
3. เสียบมือถือ (เปิด USB debugging) หรือใช้ Emulator → กด **Run ▶**
4. ในแอป กดปุ่ม **เริ่มฟัง** → อนุญาตไมโครโฟน + การแจ้งเตือน
5. พูด: **"ผู้ช่วย เปิด YouTube"** หรือ **"assistant search ราคาทอง"**

> ถ้าจะ build จากบรรทัดคำสั่ง ให้สร้าง wrapper ก่อน: `gradle wrapper` แล้วค่อย
> `./gradlew assembleDebug` (ต้องมี Android SDK + ตั้ง `local.properties`).

## คำสั่งที่รองรับ

| พูดว่า (ไทย / English) | ทำอะไร |
|---|---|
| `ผู้ช่วย เปิด YouTube` / `assistant open YouTube` | เปิด YouTube |
| `ผู้ช่วย เปิด YouTube เพลงลูกทุ่ง` / `play lofi on YouTube` | ค้นใน YouTube |
| `ผู้ช่วย ค้นหา ราคาทอง` / `search weather` | ค้นหา Google |
| `ผู้ช่วย เปิด Maps / Facebook / Gmail / LINE` | เปิดแอป/เว็บนั้น |
| `ผู้ช่วย โทรหา 0812345678` / `call 0812345678` | เปิดหน้าโทร |
| `ผู้ช่วย กี่โมงแล้ว` / `what time is it` · `วันนี้วันอะไร` | ตอบเป็นเสียง |

เพิ่มคำสั่งใหม่ได้ที่ `CommandHandler.kt` (โค้ดล้วน ทดสอบง่าย)

## โครงสร้าง

```
app/src/main/java/com/metools/voice/
  MainActivity.kt    UI + ขอ permission + เปิด/ปิด service
  VoiceService.kt    foreground service: ฟังต่อเนื่อง + wake word + TTS
  CommandHandler.kt  แปลงประโยค → ข้อความตอบ + Intent
```

## ข้อจำกัดสำคัญ (ต้องเข้าใจ)

- 🔒 **ปลดล็อกหน้าจอแทนผู้ใช้ไม่ได้** — Android ออกแบบมาห้ามทุกแอปทำ (กันมัลแวร์)
  ถ้าจอล็อกอยู่ ต้องปลดเอง แล้วคำสั่งที่ต้องเปิดแอปจะเด้งหลังปลดล็อก
- 🔋 ระบบอาจหรี่ไมค์เมื่อปิดจอนานๆ หรือเข้าโหมดประหยัดแบต — แนะนำให้ตั้ง
  **ยกเว้นแอปจาก Battery Optimization** เพื่อให้ฟังได้ต่อเนื่อง
- 📶 SpeechRecognizer ในตัวมักต้องต่อเน็ต และ Google อาจจำกัดอัตราการเรียกเมื่อ
  วนฟังถี่ๆ

## อัปเกรดเป็น wake-word แบบ offline (แนะนำสำหรับใช้งานจริง)

วิธีในโค้ดนี้ใช้ `SpeechRecognizer` วนฟัง — ฟรี ไม่ต้องมี API key แต่กินแบตและ
พึ่งเน็ต. ถ้าต้องการ wake word ที่ลื่นและทำงาน offline จริง ใช้หนึ่งใน:

- **Picovoice Porcupine** — wake-word engine คุณภาพสูง (มี free tier, ต้องมี AccessKey)
- **Vosk** — speech recognition แบบ offline ฝังโมเดลไทย/อังกฤษในแอปได้

แล้วให้ Porcupine/Vosk ตรวจคำปลุกก่อน ค่อยเรียก `SpeechRecognizer` มาถอดคำสั่งเต็ม
