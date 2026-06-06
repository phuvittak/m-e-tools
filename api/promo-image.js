/* =====================================================================
   M.E.Tools — Promo banner image proxy (Vercel Node.js Function)
   ---------------------------------------------------------------------
   รูปแบนเนอร์โปรเก็บเป็น base64 ใน admin_data/me_settings (value.promo.images[] / .image)
   LINE ส่งรูปได้เฉพาะ URL จริง (https) ไม่รับ base64 — ไฟล์นี้แปลง base64 →
   ส่งกลับเป็นรูปจริง เพื่อใช้ในข้อความ broadcast โปรโมชั่น
   เรียกใช้:  /api/promo-image          → รูปแรก
              /api/promo-image?i=2      → รูปลำดับที่ 2 (สำหรับ image carousel)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const SITE = 'https://metoolsshop.vercel.app';

export default async function handler(req, res) {
  const idx = Math.max(0, parseInt((req.query && req.query.i) || '0', 10) || 0);
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}` +
      `/databases/${FIRESTORE_DB}/documents/admin_data/me_settings`;
    const r = await fetch(url);
    if (r.ok) {
      const doc = await r.json();
      const value = doc && doc.fields && doc.fields.value;
      const promo = value && value.mapValue && value.mapValue.fields && value.mapValue.fields.promo;
      const pf = promo && promo.mapValue && promo.mapValue.fields;
      let b64 = '';
      const arr = pf && pf.images && pf.images.arrayValue && pf.images.arrayValue.values;
      if (arr && arr.length) b64 = (arr[Math.min(idx, arr.length - 1)] || {}).stringValue || '';
      if (!b64) b64 = (pf && pf.image && pf.image.stringValue) || ''; // สำรอง: รูปเดี่ยวเดิม
      const m = /^data:(image\/[\w.+-]+);base64,(.*)$/.exec(b64);
      if (m) {
        const buf = Buffer.from(m[2], 'base64');
        res.setHeader('Content-Type', m[1]);
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        res.status(200).send(buf);
        return;
      }
    }
  } catch (e) { /* ตกไปใช้รูปสำรอง */ }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.redirect(302, `${SITE}/assets/mascot-on-yellow.png`);
}
