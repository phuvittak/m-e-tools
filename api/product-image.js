/* =====================================================================
   M.E.Tools — Product image proxy (Vercel Node.js Function)
   ---------------------------------------------------------------------
   รูปสินค้าเก็บเป็น base64 ใน Firestore (products/{id}.image / .images[0])
   LINE Flex ใช้รูปได้เฉพาะ "URL จริง (https)" ไม่รับ base64 — ไฟล์นี้จึงทำหน้าที่
   แปลง base64 → ส่งกลับเป็นรูปจริง (image/jpeg ฯลฯ) เพื่อใช้เป็น hero ในการ์ด LINE
   เรียกใช้:  /api/product-image?id=<productId>
   ถ้าไม่มีรูป/หาไม่เจอ → ส่งโลโก้ร้านแทน (กันรูปแตกใน LINE)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const SITE = 'https://metoolsshop.vercel.app';

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '').trim();
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
      const m = /^data:(image\/[\w.+-]+);base64,(.*)$/.exec(b64);
      if (m) {
        const buf = Buffer.from(m[2], 'base64');
        res.setHeader('Content-Type', m[1]);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        res.status(200).send(buf);
        return;
      }
    }
  } catch (e) { /* ตกไปใช้รูปสำรองด้านล่าง */ }
  // ไม่มีรูป/หาไม่เจอ → ใช้โลโก้ร้านแทน
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.redirect(302, `${SITE}/assets/mascot-on-yellow.png`);
}
