/* =====================================================================
   M.E.Tools — Web chat bot reply (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ลูกค้าพิมพ์ในเว็บแชท → endpoint นี้ตอบกลับ
   ลำดับ: human-mode check → ทักทาย → keyword rules → Claude AI → fallback

   config อ่านจาก bot_config/web_replies (แยกจาก LINE bot ใน /replies)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

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

let _cfgCache = null, _cfgAt = 0;
const CFG_TTL = 5 * 60 * 1000;

async function getBotConfig() {
  if (_cfgCache && Date.now() - _cfgAt < CFG_TTL) return _cfgCache;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_config/web_replies`;
  try {
    const r = await fetch(url);
    if (!r.ok) return { rentEnabled: true, greeting: '', fallback: '', rules: [] };
    const doc = await r.json();
    const fields = {};
    for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]);
    _cfgCache = {
      rentEnabled: typeof fields.rentEnabled === 'boolean' ? fields.rentEnabled : true,
      greeting: String(fields.greeting || ''),
      fallback: String(fields.fallback || ''),
      rules: Array.isArray(fields.rules) ? fields.rules.map((r) => ({
        keywords: Array.isArray(r?.keywords) ? r.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean) : [],
        answer: String(r?.answer || ''),
      })).filter((r) => r.keywords.length && r.answer) : [],
    };
    _cfgAt = Date.now();
    return _cfgCache;
  } catch { return _cfgCache || { rentEnabled: true, greeting: '', fallback: '', rules: [] }; }
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

function keywordReply(text, cfg) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  if (cfg.rentEnabled === false && /(เช่า|rent|เช็า)/i.test(t)) {
    return 'ขออภัยครับ ตอนนี้ร้านยังไม่มีบริการเช่าเครื่องมือ มีแต่จำหน่ายขาดทั้งหมด 🙏';
  }
  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey)/i.test(t)) {
    return cfg.greeting || 'สวัสดีครับ 🙏 M.E.Tools ยินดีให้บริการ — สอบถามได้เลยครับ';
  }
  if (/(ติดต่อ\s*(แอดมิน|เจ้าของ|คน)|คุยกับ\s*(แอดมิน|เจ้าของ|คน)|พนักงานจริง|มนุษย์)/i.test(t)) {
    return ''; // admin จะมาตอบเอง
  }
  for (const r of cfg.rules) {
    for (const kw of r.keywords) {
      if (kw && t.indexOf(kw) >= 0) return r.answer;
    }
  }
  return null;
}

async function aiReply(text, cfg) {
  if (!ANTHROPIC_API_KEY) return null;
  const systemPrompt = `คุณคือบอทผู้ช่วยของร้าน M.E.Tools ท่ารั้ว เชียงใหม่
จำหน่ายและให้เช่าเครื่องมือช่าง DEWALT, MAKITA, BOSCH, STANLEY ของแท้ 100%
ที่ตั้ง: 199/6 ม.7 ต.สันปูเลย อ.ดอยสะเก็ด จ.เชียงใหม่ 50220
โทร: 081-3706466 (มือถือ) / 053-104699 (สำนักงาน)
เวลาทำการ: จันทร์–เสาร์ 8:00–17:00 / อาทิตย์ 8:00–15:00

${cfg.rentEnabled === false ? 'หมายเหตุ: ร้านนี้ไม่มีบริการเช่า มีแต่จำหน่ายขาด\n' : ''}
ตอบเป็นภาษาไทย กระชับ เป็นมิตร ไม่เกิน 3 ประโยค
ถ้าไม่แน่ใจ ให้แนะนำโทรมาถามร้านโดยตรง`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.content?.[0]?.text?.trim() || null;
  } catch { return null; }
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

  const session = await getSession(userId);
  if (session && session.mode === 'human') {
    res.status(200).json({ ok: true, skipped: 'human-mode' });
    return;
  }

  const cfg = await getBotConfig();

  // 1) keyword / greeting / contact rules
  let reply = keywordReply(text, cfg);

  // 2) Claude AI fallback (ถ้า keyword ไม่ตรง)
  if (reply === null) {
    reply = await aiReply(text, cfg);
  }

  // 3) hardcoded fallback
  if (reply === null) {
    reply = cfg.fallback || 'ขอบคุณสำหรับข้อความครับ 🙏 สนใจเครื่องมือหมวดไหนเป็นพิเศษครับ?';
  }

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
