/* =====================================================================
   M.E.Tools — AI hub (Vercel Node.js Function)
   ---------------------------------------------------------------------
   รวมหลายงาน AI ไว้ในฟังก์ชันเดียว (ประหยัดโควตา Serverless ของ Vercel)
   เลือกงานตามรูปแบบ request body:
     { text }            → แยกข้อมูลสินค้าเป็น fields (Claude)         [แอดมิน]
     { image }           → อ่านป้าย/ฉลาก ดึงรุ่น+Serial (Claude vision) [ฟอร์มประกัน]
     { url }             → นำเข้าสินค้าจากหน้าเว็บ (Gemini)            [แอดมิน import]
     { userId, text }    → บอทตอบแชตในเว็บ + เขียน Firestore           [ลูกค้าเว็บแชต]
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash-lite';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function unwrapFsValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrapFsValue);
  if ('mapValue' in v) { const out = {}, f = v.mapValue.fields || {}; for (const k in f) out[k] = unwrapFsValue(f[k]); return out; }
  return null;
}
function parseJson(txt, fallback) {
  try { return JSON.parse(txt); }
  catch { const m = String(txt).match(/```(?:json)?\s*([\s\S]*?)```/); try { return m ? JSON.parse(m[1].trim()) : fallback; } catch { return fallback; } }
}

/* ---------------- 1) แยกข้อมูลสินค้าจากข้อความ (Claude) ---------------- */
async function handleParse(res, raw) {
  if (!ANTHROPIC_API_KEY) { res.status(500).json({ error: 'no-api-key', message: 'ANTHROPIC_API_KEY ไม่ได้ตั้งค่าใน Vercel' }); return; }
  const systemPrompt = `คุณคือ AI ช่วยแยกข้อมูลสินค้าเครื่องมือช่าง จัดให้อ่านง่ายเป็นเรื่อง ๆ
รับข้อความดิบที่แอดมินวางมา → แยกเป็น JSON ตามโครงสร้างนี้ทุกครั้ง:

{
  "name": "ชื่อสินค้าเต็ม (ภาษาไทยหรืออังกฤษตามต้นฉบับ)",
  "brand": "ยี่ห้อ เช่น DEWALT / MAKITA / BOSCH",
  "sku": "รหัสสินค้า เช่น DCD991P2 (ถ้าไม่มีให้ใส่ string ว่าง)",
  "category": "หมวดหมู่: drill / saw / grinder / battery / measure / hand / power",
  "motorType": "ระบบมอเตอร์ เช่น ไร้แปรงถ่าน (Brushless) / มีแปรงถ่าน (Brushed)",
  "warrantyYears": 1,
  "shipSize": "ขนาด/น้ำหนักพร้อมส่ง เช่น 35 × 12 × 28 ซม. · ~2.5 กก.",
  "desc": "เกริ่นนำสั้น ๆ 1-2 ประโยค แล้วตามด้วยจุดเด่นเป็นบูลเล็ตทีละบรรทัด",
  "specs": ["ป้าย : ค่า", "แรงดันไฟ : 12V"]
}

กฎการจัดรูปแบบ (สำคัญมาก — ให้อ่านง่ายเป็นเรื่อง ๆ):
- ตอบเป็น JSON เท่านั้น ไม่มี markdown หรือข้อความอื่น
- "desc": บรรทัดแรกเป็นประโยคแนะนำสั้น ๆ 1-2 ประโยค จากนั้น **ขึ้นบรรทัดใหม่** (ใช้ \\n) เป็น
  จุดเด่นทีละข้อ แต่ละข้อขึ้นต้นด้วย "• " บรรทัดละ 1 เรื่อง (อย่ายัดรวมเป็นย่อหน้าเดียว)
  ถ้ามีหลายหมวด ใส่หัวข้อย่อยเป็นบรรทัดที่ลงท้ายด้วย ":" ก่อนกลุ่มบูลเล็ตได้
- "specs": เก็บเฉพาะสเปกเชิงเทคนิค/ตัวเลข เป็น "ป้าย : ค่า" ทีละรายการ
  (เช่น แรงดันไฟ, แรงบิด, รอบ/นาที, ขนาดหัวจับ, น้ำหนัก, ความจุแบต) ห้ามรวมหลายค่าในข้อเดียว
- รักษาข้อมูลทุกอย่างจากต้นฉบับ ห้ามตัดทิ้ง — ข้อมูลพรรณนาไว้ใน desc, ข้อมูลตัวเลขไว้ใน specs
- ถ้าไม่มีข้อมูลใด ใส่ string ว่าง / [] / 0 ตามชนิด`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content: raw }] }),
    });
    if (!r.ok) { const err = await r.text(); res.status(502).json({ error: 'anthropic-error', message: err }); return; }
    const data = await r.json();
    res.status(200).json({ ok: true, parsed: parseJson((data?.content?.[0]?.text || '{}').trim(), {}) });
  } catch (e) { res.status(500).json({ error: 'internal', message: e?.message }); }
}

