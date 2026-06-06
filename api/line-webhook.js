/* =====================================================================
   LINE Messaging API — Webhook (Vercel Node.js Function)
   ---------------------------------------------------------------------
   บอท M.E.Tools ระดับมืออาชีพ
   • Flex Message สีเหลือง-ดำ DEWALT (กรอบสวย ไม่ดูเป็น AI)
   • Quick Reply ปุ่มลัดเด้งใต้ข้อความ
   • Human handoff — ลูกค้าขอ "ติดต่อเจ้าของ" → บอทเงียบ + push ไป LINE
     เจ้าของให้รู้ทันที
   • AI (Claude Opus 4.7) สำหรับคำถามภาษาธรรมชาติ — fallback ไปกฎ
   ===================================================================== */

import crypto from 'node:crypto';

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';

// ===== ข้อมูลร้าน ========================================================
const SHOP = {
  company: 'บริษัท เอ็ม.อี.ทูลส์ จำกัด',
  shortName: 'M.E.Tools ท่ารั้ว',
  address: '199/6 ม.7 ต.สันปูเลย อ.ดอยสะเก็ด จ.เชียงใหม่ 50220',
  phoneMobile: '081-3706466',
  phoneMobileCall: '0813706466',
  phoneOffice: '053-104699',
  phoneOfficeCall: '053104699',
  lineId: '@metools',
  hoursWeek: 'จันทร์ – เสาร์ 8:00 – 17:00 น.',
  hoursSun: 'อาทิตย์ 8:00 – 15:00 น.',
  line: 'https://lin.ee/so6euhT',
  website: 'https://metoolsshop.vercel.app',
};

// ===== สีแบรนด์ DEWALT ==================================================
const COLOR = {
  yellow: '#FFB81C',   // DEWALT yellow
  black: '#000000',
  white: '#FFFFFF',
  gray: '#666666',
  lightGray: '#E5E5E5',
  green: '#22C55E',
  red: '#EF4444',
};

const CATEGORY_LABELS = {
  drill: 'สว่าน / ไขควง',
  saw: 'เลื่อย',
  grinder: 'เครื่องเจียร',
  battery: 'แบตเตอรี่ / ที่ชาร์จ',
  measure: 'เครื่องมือวัด',
  hand: 'เครื่องมือช่างมือ',
  power: 'เครื่องมือไฟฟ้าอื่นๆ',
};

const HUMAN_HANDOFF_TTL_MS = 2 * 60 * 60 * 1000; // 2 ชั่วโมง จากนั้นบอทกลับมาตอบอัตโนมัติ

// ===== Intent detection ================================================
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
  if (/^DW[-_]/i.test(t)) return 'DEWALT';
  if (/^MK[-_]/i.test(t)) return 'MAKITA';
  if (/^BS[-_]/i.test(t)) return 'BOSCH';
  return null;
}

function detectSku(text) {
  const m = String(text || '').toUpperCase().match(/(?:[A-Z]{2,3}-)?[A-Z]{2,4}\d{3,6}/);
  return m ? m[0] : null;
}

function isWildcardAny(text) {
  return /(ทั้งหมด|ทุกแบรนด์|ทุกยี่ห้อ|ไม่ระบุ|อะไรก็ได้|ใดก็ได้|ไม่เลือก)/i.test(text);
}

function wantsHuman(text) {
  return /(ติดต่อแอดมิน|คุยกับแอดมิน|ติดต่อเจ้าของ|คุยกับเจ้าของ|ขอคุยกับคน|พนักงานจริง|ติดต่อเจ้าหน้าที่|admin|คน|มนุษย์)/i.test(text)
      && !/(\?|how|what|why|จะ|ทำไม|ยังไง)/i.test(text); // ไม่ใช่คำถาม
}

// ============================================================
// Firestore bot_config/replies (5 min cache) — เจ้าของแก้ผ่าน /admin/bot-replies.html
// ============================================================
let _botCfgCache = null;
let _botCfgFetchedAt = 0;
const BOT_CFG_TTL_MS = 5 * 60 * 1000;

