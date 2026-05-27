/* =====================================================================
   LINE Messaging API — Webhook (Vercel Node.js Function)
   ---------------------------------------------------------------------
   บอทตอบลูกค้าแบบทีละขั้น สุภาพ บอกราคาเป็นข้อมูลสุดท้าย
   อ่านสินค้าสด ๆ จาก Firestore + จดจำบทสนทนาผ่าน bot_sessions

   ✏️ จะแก้คำตอบของบอท แก้ในไฟล์นี้ — อ่านคู่มือใน README.md หัวข้อ
      "แก้คำตอบบอท LINE"
   ===================================================================== */

import crypto from 'node:crypto';

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';

// ===== ข้อมูลร้าน (แก้ตรงนี้ถ้าเปลี่ยน) =================================
const SHOP = {
  company: 'บริษัท เอ็ม.อี.ทูลส์ จำกัด',
  address: '199/6 ม.7 ต.สันปูเลย อ.ดอยสะเก็ด จ.เชียงใหม่ 50220',
  phone: '081-3706466, 053-104699',
  hoursWeek: 'จันทร์ – เสาร์ 8:00 – 17:00 น.',
  hoursSun: 'อาทิตย์ 8:00 – 15:00 น.',
  line: 'https://lin.ee/so6euhT',
  website: 'https://metools-rho.vercel.app',
};

const HELP_TEXT =
  'สอบถามได้เลยครับ 🙂\n' +
  '• เลือกประเภท \n' +
  '• ถ้าใส่รหัสสินค้าจะดูสเป็กทันที\n' +
  '• "พนักงาน" — ขอคุยกับแอดมิน';

// ===== ป้ายชื่อหมวด (สำหรับพูดให้ลูกค้าฟังเข้าใจ) ========================
const CATEGORY_LABELS = {
  drill: 'สว่าน / ไขควง',
  saw: 'เลื่อย',
  grinder: 'เครื่องเจียร',
  battery: 'แบตเตอรี่ / ที่ชาร์จ',
  measure: 'เครื่องมือวัด',
  hand: 'เครื่องมือช่างมือ',
  power: 'เครื่องมือไฟฟ้าอื่นๆ',
};

// ===== ตัวจับคำ (intent detection) =====================================
// ✏️ เพิ่มคำที่ลูกค้าใช้บ่อยที่ตรงนี้ได้
function detectCategory(text) {
  const t = String(text || '').toLowerCase();
  if (/(สว่าน|ไขควง|กระแทก|drill|driver|โรตารี)/.test(t)) return 'drill';
  if (/(เลื่อย|saw|วงเดือน|จิ๊กซอว์)/.test(t)) return 'saw';
  if (/(เจียร|grinder|ลับ)/.test(t)) return 'grinder';
  if (/(แบต|battery|battary|ชาร์จ|charger|พลังงาน)/.test(t)) return 'battery';
  if (/(วัด|measure|เลเซอร์|laser|ตลับเมตร|ระดับน้ำ)/.test(t)) return 'measure';
  if (/(ประแจ|wrench|กล่อง.*เครื่องมือ|ค้อน|hammer)/.test(t)) return 'hand';
  if (/(ปั๊มลม|compressor|อัดลม|เป่าลม)/.test(t)) return 'power';
  return null;
}

function detectBrand(text) {
  const t = String(text || '').toUpperCase();
  if (/(DEWALT|เดวอลท์|เดอวอลท์|ดีวอลท์)/i.test(text)) return 'DEWALT';
  if (/(MAKITA|มาคิตะ|มากิตะ)/i.test(text)) return 'MAKITA';
  if (/(BOSCH|บอช|บ๊อช)/i.test(text)) return 'BOSCH';
  if (/(OSUKA|โอสุกะ)/i.test(text)) return 'OSUKA';
  if (/(STANLEY|สแตนเลย์|สแตนลี่ย์)/i.test(text)) return 'STANLEY';
  if (/(INGCO|อิงโก)/i.test(text)) return 'INGCO';
  // also match SKU prefix
  if (/^DW[-_]/i.test(t)) return 'DEWALT';
  if (/^MK[-_]/i.test(t)) return 'MAKITA';
  if (/^BS[-_]/i.test(t)) return 'BOSCH';
  return null;
}

