/* =====================================================================
   M.E.Tools — Admin resume bot API (Vercel Node.js Function)
   ---------------------------------------------------------------------
   เจ้าของกด "เปิดบอท" ใน bot-inbox → ลบ bot_sessions[userId]
   → ครั้งหน้าที่ลูกค้าทักมาทาง LINE บอทจะตอบเอง (mode default = "ai")

   ⚠️ ตอนนี้ยังไม่มี auth check — Phase D จะเพิ่มการตรวจ Firebase ID token
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

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
