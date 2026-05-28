/* =====================================================================
   M.E.Tools — Admin resume bot API (Vercel Node.js Function)
   ---------------------------------------------------------------------
   เจ้าของกด "เปิดบอท" ใน bot-inbox → ลบ bot_sessions[userId]
   → ครั้งหน้าที่ลูกค้าทักมาทาง LINE บอทจะตอบเอง (mode default = "ai")

   ⚠️ ตอนนี้ยังไม่มี auth check — Phase D จะเพิ่มการตรวจ Firebase ID token
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const adminUid = await requireAdmin(req, res);
  if (!adminUid) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const userId = String(body.userId || '').trim();
  if (!userId) { res.status(400).json({ error: 'missing-userId' }); return; }

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(userId)}`;
  try {
    const r = await fetch(url, { method: 'DELETE' });
    // 404 = ไม่เคยมี session อยู่แล้ว — ถือว่า success (idempotent)
    if (!r.ok && r.status !== 404) {
      const errBody = await r.text().catch(() => '');
      console.error('[admin-resume-bot] delete failed', r.status, errBody.slice(0, 200));
      res.status(502).json({ error: 'firestore-delete-failed', status: r.status });
      return;
    }
  } catch (e) {
    console.error('[admin-resume-bot] delete threw', e?.message);
    res.status(502).json({ error: 'delete-threw', message: e?.message });
    return;
  }
  res.status(200).json({ ok: true });
}
