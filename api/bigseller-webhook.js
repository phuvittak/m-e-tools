/* =====================================================================
   M.E.Tools — BigSeller Webhook receiver (Vercel Node.js Function)
   ---------------------------------------------------------------------
   "ขาเข้า" จาก BigSeller — เมื่อมีออเดอร์/ยกเลิก/คืนสินค้า/ออกเลขพัสดุจาก
   Shopee·Lazada·TikTok ทาง BigSeller จะ POST มาที่ /api/bigseller-webhook
   (เป็น event-driven ไม่ polling → ประหยัดโควตา API)

   ปรัชญาความปลอดภัย (สำคัญมาก):
     เว็บนี้เก็บแคตตาล็อกเป็น "เอกสารรวม" products/catalog (items[]) ซึ่งเปราะบาง
     (เคยมีเหตุ migration เผลอล้าง catalog) ดังนั้น webhook นี้ "จะไม่" ไปแก้สต็อก
     หรือบัญชีโดยตรง แต่จะ "บันทึก event ไว้" ใน Firestore คอลเลกชัน bigseller_events
     แบบกันซ้ำ (idempotent) แล้วให้ระบบหลังร้าน (หน้า BigSeller Sync) ดึงไป apply
     ผ่านโค้ดเดิมที่ทดสอบแล้ว (adjustStock / saveLedgerEntry / setOrderStatus)
     ซึ่งดูแล catalog + ledger + cloud ให้ครบถูกต้องอยู่แล้ว
     → ได้ทั้ง real-time (onSnapshot) และไม่เสี่ยงเขียนทับ catalog พัง

   ENV:
     BIGSELLER_WEBHOOK_SECRET = ความลับไว้ตรวจลายเซ็น HMAC-SHA256 (แนะนำตั้ง)
   ไม่ตั้ง secret → รับ event โดยไม่ตรวจลายเซ็น (เหมาะตอนทดสอบเท่านั้น)

   เหตุการณ์ที่รองรับ (normalize เป็นชนิดกลาง):
     sale      → ขายออก   → หลังร้านจะ "ตัดสต็อก" + ลงรายรับ/COGS
     cancel    → ยกเลิก    → หลังร้านจะ "บวกสต็อกคืน" + ลดรายรับ
     return    → คืนสินค้า → เหมือน cancel
     shipped   → ออกพัสดุ  → หลังร้านจะบันทึกเลข tracking + เปลี่ยนสถานะ "กำลังจัดส่ง"
   ===================================================================== */

import crypto from 'crypto';

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents`;

// บันทึก event แบบ create-only (documentId = eventId) → ถ้า 409 แปลว่าเคยรับแล้ว (กันซ้ำ)
async function recordEvent(eventId, fields) {
  const safe = String(eventId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200) || ('evt-' + Date.now());
  const url = `${FS_BASE}/bigseller_events?documentId=${encodeURIComponent(safe)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (r.status === 409) return { ok: true, dup: true };
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: e && e.message };
  }
}

// helper: ค่า → Firestore typed value
function sv(v) {
  if (v == null) return { nullValue: null };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(sv) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, sv(val)])) } };
  return { stringValue: String(v) };
}

// map ชนิด event ของ BigSeller → ชนิดกลาง (ปรับ keyword ตามจริงของบัญชีคุณได้)
function classify(raw) {
  const t = String(raw.event || raw.type || raw.action || raw.status || '').toLowerCase();
  if (/cancel/.test(t)) return 'cancel';
  if (/return|refund/.test(t)) return 'return';
  if (/ship|tracking|delivered|deliver/.test(t)) return 'shipped';
  if (/order|create|paid|new|sale/.test(t)) return 'sale';
  return 'sale';
}

// ดึงรายการสินค้า (sku, qty) ออกจาก payload หลายทรงให้ทนทาน
function extractItems(o) {
  const arr = o.items || o.orderItems || o.products || o.skuList || [];
  return (Array.isArray(arr) ? arr : []).map((it) => ({
    sku: String(it.merchantSku || it.sellerSku || it.sku || it.skuId || '').trim(),
    qty: Number(it.quantity || it.qty || it.num || 1) || 1,
    price: Number(it.price || it.unitPrice || 0) || 0,
  })).filter((x) => x.sku);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature, X-Bigseller-Signature');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method-not-allowed' }); return; }

  // อ่าน raw body (ต้องใช้ตัวดิบในการตรวจ HMAC)
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { res.status(400).json({ ok: false, error: 'bad-json' }); return; }

  // ตรวจลายเซ็น (ถ้าตั้ง secret ไว้)
  const secret = process.env.BIGSELLER_WEBHOOK_SECRET;
  if (secret) {
    const sig = String(req.headers['x-signature'] || req.headers['x-bigseller-signature'] || '');
    const expect = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const ok = sig && (sig === expect || sig === 'sha256=' + expect);
    if (!ok) { res.status(401).json({ ok: false, error: 'bad-signature' }); return; }
  }

  try {
    const order = body.data || body.order || body;
    const kind = classify(body);
    const orderRef = String(order.outerOrderSn || order.reference || order.orderSn || order.orderId || order.id || '').trim();
    const items = extractItems(order);
    const eventId = String(body.eventId || body.id || (orderRef + ':' + kind + ':' + (order.updateTime || order.updatedAt || ''))).trim();

    const fields = {
      type: sv(kind),
      orderRef: sv(orderRef),
      channel: sv(String(order.platform || order.channel || order.shopType || '')),
      items: sv(items),
      amount: sv(Number(order.totalAmount || order.total || order.paidAmount || 0) || 0),
      tracking: sv(String(order.trackingNumber || order.trackingNo || order.tracking || '')),
      carrier: sv(String(order.logisticsName || order.carrier || order.shippingCarrier || '')),
      processed: sv(false),
      receivedAt: { timestampValue: new Date().toISOString() },
      rawType: sv(String(body.event || body.type || body.action || body.status || '')),
    };

    const rec = await recordEvent(eventId, fields);
    // กันซ้ำ: เคยรับแล้วก็ตอบ 200 (BigSeller จะได้ไม่ retry ซ้ำ ๆ)
    if (rec.dup) { res.status(200).json({ ok: true, dedup: true }); return; }
    if (!rec.ok) { res.status(200).json({ ok: false, stored: false, note: 'firestore-unavailable' }); return; }

    res.status(200).json({ ok: true, stored: true, type: kind, orderRef, items: items.length });
  } catch (e) {
    // ตอบ 200 เสมอเพื่อไม่ให้ BigSeller มองว่า fail แล้ว retry ถล่ม — log ฝั่ง Vercel แทน
    console.error('[bigseller-webhook]', e && e.message);
    res.status(200).json({ ok: false, error: 'handler-exception' });
  }
}