function detectSku(text) {
  // จับรูปแบบเช่น DW-DCD805, DCD805, MK-HR2470
  const m = String(text || '').toUpperCase().match(/(?:[A-Z]{2,3}-)?[A-Z]{2,4}\d{3,6}/);
  return m ? m[0] : null;
}

function isWildcardAny(text) {
  return /(ทั้งหมด|ทุกแบรนด์|ทุกยี่ห้อ|ไม่ระบุ|อะไรก็ได้|ใดก็ได้|ไม่เลือก)/i.test(text);
}

// ============================================================
// Firestore catalog (5 min cache)
// ============================================================
let _catalogCache = null;
let _catalogFetchedAt = 0;
const CATALOG_TTL_MS = 5 * 60 * 1000;

async function getCatalog() {
  if (_catalogCache && Date.now() - _catalogFetchedAt < CATALOG_TTL_MS) return _catalogCache;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/products/catalog`;
  try {
    const res = await fetch(url);
    if (!res.ok) { _catalogCache = []; _catalogFetchedAt = Date.now(); return []; }
    const doc = await res.json();
    const itemsField = doc?.fields?.items;
    const items = itemsField ? (itemsField.arrayValue?.values || []).map(unwrapFsValue) : [];
    _catalogCache = items; _catalogFetchedAt = Date.now();
    console.log('[catalog] loaded', items.length, 'products');
    return items;
  } catch (err) {
    console.error('[catalog] fetch threw', err?.message);
    return _catalogCache || [];
  }
}

function unwrapFsValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) {
    const out = {}, f = v.mapValue.fields || {};
    for (const k in f) out[k] = unwrapFsValue(f[k]);
    return out;
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrapFsValue);
  return null;
}

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

// ============================================================
// Session: จำว่าลูกค้าคนนี้กำลังถามเรื่องอะไรอยู่ (TTL 10 นาที)
// ============================================================
const SESSION_TTL_MS = 10 * 60 * 1000;

async function getSession(userId) {
  if (!userId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${userId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = await res.json();
    const fields = {}; for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]);
    if (fields.updatedAt && Date.now() - new Date(fields.updatedAt).getTime() > SESSION_TTL_MS) return null;
    return fields;
  } catch { return null; }
}

async function setSession(userId, data) {
  if (!userId) return;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(userId)}`;
  const body = { fields: toFsFields({ ...data, updatedAt: new Date().toISOString() }) };
  try {
    await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (err) { console.error('[session] set threw', err?.message); }
}

async function clearSession(userId) {
  if (!userId) return;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(userId)}`;
  try { await fetch(url, { method: 'DELETE' }); } catch {}
}

// ============================================================
// ฟอร์แมตคำตอบ
// ============================================================
function specsToText(specs) {
  if (!Array.isArray(specs)) return '';
  return specs.slice(0, 4).map((s) => {
    if (Array.isArray(s)) return `  • ${s[0]}: ${s[1]}`;
    if (s && typeof s === 'object') return `  • ${s.label}: ${s.value}`;
    return '';
  }).filter(Boolean).join('\n');
}

function formatProduct(p) {
  const lines = [`🛠️ ${p.name}`, `แบรนด์: ${p.brand || '-'}    รหัส: ${p.sku || '-'}`];
  const av = p.available != null ? p.available : Math.max(0, (p.stock || 0) - (p.rented || 0));
  lines.push(av > 0 ? `📦 มีพร้อมส่ง ${av} ชิ้นครับ` : `📦 ขออภัย สินค้าหมดชั่วคราวครับ 🙏`);
  const sp = specsToText(p.specs);
  if (sp) lines.push('\n📋 สเป็ก:\n' + sp);
  // ราคา = ข้อมูลสุดท้าย (ตามคำขอ)
  const priceLines = [];
  if (p.forSale && p.price) priceLines.push(`💰 ราคาขาย: ${Number(p.price).toLocaleString()} บาท`);
  if (p.forRent && p.rentPerDay) priceLines.push(`📅 ค่าเช่า/วัน: ${Number(p.rentPerDay).toLocaleString()} บาท`);
  if (priceLines.length) lines.push('', ...priceLines);
  lines.push(`\nดูรูปเต็ม: ${SHOP.website}/product.html?id=${p.id || ''}`);
  return lines.join('\n');
}

function formatProductList(matches) {
  if (matches.length === 1) return formatProduct(matches[0]);
  const lines = [`พบ ${matches.length} รุ่นครับ 🛠️\n`];
  matches.slice(0, 5).forEach((p) => {
    const av = p.available != null ? p.available : Math.max(0, (p.stock || 0) - (p.rented || 0));
    const stock = av > 0 ? `มี ${av} ชิ้น` : 'หมด';
    const price = p.forSale && p.price ? `${Number(p.price).toLocaleString()}฿` : '';
    const rent = p.forRent && p.rentPerDay ? `เช่า ${Number(p.rentPerDay)}฿/วัน` : '';
    lines.push(`• ${p.name}`);
    lines.push(`  รหัส ${p.sku || '-'} · ${stock}${price ? ' · ' + price : ''}${rent ? ' · ' + rent : ''}`);
  });
  if (matches.length > 5) lines.push(`\n... และอีก ${matches.length - 5} รุ่น`);
  lines.push(`\n💬 พิมพ์รหัสสินค้าที่สนใจ (เช่น DCD805) เพื่อดูสเป็กเต็มครับ`);
  return lines.join('\n');
}

function uniqueBrandsForCategory(products, cat) {
  const set = new Set();
  products.filter((p) => p.category === cat).forEach((p) => p.brand && set.add(p.brand));
  return Array.from(set).sort();
}

// ============================================================
// 🤖 หัวใจของบอท — ตัวเลือกคำตอบทีละขั้น
// ============================================================
async function smartReply(userId, text) {
  const products = await getCatalog();
  const session = await getSession(userId);

  const sku = detectSku(text);
  const category = detectCategory(text);
  const brand = detectBrand(text);

  // 1) ลูกค้าพิมพ์รหัสสินค้า → ตอบรายละเอียดทันที (รูปแบบ ราคาท้ายสุด)
  if (sku) {
    const matches = products.filter((p) => {
      const ps = String(p.sku || '').toUpperCase();
      return ps && (ps === sku || ps.includes(sku) || sku.includes(ps));
    });
    if (matches.length === 1) { await clearSession(userId); return formatProduct(matches[0]); }
    if (matches.length > 1) { await clearSession(userId); return formatProductList(matches); }
  }

  // 2) ลูกค้าเคยถามหมวดมาแล้ว → รอบนี้เป็นแบรนด์
  if (session && session.expecting === 'brand' && session.category) {
    const cat = session.category;
    if (isWildcardAny(text)) {
      const all = products.filter((p) => p.category === cat);
      await clearSession(userId);
      if (!all.length) return `ขออภัย ตอนนี้${CATEGORY_LABELS[cat] || ''}ไม่มีในสต๊อกครับ 🙏`;
      return formatProductList(all);
    }
    if (brand) {
      const filtered = products.filter((p) => p.category === cat && String(p.brand || '').toUpperCase() === brand);
      await clearSession(userId);
      if (!filtered.length) {
        const brands = uniqueBrandsForCategory(products, cat);
        return `ขออภัย ตอนนี้${brand} ${CATEGORY_LABELS[cat] || ''}ยังไม่มีในสต๊อกครับ 🙏\nที่มีคือ: ${brands.join(' / ') || '—'}`;
      }
      return formatProductList(filtered);
    }
    // ตอบไม่ตรง — ถามอีกที สั้น ๆ
    const brands = uniqueBrandsForCategory(products, cat);
    return `ขออภัยครับ ไม่เข้าใจ 🙏\nลองพิมพ์ชื่อแบรนด์ได้เลย เช่น: ${brands.join(', ')}\nหรือพิมพ์ "ทั้งหมด" ดูทุกแบรนด์ครับ`;
  }

  // 3) ระบุหมวด+แบรนด์ในข้อความเดียว → แสดงผลเลย ไม่ต้องถามต่อ
  if (category && brand) {
    const filtered = products.filter((p) => p.category === category && String(p.brand || '').toUpperCase() === brand);
    if (filtered.length) { await clearSession(userId); return formatProductList(filtered); }
  }

  // 4) ระบุแค่หมวด → ถามแบรนด์ก่อน (multi-turn)
  if (category) {
    const brands = uniqueBrandsForCategory(products, category);
    await setSession(userId, { category, expecting: 'brand' });
    return `สนใจ${CATEGORY_LABELS[category] || ''}ใช่ไหมคะ 🛠️\nอยากดูแบรนด์ไหนคะ?\n👉 ${brands.join(' / ')}\n\nหรือพิมพ์ "ทั้งหมด" ดูทุกแบรนด์ครับ`;
  }

  // 5) ระบุแค่แบรนด์ (ไม่บอกหมวด) → ลิสต์สินค้าทุกหมวดของแบรนด์นั้น
  if (brand) {
    const filtered = products.filter((p) => String(p.brand || '').toUpperCase() === brand);
    if (filtered.length) { await clearSession(userId); return formatProductList(filtered); }
  }

  // 6) คำสำคัญทั่วไป (ข้อมูลร้าน, ทักทาย)
  return basicReply(text);
}

// ============================================================
// 💬 คำตอบทั่วไป (ทักทาย / เวลาเปิด / ที่อยู่ / เบอร์)
// ✏️ แก้คำตอบประเภทนี้ตรงนี้
// ============================================================
function basicReply(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;

  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey|hej)/i.test(t)) {
    return `สวัสดีครับ ขอบคุณที่ทักมา M.E.Tools ท่ารั้วยินดีบริการ 🛠️\n\n${HELP_TEXT}`;
  }
  if (/(เวลา|เปิด|ปิด|กี่โมง|hours?|open)/i.test(t)) {
    return `🕐 เวลาทำการ\n${SHOP.hoursWeek}\n${SHOP.hoursSun}\n\nมาทักก่อนได้นะคะ จะเตรียมของรอให้ครับ 🙂`;
  }
  if (/(ที่อยู่|ที่ตั้ง|address|location|แผนที่|map|ไป.*ร้าน)/i.test(t)) {
    return `📍 ที่อยู่ร้าน\n${SHOP.address}\n\nLINE: ${SHOP.line}\nเว็บ: ${SHOP.website}`;
  }
  if (/(เบอร์|โทร|tel|phone|ติดต่อ|call)/i.test(t)) {
    return `📞 โทรหาเราได้เลยครับ\n${SHOP.phone}\nLINE: ${SHOP.line}`;
  }
  if (/(พนักงาน|แอดมิน|admin|staff|คุย.*คน|ตอบ.*คน)/i.test(t)) {
    return `รับทราบครับ จะแจ้งทีมงานให้นะคะ 🙏\nระหว่างนี้ลองดูสินค้าที่ ${SHOP.website} ก่อนได้ครับ`;
  }
  if (/(ขอบคุณ|thanks?|thank you|thx)/i.test(t)) {
    return `ยินดีครับ 🙏 ฝากร้านด้วยนะคะ 💪`;
  }
  if (/^(help|ช่วย|menu|เมนู|\?)$/i.test(t)) {
    return HELP_TEXT;
  }
  // ตอบสุภาพแบบ default
  return `ขอบคุณสำหรับข้อความครับ 🙏\n\n${HELP_TEXT}`;
}

// ============================================================
// 🧠 AI: Claude Opus 4.7 (ตอบลูกค้าด้วยภาษาธรรมชาติ)
// - prompt caching ลด cost (catalog cache ครั้งแรก, อ่านครั้งต่อ ๆ ไปถูก 10x)
// - adaptive thinking ให้ Claude คิดเองว่าควรไตร่ตรองนานแค่ไหน
// - ทำงานเฉพาะเมื่อมี env var ANTHROPIC_API_KEY เท่านั้น
//   ถ้าไม่มี = fallback ไป smartReply แบบกฎ
// ============================================================
function buildAISystemPrompt(products) {
  const catalogText = products.map((p) => {
    const avail = p.available != null ? p.available : Math.max(0, (p.stock || 0) - (p.rented || 0));
    const stock = avail > 0 ? `เหลือ ${avail} ชิ้น` : 'หมด';
    const price = p.forSale && p.price ? `${Number(p.price).toLocaleString()} บาท` : '-';
    const rent = p.forRent && p.rentPerDay ? `${Number(p.rentPerDay).toLocaleString()} บาท/วัน` : '-';
    const specs = (p.specs || []).map((s) => {
      if (Array.isArray(s)) return `${s[0]}=${s[1]}`;
      if (s && typeof s === 'object') return `${s.label}=${s.value}`;
      return '';
    }).filter(Boolean).join(', ');
    return `${p.sku || ''} | ${p.name} | แบรนด์:${p.brand || '-'} | หมวด:${CATEGORY_LABELS[p.category] || p.category} | ขาย:${price} | เช่า/วัน:${rent} | สต็อก:${stock} | สเป็ก:${specs}`;
  }).join('\n');

  return `คุณคือพนักงานต้อนรับของร้าน ${SHOP.company} (M.E.Tools ท่ารั้ว) จ.เชียงใหม่
ร้านเช่า–ซื้อเครื่องมือช่าง DEWALT และแบรนด์โปรอื่น ๆ มา ${products.length} รุ่น

== ข้อมูลร้าน ==
ที่อยู่: ${SHOP.address}
เบอร์โทร: ${SHOP.phone}
LINE: ${SHOP.line}
เวลาทำการ: ${SHOP.hoursWeek} | ${SHOP.hoursSun}
เว็บไซต์: ${SHOP.website}

== แคตตาล็อกสินค้าปัจจุบัน ==
${catalogText}

== กฎการตอบ (สำคัญ ห้ามผิด) ==
1. ตอบเป็นภาษาไทยสุภาพ ใช้คำลงท้ายว่า "ครับ" เท่านั้น — **ห้ามใช้ "ค่ะ" เด็ดขาด**
2. ตอบสั้น ทีละข้อความ ไม่ยัดข้อมูลเยอะในตอบเดียว
3. **บอกราคาเป็นข้อมูลสุดท้าย** ไม่บอกราคาทันทีในการตอบครั้งแรก
4. ลำดับการแนะนำสินค้า:
   ขั้น 1) ลูกค้าบอกแค่ประเภท (เช่น "สว่าน") → ถามแบรนด์ที่สนใจ พร้อมบอกแบรนด์ที่ร้านมี
   ขั้น 2) ลูกค้าระบุแบรนด์แล้ว → แนะนำ 1–3 รุ่นที่ตรงความต้องการ บอกชื่อ+สเป็กสั้น (ยังไม่บอกราคา)
   ขั้น 3) ลูกค้าสนใจรุ่นใดรุ่นหนึ่ง → ตอบสเป็กละเอียด **ปิดท้ายด้วยราคา**
   ข้อยกเว้น: ถ้าลูกค้าพิมพ์รหัสสินค้าตรง ๆ (เช่น DCD805) ตอบรายละเอียดเต็มได้เลย แต่ราคายังต้องอยู่ท้ายข้อความ