/* ---------------- 2) อ่านป้าย/ฉลากจากรูป (Claude vision) ---------------- */
async function handleLabel(res, raw) {
  if (!ANTHROPIC_API_KEY) { res.status(500).json({ error: 'no-api-key', message: 'ANTHROPIC_API_KEY ไม่ได้ตั้งค่าใน Vercel' }); return; }
  const mm = /^data:(image\/[\w.+-]+);base64,(.*)$/.exec(raw);
  const mediaType = mm ? mm[1] : 'image/jpeg';
  const imgB64 = mm ? mm[2] : String(raw).replace(/^data:[^,]*,/, '');
  if (!imgB64) { res.status(400).json({ error: 'no-image' }); return; }
  const sys = `คุณคือผู้ช่วยอ่านป้าย/ฉลากเครื่องมือช่างจากรูปถ่าย — รองรับ "ทุกยี่ห้อ"
(DEWALT, MAKITA, BOSCH, OSUKA, INGCO, STANLEY, HITACHI/HiKOKI ฯลฯ) อ่านตามที่เห็นจริงบนป้าย
ตอบเป็น JSON เท่านั้น: {"model":"รหัสรุ่น เช่น OCHD802/DCD701 (ไม่เจอใส่ \\"\\")","serial":"Serial/SN เช่น NA015131 B1H7MDN (ไม่เจอใส่ \\"\\")","brand":"ยี่ห้อ (ไม่เจอใส่ \\"\\")","category":"ประเภทสั้นๆ เช่น สว่านไร้สาย/แบตเตอรี่ (ไม่แน่ใจใส่ \\"\\")"}
กฎ: อ่านเฉพาะที่เห็นจริง ห้ามเดา ถ้าไม่ชัดใส่ค่าว่าง · model มักเป็นรหัสตัวใหญ่ · serial มักยาวกว่าและอยู่ใกล้ QR/บาร์โค้ด`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 512, system: sys,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imgB64 } },
          { type: 'text', text: 'อ่านป้าย/ฉลากในรูปนี้ แล้วตอบเป็น JSON ตามรูปแบบ' },
        ] }],
      }),
    });
    if (!r.ok) { const e = await r.text(); res.status(502).json({ error: 'anthropic-error', message: e.slice(0, 200) }); return; }
    const data = await r.json();
    res.status(200).json({ ok: true, parsed: parseJson((data?.content?.[0]?.text || '{}').trim(), {}) });
  } catch (e) { res.status(500).json({ error: 'internal', message: e?.message }); }
}

