/* =====================================================================
   M.E.Tools — Admin reply API (Vercel Node.js Function)
   ---------------------------------------------------------------------
   เจ้าของกด "ส่ง" ใน /admin/bot-inbox.html → ยิงเข้า endpoint นี้
   1. push ข้อความเข้า LINE ของลูกค้าผ่าน LINE Messaging API
   2. บันทึก doc role:"admin" ใน bot_messages (โชว์ใน bot-inbox + web chat)
   3. ตั้ง bot_sessions[userId].mode = "human" — บอทจะเงียบจนเจ้าของกดเปิดบอท

   ⚠️ ตอนนี้ยังไม่มี auth check — Phase D จะเพิ่มการตรวจ Firebase ID token
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const userId = String(body.userId || '').trim();
  const text = String(body.text || '').trim();
  if (!userId || !text) { res.status(400).json({ error: 'missing-fields' }); return; }
  if (text.length > 5000) { res.status(400).json({ error: 'text-too-long' }); return; }

  // 1) Push ไป LINE (เฉพาะลูกค้า LINE — ลูกค้าฝั่งเว็บจะอ่านจาก Firestore เอง)
  let linePushed = false;
  if (isLineUserId(userId)) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) { res.status(500).json({ error: 'no-line-token' }); return; }
    try {
      const r = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
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
        userId, role: 'admin', text, source: 'admin', at: new Date(),
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
