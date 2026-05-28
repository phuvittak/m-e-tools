/* =====================================================================
   M.E.Tools — Web chat bot reply (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ลูกค้าพิมพ์ในเว็บแชท (มุมขวาล่าง) → client เขียน user doc แล้วเรียก
   endpoint นี้ → ตรวจว่า user อยู่โหมด human ไหม + คำนวณคำตอบบอทจาก
   bot_config + เขียน reply กลับเป็น role:"bot"

   ไม่ใช้ Claude AI ที่นี่ — แค่ keyword + fallback (เร็ว ฟรี ปรับใน
   /admin/bot-replies.html ได้)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';

function unwrapFsValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrapFsValue);
  if ('mapValue' in v) {
    const out = {}, f = v.mapValue.fields || {};
    for (const k in f) out[k] = unwrapFsValue(f[k]);
    return out;
  }
  return null;
}

async function getBotConfig() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_config/replies`;
  try {
    const r = await fetch(url);
    if (!r.ok) return { rentEnabled: true, greeting: '', fallback: '', rules: [] };
    const doc = await r.json();
    const fields = {};
    for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]);
    return {
      rentEnabled: typeof fields.rentEnabled === 'boolean' ? fields.rentEnabled : true,
      greeting: String(fields.greeting || ''),
      fallback: String(fields.fallback || ''),
      rules: Array.isArray(fields.rules) ? fields.rules.map((r) => ({
        keywords: Array.isArray(r?.keywords) ? r.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean) : [],
        answer: String(r?.answer || ''),
      })).filter((r) => r.keywords.length && r.answer) : [],
    };
  } catch { return { rentEnabled: true, greeting: '', fallback: '', rules: [] }; }
}

async function getSession(userId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(userId)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const doc = await r.json();
    const fields = {};
    for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]);
    return fields;
  } catch { return null; }
}

function computeReply(text, cfg) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return '';
  // 1) Rent off + ลูกค้าถามเรื่องเช่า → บอกตรง
  if (cfg.rentEnabled === false && /(เช่า|rent|เช็า)/i.test(t)) {
    return 'ขออภัยครับ ตอนนี้ร้านยังไม่มีบริการเช่าเครื่องมือนะครับ 🙏\nมีแต่จำหน่ายขาดทั้งหมด';
  }
  // 2) ทักทาย
  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey|hej)/i.test(t)) {
    return cfg.greeting || 'สวัสดีครับ 🙏 M.E.Tools ยินดีให้บริการ — สนใจสิ่งใดครับ?';
  }
  // 3) "ติดต่อแอดมิน" / "ติดต่อเจ้าของ" → เงียบ (ให้แอดมินตอบเอง — bot ไม่ตอบ)
  if (/(ติดต่อ\s*(แอดมิน|เจ้าของ|คน)|คุยกับ\s*(แอดมิน|เจ้าของ|คน)|พนักงานจริง|มนุษย์)/i.test(t)) {
    return ''; // ไม่ตอบ — admin จะมาตอบเอง
  }
  // 4) ลองคีย์เวิร์ดที่เจ้าของตั้งไว้
  for (const r of cfg.rules) {
    for (const kw of r.keywords) {
      if (kw && t.indexOf(kw) >= 0) return r.answer;
    }
  }
  // 5) Fallback
  return cfg.fallback || 'ขอบคุณสำหรับข้อความครับ 🙏\nสนใจเครื่องมือหมวดไหนเป็นพิเศษครับ?';
}

async function writeBotMessage(userId, replyText) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_messages`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        userId: { stringValue: String(userId) },
        role: { stringValue: 'bot' },
        text: { stringValue: String(replyText) },
        source: { stringValue: 'web' },
        at: { timestampValue: new Date().toISOString() },
      },
    }),
  });
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

  // ถ้า user อยู่โหมด human (แอดมินกำลังคุย) → บอทเงียบ
  const session = await getSession(userId);
  if (session && session.mode === 'human') {
    res.status(200).json({ ok: true, skipped: 'human-mode' });
    return;
  }

  const cfg = await getBotConfig();
  const reply = computeReply(text, cfg);
  if (!reply) {
    res.status(200).json({ ok: true, skipped: 'no-reply' });
    return;
  }

  try {
    await writeBotMessage(userId, reply);
    res.status(200).json({ ok: true, reply });
  } catch (e) {
    console.error('[web-bot-reply] write threw', e?.message);
    res.status(502).json({ error: 'write-failed', message: e?.message });
  }
}
