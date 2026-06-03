/* =====================================================================
   M.E.Tools — AI product importer (Vercel Node.js Function)
   ---------------------------------------------------------------------
   แอดมินป้อน URL หน้าสินค้า (KTW / iToolmart / ใดก็ได้) → endpoint นี้
   fetch HTML → strip → ส่ง Claude ให้แยกข้อมูลสินค้า → return products[]
   ===================================================================== */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n')
    .trim();
}

const SYSTEM_PROMPT = `คุณคือ AI ช่วยนำเข้าสินค้าสำหรับร้านเครื่องมือช่าง M.E.Tools
รับข้อความหน้าเว็บสินค้า (หลังลบ HTML แล้ว) → แยกสินค้าและ return JSON array

โครงสร้าง product object:
{
  "name": "ชื่อสินค้าเต็ม",
  "brand": "ยี่ห้อ เช่น DEWALT / MAKITA / BOSCH / STANLEY",
  "sku": "รหัสสินค้า (ถ้าไม่มีให้ใส่ string ว่าง)",
  "category": "หนึ่งใน: drill / saw / grinder / battery / measure / hand / power",
  "motorType": "ระบบมอเตอร์ เช่น ไร้แปรงถ่าน (Brushless) หรือ string ว่าง",
  "warrantyYears": 1,
  "price": 0,
  "rentPerDay": 0,
  "desc": "รายละเอียดหลัก (2-4 ประโยคภาษาไทย)",
  "specs": ["สเปคข้อ 1", "สเปคข้อ 2"],
  "shipSize": ""
}

กฎ:
- ตอบเป็น JSON array เท่านั้น: [{ ... }, { ... }]
- ไม่มี markdown ไม่มีข้อความอื่น
- ถ้าหน้าเว็บมีสินค้าหลายรายการ → ส่งทั้งหมด (สูงสุด 20 รายการ)
- ถ้าไม่พบข้อมูลสินค้าเลย → ส่ง []
- price/rentPerDay ใส่ 0 ถ้าหาไม่ได้
- category ต้องเป็นหนึ่งใน drill/saw/grinder/battery/measure/hand/power เท่านั้น`;

async function fetchPageText(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'th,en;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const text = stripHtml(html);
  return text.slice(0, 20000); // Claude ไม่ต้องการมากกว่านี้
}

async function parseWithClaude(text) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY ไม่ได้ตั้งค่า');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) { const e = await r.text(); throw new Error('Anthropic: ' + e.slice(0, 200)); }
  const data = await r.json();
  const raw = data?.content?.[0]?.text?.trim() || '[]';
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    return m ? JSON.parse(m[1].trim()) : [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const url = String(body.url || '').trim();
  const text = String(body.text || '').trim();

  if (!url && !text) { res.status(400).json({ error: 'ต้องระบุ url หรือ text' }); return; }

  try {
    let pageText = text;
    if (url) {
      try {
        pageText = await fetchPageText(url);
      } catch (e) {
        res.status(502).json({ error: 'fetch-failed', message: String(e.message || e) });
        return;
      }
    }

    const products = await parseWithClaude(pageText);
    if (!Array.isArray(products)) {
      res.status(200).json({ ok: true, products: [], warning: 'ไม่พบสินค้าในหน้านี้' });
      return;
    }

    // normalise — ensure required fields
    const normalized = products.map(function (p) {
      return {
        name: String(p.name || '').trim(),
        brand: String(p.brand || '').trim(),
        sku: String(p.sku || '').trim(),
        category: ['drill','saw','grinder','battery','measure','hand','power'].includes(p.category) ? p.category : 'power',
        motorType: String(p.motorType || '').trim(),
        warrantyYears: Number(p.warrantyYears) || 0,
        price: Number(p.price) || 0,
        rentPerDay: Number(p.rentPerDay) || 0,
        desc: String(p.desc || '').trim(),
        specs: Array.isArray(p.specs) ? p.specs.map(String).filter(Boolean) : [],
        shipSize: String(p.shipSize || '').trim(),
      };
    }).filter(function (p) { return p.name; });

    res.status(200).json({ ok: true, products: normalized });
  } catch (e) {
    console.error('[import-products] threw', e?.message);
    res.status(500).json({ error: 'internal', message: String(e?.message || e) });
  }
}