async function getBotConfig() {
  if (_botCfgCache && Date.now() - _botCfgFetchedAt < BOT_CFG_TTL_MS) return _botCfgCache;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_config/replies`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      _botCfgCache = { rentEnabled: true, greeting: '', fallback: '', rules: [] };
      _botCfgFetchedAt = Date.now();
      return _botCfgCache;
    }
    const doc = await res.json();
    const fields = {};
    for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]);
    _botCfgCache = {
      rentEnabled: typeof fields.rentEnabled === 'boolean' ? fields.rentEnabled : true,
      greeting: String(fields.greeting || ''),
      fallback: String(fields.fallback || ''),
      rules: Array.isArray(fields.rules) ? fields.rules.map((r) => ({
        keywords: Array.isArray(r?.keywords) ? r.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean) : [],
        answer: String(r?.answer || ''),
      })).filter((r) => r.keywords.length && r.answer) : [],
    };
    _botCfgFetchedAt = Date.now();
    return _botCfgCache;
  } catch (err) {
    console.error('[bot_config] fetch threw', err?.message);
    return _botCfgCache || { rentEnabled: true, greeting: '', fallback: '', rules: [] };
  }
}

// จับคีย์เวิร์ดเจอตัวใดตัวหนึ่ง → ใช้ answer ของ rule นั้น
function customRuleReply(text, config) {
  const t = String(text || '').toLowerCase();
  if (!t || !config?.rules?.length) return null;
  for (const r of config.rules) {
    for (const kw of r.keywords) {
      if (kw && t.indexOf(kw) >= 0) return r.answer;
    }
  }
  return null;
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
// Session — จำว่าลูกค้ากำลังถามอะไร + โหมด AI/human
// ============================================================
const SESSION_TTL_MS = 10 * 60 * 1000;

async function getSession(userId) {
  if (!userId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_sessions/${encodeURIComponent(userId)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = await res.json();
    const fields = {}; for (const k in doc.fields || {}) fields[k] = unwrapFsValue(doc.fields[k]);
    // โหมด human ใช้ TTL 2 ชม — หลังจากนั้นบอทกลับมาตอบเอง
    const ttl = fields.mode === 'human' ? HUMAN_HANDOFF_TTL_MS : SESSION_TTL_MS;
    if (fields.updatedAt && Date.now() - new Date(fields.updatedAt).getTime() > ttl) return null;
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
// 🎨 Flex Message builders — สีเหลือง-ดำ DEWALT
// ============================================================
function flexHeader(subtitle) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: COLOR.black,
    paddingAll: '12px',
    contents: [
      { type: 'text', text: 'M.E.TOOLS', color: COLOR.yellow, weight: 'bold', size: 'sm' },
      ...(subtitle ? [{ type: 'text', text: subtitle, color: COLOR.white, size: 'xxs', margin: 'xs' }] : []),
    ],
  };
}

function flexProductCard(p) {
  const avail = p.available != null ? p.available : Math.max(0, (p.stock || 0) - (p.rented || 0));
  const inStock = avail > 0;
  const specRows = (p.specs || []).slice(0, 4).map((s) => {
    let label = '', value = '';
    if (Array.isArray(s)) { label = s[0]; value = s[1]; }
    else if (s && typeof s === 'object') { label = s.label; value = s.value; }
    return {
      type: 'box', layout: 'baseline', spacing: 'sm',
      contents: [
        { type: 'text', text: String(label || ''), color: COLOR.gray, size: 'xs', flex: 3 },
        { type: 'text', text: String(value || ''), color: COLOR.black, size: 'xs', flex: 4, weight: 'bold', wrap: true },
      ],
    };
  });

  const priceBoxes = [];
  if (p.forSale && p.price) {
    priceBoxes.push({
      type: 'box', layout: 'baseline',
      contents: [
        { type: 'text', text: '💰 ราคาขาย', color: COLOR.gray, size: 'sm', flex: 1 },
        { type: 'text', text: `${Number(p.price).toLocaleString()} บาท`, color: COLOR.black, weight: 'bold', size: 'sm', flex: 0, align: 'end' },
      ],
    });
  }
  if (p.forRent && p.rentPerDay) {
    priceBoxes.push({
      type: 'box', layout: 'baseline', margin: 'sm',
      contents: [
        { type: 'text', text: '📅 เช่า/วัน', color: COLOR.gray, size: 'sm', flex: 1 },
        { type: 'text', text: `${Number(p.rentPerDay).toLocaleString()} บาท`, color: COLOR.black, weight: 'bold', size: 'sm', flex: 0, align: 'end' },
      ],
    });
  }

  return {
    type: 'bubble',
    size: 'mega',
    // รูปสินค้าด้านบนการ์ด — ดึงผ่าน /api/product-image (แปลง base64 ใน Firestore เป็น URL จริง)
    // ถ้าสินค้าไม่มีรูป endpoint จะส่งโลโก้ร้านแทน จึงไม่มีรูปแตก
    ...(p.id ? { hero: {
      type: 'image',
      url: `${SHOP.website}/api/product-image?id=${encodeURIComponent(p.id)}`,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'fit',              // เห็นรูปเต็มทั้งชิ้น ไม่ครอป/ไม่ขาด
      backgroundColor: '#FFFFFF',     // รูปสินค้าพื้นขาวอยู่แล้ว → เนียนไปกับการ์ด
      action: { type: 'uri', label: 'ดูสินค้า', uri: `${SHOP.website}/product.html?id=${p.id}` },
    } } : {}),
    header: flexHeader(`${p.brand || ''} · ${CATEGORY_LABELS[p.category] || ''}`),
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
      contents: [
        { type: 'text', text: p.name, weight: 'bold', size: 'md', wrap: true, color: COLOR.black },
        { type: 'text', text: `รหัสสินค้า: ${p.sku || '-'}`, size: 'xxs', color: COLOR.gray },
        { type: 'separator', margin: 'md' },
        ...(specRows.length ? [{ type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: specRows }] : []),
        { type: 'separator', margin: 'md' },
        {
          type: 'box', layout: 'baseline', margin: 'md',
          contents: [
            { type: 'text', text: inStock ? `📦 มี ${avail} ชิ้น` : '📦 หมดชั่วคราว', color: inStock ? COLOR.green : COLOR.red, size: 'sm', weight: 'bold' },
          ],
        },
        ...priceBoxes,
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
      contents: [
        {
          type: 'button', style: 'primary', color: COLOR.yellow, height: 'sm',
          action: { type: 'uri', label: '🛒 ดู / สั่งซื้อในเว็บ', uri: `${SHOP.website}/product.html?id=${p.id || ''}` },
        },
        {
          type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'message', label: '💬 ติดต่อแอดมิน', text: 'ติดต่อแอดมิน' },
        },
      ],
    },
    styles: { footer: { separator: true } },
  };
}

function flexProductCarousel(products) {
  return {
    type: 'flex',
    altText: `พบสินค้า ${products.length} รุ่น`,
    contents: {
      type: 'carousel',
      contents: products.slice(0, 10).map(flexProductCard),
    },
  };
}

function flexProduct(p) {
  return { type: 'flex', altText: `${p.name} (${p.sku || ''})`, contents: flexProductCard(p) };
}

function flexContactMenu() {
  return {
    type: 'flex',
    altText: 'ติดต่อร้าน M.E.Tools',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: flexHeader('ติดต่อเรา'),
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: 'เลือกช่องทางที่สะดวกครับ 🙏', size: 'md', weight: 'bold', color: COLOR.black },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md',
            contents: [
              { type: 'box', layout: 'baseline', contents: [
                { type: 'text', text: '📍 ที่อยู่', size: 'sm', color: COLOR.gray, flex: 1 },
              ]},
              { type: 'text', text: SHOP.address, size: 'sm', color: COLOR.black, wrap: true },
              { type: 'separator', margin: 'sm' },
              { type: 'box', layout: 'baseline', contents: [
                { type: 'text', text: '🕐 เวลาทำการ', size: 'sm', color: COLOR.gray, flex: 1 },
              ]},
              { type: 'text', text: `${SHOP.hoursWeek}\n${SHOP.hoursSun}`, size: 'sm', color: COLOR.black, wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          {
            type: 'button', style: 'primary', color: COLOR.black, height: 'sm',
            action: { type: 'uri', label: `📱 มือถือ ${SHOP.phoneMobile}`, uri: `tel:${SHOP.phoneMobileCall}` },
          },
          {
            type: 'button', style: 'primary', color: '#333333', height: 'sm',
            action: { type: 'uri', label: `☎️ สำนักงาน ${SHOP.phoneOffice}`, uri: `tel:${SHOP.phoneOfficeCall}` },
          },
          {
            type: 'button', style: 'primary', color: '#06C755', height: 'sm',
            action: { type: 'uri', label: `💬 LINE ${SHOP.lineId}`, uri: SHOP.line },
          },
          {
            type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'uri', label: '🌐 ดูเว็บไซต์', uri: SHOP.website },
          },
        ],
      },
    },
  };
}

// ข้อความต้อนรับเริ่มต้น (plain text + emoji) — เลียนสไตล์ DeWalt Thailand OA
// เจ้าของแก้ได้ใน /admin/bot-replies.html (override ผ่าน bot_config.greeting)
// rentEnabled: ถ้าร้านไม่มีบริการเช่า ระบบจะตัดบรรทัด "เช่า" ออก
function defaultWelcomeText(opts = {}) {
  const lines = [
    `🛠️ สวัสดีครับ ${SHOP.shortName}`,
    `ยินดีต้อนรับ — แจ้งข้อมูลที่ต้องการสอบถามได้โดย`,
    ``,
    `🔧 อะไหล่ — แจ้งชื่อรุ่นสินค้าและอะไหล่ที่ต้องการ`,
    `⚙️ การใช้งาน — แจ้งปัญหาที่เกิดขึ้น`,
    `📦 สินค้า — แจ้งชื่อรุ่นสินค้าที่สนใจ`,
  ];
  if (opts.rentEnabled !== false) lines.push(`💰 เช่า — เครื่องมือเช่ารายวัน`);
  lines.push(
    ``,
    `ทางแอดมินจะตอบกลับเร็วที่สุดภายใน 24 ชม.`,
    ``,
    `⏰ เวลาทำการ`,
    `${SHOP.hoursWeek}`,
    `${SHOP.hoursSun}`,
    ``,
    `📞 หากไม่มีการตอบกลับภายใน 24 ชม.`,
    `ติดต่อได้ที่ ${SHOP.phoneMobile} / ${SHOP.phoneOffice}`
  );
  return lines.join('\n');
}

function flexWelcome() {
  return {
    type: 'flex',
    altText: `ยินดีต้อนรับ ${SHOP.shortName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: flexHeader('ยินดีต้อนรับ 🙏'),
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '20px',
        contents: [
          { type: 'text', text: 'สวัสดีครับ 🛠️', weight: 'bold', size: 'xxl', color: COLOR.black },
          { type: 'text', text: `${SHOP.shortName} ยินดีให้บริการครับ`, size: 'md', color: COLOR.gray, wrap: true, margin: 'sm' },
          { type: 'separator', margin: 'lg' },
          { type: 'text', text: 'เครื่องมือช่าง DEWALT และแบรนด์โปร', size: 'sm', color: COLOR.gray, margin: 'lg' },
          { type: 'text', text: 'เช่ารายวัน หรือ ซื้อขาด', size: 'sm', color: COLOR.gray },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          {
            type: 'button', style: 'primary', color: COLOR.yellow, height: 'sm',
            action: { type: 'message', label: '🛠️ ดูเครื่องมือ', text: 'ดูสินค้า' },
          },
          {
            type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'message', label: '📞 ติดต่อร้าน', text: 'ติดต่อ' },
          },
        ],
      },
    },
  };
}

