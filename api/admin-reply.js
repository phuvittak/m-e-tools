/* =====================================================================
   M.E.Tools — Admin reply API (Vercel Node.js Function)
   ---------------------------------------------------------------------
   เจ้าของกด "ส่ง" ใน /admin/bot-inbox.html → ยิงเข้า endpoint นี้
   1. ตรวจ Authorization: Bearer <Firebase ID token> + admins/{uid} ใน Firestore
   2. push ข้อความเข้า LINE ของลูกค้าผ่าน LINE Messaging API
   3. บันทึก doc role:"admin" ใน bot_messages (โชว์ใน bot-inbox + web chat)
   4. ตั้ง bot_sessions[userId].mode = "human" — บอทจะเงียบจนเจ้าของกดเปิดบอท

   ⚠️ Auth check decode JWT payload โดยไม่ verify signature — ป้องกันคำขอ
   แบบไม่มี token แต่ผู้โจมตีที่รู้ admin uid และปลอม payload ได้ยังคงผ่าน
   (Phase 2 hardening: ตรวจ signature ด้วย Google JWKS)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';

function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const k in v) fields[k] = toFsValue(v[k]);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}
function toFsFields(obj) {
  const f = {}; for (const k in obj) f[k] = toFsValue(obj[k]); return f;
}

// LINE userId รูปแบบ "U" + 32 hex chars (ความยาว 33) — ใช้แยก LINE จาก Firebase Auth UID
function isLineUserId(uid) {
  return /^U[0-9a-f]{32}$/i.test(String(uid || ''));
}

// decode JWT payload — ไม่ verify signature (TODO: ใช้ Google JWKS)
function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1] || '';
    const padded = part + '='.repeat((4 - part.length % 4) % 4);
    return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch { return null; }
}

// ตรวจว่า uid อยู่ใน admins/{uid} หรือไม่ — Firestore REST แบบไม่ต้อง auth
async function isAdminUid(uid) {
  if (!uid) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/admins/${encodeURIComponent(uid)}`;
  try {
    const r = await fetch(url);
    return r.ok; // 200 = exists, 404 = ไม่ใช่แอดมิน
  } catch { return false; }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const adminUid = await requireAdmin(req, res);
  if (!adminUid) return; // response ส่งใน requireAdmin แล้ว

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  // action=resume → เปิดบอท (ลบ bot_sessions[userId]) — รวมจาก admin-resume-bot เดิม
  if (((req.query && req.query.action) || body.action) === 'resume') {
    const uid2 = String(body.userId || '').trim();
    if (!uid2) { res.status(400).json({ error: 'missing-userId' }); return; }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(uid2)}`;
    try {
      const r = await fetch(url, { method: 'DELETE' });
      if (!r.ok && r.status !== 404) { res.status(502).json({ error: 'firestore-delete-failed', status: r.status }); return; }
    } catch (e) { res.status(502).json({ error: 'delete-threw', message: e?.message }); return; }
    res.status(200).json({ ok: true }); return;
  }

  const userId = String(body.userId || '').trim();
  const text = String(body.text || '').trim();
  const image = typeof body.image === 'string' ? body.image : '';
  if (!userId || (!text && !image)) { res.status(400).json({ error: 'missing-fields' }); return; }
  if (text.length > 5000) { res.status(400).json({ error: 'text-too-long' }); return; }

  const idToken = (req.headers['authorization'] || req.headers['Authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const SITE = 'https://metoolsshop.vercel.app';

  // ส่งรูป: เก็บรูปเป็น doc สาธารณะ products/chatimg-{id} (เขียนด้วย token แอดมิน → ผ่าน rule auth)
  // แล้วได้ URL จริงสำหรับส่งเข้า LINE + ให้หลังร้านแสดงรูปผ่าน /api/product-image
  let imageUrl = '';
  if (image) {
    if (!/^data:image\/[\w.+-]+;base64,/.test(image)) { res.status(400).json({ error: 'bad-image' }); return; }
    const imgId = 'chatimg-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    try {
      const purl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/products/${imgId}`;
      const wr = await fetch(purl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ fields: toFsFields({ image, chatImage: true, hidden: true, at: new Date() }) }),
      });
      if (!wr.ok) { const eb = await wr.text().catch(() => ''); console.error('[admin-reply] chatimg store', wr.status, eb.slice(0, 150)); res.status(500).json({ error: 'image-store-failed', status: wr.status }); return; }
      imageUrl = `${SITE}/api/product-image?id=${imgId}`;
    } catch (e) { res.status(500).json({ error: 'image-store-threw', message: e?.message }); return; }
  }

  // 1) Push ไป LINE (เฉพาะลูกค้า LINE — ลูกค้าฝั่งเว็บจะอ่านจาก Firestore เอง)
  let linePushed = false;
  if (isLineUserId(userId)) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) { res.status(500).json({ error: 'no-line-token' }); return; }
    const messages = [];
    if (imageUrl) messages.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl });
    if (text) messages.push({ type: 'text', text });
    try {
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: userId, messages }),
      });
      if (!r.ok) {
        const errBody = await r.text().catch(() => '');
        console.error('[admin-reply] LINE push failed', r.status, errBody.slice(0, 200));
        res.status(502).json({ error: 'line-push-failed', status: r.status, body: errBody.slice(0, 200) });
        return;
      }
      linePushed = true;
    } catch (e) {
      console.error('[admin-reply] LINE push threw', e?.message);
      res.status(502).json({ error: 'line-push-threw', message: e?.message });
      return;
    }
  }

  // 2) บันทึกใน Firestore bot_messages — bot-inbox + web chat เห็นผ่าน listener
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_messages`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFsFields({
        userId, role: 'admin', text: text || (imageUrl ? '[รูปภาพ]' : ''), image: imageUrl || '', source: 'admin', at: new Date(),
      }) }),
    });
  } catch (e) {
    console.error('[admin-reply] firestore write threw', e?.message);
    // LINE push ผ่านแล้ว — return success อยู่ดี
  }

  // 3) ตั้ง bot_sessions เป็น human — บอทเงียบจนเจ้าของกดเปิดบอท
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(userId)}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFsFields({
        mode: 'human', updatedAt: new Date().toISOString(),
      }) }),
    });
  } catch (e) {
    console.error('[admin-reply] session write threw', e?.message);
  }

  res.status(200).json({ ok: true, linePushed });
}