5. ใช้ emoji เล็กน้อยพอเหมาะ (🛠️ 📦 💰 📅) ไม่เกิน 2–3 ตัวต่อข้อความ
6. ถ้าไม่ทราบข้อมูล/ไม่ใช่สินค้าในแคตตาล็อก → ขอโทษและให้โทร ${SHOP.phone}
7. ถ้าลูกค้าถามเรื่องไม่เกี่ยวกับร้าน → ขอโทษและพากลับมาคุยเรื่องเครื่องมือ
8. ลูกค้าทักทาย → ทักทายกลับ + แนะนำสั้น ๆ ว่าช่วยอะไรได้บ้าง (ดูเครื่องมือ/เช่า/ซื้อ)
9. ลูกค้าขอคุยกับ "พนักงาน/แอดมิน" → บอกว่าจะแจ้งให้ และให้เบอร์ ${SHOP.phone}`;
}

async function aiReply(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const products = await getCatalog();
  if (!products.length) return null;

  const systemPrompt = buildAISystemPrompt(products);
  const startedAt = Date.now();
  const ctrl = new AbortController();
  // Vercel function timeout เป็น 60s บน Pro; เผื่อ 25s ให้ Claude ตอบ
  const timer = setTimeout(() => ctrl.abort(), 25000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        thinking: { type: 'adaptive' },
        system: [
          // cache_control บน text block สุดท้ายของ system = cache ทั้ง catalog
          // ครั้งแรกเขียน cache (~1.25x) ครั้งต่อ ๆ ไปอ่าน cache (~0.1x)
          { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: text }],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[ai] Claude API failed', res.status, body.slice(0, 300));
      return null;
    }

    const data = await res.json();
    const ms = Date.now() - startedAt;
    const u = data.usage || {};
    console.log('[ai] OK in', ms, 'ms — input:', u.input_tokens, '| cache_read:', u.cache_read_input_tokens, '| cache_create:', u.cache_creation_input_tokens, '| output:', u.output_tokens);

    const textBlocks = (data.content || []).filter((b) => b.type === 'text');
    if (!textBlocks.length) return null;
    return textBlocks.map((b) => b.text).join('\n').trim();
  } catch (err) {
    console.error('[ai] threw —', err?.name, err?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 🎯 Hybrid: รวม smartReply (กฎ, เร็ว) + aiReply (Claude, ฉลาด)
// ============================================================
async function handleMessage(userId, text) {
  // เริ่มจากกฎ — รวดเร็ว ไม่เสียค่า API ถ้าคำสั่งชัดเจน (เช่น "DCD805")
  const ruleReply = await smartReply(userId, text);

  // ถ้า ruleReply เป็นแค่คำตอบ generic (basicReply fallback) ลอง AI
  const isGenericFallback = ruleReply && /^ขอบคุณสำหรับข้อความ/.test(ruleReply);

  if (isGenericFallback || !ruleReply) {
    const ai = await aiReply(text);
    if (ai) return ai;
  }

  return ruleReply;
}

// ============================================================
// บันทึก log สนทนาลง Firestore (ให้แอดมินดูในหลังร้าน)
// ============================================================
async function logBotMessage(userId, text, reply) {
  if (!userId) return;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_messages`;
  const safe = (s, max) => String(s || '').slice(0, max);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          userId: { stringValue: safe(userId, 99) },
          text: { stringValue: safe(text, 4999) },
          reply: { stringValue: safe(reply, 4999) },
          source: { stringValue: 'line' },
          at: { timestampValue: new Date().toISOString() },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[log] write failed', res.status, body.slice(0, 200));
    }
  } catch (err) { console.error('[log] write threw', err?.message); }
}