// ===== Quick Reply (ปุ่มลัดเด้งใต้ข้อความ) ===============================
function withQuickReply(message, items) {
  if (!items?.length) return message;
  const msg = typeof message === 'string' ? { type: 'text', text: message } : message;
  return { ...msg, quickReply: { items: items.map((it) => ({ type: 'action', action: it })) } };
}

const QUICK_MAIN = [
  { type: 'message', label: '🛠️ สว่าน', text: 'สว่าน' },
  { type: 'message', label: '🪚 เลื่อย', text: 'เลื่อย' },
  { type: 'message', label: '⚡ เจียร', text: 'เครื่องเจียร' },
  { type: 'message', label: '🔋 แบต', text: 'แบต' },
  { type: 'message', label: '📞 ติดต่อ', text: 'ติดต่อ' },
];

// quick reply ที่ตอบสนอง rentEnabled — แทรกปุ่ม "เช่า" ถ้าร้านเปิดบริการเช่า
function quickMainFor(cfg) {
  if (cfg && cfg.rentEnabled === false) return QUICK_MAIN;
  return [
    { type: 'message', label: '🛠️ สว่าน', text: 'สว่าน' },
    { type: 'message', label: '🪚 เลื่อย', text: 'เลื่อย' },
    { type: 'message', label: '⚡ เจียร', text: 'เครื่องเจียร' },
    { type: 'message', label: '🔋 แบต', text: 'แบต' },
    { type: 'message', label: '💰 เช่า', text: 'เช่า' },
    { type: 'message', label: '📞 ติดต่อ', text: 'ติดต่อ' },
  ];
}

