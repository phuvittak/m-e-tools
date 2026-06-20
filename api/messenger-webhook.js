/* =====================================================================
   M.E.Tools — Messenger / Instagram webhook (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ให้ AI ตอบลูกค้าบน Facebook Messenger และ Instagram DM ด้วย "สมองตัวเดียว"
   กับ LINE bot: ใช้กฎคีย์เวิร์ดที่เจ้าของตั้งใน bot_config/replies ก่อน → ถ้าไม่เจอ
   ใช้ Claude ตอบจากแคตตาล็อกจริง → ถ้ายังไม่ได้ ใช้ fallback

   ตั้งค่า (Meta for Developers → Webhooks):
     - Callback URL: https://<โดเมน>/api/messenger-webhook
     - Verify Token: ใส่ให้ตรงกับ ENV META_VERIFY_TOKEN
   ENV:
     META_VERIFY_TOKEN  = ข้อความลับสำหรับยืนยัน webhook (ตั้งเอง อะไรก็ได้)
     META_PAGE_TOKEN    = Page Access Token (Messenger) / IG token — ใช้ส่งข้อความตอบ
     ANTHROPIC_API_KEY  = (ไม่บังคับ) เปิดให้ AI ตอบคำถามธรรมชาติ
   ไม่ตั้ง META_PAGE_TOKEN → รับ event ได้แต่ไม่ส่งตอบ (เหมาะตอนทดสอบ verify)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/default/documents`;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GRAPH = 'https://graph.facebook.com/v18.0';

function fsVal(v) {
  if (!v) return null;
  if (v.stringValue != null) return v.stringValue;
  if (v.integerValue != null) return +v.integerValue;
  if (v.booleanValue != null) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fsVal);
  if (v.mapValue) { const o = {}, f = v.mapValue.fields || {}; for (const k in f) o[k] = fsVal(f[k]); return o; }
  return null;
}

async function getBotConfig() {
  try {
    const r = await fetch(`${FS_BASE}/bot_config/replies`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { rules: [], greeting: '', fallback: '' };
    const doc = await r.json();
    const f = doc.fields || {};
    return { rules: fsVal(f.rules) || [], greeting: fsVal(f.greeting) || '', fallback: fsVal(f.fallback) || '' };
  } catch { return { rules: [], greeting: '', fallback: '' }; }
}

// กฎคีย์เวิร์ดที่เจ้าของตั้ง (เหมือนเว็บ/LINE)
function ruleReply(text, cfg) {
  const t = String(text || '').toLowerCase();
  for (const r of (cfg.rules || [])) {
    const kws = (Array.isArray(r.keywords) ? r.keywords : String(r.keywords || '').split(','))
      .map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    if (kws.some((k) => k && t.indexOf(k) >= 0)) return r.answer;
  }
  return null;
}

async function aiReply(text) {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    let catalog = '';
    try {
      const r = await fetch(`${FS_BASE}/products/catalog`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const doc = await r.json();
        const items = (doc.fields && fsVal(doc.fields.items)) || [];
        catalog = items.slice(0, 60).map((p) => `- ${p.name || ''}${p.brand ? ' (' + p.brand + ')' : ''}${p.price ? ' ' + p.price + '฿' : ''}`).join('\n');
      }
    } catch { /* ignore */ }
    const system =
      'คุณคือผู้ช่วยตอบลูกค้าของร้าน M.E.Tools (ร้านเครื่องมือช่าง เชียงใหม่) ตอบภาษาไทยสุภาพ กระชับ เป็นกันเอง ' +
      'ตอบจากข้อมูลร้านเท่านั้น ถ้าไม่รู้ให้บอกว่าจะให้แอดมินติดต่อกลับ ไม่เกิน 3-4 บรรทัด\n\n' +
      (catalog ? 'สินค้าในร้าน (ย่อ):\n' + catalog : '');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, system, messages: [{ role: 'user', content: String(text || '') }] }),
      signal: AbortSignal.timeout(18000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return (data.content && data.content[0] && data.content[0].text) || null;
  } catch { return null; }
}

async function buildReply(text) {
  const cfg = await getBotConfig();
  if (/^(สวัสดี|หวัดดี|hello|hi|hey)/i.test(String(text || '').trim()) && cfg.greeting) return cfg.greeting;
  return ruleReply(text, cfg) || (await aiReply(text)) || cfg.fallback ||
    'ขอบคุณสำหรับข้อความครับ 🙏 สนใจเครื่องมือหมวดไหนเป็นพิเศษ แจ้งได้เลยครับ';
}

async function sendMessage(recipientId, text) {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) { console.log('[messenger] no META_PAGE_TOKEN — skip send'); return; }
  try {
    await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: 'RESPONSE', message: { text: String(text).slice(0, 1900) } }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) { console.error('[messenger] send', e?.message); }
}

export default async function handler(req, res) {
  // 1) ยืนยัน webhook (Meta เรียก GET ครั้งเดียวตอนตั้งค่า)
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === process.env.META_VERIFY_TOKEN) {
      res.status(200).send(q['hub.challenge']); return;
    }
    res.status(403).send('forbidden'); return;
  }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { res.status(200).json({ ok: false }); return; }

  // ตอบ 200 เร็ว ๆ ก่อน เพื่อไม่ให้ Meta retry (ประมวลผลต่อแบบ best-effort)
  res.status(200).json({ ok: true });

  try {
    // รองรับทั้ง Messenger (object:'page') และ Instagram (object:'instagram')
    const entries = body.entry || [];
    for (const entry of entries) {
      const events = entry.messaging || entry.standby || [];
      for (const ev of events) {
        const senderId = ev.sender && ev.sender.id;
        const text = ev.message && ev.message.text;
        if (!senderId || !text || (ev.message && ev.message.is_echo)) continue;
        const reply = await buildReply(text);
        await sendMessage(senderId, reply);
      }
    }
  } catch (e) { console.error('[messenger-webhook]', e?.message); }
}
