/* =====================================================================
   M.E.Tools — AI Suggest Reply (Vercel Node.js Function)
   ---------------------------------------------------------------------
   "สมองช่วยตอบ" ของระบบ AI เรียนรู้เอง — รับคำถามที่บอทตอบไม่ได้ แล้วให้
   Claude ร่างคำตอบภาษาไทยสุภาพจากข้อมูลร้านจริง (แคตตาล็อกสินค้า + กฎคำตอบเดิม)
   เจ้าของแค่กด "ให้ AI ร่างคำตอบ" → ตรวจ → กดเพิ่มเป็นกฎ บอทก็ตอบเองได้ครั้งต่อไป
   เจ้าของไม่ต้องพิมพ์คำตอบเอง

   ENV: ANTHROPIC_API_KEY (ไม่ตั้ง → { configured:false } → หน้าเว็บแจ้งให้ตั้งก่อน)

   contract:
     req:  { question: string }
     res:  { ok, configured, answer, keywords:[...] }
   ===================================================================== */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const FIREBASE_PROJECT = 'metools-724dc';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/default/documents`;

function fsVal(v) {
  if (!v) return null;
  if (v.stringValue != null) return v.stringValue;
  if (v.integerValue != null) return +v.integerValue;
  if (v.doubleValue != null) return +v.doubleValue;
  if (v.booleanValue != null) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fsVal);
  if (v.mapValue) { const o = {}, f = v.mapValue.fields || {}; for (const k in f) o[k] = fsVal(f[k]); return o; }
  return null;
}

// แคตตาล็อกย่อ (ชื่อ/แบรนด์/ราคา/คงเหลือ) — ให้ AI อ้างอิงสินค้าจริง
async function loadCatalogSummary() {
  try {
    const r = await fetch(`${FS_BASE}/products/catalog`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    const doc = await r.json();
    const items = (doc.fields && fsVal(doc.fields.items)) || [];
    return items.slice(0, 80).map((p) => {
      const price = p.price ? `${p.price}฿` : '';
      return `- ${p.name || ''}${p.brand ? ' (' + p.brand + ')' : ''} ${price} SKU:${p.sku || p.id || ''}`;
    }).join('\n');
  } catch { return ''; }
}

// กฎคำตอบเดิม (ใช้เป็นสไตล์/FAQ ให้ AI ตอบโทนเดียวกับร้าน)
async function loadBotFaq() {
  try {
    const r = await fetch(`${FS_BASE}/bot_config/replies`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    const doc = await r.json();
    const rules = (doc.fields && fsVal(doc.fields.rules)) || [];
    return rules.slice(0, 40).map((rule) => {
      const kw = Array.isArray(rule.keywords) ? rule.keywords.join(', ') : (rule.keywords || '');
      return `ถาม(${kw}) → ตอบ: ${rule.answer || ''}`;
    }).join('\n');
  } catch { return ''; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method-not-allowed' }); return; }

  if (!ANTHROPIC_API_KEY) { res.status(200).json({ ok: false, configured: false }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { res.status(400).json({ ok: false, configured: true, error: 'bad-json' }); return; }

  const question = String(body.question || '').trim().slice(0, 1000);
  if (!question) { res.status(400).json({ ok: false, configured: true, error: 'no-question' }); return; }

  try {
    const [catalog, faq] = await Promise.all([loadCatalogSummary(), loadBotFaq()]);
    const system =
      'คุณคือผู้ช่วยตอบลูกค้าของร้าน M.E.Tools (ร้านเครื่องมือช่าง DEWALT และแบรนด์โปร ที่ดอยสะเก็ด เชียงใหม่)\n' +
      'หน้าที่: ร่าง "คำตอบสำเร็จรูป" ภาษาไทยสุภาพ กระชับ เป็นกันเอง สำหรับคำถามที่บอทตอบไม่ได้ เพื่อให้เจ้าของกดบันทึกเป็นคำตอบอัตโนมัติ\n' +
      'กติกา:\n' +
      '- ตอบจากข้อมูลร้านที่ให้ด้านล่างเท่านั้น ห้ามแต่งราคา/สเปก/นโยบายที่ไม่มีข้อมูล\n' +
      '- ถ้าข้อมูลไม่พอ ให้ตอบกลาง ๆ อย่างสุภาพและชวนให้ลูกค้าแจ้งรายละเอียดเพิ่ม หรือบอกว่าจะให้แอดมินติดต่อกลับ\n' +
      '- คำตอบยาวไม่เกิน 3-4 บรรทัด เหมาะส่งในแชท\n' +
      '- ตอบกลับเป็น JSON เท่านั้น รูปแบบ: {"answer":"...","keywords":["คำ1","คำ2","คำ3"]}\n' +
      '  โดย keywords คือคำสั้น ๆ 2-5 คำที่ลูกค้าน่าจะพิมพ์เพื่อให้บอทจับคู่คำตอบนี้ครั้งต่อไป\n\n' +
      (catalog ? 'สินค้าในร้าน (ย่อ):\n' + catalog + '\n\n' : '') +
      (faq ? 'ตัวอย่างคำตอบเดิมของร้าน (ใช้เลียนแบบโทน):\n' + faq + '\n' : '');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 700, system,
        messages: [{ role: 'user', content: 'คำถามจากลูกค้า: "' + question + '"\n\nร่างคำตอบให้ร้านเป็น JSON ตามรูปแบบที่กำหนด' }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) { const e = await r.text(); res.status(502).json({ ok: false, configured: true, error: 'anthropic ' + r.status + ': ' + e.slice(0, 200) }); return; }
    const data = await r.json();
    const txt = (data.content && data.content[0] && data.content[0].text) || '';
    let parsed = null;
    try { const m = txt.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
    const answer = (parsed && parsed.answer) || txt.trim();
    const keywords = (parsed && Array.isArray(parsed.keywords)) ? parsed.keywords.slice(0, 6) : [];
    res.status(200).json({ ok: true, configured: true, answer, keywords });
  } catch (e) {
    res.status(502).json({ ok: false, configured: true, error: 'failed: ' + (e && e.message) });
  }
}