const QUICK_BRANDS = [
  { type: 'message', label: 'DEWALT', text: 'DEWALT' },
  { type: 'message', label: 'MAKITA', text: 'MAKITA' },
  { type: 'message', label: 'BOSCH', text: 'BOSCH' },
  { type: 'message', label: 'OSUKA', text: 'OSUKA' },
  { type: 'message', label: 'STANLEY', text: 'STANLEY' },
  { type: 'message', label: 'ทั้งหมด', text: 'ทั้งหมด' },
];

// ============================================================
// 🤖 smartReply — return string OR Array<LINE message object>
// ============================================================
function uniqueBrandsForCategory(products, cat) {
  const set = new Set();
  products.filter((p) => p.category === cat).forEach((p) => p.brand && set.add(p.brand));
  return Array.from(set).sort();
}

async function smartReply(userId, text) {
  const products = await getCatalog();
  const session = await getSession(userId);

  const sku = detectSku(text);
  const category = detectCategory(text);
  const brand = detectBrand(text);

  // 1) รหัสสินค้า → Flex card
  if (sku) {
    const matches = products.filter((p) => {
      const ps = String(p.sku || '').toUpperCase();
      return ps && (ps === sku || ps.includes(sku) || sku.includes(ps));
    });
    if (matches.length === 1) { await clearSession(userId); return flexProduct(matches[0]); }
    if (matches.length > 1) { await clearSession(userId); return flexProductCarousel(matches); }
  }

  // 2) Session รอแบรนด์
  if (session && session.expecting === 'brand' && session.category) {
    const cat = session.category;
    if (isWildcardAny(text)) {
      const all = products.filter((p) => p.category === cat);
      await clearSession(userId);
      if (!all.length) return `ขออภัย ตอนนี้${CATEGORY_LABELS[cat] || ''}ไม่มีในสต๊อกครับ 🙏`;
      return flexProductCarousel(all);
    }
    if (brand) {
      const filtered = products.filter((p) => p.category === cat && String(p.brand || '').toUpperCase() === brand);
      await clearSession(userId);
      if (!filtered.length) {
        const brands = uniqueBrandsForCategory(products, cat);
        return withQuickReply(
          `ขออภัย ${brand} ${CATEGORY_LABELS[cat] || ''}ไม่มีในสต็อกตอนนี้ครับ 🙏\nลองเลือกแบรนด์อื่นได้`,
          brands.map((b) => ({ type: 'message', label: b, text: b }))
        );
      }
      return flexProductCarousel(filtered);
    }
    const brands = uniqueBrandsForCategory(products, cat);
    return withQuickReply(
      `ขออภัยครับ ไม่เข้าใจ 🙏 ลองกดเลือกแบรนด์ด้านล่าง`,
      [...brands.map((b) => ({ type: 'message', label: b, text: b })), { type: 'message', label: 'ทั้งหมด', text: 'ทั้งหมด' }]
    );
  }

  // 3) หมวด+แบรนด์ → แสดงผล
  if (category && brand) {
    const filtered = products.filter((p) => p.category === category && String(p.brand || '').toUpperCase() === brand);
    if (filtered.length) { await clearSession(userId); return flexProductCarousel(filtered); }
  }

  // 4) แค่หมวด → ถามแบรนด์
  if (category) {
    const brands = uniqueBrandsForCategory(products, category);
    await setSession(userId, { category, expecting: 'brand', mode: 'ai' });
    return withQuickReply(
      `สนใจ${CATEGORY_LABELS[category] || ''} ใช่ไหมครับ 🛠️\nอยากดูแบรนด์ไหนครับ?`,
      brands.map((b) => ({ type: 'message', label: b, text: b }))
    );
  }

  // 5) แค่แบรนด์
  if (brand) {
    const filtered = products.filter((p) => String(p.brand || '').toUpperCase() === brand);
    if (filtered.length) { await clearSession(userId); return flexProductCarousel(filtered); }
  }

  // 6) คำสั่งทั่วไป
  return basicReply(text);
}

