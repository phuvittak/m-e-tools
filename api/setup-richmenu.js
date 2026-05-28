/* =====================================================================
   M.E.Tools — Setup Rich Menu API (Vercel Node.js Function)
   ---------------------------------------------------------------------
   เจ้าของกด "Apply to LINE" ใน /admin/richmenu.html → ยิงเข้า endpoint นี้
   1. ตรวจ admin auth (Firebase ID token + admins/{uid})
   2. สร้าง rich menu structure ที่ LINE
   3. อัปโหลด PNG (base64) ไปที่ rich menu นั้น
   4. ลบ rich menu เก่า (ถ้ามี) แล้ว set อันใหม่เป็น default ให้ผู้ใช้ทุกคน

   POST body:
   {
     "image": "data:image/png;base64,...",  // หรือ base64 ดิบก็ได้
     "chatBarText": "เมนู",
     "name": "M.E.Tools Main Menu",
     "areas": [ { bounds: {x,y,width,height}, action: {...} }, ... ]
   }
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';

function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1] || '';
    const padded = part + '='.repeat((4 - part.length % 4) % 4);
    return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch { return null; }
}

async function isAdminUid(uid) {
  if (!uid) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/admins/${encodeURIComponent(uid)}`;
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}

async function requireAdmin(req, res) {
  const hdr = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = hdr.replace(/^Bearer\s+/i, '').trim();
  if (!token) { res.status(401).json({ error: 'missing-auth' }); return null; }
  const payload = decodeJwtPayload(token);
  if (!payload || payload.aud !== FIREBASE_PROJECT) { res.status(401).json({ error: 'invalid-token' }); return null; }
  if (payload.exp && payload.exp < Date.now() / 1000) { res.status(401).json({ error: 'expired-token' }); return null; }
  const uid = payload.user_id || payload.sub || '';
  if (!(await isAdminUid(uid))) { res.status(403).json({ error: 'not-admin', uid }); return null; }
  return uid;
}

// ลบ rich menu ทุกอันที่มีอยู่ — ก่อน setup ใหม่จะได้ไม่บวมในบัญชี
async function clearExistingRichMenus(token) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/richmenu/list', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const data = await r.json();
    const ids = (data.richmenus || []).map((m) => m.richMenuId);
    await Promise.all(ids.map((id) =>
      fetch(`https://api.line.me/v2/bot/richmenu/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    ));
  } catch (err) { console.warn('[richmenu] clear existing threw', err?.message); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const adminUid = await requireAdmin(req, res);
  if (!adminUid) return;

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) { res.status(500).json({ error: 'no-line-token' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const imageInput = String(body.image || '');
  const areas = Array.isArray(body.areas) ? body.areas : [];
  if (!imageInput || !areas.length) { res.status(400).json({ error: 'missing-image-or-areas' }); return; }

  // ดึง base64 ดิบ (รองรับทั้ง data URL และ base64 ตรง ๆ)
  const base64 = imageInput.includes(',') ? imageInput.split(',', 2)[1] : imageInput;
  let imageBytes;
  try {
    imageBytes = Buffer.from(base64, 'base64');
  } catch { res.status(400).json({ error: 'invalid-base64' }); return; }
  if (imageBytes.length > 1024 * 1024) {
    res.status(413).json({ error: 'image-too-large', size: imageBytes.length, max: 1048576 });
    return;
  }

  const richMenuObject = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: String(body.name || 'M.E.Tools Main Menu').slice(0, 100),
    chatBarText: String(body.chatBarText || 'เมนู').slice(0, 14),
    areas: areas,
  };

  // 0) ล้างของเก่าก่อน (ป้องกัน rich menu ค้างในบัญชี)
  await clearExistingRichMenus(token);

  // 1) สร้าง rich menu
  let richMenuId = '';
  try {
    const r = await fetch('https://api.line.me/v2/bot/richmenu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(richMenuObject),
    });
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      res.status(502).json({ error: 'create-failed', status: r.status, body: errBody.slice(0, 300) });
      return;
    }
    const data = await r.json();
    richMenuId = data.richMenuId;
  } catch (e) {
    res.status(502).json({ error: 'create-threw', message: e?.message });
    return;
  }

  // 2) อัปโหลดรูป (ใช้ api-data.line.me สำหรับ binary)
  try {
    const r = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png', Authorization: `Bearer ${token}` },
      body: imageBytes,
    });
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      res.status(502).json({ error: 'upload-failed', status: r.status, body: errBody.slice(0, 300) });
      return;
    }
  } catch (e) {
    res.status(502).json({ error: 'upload-threw', message: e?.message });
    return;
  }

  // 3) Set เป็น default ของ user ทุกคน
  try {
    const r = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      // failed to set default — but menu was created/uploaded. report partial success.
      res.status(200).json({ ok: true, richMenuId, warning: 'create+upload OK but set-default failed', detail: errBody.slice(0, 300) });
      return;
    }
  } catch (e) {
    res.status(200).json({ ok: true, richMenuId, warning: 'set-default threw', message: e?.message });
    return;
  }

  res.status(200).json({ ok: true, richMenuId });
}
