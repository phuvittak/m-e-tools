/* =====================================================================
   M.E.Tools — Google Sheets sync (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ส่งข้อมูลออเดอร์/สินค้าไปต่อท้ายแถวใน Google Sheets แบบเรียลไทม์ โดย
   "ไม่ต้องใช้ Google service account" — ใช้ Google Apps Script Web App แทน
   (คุณ deploy สคริปต์เล็ก ๆ ในชีตของคุณเอง → ได้ URL → ใส่เป็น ENV)

   ENV:
     SHEETS_WEBHOOK_URL = URL ของ Apps Script Web App (เช่น https://script.google.com/macros/s/XXX/exec)
   ไม่ตั้ง → ตอบ { configured:false } (ฝั่งเว็บถือเป็น no-op — ไม่กระทบความเร็ว)

   วิธีตั้งฝั่ง Google (อยู่ใน README): เปิดชีต → ส่วนขยาย → Apps Script → วางโค้ด doPost →
   Deploy เป็น Web App (Execute as: Me, Access: Anyone) → คัดลอก URL มาใส่ ENV

   contract:
     req:  { type: "order"|"product"|..., row: {...} }   // row = คู่คอลัมน์→ค่า
     res:  { ok, configured }
   ===================================================================== */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method-not-allowed' }); return; }

  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) { res.status(200).json({ ok: false, configured: false }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { res.status(400).json({ ok: false, configured: true, error: 'bad-json' }); return; }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: String(body.type || 'order'), row: body.row || {}, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(12000),
      redirect: 'follow', // Apps Script Web App ตอบ 302 ไป googleusercontent — ต้อง follow
    });
    if (!r.ok) { res.status(200).json({ ok: false, configured: true, error: 'sheets-' + r.status }); return; }
    res.status(200).json({ ok: true, configured: true });
  } catch (e) {
    // เน็ต/timeout — อย่าให้กระทบ flow หลัก
    res.status(200).json({ ok: false, configured: true, error: 'fetch-failed: ' + (e && e.message) });
  }
}