// ============================================================
// 💬 คำตอบทั่วไป (สั้น สุภาพ "ครับ")
// ============================================================
function basicReply(text) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;

  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey|hej)/i.test(t)) {
    return withQuickReply(`สวัสดีครับ 🙏\n${SHOP.shortName} ยินดีให้บริการ\nสนใจสิ่งใดครับ?`, QUICK_MAIN);
  }
  if (/(ดูสินค้า|catalog|product|รายการสินค้า|มีอะไรบ้าง)/i.test(t)) {
    return withQuickReply(
      `เครื่องมือของเรามี 7 หมวด ลองกดเลือกได้เลยครับ 🛠️`,
      [
        { type: 'message', label: 'สว่าน/ไขควง', text: 'สว่าน' },
        { type: 'message', label: 'เลื่อย', text: 'เลื่อย' },
        { type: 'message', label: 'เครื่องเจียร', text: 'เครื่องเจียร' },
        { type: 'message', label: 'แบต/ชาร์จ', text: 'แบต' },
        { type: 'message', label: 'เครื่องวัด', text: 'วัด' },
        { type: 'message', label: 'ช่างมือ', text: 'ประแจ' },
      ]
    );
  }
  if (/(เวลา|เปิด|ปิด|กี่โมง|hours?|open)/i.test(t)) {
    return `🕐 เวลาทำการ\n${SHOP.hoursWeek}\n${SHOP.hoursSun}\n\nมาทักก่อนได้นะครับ จะเตรียมของรอให้`;
  }
  if (/(ที่อยู่|ที่ตั้ง|address|location|แผนที่|map|ไป.*ร้าน|ติดต่อ|เบอร์|โทร|tel|phone|call)/i.test(t)) {
    return flexContactMenu();
  }
  if (/(ขอบคุณ|thanks?|thank you|thx)/i.test(t)) {
    return `ยินดีครับ 🙏 ฝากร้านด้วยนะครับ 💪`;
  }
  if (/^(help|ช่วย|menu|เมนู|\?)$/i.test(t)) {
    return withQuickReply('สอบถามได้เลยครับ 🙂', QUICK_MAIN);
  }
  return null; // ให้ AI ตอบ
}

