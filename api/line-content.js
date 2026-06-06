/* =====================================================================
   M.E.Tools — LINE message content proxy (Vercel Node.js Function)
   ---------------------------------------------------------------------
   สตรีมไฟล์ (วิดีโอ/รูป) ของข้อความ LINE จาก messageId ผ่าน Messaging API
   ใช้แสดงวิดีโอที่ลูกค้าส่งมาในหลังร้าน/เว็บแชต โดยไม่ต้องเก็บไฟล์ใหญ่ลง Firestore
   เรียกใช้:  /api/line-content?id=<messageId>
   ⚠️ เนื้อหาจาก LINE มีอายุจำกัด (ดูได้ช่วงหลังลูกค้าส่งไม่นาน) ถ้าหมดอายุจะเล่นไม่ได้
   ===================================================================== */

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '').trim();
  if (!id || !/^\d+$/.test(id)) { res.status(400).send('bad id'); return; }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) { res.status(500).send('no token'); return; }
  try {
    const r = await fetch(`https://api-data.line.me/v2/bot/message/${id}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { res.status(r.status === 404 ? 410 : 502).send('content unavailable'); return; }
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).send('proxy error');
  }
}