// ============================================================
// LINE Reply API
// ============================================================
async function replyMessage(replyToken, text, token) {
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
  } finally { clearTimeout(timer); }
}

// ============================================================
// ตรวจลายเซ็น + อ่าน raw body
// ============================================================
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifySignature(secret, body, signature) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  try {
    const a = Buffer.from(expected); const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// ============================================================
// Handler
// ============================================================
export default async function handler(req, res) {
  if (req.method === 'GET') { res.status(200).send('LINE webhook is live ✅'); return; }
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }

  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!secret || !token) {
    console.error('[webhook] Missing LINE env vars');
    res.status(500).send('Server not configured'); return;
  }

  let rawBody;
  try { rawBody = await readRawBody(req); }
  catch { res.status(400).send('Bad request'); return; }

  const signature = req.headers['x-line-signature'];
  if (!verifySignature(secret, rawBody, signature)) {
    res.status(401).send('Invalid signature'); return;
  }

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { res.status(400).send('Bad JSON'); return; }

  const events = Array.isArray(payload.events) ? payload.events : [];
  console.log('[webhook] events:', events.length, '| types:', events.map((e) => e.type).join(','));

  await Promise.all(events.map(async (event) => {
    try {
      if (event.type === 'follow') {
        await replyMessage(event.replyToken,
          `สวัสดีครับ ขอบคุณที่เพิ่มเพื่อน 🙏\nM.E.Tools ท่ารั้วยินดีให้บริการ\n\n${HELP_TEXT}`,
          token);
        return;
      }
      if (event.type === 'message' && event.message?.type === 'text') {
        const userId = event.source?.userId;
        const userText = event.message.text;
        const reply = await handleMessage(userId, userText);
        console.log('[event] text:', JSON.stringify(userText).slice(0, 80), '| reply chars:', reply?.length);
        if (reply) {
          await Promise.all([
            replyMessage(event.replyToken, reply, token),
            logBotMessage(userId, userText, reply),
          ]);
        }
      }
    } catch (err) {
      console.error('[event] handler error:', err?.name, err?.message);
    }
  }));

  console.log('[webhook] done');
  res.status(200).send('OK');
}