// ============================================================
// 🧠 AI: Claude Opus 4.7 + prompt caching + adaptive thinking
// ============================================================
function buildAISystemPrompt(products) {
  const catalogText = products.map((p) => {
    const avail = p.available != null ? p.available : Math.max(0, (p.stock || 0) - (p.rented || 0));
    const stock = avail > 0 ? `เหลือ ${avail}` : 'หมด';
    const price = p.forSale && p.price ? `${Number(p.price).toLocaleString()} บ.` : '-';
    const rent = p.forRent && p.rentPerDay ? `${Number(p.rentPerDay).toLocaleString()} บ./วัน` : '-';
    return `${p.sku || ''} | ${p.name} | ${p.brand || '-'} | ${CATEGORY_LABELS[p.category] || p.category} | ขาย:${price} | เช่า:${rent} | สต็อก:${stock}`;
  }).join('\n');

  return `คุณคือ "พี่ช่าง" — พนักงานต้อนรับร้าน ${SHOP.company} (${SHOP.shortName}) จ.เชียงใหม่
ร้านเช่า–ซื้อเครื่องมือช่าง DEWALT และแบรนด์โปร มา ${products.length} รุ่น

== ข้อมูลร้าน ==
ที่อยู่: ${SHOP.address}
โทร: ${SHOP.phoneMobile} (มือถือ) / ${SHOP.phoneOffice} (สำนักงาน)
LINE: ${SHOP.line}
เวลาทำการ: ${SHOP.hoursWeek} | ${SHOP.hoursSun}

== แคตตาล็อกปัจจุบัน ==
${catalogText}

== บุคลิก (สำคัญ! ห้ามดูเป็น AI) ==
- พูดเหมือนคนจริง สุภาพ เรียบง่าย อบอุ่น แต่ไม่เว่อร์
- ใช้ภาษาช่างนิดหน่อย ("รุ่นนี้ใช้ได้ดี", "งานทั่วไปก็พอ", "ตัวนี้แรงพอครับ")
- ลงท้าย "ครับ" เท่านั้น (ห้ามใช้ "ค่ะ" เด็ดขาด)
- ตอบสั้น 1-3 ประโยค ห้ามตอบยาว
- ห้ามขึ้นต้น "ผมเข้าใจครับ...", "เป็นคำถามที่ดีครับ..." แบบ AI typical
- ห้ามใช้คำว่า "ในฐานะ AI", "AI ของร้าน" — คุณเป็นคน

== วิธีแนะนำสินค้า ==
1. ลูกค้าบอกแค่ประเภท → ถามแบรนด์ พร้อมบอกแบรนด์ที่มี (อย่าลิสต์รุ่นเลย)
2. ลูกค้าระบุแบรนด์ → แนะนำ 1-3 รุ่น บอกชื่อ+จุดเด่นสั้น (ยังไม่บอกราคา)
3. ลูกค้าสนใจรุ่นใดรุ่นหนึ่ง → ตอบสเป็ก จบด้วยราคา
- ข้อยกเว้น: ถ้าลูกค้าพิมพ์รหัส (DCD805) ตอบรายละเอียดเต็มได้เลย ราคาท้ายสุด

== กฎเด็ดขาด ==
- ถ้าไม่ทราบ → ให้โทร ${SHOP.phoneMobile} หรือ ${SHOP.phoneOffice}
- ถ้าคำถามนอกเรื่องร้าน → ขอโทษและพากลับเรื่องเครื่องมือ
- ถ้าคำถามต้องการตอบจากคนจริง (เช่น ขอต่อราคา, ขอใบเสนอราคา, ปัญหาเฉพาะ) → บอก "ขอแจ้งแอดมินนะครับ" และจบ`;
}

async function aiReply(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const products = await getCatalog();
  if (!products.length) return null;
  const systemPrompt = buildAISystemPrompt(products);
  const startedAt = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 512,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: text }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[ai] failed', res.status, body.slice(0, 200));
      return null;
    }
    const data = await res.json();
    const ms = Date.now() - startedAt;
    const u = data.usage || {};
    console.log('[ai] OK', ms, 'ms — in:', u.input_tokens, 'cache_r:', u.cache_read_input_tokens, 'cache_w:', u.cache_creation_input_tokens, 'out:', u.output_tokens);
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
// 🎯 หลักการตัดสินใจ: human handoff → smartReply (กฎ) → AI → fallback
// ============================================================
async function handleMessage(userId, text, token) {
  // 0) ตรวจโหมด human — ถ้าคนกำลังคุยกัน บอทเงียบ
  //    เจ้าของจะกลับเปิดบอทเองจาก bot-inbox (ปุ่ม "เปิดบอท") — ลูกค้าไม่ต้องพิมพ์อะไร
  const session = await getSession(userId);
  if (session?.mode === 'human') {
    console.log('[handoff] session in human mode, bot stays silent');
    return null; // null = ไม่ตอบ
  }

  // 1) ตรวจคำขอ "ติดต่อเจ้าของ" → ผลักไป LINE เจ้าของ + เข้าโหมด human
  if (wantsHuman(text)) {
    await setSession(userId, { mode: 'human' });
    await pushHandoffToAdmin(userId, text, token);
    return `รับทราบครับ 🙏\nผมได้แจ้งแอดมินแล้ว เดี๋ยวแอดมินจะตอบคุณในเร็ว ๆ นี้\n\nระหว่างนี้โทรหาเราได้ที่\n📱 ${SHOP.phoneMobile}\n☎️ ${SHOP.phoneOffice}`;
  }

  // 1.5) โหลด config ที่เจ้าของตั้งไว้จาก Firestore (cache 5 นาที)
  const botCfg = await getBotConfig();

  // 1.55) ถ้าร้านปิดบริการเช่า + ลูกค้าทักเรื่องเช่า → บอกตรง ๆ ก่อน AI จะตอบมั่ว
  if (botCfg.rentEnabled === false && /(เช่า|rent|เช็า)/i.test(String(text || ''))) {
    return withQuickReply(
      `ขออภัยครับ ตอนนี้ร้านยังไม่มีบริการเช่าเครื่องมือนะครับ 🙏\nมีแต่จำหน่ายขาดทั้งหมด — ดูเครื่องมือได้ที่ ${SHOP.website}/shop.html`,
      quickMainFor(botCfg)
    );
  }

  // 1.6) ทักทาย — ใช้ greeting ที่เจ้าของตั้ง ถ้ามี
  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey|hej)/i.test(String(text || '').trim())) {
    if (botCfg.greeting) return withQuickReply(botCfg.greeting, quickMainFor(botCfg));
  }

  // 1.7) คีย์เวิร์ดที่เจ้าของกำหนดเอง — มาก่อน smartReply (กฎที่ owner แก้ได้ ชนะ hardcode)
  const custom = customRuleReply(text, botCfg);
  if (custom) return custom;

  // 2) ลองกฎ hardcode (เร็ว ฟรี)
  const ruleReply = await smartReply(userId, text);
  if (ruleReply) return ruleReply;

  // 3) ใช้ AI (Claude)
  const ai = await aiReply(text);
  if (ai) return ai;

  // 4) Fallback — ใช้ของเจ้าของถ้ามี ไม่งั้น default
  if (botCfg.fallback) return withQuickReply(botCfg.fallback, quickMainFor(botCfg));
  return withQuickReply(
    `ขอบคุณสำหรับข้อความครับ 🙏\nสนใจดูเครื่องมือหมวดไหนเป็นพิเศษครับ?`,
    quickMainFor(botCfg)
  );
}

