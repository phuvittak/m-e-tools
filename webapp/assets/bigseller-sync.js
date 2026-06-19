/* =====================================================================
   M.E.Tools — BigSeller Sync Module (client)
   ---------------------------------------------------------------------
   โมดูลซิงค์ข้อมูลระหว่างเว็บ M.E.Tools กับ BigSeller Open API

   หลักการออกแบบ (อ่านก่อนแก้):
   1) ปลอดภัยโดยค่าเริ่มต้น (safe by default) — ทุกการเชื่อมต่อถูก "ปิด" ไว้
      จนกว่าแอดมินจะเปิดสวิตช์ในหน้า BigSeller Sync และตั้ง API key ฝั่งเซิร์ฟเวอร์
      ครบ ถ้ายังไม่พร้อม ทุกฟังก์ชันจะกลายเป็น dry-run (แค่บันทึก log) — เว็บจริงไม่รวน
   2) ความลับอยู่ฝั่งเซิร์ฟเวอร์ — เบราว์เซอร์ "ไม่" ถือ BigSeller API key เด็ดขาด
      ทุกคำสั่งวิ่งผ่าน Vercel proxy /api/bigseller-sync ซึ่งถือ ENV BIGSELLER_API_KEY
      (กัน CORS + กันคีย์รั่ว) — ถ้าเซิร์ฟเวอร์ตอบ configured:false ถือเป็น dry-run
   3) ขาออกทำแบบคิวเบื้องหลัง (async queue) มี retry + exponential backoff + sync log
      เก็บคิวใน localStorage จึงไม่หายแม้รีเฟรช และไม่บล็อก UI ตอนแอดมินกดบันทึก
   4) Idempotency — ทุก request แนบ Idempotency-Key (UUIDv4) กันประมวลผลซ้ำเวลา retry
   5) ขาเข้า (ออเดอร์/สต็อก/เลขพัสดุจากมาร์เก็ตเพลส) มาทาง Webhook → /api/bigseller-webhook
      ไม่ใช้ polling (กันโควตา API ฟรีหมดไว)

   การจับคู่ข้อมูล (Data Mapping) — Primary Key = Merchant SKU
     SKU, Brand, Product Name, Cost, Price, Weight, Width/Length/Height,
     Description (ต่อท้ายด้วย Specs ที่แปลงเป็น bullet), Image URLs (https เท่านั้น)
   * หมายเหตุสำคัญ:
     - "ค่าจัดส่ง (shipping)" คิดแบบ local เท่านั้น — ไม่ส่งออกไป BigSeller
     - "ที่จัดเก็บในคลัง (location/shelf)" เก็บในเว็บเราเท่านั้น — ไม่ส่งออก (ตามที่ตกลง)
   ===================================================================== */
