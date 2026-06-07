/* =====================================================================
   M.E.Tools — Product image proxy (Vercel Node.js Function)
   ---------------------------------------------------------------------
   รูปสินค้าเก็บเป็น base64 ใน Firestore (products/{id}.image / .images[0])
   LINE Flex ใช้รูปได้เฉพาะ "URL จริง (https)" ไม่รับ base64 — ไฟล์นี้จึงทำหน้าที่
   แปลง base64 → ส่งกลับเป็นรูปจริง (image/jpeg ฯลฯ) เพื่อใช้เป็น hero ในการ์ด LINE
   เรียกใช้:  /api/product-image?id=<productId>
              /api/product-image?promo=1&i=<index>   (รูปแบนเนอร์โปรจาก admin_data/me_settings.promo.images[])
   ถ้าไม่มีรูป/หาไม่เจอ → ส่งโลโก้ร้านแทน (กันรูปแตกใน LINE)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const SITE = 'https://metoolsshop.vercel.app';

function sendImg(res, b64) {
  const m = /^data:(image\/[\w.+-]+);base64,(.*)$/.exec(b64 || '');
  if (!m) return false;
  res.setHeader('Content-Type', m[1]);
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.status(200).send(Buffer.from(m[2], 'base64'));
  return true;
}

export default async function handler(req, res) {
  const q = req.query || {};
  // โหมดสตรีมเนื้อหาข้อความ LINE (วิดีโอ/รูป) จาก messageId (รวมจาก line-content เดิม)
  if (q.line) {
    const mid = String(q.line).replace(/[^0-9]/g, '');
    if (!mid) { res.status(400).send('bad id'); return; }
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) { res.status(500).send('no token'); return; }
    try {
      const r = await fetch(`https://api-data.line.me/v2/bot/message/${mid}/content`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { res.status(r.status === 404 ? 410 : 502).send('content unavailable'); return; }
      res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(Buffer.from(await r.arrayBuffer()));
    } catch (e) { res.status(502).send('proxy error'); }
    return;
  }
  // โหมดรูปโปรโมชั่น (รวมจาก promo-image เดิม เพื่อประหยัดจำนวนฟังก์ชัน Vercel)
  if (q.promo) {
    const idx = Math.max(0, parseInt(q.i || '0', 10) || 0);
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/admin_data/me_settings`;
      const r = await fetch(url);
      if (r.ok) {
        const doc = await r.json();
        const value = doc && doc.fields && doc.fields.value;
        const promo = value && value.mapValue && value.mapValue.fields && value.mapValue.fields.promo;
        const pf = promo && promo.mapValue && promo.mapValue.fields;
        let b64 = '';
        const arr = pf && pf.images && pf.images.arrayValue && pf.images.arrayValue.values;
        if (arr && arr.length) b64 = (arr[Math.min(idx, arr.length - 1)] || {}).stringValue || '';
        if (!b64) b64 = (pf && pf.image && pf.image.stringValue) || '';
        if (sendImg(res, b64)) return;
      }
    } catch (e) { /* ตกไปใช้รูปสำรอง */ }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.redirect(302, `${SITE}/assets/mascot-on-yellow.png`);
    return;
  }

  const id = String(q.id || '').trim();
  if (!id) { res.status(400).send('missing id'); return; }
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}` +
      `/databases/${FIRESTORE_DB}/documents/products/${encodeURIComponent(id)}`;
    const r = await fetch(url);
    if (r.ok) {
      const doc = await r.json();
      const f = (doc && doc.fields) || {};
      let b64 = (f.image && f.image.stringValue) || '';
      if (!b64 && f.images && f.images.arrayValue && f.images.arrayValue.values && f.images.arrayValue.values[0]) {
        b64 = f.images.arrayValue.values[0].stringValue || '';
      }
      if (sendImg(res, b64)) return;
    }
  } catch (e) { /* ตกไปใช้รูปสำรองด้านล่าง */ }
  // ไม่มีรูป/หาไม่เจอ → ใช้โลโก้ร้านแทน
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.redirect(302, `${SITE}/assets/mascot-on-yellow.png`);
}