/* ---------------- 3) นำเข้าสินค้าจาก URL (Gemini) ---------------- */
function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '').replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n').trim();
}
const IMPORT_SYSTEM = `คุณคือ AI ช่วยนำเข้าสินค้าสำหรับร้านเครื่องมือช่าง M.E.Tools
รับข้อความหน้าเว็บสินค้า (หลังลบ HTML แล้ว) → แยกสินค้าและ return JSON array
โครงสร้าง product object: { "name","brand","sku","category(drill/saw/grinder/battery/measure/hand/power)","motorType","warrantyYears","price","rentPerDay","desc","specs":[],"shipSize" }
กฎ: ตอบเป็น JSON array เท่านั้น · ไม่มี markdown · หลายรายการส่งทั้งหมด (สูงสุด 20) · ไม่พบส่ง [] · price/rentPerDay ใส่ 0 ถ้าหาไม่ได้ · category ต้องเป็นหนึ่งใน drill/saw/grinder/battery/measure/hand/power`;
function normalizeImported(p) {
  return {
    name: String(p.name || '').trim(), brand: String(p.brand || '').trim(), sku: String(p.sku || '').trim(),
    category: ['drill', 'saw', 'grinder', 'battery', 'measure', 'hand', 'power'].includes(p.category) ? p.category : 'power',
    motorType: String(p.motorType || '').trim(), warrantyYears: Number(p.warrantyYears) || 0,
    price: Number(p.price) || 0, rentPerDay: Number(p.rentPerDay) || 0, desc: String(p.desc || '').trim(),
    specs: Array.isArray(p.specs) ? p.specs.map(String).filter(Boolean) : [], shipSize: String(p.shipSize || '').trim(),
  };
}
// ดึงสินค้าด้วย Gemini (ฟรี) — โยน error ถ้าโควต้าเต็ม/ล่ม เพื่อให้ fallback ไป Claude
async function geminiExtract(pageText) {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);
  const gr = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: IMPORT_SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: pageText }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!gr.ok) throw new Error('gemini ' + gr.status);
  const data = await gr.json();
  return parseJson((data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]').trim(), []);
}
// ดึงสินค้าด้วย Claude (ใช้เป็น fallback เมื่อ Gemini ใช้ไม่ได้)
async function claudeExtract(pageText) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, system: IMPORT_SYSTEM, messages: [{ role: 'user', content: pageText }] }),
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const data = await r.json();
  return parseJson((data?.content?.[0]?.text || '[]').trim(), []);
}
// ดึงสินค้าด้วย Groq (ฟรี โควต้าเยอะ — OpenAI-compatible API) ใช้เป็นชั้นฟรีที่ 2
async function groqExtract(pageText) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + GROQ_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.2, max_tokens: 4096, messages: [{ role: 'system', content: IMPORT_SYSTEM }, { role: 'user', content: pageText }] }),
    signal: AbortSignal.timeout(40000),
  });
  if (!r.ok) throw new Error('groq ' + r.status);
  const data = await r.json();
  return parseJson((data?.choices?.[0]?.message?.content || '[]').trim(), []);
}
async function handleImport(res, url, textIn) {
  if (!GEMINI_API_KEY && !GROQ_API_KEY && !ANTHROPIC_API_KEY) { res.status(500).json({ error: 'no-api-key', message: 'ยังไม่ได้ตั้ง GEMINI_API_KEY / GROQ_API_KEY / ANTHROPIC_API_KEY ตัวใดเลยใน Vercel' }); return; }
  try {
    let pageText = String(textIn || '');
    if (url) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'th,en;q=0.9' }, signal: AbortSignal.timeout(12000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        pageText = stripHtml(await r.text()).slice(0, 20000);
      } catch (e) { res.status(502).json({ error: 'fetch-failed', message: String(e.message || e) }); return; }
    }
    if (!pageText.trim()) { res.status(200).json({ ok: true, products: [], warning: 'ไม่พบเนื้อหาในแหล่งนี้' }); return; }

    let products = null, via = '';
    const diag = []; // เก็บเหตุผลของแต่ละตัว เพื่อบอกชัดว่าติดตรงไหน
    // 1) ลอง Gemini ก่อน (ฟรี)
    if (GEMINI_API_KEY) {
      try { products = await geminiExtract(pageText); via = 'gemini'; }
      catch (e) { diag.push('Gemini ใช้ไม่ได้ (' + (e?.message || e) + ')'); }
    } else { diag.push('Gemini: ไม่ได้ตั้ง GEMINI_API_KEY'); }
    // 2) Gemini เต็ม/ล่ม → ลอง Groq (ฟรี)
    if (products == null) {
      if (GROQ_API_KEY) {
        try { products = await groqExtract(pageText); via = 'groq'; }
        catch (e) { diag.push('Groq ใช้ไม่ได้ (' + (e?.message || e) + ')'); }
      } else { diag.push('Groq: ยังไม่เห็น GROQ_API_KEY ใน deployment (อาจลืม Redeploy หลังใส่ค่า)'); }
    }
    // 3) ฟรีทั้งคู่เต็ม/ล่ม → ใช้ Claude (เสียเงิน) เป็นด่านสุดท้าย
    if (products == null) {
      if (ANTHROPIC_API_KEY) {
        try { products = await claudeExtract(pageText); via = 'claude'; }
        catch (e) { diag.push('Claude ใช้ไม่ได้ (' + (e?.message || e) + ')'); }
      } else { diag.push('Claude: ไม่ได้ตั้ง ANTHROPIC_API_KEY'); }
    }
    if (products == null) { res.status(502).json({ error: 'ai-unavailable', message: 'นำเข้าด้วย AI ไม่สำเร็จ — ' + diag.join(' · '), diag }); return; }

    const normalized = (Array.isArray(products) ? products : []).map(normalizeImported).filter(function (p) { return p.name; });
    res.status(200).json({ ok: true, products: normalized, via });
  } catch (e) { res.status(500).json({ error: 'internal', message: String(e?.message || e) }); }
}

