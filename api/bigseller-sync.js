/* =====================================================================
   M.E.Tools — BigSeller Sync proxy (Vercel Node.js Function)
   ---------------------------------------------------------------------
   เป็น "ขาออก" เดียวที่ถือ BigSeller API key — เบราว์เซอร์ยิงมาที่นี่ แล้ว
   ฟังก์ชันนี้เซ็น/แนบ header แล้วค่อย forward ไป BigSeller Open API จริง
   (เก็บคีย์ไว้ฝั่งเซิร์ฟเวอร์ + กัน CORS + บังคับ Idempotency-Key)

   ENV (ตั้งใน Vercel → Settings → Environment Variables):
     BIGSELLER_API_KEY      = access token จาก BigSeller Open API (จำเป็น)
     BIGSELLER_API_BASE     = โฮสต์ API (ไม่บังคับ, ค่าเริ่ม https://api.bigseller.com)
     BIGSELLER_EP_PRODUCT   = path สร้าง/แก้สินค้า (ไม่บังคับ, ค่าเริ่ม /api/v1/product/upsert)
     BIGSELLER_EP_ORDER     = path สร้างออเดอร์   (ไม่บังคับ, ค่าเริ่ม /api/v1/order/create)
     BIGSELLER_EP_STOCK     = path ถามสต็อก       (ไม่บังคับ, ค่าเริ่ม /api/v1/stock/query)
   ไม่ตั้ง BIGSELLER_API_KEY → ตอบ { configured:false } → ฝั่งเว็บถือเป็น dry-run (เว็บไม่รวน)

   ⚠️ path/รูปแบบ payload ด้านล่างเป็น "จุดเดียว" ที่ผูกกับ BigSeller — โปรดตรวจกับ
      เอกสาร BigSeller Open API ของบัญชีคุณแล้วปรับ mapForBigSeller()/endpoint ให้ตรง
      ก่อนเปิดใช้งานจริง (ทุกอย่างอื่นบนเว็บไม่ต้องแก้)

   contract กับฝั่งเว็บ (assets/bigseller-sync.js):
     req:  { action: "product.upsert"|"order.create"|"stock.query", payload: {...} }
     res:  { ok, configured, data?, error? }
   ===================================================================== */

import crypto from 'crypto';

const API_BASE = (process.env.BIGSELLER_API_BASE || 'https://api.bigseller.com').replace(/\/+$/, '');
const EP = {
  'product.upsert': process.env.BIGSELLER_EP_PRODUCT || '/api/v1/product/upsert',
  'product.offshelf': process.env.BIGSELLER_EP_OFFSHELF || '/api/v1/product/off-shelf',
  'product.delete': process.env.BIGSELLER_EP_DELETE || '/api/v1/product/delete',
  'order.create': process.env.BIGSELLER_EP_ORDER || '/api/v1/order/create',
  'stock.query': process.env.BIGSELLER_EP_STOCK || '/api/v1/stock/query',
};

// แปลง payload กลางจากเว็บ → รูปแบบที่ BigSeller ต้องการ (ปรับตรงนี้ที่เดียว)
function mapForBigSeller(action, p) {
  if (action === 'product.upsert') {
    return {
      merchantSku: p.sku,
      name: p.name,
      brand: p.brand,
      description: p.description,
      price: p.price,
      costPrice: p.cost,
      stock: p.stock,
      weight: p.weight,
      packageSize: { width: p.width, length: p.length, height: p.height },
      images: p.images,
    };
  }
  if (action === 'order.create') {
    return {
      outerOrderSn: p.reference,
      buyer: { name: p.buyerName, phone: p.buyerPhone },
      shippingMethod: p.shipping && p.shipping.method,
      address: p.shipping && p.shipping.address,
      items: (p.items || []).map((it) => ({ merchantSku: it.sku, name: it.name, quantity: it.qty, price: it.price })),
      totalAmount: p.total,
    };
  }
  if (action === 'product.offshelf') {
    return { merchantSku: p.sku, status: 'OFF_SHELF' };   // ปิดการขายบนทุกแพลตฟอร์ม
  }
  if (action === 'product.delete') {
    return { merchantSku: p.sku };                         // ลบสินค้าต้นแบบ
  }
  if (action === 'stock.query') {
    return { skuList: p.skus || [] };
  }
  return p;
}

// normalize ผลลัพธ์จาก BigSeller → contract กลาง (ปรับ field ตามจริงได้)
function normalize(action, data) {
  if (action === 'stock.query') {
    const rows = (data && (data.data || data.items || data.list)) || [];
    return {
      items: rows.map((r) => ({
        sku: r.merchantSku || r.sku || r.sellerSku,
        stock: Number(r.stock != null ? r.stock : (r.availableStock != null ? r.availableStock : r.quantity)) || 0,
      })),
    };
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method-not-allowed' }); return; }

  const key = process.env.BIGSELLER_API_KEY;
  // ยังไม่ตั้งคีย์ → dry-run ฝั่งเว็บ (ไม่ใช่ error)
  if (!key) { res.status(200).json({ ok: false, configured: false }); return; }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { res.status(400).json({ ok: false, configured: true, error: 'bad-json' }); return; }

  const action = String(body.action || '');
  const payload = body.payload || {};
  const path = EP[action];
  if (!path) { res.status(400).json({ ok: false, configured: true, error: 'unknown-action: ' + action }); return; }

  // Idempotency-Key — ใช้ที่ client ส่งมา ถ้าไม่มีค่อยสร้างใหม่ (กันประมวลผลซ้ำตอน retry)
  const idem = String(req.headers['idempotency-key'] || '') || crypto.randomUUID();

  try {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'Idempotency-Key': idem,
      },
      body: JSON.stringify(mapForBigSeller(action, payload)),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json().catch(() => ({}));

    if (r.status === 429 || r.status >= 500) {
      // ชั่วคราว → บอกเว็บให้ retry (เว็บมี exponential backoff)
      res.status(r.status).json({ ok: false, configured: true, error: 'upstream-' + r.status, data });
      return;
    }
    if (!r.ok) {
      res.status(200).json({ ok: false, configured: true, error: (data && (data.message || data.error)) || ('HTTP ' + r.status), data });
      return;
    }
    res.status(200).json({ ok: true, configured: true, data: normalize(action, data) });
  } catch (e) {
    // network/timeout → 502 ให้เว็บ retry
    res.status(502).json({ ok: false, configured: true, error: 'fetch-failed: ' + (e && e.message) });
  }
}
