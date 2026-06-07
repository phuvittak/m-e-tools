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

  // โหมดอ่านป้าย/ฉลากจากรูป (vision) — ใช้ในฟอร์มลงทะเบียนประกัน (รวมไว้ที่นี่เพื่อประหยัดจำนวนฟังก์ชัน Vercel)
  if (body.image) {
    const raw = String(body.image);
    const mm = /^data:(image\/[\w.+-]+);base64,(.*)$/.exec(raw);
    const mediaType = mm ? mm[1] : 'image/jpeg';
    const imgB64 = mm ? mm[2] : raw.replace(/^data:[^,]*,/, '');
    if (!imgB64) { res.status(400).json({ error: 'no-image' }); return; }
    const sys = `คุณคือผู้ช่วยอ่านป้าย/ฉลากเครื่องมือช่างจากรูปถ่าย — รองรับ "ทุกยี่ห้อ"
(DEWALT, MAKITA, BOSCH, OSUKA, INGCO, STANLEY, HITACHI/HiKOKI ฯลฯ) อ่านตามที่เห็นจริงบนป้าย
ตอบเป็น JSON เท่านั้น: {"model":"รหัสรุ่น เช่น OCHD802/DCD701 (ไม่เจอใส่ \\"\\")","serial":"Serial/SN เช่น NA015131 B1H7MDN (ไม่เจอใส่ \\"\\")","brand":"ยี่ห้อ (ไม่เจอใส่ \\"\\")","category":"ประเภทสั้นๆ เช่น สว่านไร้สาย/แบตเตอรี่ (ไม่แน่ใจใส่ \\"\\")"}
กฎ: อ่านเฉพาะที่เห็นจริง ห้ามเดา ถ้าไม่ชัดใส่ค่าว่าง · model มักเป็นรหัสตัวใหญ่ · serial มักยาวกว่าและอยู่ใกล้ QR/บาร์โค้ด`;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 512, system: sys,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imgB64 } },
            { type: 'text', text: 'อ่านป้าย/ฉลากในรูปนี้ แล้วตอบเป็น JSON ตามรูปแบบ' },
          ] }],
        }),
      });
      if (!r.ok) { const e = await r.text(); res.status(502).json({ error: 'anthropic-error', message: e.slice(0, 200) }); return; }
      const data = await r.json();
      const txt = (data?.content?.[0]?.text || '{}').trim();
      let parsed;
      try { parsed = JSON.parse(txt); }
      catch { const x = txt.match(/```(?:json)?\s*([\s\S]*?)```/); parsed = x ? JSON.parse(x[1].trim()) : {}; }
      res.status(200).json({ ok: true, parsed: parsed || {} });
    } catch (e) { res.status(500).json({ error: 'internal', message: e?.message }); }
    return;
  }

  const raw = String(body.text || '').trim();
  if (!raw) { res.status(400).json({ error: 'missing-text' }); return; }

  const systemPrompt = `คุณคือ AI ช่วยแยกข้อมูลสินค้าเครื่องมือช่าง จัดให้อ่านง่ายเป็นเรื่อง ๆ
รับข้อความดิบที่แอดมินวางมา → แยกเป็น JSON ตามโครงสร้างนี้ทุกครั้ง:

{
  "name": "ชื่อสินค้าเต็ม (ภาษาไทยหรืออังกฤษตามต้นฉบับ)",
  "brand": "ยี่ห้อ เช่น DEWALT / MAKITA / BOSCH",
  "sku": "รหัสสินค้า เช่น DCD991P2 (ถ้าไม่มีให้ใส่ string ว่าง)",
  "category": "หมวดหมู่: drill / saw / grinder / battery / measure / hand / power",
  "motorType": "ระบบมอเตอร์ เช่น ไร้แปรงถ่าน (Brushless) / มีแปรงถ่าน (Brushed)",
  "warrantyYears": 1,
  "shipSize": "ขนาด/น้ำหนักพร้อมส่ง เช่น 35 × 12 × 28 ซม. · ~2.5 กก.",
  "desc": "เกริ่นนำสั้น ๆ 1-2 ประโยค แล้วตามด้วยจุดเด่นเป็นบูลเล็ตทีละบรรทัด",
  "specs": [
    "ป้าย : ค่า",
    "แรงดันไฟ : 12V"
  ]
}

กฎการจัดรูปแบบ (สำคัญมาก — ให้อ่านง่ายเป็นเรื่อง ๆ):
- ตอบเป็น JSON เท่านั้น ไม่มี markdown หรือข้อความอื่น
- "desc": บรรทัดแรกเป็นประโยคแนะนำสั้น ๆ 1-2 ประโยค จากนั้น **ขึ้นบรรทัดใหม่** (ใช้ \\n) เป็น
  จุดเด่นทีละข้อ แต่ละข้อขึ้นต้นด้วย "• " บรรทัดละ 1 เรื่อง (อย่ายัดรวมเป็นย่อหน้าเดียว)
  ถ้ามีหลายหมวด ใส่หัวข้อย่อยเป็นบรรทัดที่ลงท้ายด้วย ":" ก่อนกลุ่มบูลเล็ตได้
- "specs": เก็บเฉพาะสเปกเชิงเทคนิค/ตัวเลข เป็น "ป้าย : ค่า" ทีละรายการ
  (เช่น แรงดันไฟ, แรงบิด, รอบ/นาที, ขนาดหัวจับ, น้ำหนัก, ความจุแบต) ห้ามรวมหลายค่าในข้อเดียว
- รักษาข้อมูลทุกอย่างจากต้นฉบับ ห้ามตัดทิ้ง — ข้อมูลพรรณนาไว้ใน desc, ข้อมูลตัวเลขไว้ใน specs
- ถ้าไม่มีข้อมูลใด ใส่ string ว่าง / [] / 0 ตามชนิด`;

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
