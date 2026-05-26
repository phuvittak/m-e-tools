/* =====================================================================
   LINE Messaging API — Webhook (Vercel Node.js Function)
   ---------------------------------------------------------------------
   รับข้อความจาก LINE Official Account แล้วตอบกลับอัตโนมัติ
   อ่านสินค้าสด ๆ จาก Firestore (collection: products, doc: catalog)
   ตั้งค่า env vars ที่ Vercel:
     - LINE_CHANNEL_SECRET         (จาก LINE Developers Console)
     - LINE_CHANNEL_ACCESS_TOKEN   (จาก LINE Developers Console)
   ตั้ง Webhook URL ใน LINE Console เป็น:
     https://<your-vercel-domain>/api/line-webhook
   ===================================================================== */

import crypto from 'node:crypto';

const FIREBASE_PROJECT = 'metools-724dc';

// ----- ข้อมูลร้าน (ต้องตรงกับ DEFAULT_SETTINGS ใน webapp/assets/store.js) -----
const SHOP = {
  company: 'บริษัท เอ็ม.อี.ทูลส์ จำกัด',
  address: 'แยกท่ารั้ว ต.ท่าวังตาล อ.สารภี จ.เชียงใหม่ 50140',
  phone: '053-XXX-XXXX',
  hoursWeek: 'จันทร์ – เสาร์ 8:00 – 17:00 น.',
  hoursSun: 'อาทิตย์ 8:00 – 15:00 น.',
  line: '@metools',
  website: 'https://metools-rho.vercel.app',
};

const HELP_TEXT =
  'พิมพ์คำถามได้เลยครับ เช่น\n' +
  '• "เวลาเปิด" — ดูเวลาทำการ\n' +
  '• "ที่อยู่" — แผนที่ร้าน\n' +
  '• "เบอร์โทร" — ติดต่อร้าน\n' +
  '• ชื่อ/รหัสสินค้า เช่น "สว่าน" หรือ "DCD805" — ดูราคา/สต๊อก\n' +
  '• "พนักงาน" — คุยกับแอดมิน';

// ============================================================
// Firestore product catalog (cached 5 minutes in module scope)
// ============================================================
let _catalogCache = null;
let _catalogFetchedAt = 0;
const CATALOG_TTL_MS = 5 * 60 * 1000;

