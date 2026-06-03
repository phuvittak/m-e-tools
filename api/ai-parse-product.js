/* =====================================================================
   M.E.Tools — AI product description parser (Vercel Node.js Function)
   ---------------------------------------------------------------------
   แอดมินวางรายละเอียดสินค้าดิบ → endpoint นี้ใช้ Claude แยกให้เป็น
   structured fields ที่ใส่ใน product modal ได้ทันที
   ===================================================================== */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  if (!ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'no-api-key', message: 'ANTHROPIC_API_KEY ไม่ได้ตั้งค่าใน Vercel Environment' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const raw = String(body.text || '').trim();
  if (!raw) { res.status(400).json({ error: 'missing-text' }); return; }

  const systemPrompt = `คุณคือ AI ช่วยแยกข้อมูลสินค้าเครื่องมือช่าง
รับข้อความดิบที่แอดมินวางมา → แยกให้เป็น JSON ตามโครงสร้างนี้ทุกครั้ง:

{
  "name": "ชื่อสินค้าเต็ม (ภาษาไทยหรืออังกฤษตามต้นฉบับ)",
  "brand": "ยี่ห้อ เช่น DEWALT / MAKITA / BOSCH",
  "sku": "รหัสสินค้า เช่น DCD991P2 (ถ้าไม่มีให้ใส่ string ว่าง)",
  "category": "หมวดหมู่: drill / saw / grinder / battery / measure / hand / power",
  "motorType": "ระบบมอเตอร์ เช่น ไร้แปรงถ่าน (Brushless) / มีแปรงถ่าน (Brushed)",
  "warrantyYears": 1,
  "shipSize": "ขนาด/น้ำหนักพร้อมส่ง เช่น 35 × 12 × 28 ซม. · ~2.5 กก.",
  "desc": "รายละเอียดหลัก 2-4 ประโยค (สั้น เน้นจุดเด่น ภาษาไทย)",
  "specs": [
    "สเปคสำคัญข้อ 1",
    "สเปคสำคัญข้อ 2"
  ]
}

กฎ:
- ตอบเป็น JSON เท่านั้น ไม่ต้องมี markdown หรือข้อความอื่น
- ถ้าไม่มีข้อมูลใด ให้ใส่ string ว่าง หรือ [] สำหรับ array / 0 สำหรับ number
- รักษาข้อมูลทุกอย่างที่มีในต้นฉบับ ห้ามตัดทิ้ง — เก็บไว้ใน desc หรือ specs
- specs ให้แยกเป็น array สั้น ๆ ทีละรายการ ไม่รวมกัน`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: raw }],
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      res.status(502).json({ error: 'anthropic-error', message: err });
      return;
    }

    const data = await r.json();
    const rawJson = data?.content?.[0]?.text?.trim() || '{}';

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      // Claude might wrap in ```json ... ```
      const m = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = m ? JSON.parse(m[1].trim()) : {};
    }

    res.status(200).json({ ok: true, parsed });
  } catch (e) {
    console.error('[ai-parse-product] threw', e?.message);
    res.status(500).json({ error: 'internal', message: e?.message });
  }
}