/* ---------------- 4) บอทตอบแชตในเว็บ ---------------- */
let _cfgCache = null, _cfgAt = 0;
async function getBotConfig() {
  if (_cfgCache && Date.now() - _cfgAt < 5 * 60 * 1000) return _cfgCache;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_config/web_replies`;
  try {
    const r = await fetch(url);
    if (!r.ok) return { rentEnabled: true, greeting: '', fallback: '', rules: [] };
    const doc = await r.json(); const fields = {};
    for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]);
    _cfgCache = {
      rentEnabled: typeof fields.rentEnabled === 'boolean' ? fields.rentEnabled : true,
      greeting: String(fields.greeting || ''), fallback: String(fields.fallback || ''),
      rules: Array.isArray(fields.rules) ? fields.rules.map((r) => ({ keywords: Array.isArray(r?.keywords) ? r.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean) : [], answer: String(r?.answer || '') })).filter((r) => r.keywords.length && r.answer) : [],
    };
    _cfgAt = Date.now();
    return _cfgCache;
  } catch { return _cfgCache || { rentEnabled: true, greeting: '', fallback: '', rules: [] }; }
}
async function getSession(userId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(userId)}`;
  try { const r = await fetch(url); if (!r.ok) return null; const doc = await r.json(); const fields = {}; for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]); return fields; } catch { return null; }
}
function keywordReply(text, cfg) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  if (cfg.rentEnabled === false && /(เช่า|rent|เช็า)/i.test(t)) return 'ขออภัยครับ ตอนนี้ร้านยังไม่มีบริการเช่าเครื่องมือ มีแต่จำหน่ายขาดทั้งหมด 🙏';
  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey)/i.test(t)) return cfg.greeting || 'สวัสดีครับ 🙏 M.E.Tools ยินดีให้บริการ — สอบถามได้เลยครับ';
  if (/(ติดต่อ\s*(แอดมิน|เจ้าของ|คน)|คุยกับ\s*(แอดมิน|เจ้าของ|คน)|พนักงานจริง|มนุษย์)/i.test(t)) return '';
  for (const r of cfg.rules) for (const kw of r.keywords) if (kw && t.indexOf(kw) >= 0) return r.answer;
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
      method: 'POST', headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: systemPrompt, messages: [{ role: 'user', content: text }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.content?.[0]?.text?.trim() || null;
  } catch { return null; }
}
async function handleWebChat(res, userId, text) {
  const session = await getSession(userId);
  if (session && session.mode === 'human') { res.status(200).json({ ok: true, skipped: 'human-mode' }); return; }
  const cfg = await getBotConfig();
  let reply = keywordReply(text, cfg);
  if (reply === null) reply = await aiReply(text, cfg);
  if (reply === null) reply = cfg.fallback || 'ขอบคุณสำหรับข้อความครับ 🙏 สนใจเครื่องมือหมวดไหนเป็นพิเศษครับ?';
  if (!reply) { res.status(200).json({ ok: true, skipped: 'no-reply' }); return; }
  try {
    await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { userId: { stringValue: String(userId) }, role: { stringValue: 'bot' }, text: { stringValue: String(reply) }, source: { stringValue: 'web' }, at: { timestampValue: new Date().toISOString() } } }),
    });
    res.status(200).json({ ok: true, reply });
  } catch (e) { res.status(502).json({ error: 'write-failed', message: e?.message }); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (body.image) return handleLabel(res, String(body.image));
  if (body.url || body.import) return handleImport(res, String(body.url || '').trim(), body.text);
  if (body.userId && body.text) return handleWebChat(res, String(body.userId).trim(), String(body.text).trim());
  const text = String(body.text || '').trim();
  if (!text) { res.status(400).json({ error: 'missing-text' }); return; }
  return handleParse(res, text);
}