(function (global) {
  "use strict";

  var PROXY = "/api/bigseller-sync";
  var LOGS_KEY = "me_bs_logs";     // sync log (ดูในหน้าแอดมิน)
  var QUEUE_KEY = "me_bs_queue";   // คิวงานขาออกที่ค้างส่ง
  var MAX_ATTEMPTS = 6;            // ครบแล้วเลิก retry (กัน loop)
  var FLUSH_EVERY = 20000;        // หน่วง flush คิวทุก 20 วิ ระหว่างเปิดหน้า
  var REQ_TIMEOUT = 12000;        // ตัดการเชื่อมต่อที่ค้างเกิน 12 วิ

  function S() { return global.MEStore; }
  function now() { return Date.now(); }

  /* ---------- config (อ่านจาก settings.bigseller) ---------- */
  function cfg() {
    var s = S() && S().getSettings ? S().getSettings() : {};
    return (s && s.bigseller) || {};
  }
  // เปิดใช้งานจริงก็ต่อเมื่อแอดมินติ๊ก "เปิดซิงค์" ไว้เท่านั้น (ฝั่ง client gate)
  // ฝั่งเซิร์ฟเวอร์ยังมี gate ที่สองคือมี ENV key หรือไม่ (configured)
  function enabled() { return !!cfg().enabled; }
  function featureOn(name) { var c = cfg(); return enabled() && !!(c.sync && c.sync[name]); }

  /* ---------- utils ---------- */
  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function isHttps(u) { return /^https:\/\//i.test(String(u || "")); }

  /* ---------- sync log ---------- */
  function log(entry) {
    var list = read(LOGS_KEY, []);
    list.unshift(Object.assign({ ts: now() }, entry));
    if (list.length > 200) list = list.slice(0, 200);
    write(LOGS_KEY, list);
  }
  function getLogs() { return read(LOGS_KEY, []); }
  function clearLogs() { write(LOGS_KEY, []); }

  /* =====================================================================
     Data parser — แปลง Specifications object → bullet text ต่อท้าย description
     เว็บเรามีฟิลด์เฉพาะทาง (ประกัน, มอเตอร์, แพลตฟอร์มแบต, specs[]) ที่ BigSeller
     ไม่มีช่องรองรับตรง ๆ จึงรวมเป็นข้อความ bullet ใส่ใน "รายละเอียดสินค้า"
     เพื่อให้ไปโผล่ครบบน Shopee/Lazada/TikTok
     ===================================================================== */
  function specKV(s) {
    if (!s) return null;
    if (Array.isArray(s)) return s[0] || s[1] ? [String(s[0] || ""), String(s[1] || "")] : null;
    if (typeof s === "object") return (s.label || s.value) ? [String(s.label || ""), String(s.value || "")] : null;
    return null;
  }
  function specToDescription(p) {
    var lines = [];
    if (p.brand) lines.push("แบรนด์: " + p.brand);
    if (p.warrantyYears) lines.push("การรับประกัน: ศูนย์ " + p.warrantyYears + " ปี");
    if (p.warrantyType) lines.push("ประเภทการรับประกัน: " + p.warrantyType);
    if (p.motorType && p.motorType !== "—") lines.push("ระบบมอเตอร์: " + p.motorType);
    if (p.voltage) lines.push("แรงดันไฟฟ้า: " + p.voltage);
    if (p.batteryPlatform) lines.push("แพลตฟอร์มแบตเตอรี่: " + p.batteryPlatform);
    if (p.material) lines.push("วัสดุที่รองรับ: " + p.material);
    (p.specs || []).forEach(function (s) {
      var kv = specKV(s);
      if (kv && (kv[0] || kv[1])) lines.push(kv[0] + (kv[1] ? ": " + kv[1] : ""));
    });
    var base = (p.desc || "").trim();
    if (!lines.length) return base;
    var bullets = "\n\n— ข้อมูลจำเพาะ —\n" + lines.map(function (l) { return "• " + l; }).join("\n");
    return base + bullets;
  }

  /* ---------- payload builders (จับคู่ฟิลด์ → BigSeller) ---------- */
  function merchantSku(p) {
    var c = cfg();
    return (c.skuPrefix || "") + (p.sku || p.id || "");
  }
  function productImages(p) {
    var imgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    // BigSeller/มาร์เก็ตเพลสรับเฉพาะลิงก์ https สาธารณะ — รูป data:/http ถูกตัดทิ้ง
    return imgs.filter(isHttps).slice(0, 8);
  }
  function marketplacePrice(p) {
    var base = Number(p.price) || 0, m = Number(cfg().markup) || 0;
    return Math.round(base * (1 + m / 100));
  }
  function buildProductPayload(p) {
    var c = cfg(), dims = c.dims || {};
    return {
      sku: merchantSku(p),                 // Primary Key เชื่อมทุกระบบ
      brand: p.brand || "",
      name: p.name || "",
      cost: Number(p.cost) || 0,           // ต้นทุน (ภายใน — ใช้คิด COGS)
      price: marketplacePrice(p),          // ราคาขาย (+markup ตามตั้งค่า)
      stock: S() ? S().available(p) : (p.stock || 0),
      weight: Number(c.weight) || 1,       // กก.
      width: Number(dims.width) || 0,      // ขนาดกล่อง (ซม.)
      length: Number(dims.length) || 0,
      height: Number(dims.height) || 0,
      description: specToDescription(p),    // desc + specs bullets
      images: productImages(p),
      // ไม่ส่ง: shipping (คิด local), location/shelf (เก็บในเว็บเท่านั้น)
    };
  }
  // ตรวจความถูกต้องก่อนยิง — โดยเฉพาะ "รูปต้องเป็น https" ตามข้อกำหนด
  function validateProduct(payload) {
    var errs = [];
    if (!payload.sku) errs.push("ไม่มี SKU (จำเป็นต้องเป็น Merchant SKU เดียวกันทุกระบบ)");
    if (!payload.name) errs.push("ไม่มีชื่อสินค้า");
    if (!payload.images.length) errs.push("ไม่มีรูปแบบลิงก์ https — ต้องย้ายรูปขึ้น Storage ก่อน");
    return errs;
  }

  function buildOrderPayload(o) {
    var c = (o.customer) || {};
    return {
      reference: o.id,                     // เลขออเดอร์ฝั่งเรา (กันซ้ำ + อ้างอิงกลับ)
      buyerName: c.name || "",
      buyerPhone: c.phone || "",
      shipping: {
        method: o.fulfillment === "delivery" ? "delivery" : "pickup",
        address: (o.address && o.address.text) || "",
        // ค่าจัดส่งคิด local — ส่งไปเป็นข้อมูลอ้างอิงเฉย ๆ ไม่ให้ BigSeller คิดใหม่
        feeLocal: Number(o.shipping) || 0,
      },
      items: (o.items || []).map(function (it) {
        var p = S() ? S().getProduct(it.productId) : null;
        return { sku: p ? merchantSku(p) : it.productId, name: it.name, qty: it.qty, price: it.unitPrice };
      }),
      total: Number(o.total) || 0,
    };
  }

  /* =====================================================================
     HTTP — ผ่าน proxy ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่ยิงตรง BigSeller จาก browser)
     คืน { ok, configured, dryRun, status, data, error }
     ===================================================================== */
  function request(action, payload, idemKey) {
    if (!enabled()) {
      log({ kind: action, status: "dry-run", sku: payload && payload.sku, ref: payload && payload.reference, message: "ปิดซิงค์อยู่ — ข้าม (dry-run)" });
      return Promise.resolve({ ok: false, dryRun: true });
    }
    var ctrl = ("AbortController" in global) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, REQ_TIMEOUT) : null;
    return fetch(PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey || uuid() },
      body: JSON.stringify({ action: action, payload: payload }),
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (data) {
        // เซิร์ฟเวอร์ยังไม่ตั้ง ENV key → ถือเป็น dry-run (ไม่ใช่ error, ไม่ retry)
        if (data && data.configured === false) {
          log({ kind: action, status: "dry-run", sku: payload && payload.sku, ref: payload && payload.reference, message: "เซิร์ฟเวอร์ยังไม่ตั้ง BIGSELLER_API_KEY (dry-run)" });
          return { ok: false, configured: false };
        }
        if (r.status === 429 || r.status >= 500) {
          // ชั่วคราว → ให้ retry ได้
          throw Object.assign(new Error("retryable " + r.status), { retryable: true, status: r.status });
        }
        if (!r.ok) {
          // 4xx อื่น ๆ = ผิดถาวร (เช่นข้อมูลไม่ผ่าน) → ไม่ retry
          return { ok: false, status: r.status, error: (data && (data.error || data.message)) || ("HTTP " + r.status), data: data };
        }
        return { ok: true, status: r.status, data: data };
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      // network/timeout = ชั่วคราว → retry
      throw Object.assign(err || new Error("network"), { retryable: true });
    });
  }

  /* =====================================================================
     Job queue (localStorage) + flush + exponential backoff
     ===================================================================== */
  function enqueue(action, payload) {
    var q = read(QUEUE_KEY, []);
    q.push({ id: uuid(), action: action, payload: payload, idemKey: uuid(), attempts: 0, nextAt: now() });
    write(QUEUE_KEY, q);
    log({ kind: action, status: "queued", sku: payload && payload.sku, ref: payload && payload.reference, message: "เข้าคิวรอส่ง" });
    scheduleFlush(400);
  }

  var flushing = false, flushTimer = null;
  function scheduleFlush(delay) {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flushQueue(); }, delay || 0);
  }
  function backoff(attempts) {
    // 2s, 4s, 8s, 16s, 32s, 60s (เพดาน)
    return Math.min(60000, Math.pow(2, attempts) * 1000);
  }
  function flushQueue() {
    if (flushing || !enabled()) return Promise.resolve();
    var q = read(QUEUE_KEY, []);
    var due = q.filter(function (j) { return j.nextAt <= now(); });
    if (!due.length) return Promise.resolve();
    flushing = true;
    var job = due[0];
    return request(job.action, job.payload, job.idemKey).then(function (res) {
      var list = read(QUEUE_KEY, []);
      if (res.ok) {
        write(QUEUE_KEY, list.filter(function (j) { return j.id !== job.id; }));
        log({ kind: job.action, status: "ok", sku: job.payload && job.payload.sku, ref: job.payload && job.payload.reference, message: "ส่งสำเร็จ" });
      } else {
        // dry-run / 4xx ถาวร → เอาออกจากคิว ไม่วน
        write(QUEUE_KEY, list.filter(function (j) { return j.id !== job.id; }));
        if (!res.dryRun && res.configured !== false) {
          log({ kind: job.action, status: "error", sku: job.payload && job.payload.sku, ref: job.payload && job.payload.reference, message: res.error || "ปฏิเสธ (ไม่ retry)" });
        }
      }
    }).catch(function (err) {
      // ชั่วคราว → เพิ่ม attempt + เลื่อน nextAt (exponential backoff)
      var list = read(QUEUE_KEY, []);
      for (var i = 0; i < list.length; i++) {
        if (list[i].id !== job.id) continue;
        list[i].attempts++;
        if (list[i].attempts >= MAX_ATTEMPTS) {
          log({ kind: job.action, status: "error", sku: job.payload && job.payload.sku, ref: job.payload && job.payload.reference, message: "ส่งไม่สำเร็จหลังพยายาม " + MAX_ATTEMPTS + " ครั้ง — ยกเลิก" });
          list.splice(i, 1);
        } else {
          list[i].nextAt = now() + backoff(list[i].attempts);
          log({ kind: job.action, status: "retry", sku: job.payload && job.payload.sku, ref: job.payload && job.payload.reference, message: "พยายามครั้งที่ " + list[i].attempts + " ล้มเหลว — จะลองใหม่ใน " + Math.round(backoff(list[i].attempts) / 1000) + " วิ (" + (err && err.message) + ")" });
        }
        break;
      }
      write(QUEUE_KEY, list);
    }).then(function () {
      flushing = false;
      // ยังมีงานค้างอีก → นัด flush รอบถัดไป
      if (read(QUEUE_KEY, []).some(function (j) { return j.nextAt <= now(); })) scheduleFlush(800);
    });
  }

  /* ---------- public actions (ขาออก) ---------- */
  // เรียกตอน saveProduct — ไม่บล็อก ไม่ throw
  function syncProduct(p) {
    try {
      if (!featureOn("product")) return;
      var payload = buildProductPayload(p);
      var errs = validateProduct(payload);
      if (errs.length) {
        log({ kind: "product.upsert", status: "error", sku: payload.sku, message: "ข้ามซิงค์: " + errs.join(" · ") });
        return;
      }
      enqueue("product.upsert", payload);
    } catch (e) { log({ kind: "product.upsert", status: "error", message: "exception: " + (e && e.message) }); }
  }
  // เรียกตอน placeOrder สำเร็จ — สร้างออเดอร์ใน BigSeller (ขาที่จะเปิดเป็นลำดับถัดไป)
  function syncOrder(o) {
    try {
      if (!featureOn("order")) return;
      enqueue("order.create", buildOrderPayload(o));
    } catch (e) { log({ kind: "order.create", status: "error", message: "exception: " + (e && e.message) }); }
  }
  // ปิดการขายสินค้า (off-shelf) บนทุกแพลตฟอร์ม — ใช้ตอน "ซ่อน/ปิดขายทั้งแบรนด์"
  function offShelfProduct(p) {
    try {
      if (!featureOn("product")) return;
      enqueue("product.offshelf", { sku: merchantSku(p) });
    } catch (e) { log({ kind: "product.offshelf", status: "error", message: "exception: " + (e && e.message) }); }
  }
  // ลบสินค้าต้นแบบใน BigSeller — ใช้ตอน "ลบทั้งแบรนด์" (ถอนรากถอนโคน)
  function removeProduct(p) {
    try {
      if (!featureOn("product")) return;
      enqueue("product.delete", { sku: merchantSku(p) });
    } catch (e) { log({ kind: "product.delete", status: "error", message: "exception: " + (e && e.message) }); }
  }

  /* ---------- read-only: ดึงสต็อกจาก BigSeller (Phase 1 — ปลอดภัยสุด) ----------
     เรียกแบบ on-demand เท่านั้น (ปุ่มในหน้าแอดมิน / ก่อนชำระเงิน) — ไม่ polling
     คืน { ok, items:[{sku, stock}] } หรือ { ok:false } ถ้าปิด/ยังไม่ตั้งค่า     */
  function pullStock(skus) {
    if (!enabled()) return Promise.resolve({ ok: false, dryRun: true });
    return request("stock.query", { skus: skus || [] }, uuid()).then(function (res) {
      if (res.ok && res.data) return { ok: true, items: res.data.items || res.data || [] };
      return { ok: false, configured: res.configured };
    }).catch(function () { return { ok: false }; });
  }

  /* ---------- final stock check ก่อนชำระเงิน ----------
     เทียบจำนวนที่ลูกค้าจะซื้อกับสต็อกจริงที่คลังกลาง BigSeller อีกครั้ง
     lines = [{ sku, qty }]  → คืน { ok, shortages:[{sku, want, have}] }
     ถ้าปิดซิงค์/ดึงไม่ได้ → ok:true (fallback เชื่อสต็อก local เดิม ไม่บล็อกการขาย) */
  function finalStockCheck(lines) {
    if (!featureOn("stockPull") || !lines || !lines.length) return Promise.resolve({ ok: true, skipped: true });
    var skus = lines.map(function (l) { return l.sku; });
    return pullStock(skus).then(function (res) {
      if (!res.ok) return { ok: true, skipped: true };  // ดึงไม่ได้ → ไม่ขวางการขาย
      var have = {};
      (res.items || []).forEach(function (it) { have[String(it.sku)] = Number(it.stock) || 0; });
      var shortages = [];
      lines.forEach(function (l) {
        var h = have[String(l.sku)];
        if (h != null && h < l.qty) shortages.push({ sku: l.sku, want: l.qty, have: h });
      });
      return { ok: shortages.length === 0, shortages: shortages };
    }).catch(function () { return { ok: true, skipped: true }; });
  }

  /* ---------- lifecycle ---------- */
  function start() {
    // flush คิวที่ค้างเป็นระยะ (เฉพาะตอนแท็บ visible) — ไม่ polling API ภายนอก
    setInterval(function () {
      if (document.visibilityState === "visible") flushQueue();
    }, FLUSH_EVERY);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") scheduleFlush(500);
    });
    scheduleFlush(1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  global.BigSellerSync = {
    // config
    cfg: cfg, enabled: enabled, featureOn: featureOn,
    // parsers/builders (ทดสอบ/พรีวิวได้)
    specToDescription: specToDescription, buildProductPayload: buildProductPayload,
    buildOrderPayload: buildOrderPayload, validateProduct: validateProduct, merchantSku: merchantSku,
    // outbound
    syncProduct: syncProduct, syncOrder: syncOrder, offShelfProduct: offShelfProduct, removeProduct: removeProduct,
    // read-only / checkout guard
    pullStock: pullStock, finalStockCheck: finalStockCheck,
    // queue/log
    flushQueue: flushQueue, getQueue: function () { return read(QUEUE_KEY, []); },
    getLogs: getLogs, clearLogs: clearLogs,
  };
})(window);