// ============================================================
// 🔔 Push notification ไป LINE เจ้าของร้าน (human handoff)
// ============================================================
async function pushHandoffToAdmin(customerUserId, customerText, token) {
  const adminId = process.env.ADMIN_LINE_USER_ID;
  if (!adminId) {
    console.warn('[handoff] ADMIN_LINE_USER_ID not set — skipping push');
    return;
  }
  const url = 'https://api.line.me/v2/bot/message/push';
  const tag = customerUserId ? customerUserId.slice(-8) : 'ไม่ทราบ';
  const msg = {
    type: 'flex',
    altText: `🔔 ลูกค้าขอคุย: …${tag}`,
    contents: {
      type: 'bubble',
      header: flexHeader('🔔 ลูกค้าขอคุยด้วย'),
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: `ลูกค้า: …${tag}`, weight: 'bold', size: 'md', color: COLOR.black },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'ข้อความล่าสุด:', size: 'xs', color: COLOR.gray, margin: 'md' },
          { type: 'text', text: String(customerText || '').slice(0, 300), size: 'sm', color: COLOR.black, wrap: true },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: 'บอทถูกปิดเสียงให้คุยกับลูกค้าได้ 4 ชม.\nไปที่แท็บ "แชท" ใน LINE Official Account Manager เพื่อตอบ', size: 'xs', color: COLOR.gray, wrap: true, margin: 'md' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          {
            type: 'button', style: 'primary', color: COLOR.yellow, height: 'sm',
            action: { type: 'uri', label: '📱 เปิด OA Manager', uri: 'https://manager.line.biz/' },
          },
        ],
      },
    },
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: adminId, messages: [msg] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[handoff] push failed', res.status, body.slice(0, 200));
    } else {
      console.log('[handoff] pushed to admin');
    }
  } catch (err) { console.error('[handoff] push threw', err?.message); }
}

// ============================================================
// log สนทนาลง Firestore
// ============================================================
// ดาวน์โหลดรูปที่ลูกค้าส่งมาทาง LINE → เก็บเป็น bot_message (image base64) ให้หลังร้านเห็น
async function logCustomerImage(userId, messageId, lineToken) {
  if (!userId || !messageId) return;
  try {
    const r = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${lineToken}` },
    });
    if (!r.ok) { console.error('[img] LINE content fetch', r.status); return; }
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    const dataUrl = `data:${ct};base64,${buf.toString('base64')}`;
    const tooBig = dataUrl.length > 950000; // เกินลิมิต doc Firestore (~1MB)
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_messages`;
    const fields = {
      userId: { stringValue: String(userId).slice(0, 99) },
      text: { stringValue: tooBig ? '[ลูกค้าส่งรูป (ใหญ่เกินแสดง)]' : '[ลูกค้าส่งรูป]' },
      role: { stringValue: 'user' },
      source: { stringValue: 'line' },
      at: { timestampValue: new Date().toISOString() },
    };
    if (!tooBig) fields.image = { stringValue: dataUrl };
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  } catch (e) { console.error('[img] store threw', e?.message); }
}