async function getCatalog() {
  if (_catalogCache && Date.now() - _catalogFetchedAt < CATALOG_TTL_MS) {
    return _catalogCache;
  }
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/products/catalog`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[catalog] Firestore fetch failed', res.status);
      _catalogCache = []; _catalogFetchedAt = Date.now();
      return _catalogCache;
    }
    const doc = await res.json();
    const itemsField = doc?.fields?.items;
    const items = itemsField ? (itemsField.arrayValue?.values || []).map(unwrapFsValue) : [];
    _catalogCache = items;
    _catalogFetchedAt = Date.now();
    console.log('[catalog] loaded', items.length, 'products');
    return items;
  } catch (err) {
    console.error('[catalog] fetch threw', err?.message);
    return _catalogCache || [];
  }
}

// Convert Firestore REST typed value → plain JS value
function unwrapFsValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) {
    const out = {};
    const f = v.mapValue.fields || {};
    for (const k in f) out[k] = unwrapFsValue(f[k]);
    return out;
  }
  if ('arrayValue' in v) {
    return (v.arrayValue.values || []).map(unwrapFsValue);
  }
  return null;
}

function specsToText(specs) {
  if (!Array.isArray(specs)) return '';
  return specs.slice(0, 4).map((s) => {
    if (Array.isArray(s)) return `  • ${s[0]}: ${s[1]}`;
    if (s && typeof s === 'object') return `  • ${s.label}: ${s.value}`;
    return '';
  }).filter(Boolean).join('\n');
}

function searchProducts(query, products) {
  const q = (query || '').toLowerCase().trim();
  if (!q || !products.length) return [];
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return [];

  const scored = products.map((p) => {
    const sku = String(p.sku || '').toLowerCase();
    const hay = [p.name, p.sku, p.brand, p.category].filter(Boolean).join(' ').toLowerCase();
    let score = 0;
    for (const w of words) {
      if (sku === w) score += 10;
      else if (sku && (sku.includes(w) || w.includes(sku))) score += 5;
      if (hay.includes(w)) score += 1;
    }
    return { p, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}

function formatProduct(p) {
  const lines = [`🛠️ ${p.name}`, `รหัส: ${p.sku || '-'} · ${p.brand || ''}`];
  if (p.forSale && p.price) lines.push(`💰 ราคาขาย: ${Number(p.price).toLocaleString()} บาท`);
  if (p.forRent && p.rentPerDay) lines.push(`📅 ค่าเช่า/วัน: ${Number(p.rentPerDay).toLocaleString()} บาท`);
  const avail = p.available != null ? p.available : Math.max(0, (p.stock || 0) - (p.rented || 0));
  lines.push(`📦 คงเหลือ: ${avail} ชิ้น${avail === 0 ? ' (สินค้าหมด — โทรเช็คก่อน)' : ''}`);
  const sp = specsToText(p.specs);
  if (sp) lines.push('สเป็ก:\n' + sp);
  lines.push(`\nดูรูป/รายละเอียดเต็ม: ${SHOP.website}/product.html?id=${p.id || ''}`);
  return lines.join('\n');
}

async function tryProductReply(text) {
  const products = await getCatalog();
  if (!products.length) return null;
  const matches = searchProducts(text, products);
  if (!matches.length) return null;
  if (matches.length === 1) return formatProduct(matches[0].p);
  const top = matches[0];
  // เด่นชัด — มีคะแนนนำชัดเจน
  if (top.score >= 5 && (matches.length < 2 || top.score >= matches[1].score * 2)) {
    return formatProduct(top.p);
  }
  const lines = [`🔎 พบสินค้า ${matches.length} รายการ — พิมพ์ชื่อ/รหัสให้ชัดขึ้นเพื่อดูรายละเอียด:`];
  for (const { p } of matches) {
    const price = p.forSale && p.price ? `${Number(p.price).toLocaleString()}฿` : '';
    const rent = p.forRent && p.rentPerDay ? `เช่า ${Number(p.rentPerDay).toLocaleString()}฿/วัน` : '';
    const tail = [price, rent].filter(Boolean).join(' · ');
    lines.push(`• ${p.name} (${p.sku || ''})${tail ? ' — ' + tail : ''}`);
  }
  return lines.join('\n');
}

// ----- ตัวจัดการคำตอบเริ่มต้น (ไม่เกี่ยวกับสินค้า) -----------------------
function buildReply(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;

  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey)/i.test(t)) {
    return `สวัสดีครับ! ${SHOP.company} ยินดีให้บริการ 🛠️\n\n${HELP_TEXT}`;
  }
  if (/(เวลา|เปิด|ปิด|กี่โมง|hours?|open)/i.test(t)) {
    return `🕐 เวลาทำการ\n${SHOP.hoursWeek}\n${SHOP.hoursSun}`;
  }
  if (/(ที่อยู่|ที่ตั้ง|address|location|แผนที่|map|ไป.*ร้าน)/i.test(t)) {
    return `📍 ที่อยู่ร้าน\n${SHOP.address}\n\nLINE: ${SHOP.line}\nเว็บไซต์: ${SHOP.website}`;
  }
  if (/(เบอร์|โทร|tel|phone|ติดต่อ|call)/i.test(t)) {
    return `📞 ติดต่อร้าน\nโทร: ${SHOP.phone}\nLINE: ${SHOP.line}`;
  }
  if (/(สินค้า|ราคา|เช่า|ซื้อ|product|catalog)/i.test(t)) {
    return `🧰 ดูสินค้าทั้งหมดที่เว็บไซต์\n${SHOP.website}/shop.html\n\nหรือพิมพ์ชื่อ/รหัสสินค้าที่อยากรู้ เช่น "DCD805"`;
  }
  if (/(พนักงาน|แอดมิน|admin|staff|คุย.*คน)/i.test(t)) {
    return `กำลังแจ้งแอดมินให้ครับ 🙏\nระหว่างนี้ลองดูเว็บไซต์ที่ ${SHOP.website} ได้เลย`;
  }
  if (/^(help|ช่วย|menu|เมนู|\?)$/i.test(t)) {
    return HELP_TEXT;
  }
  return `ขอบคุณสำหรับข้อความครับ 🙏\n\n${HELP_TEXT}`;
}

// ----- อ่าน raw body จาก request stream (ต้องใช้ raw bytes ตรวจ signature) -----
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ----- ตรวจลายเซ็น HMAC-SHA256 ของ LINE ---------------------------------
function verifySignature(secret, body, signature) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ----- LINE Reply API ---------------------------------------------------
async function replyMessage(replyToken, text, token) {
  console.log('[reply] calling LINE — chars:', text?.length);
  const startedAt = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
      signal: ctrl.signal,
    });
    const body = await res.text().catch(() => '');
    const ms = Date.now() - startedAt;
    if (res.ok) console.log('[reply] LINE OK', res.status, 'in', ms, 'ms');
    else console.error('[reply] LINE FAILED', res.status, 'in', ms, 'ms — body:', body);
  } catch (err) {
    console.error('[reply] LINE THREW —', err?.name, err?.message);
  } finally {
    clearTimeout(timer);
  }
}

// ----- Handler (Vercel Node.js function: req, res) ----------------------
export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).send('LINE webhook is live ✅');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!secret || !token) {
    console.error('[webhook] Missing LINE env vars');
    res.status(500).send('Server not configured');
    return;
  }

  let rawBody;
  try { rawBody = await readRawBody(req); }
  catch (err) { res.status(400).send('Bad request'); return; }

  const signature = req.headers['x-line-signature'];
  if (!verifySignature(secret, rawBody, signature)) {
    res.status(401).send('Invalid signature');
    return;
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { res.status(400).send('Bad JSON'); return; }

  const events = Array.isArray(payload.events) ? payload.events : [];
  console.log('[webhook] events:', events.length, '| types:', events.map((e) => e.type).join(','));

  await Promise.all(events.map(async (event) => {
    try {
      if (event.type === 'follow') {
        await replyMessage(
          event.replyToken,
          `สวัสดีครับ! ขอบคุณที่เพิ่มเพื่อน ${SHOP.company} 🛠️\n\n${HELP_TEXT}`,
          token
        );
        return;
      }
      if (event.type === 'message' && event.message?.type === 'text') {
        const userText = event.message.text;
        // ลองค้นสินค้าก่อน (ถ้าเจอแคตตาล็อก และมีสินค้าที่ match) ค่อย fallback ไป buildReply
        let reply = await tryProductReply(userText);
        if (!reply) reply = buildReply(userText);
        console.log('[event] text:', JSON.stringify(userText).slice(0, 80), '| reply chars:', reply?.length);
        if (reply) await replyMessage(event.replyToken, reply, token);
      }
    } catch (err) {
      console.error('[event] handler error:', err?.name, err?.message);
    }
  }));

  console.log('[webhook] done');
  res.status(200).send('OK');
}
