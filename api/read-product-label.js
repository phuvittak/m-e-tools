/* =====================================================================
   M.E.Tools — อ่านป้าย/ฉลากสินค้าจากรูป (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ลูกค้าถ่ายรูปป้ายตัวเครื่อง/แบต/กล่อง → ใช้ Claude (vision) อ่าน
   ดึง รุ่น (model) + Serial Number + ยี่ห้อ + ประเภท ให้อัตโนมัติ
   ใช้ในฟอร์มลงทะเบียนประกัน (กรอกให้เองโดยไม่ต้องพิมพ์)
   ===================================================================== */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }
  if (!ANTHROPIC_API_KEY) { res.status(500).json({ error: 'no-api-key', message: 'ANTHROPIC_API_KEY ไม่ได้ตั้งค่าใน Vercel' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const raw = String(body.image || '');
  const m = /^data:(image\/[\w.+-]+);base64,(.*)$/.exec(raw);
  const mediaType = m ? m[1] : 'image/jpeg';
  const b64 = m ? m[2] : raw.replace(/^data:[^,]*,/, '');
  if (!b64) { res.status(400).json({ error: 'no-image' }); return; }

  const system = `คุณคือผู้ช่วยอ่านป้าย/ฉลากเครื่องมือช่างจากรูปถ่าย
ดึงข้อมูลที่อ่านได้จากรูปเป็น JSON เท่านั้น (ห้ามมีข้อความอื่น):
{
  "model": "รหัสรุ่น/ชื่อรุ่น เช่น OCHD802 / DCD701 / DCB183 (ตามที่เห็นบนป้าย, ถ้าไม่เจอใส่ \\"\\")",
  "serial": "Serial Number / S/N เช่น NA015131 B1H7MDN (ถ้าไม่เจอใส่ \\"\\")",
  "brand": "ยี่ห้อ เช่น DEWALT / MAKITA / OSUKA (ถ้าไม่เจอใส่ \\"\\")",
  "category": "ประเภทสั้น ๆ เช่น สว่านไร้สาย / แบตเตอรี่ / ที่ชาร์จ (ถ้าไม่แน่ใจใส่ \\"\\")"
}
กฎ:
- อ่านเฉพาะที่เห็นจริงในรูป ห้ามเดามั่ว ถ้าไม่ชัดให้ใส่ค่าว่าง
- model มักเป็นรหัสตัวอักษร+ตัวเลขตัวใหญ่บนป้าย · serial มักยาวกว่าและมีคำว่า S/N หรืออยู่ใกล้ QR/บาร์โค้ด`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: 'อ่านป้าย/ฉลากในรูปนี้ แล้วตอบเป็น JSON ตามรูปแบบ' },
          ],
        }],
      }),
    });
    if (!r.ok) { const e = await r.text(); res.status(502).json({ error: 'anthropic-error', message: e.slice(0, 200) }); return; }
    const data = await r.json();
    const txt = (data?.content?.[0]?.text || '{}').trim();
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch { const mm = txt.match(/```(?:json)?\s*([\s\S]*?)```/); parsed = mm ? JSON.parse(mm[1].trim()) : {}; }
    res.status(200).json({ ok: true, parsed: parsed || {} });
  } catch (e) {
    res.status(500).json({ error: 'internal', message: e?.message });
  }
}