async function logBotMessage(userId, text, reply) {
  if (!userId) return;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/bot_messages`;
  const safe = (s, max) => String(s || '').slice(0, max);
  // ถ้า reply เป็น Flex/object เก็บ altText แทน
  let replyText = '';
  if (typeof reply === 'string') replyText = reply;
  else if (Array.isArray(reply)) replyText = reply.map((m) => m?.altText || m?.text || '').filter(Boolean).join(' | ');
  else if (reply?.altText) replyText = reply.altText;
  else if (reply?.text) replyText = reply.text;
  try {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          userId: { stringValue: safe(userId, 99) },
          text: { stringValue: safe(text, 4999) },
          reply: { stringValue: safe(replyText, 4999) },
          source: { stringValue: 'line' },
          at: { timestampValue: new Date().toISOString() },
        },
      }),
    });
    if (!res.ok) console.error('[log] failed', res.status);
  } catch (err) { console.error('[log] threw', err?.message); }
}

// ============================================================
// LINE Reply API — รองรับทั้ง text/flex/quickReply
// ============================================================
async function replyToLine(replyToken, content, token) {
  // normalize content → array of LINE message objects
  let messages = [];
  if (!content) return;
  if (typeof content === 'string') {
    messages = [{ type: 'text', text: content }];
  } else if (Array.isArray(content)) {
    messages = content;
  } else if (content.type) {
    messages = [content];
  }
  if (!messages.length) return;

  const startedAt = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }), // LINE max 5 messages
      signal: ctrl.signal,
    });
    const body = await res.text().catch(() => '');
    const ms = Date.now() - startedAt;
    if (res.ok) {
      console.log('[reply] OK', res.status, 'in', ms, 'ms,', messages.length, 'msgs');
    } else if (body.includes('Invalid reply token')) {
      // benign — LINE redelivery sent duplicate event with same (already-used) token
      console.warn('[reply] duplicate event (token already used) — first reply went through');
    } else {
      console.error('[reply] FAILED', res.status, 'in', ms, 'ms — body:', body);
    }
  } catch (err) {
    console.error('[reply] THREW —', err?.name, err?.message);
  } finally { clearTimeout(timer); }
}

// ============================================================
// Dedupe: skip events we've already processed (in-memory, per cold start)
// LINE redelivery can send the same event multiple times — only reply once
// ============================================================
const _seenEventIds = new Set();
const _seenEventIdsMaxSize = 500;
function alreadySeen(eventId) {
  if (!eventId) return false;
  if (_seenEventIds.has(eventId)) return true;
  _seenEventIds.add(eventId);
  if (_seenEventIds.size > _seenEventIdsMaxSize) {
    // drop oldest entry
    const first = _seenEventIds.values().next().value;
    _seenEventIds.delete(first);
  }
  return false;
}

// ============================================================
// Signature + raw body
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

  await Promise.all(events.map(async (event) => {
    try {
      // กัน LINE webhook redelivery ส่ง event ซ้ำ
      if (alreadySeen(event.webhookEventId)) {
        console.log('[dedup] skipping duplicate event', event.webhookEventId?.slice(-8));
        return;
      }
      // log userId ของแอดมินตอน follow event (เพื่อหา ADMIN_LINE_USER_ID ได้ง่าย)
      if (event.type === 'follow') {
        console.log('[follow] new user userId =', event.source?.userId);
        // ใช้ greeting ที่เจ้าของตั้งใน /admin/bot-replies.html ก่อน (style DeWalt OA)
        // ถ้าไม่มี ใช้ default plain text (ไม่ใช่ Flex) — สะอาดและอ่านง่ายเหมือนของ DeWalt
        const cfg = await getBotConfig();
        const text = cfg.greeting || defaultWelcomeText({ rentEnabled: cfg.rentEnabled });
        await replyToLine(event.replyToken, withQuickReply(text, quickMainFor(cfg)), token);
        return;
      }
      if (event.type === 'message' && event.message?.type === 'text') {
        const userId = event.source?.userId;
        const userText = event.message.text;
        console.log('[msg] from', userId?.slice(-8), '|', JSON.stringify(userText).slice(0, 80));
        const reply = await handleMessage(userId, userText, token);
        if (reply) {
          await Promise.all([
            replyToLine(event.replyToken, reply, token),
            logBotMessage(userId, userText, reply),
          ]);
        } else {
          // โหมด human — บอทเงียบ แต่ยัง log ข้อความลูกค้า
          await logBotMessage(userId, userText, '[human mode — bot silent]');
        }
      }
      // ลูกค้าส่งรูป → ดาวน์โหลดจาก LINE มาเก็บ ให้แอดมินเห็นในหลังร้าน
      if (event.type === 'message' && event.message?.type === 'image') {
        await logCustomerImage(event.source?.userId, event.message.id, token);
      }
    } catch (err) {
      console.error('[event] handler error:', err?.name, err?.message);
    }
  }));

  res.status(200).send('OK');
}
