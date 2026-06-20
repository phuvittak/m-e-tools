/* =================================================================
   M.E.Tools — shared UI helpers (icons, header/footer, toast)
   ================================================================= */
(function (global) {
  "use strict";
  var S = global.MEStore;

  /* ---------- PWA bootstrap (installable on Android & iOS) ---------- */
  (function pwa() {
    try {
      var base = /\/admin\//.test(location.pathname) ? "../" : "./";
      var head = document.head;
      function add(tag, attrs) { var el = document.createElement(tag); for (var k in attrs) el.setAttribute(k, attrs[k]); head.appendChild(el); }
      if (!document.querySelector("link[rel=manifest]")) add("link", { rel: "manifest", href: base + "manifest.webmanifest" });
      add("meta", { name: "theme-color", content: "#0B0B0B" });
      add("meta", { name: "mobile-web-app-capable", content: "yes" });
      add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
      add("meta", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });
      add("meta", { name: "apple-mobile-web-app-title", content: "M.E.Tools" });
      add("link", { rel: "apple-touch-icon", href: base + "assets/mascot-on-yellow.png" });
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register(base + "sw.js", { scope: base }).then(function (reg) {
            try { reg.update(); } catch (e) {}
          }).catch(function () {});
          // (ไม่บังคับรีโหลดอัตโนมัติแล้ว — กันหน้าจอขาว/รีโหลดกลางคัน;
          //  ความสดของไฟล์มาจาก no-cache header + SW network-first อยู่แล้ว)
        });
      }
    } catch (e) {}
  })();

  /* ---------- tool icons (inline SVG tiles) ---------------------- */
  var ICONS = {
    drill: '<path d="M3 9h7l2-2h4v4l3 1v3l-3 1v2H8l-1 3H4v-3H3z"/><path d="M16 9V6"/>',
    driver: '<path d="M4 14l6-6 3 3-6 6H4z"/><path d="M13 5l3-3 6 6-3 3z"/>',
    saw: '<circle cx="9" cy="14" r="6"/><path d="M9 14h0"/><path d="M14 9l7-5v4l-5 3"/><path d="M9 8v0M5 11v0M6 18v0M12 17v0"/>',
    grinder: '<rect x="2" y="9" width="10" height="6" rx="1"/><circle cx="18" cy="12" r="4"/><path d="M12 12h2"/>',
    rotary: '<rect x="3" y="8" width="9" height="8" rx="1"/><path d="M12 10h4l4-3v10l-4-3h-4"/>',
    battery: '<rect x="3" y="7" width="16" height="11" rx="2"/><path d="M19 10h2v5h-2"/><path d="M8 4h8v3H8z"/><path d="M7 12h6"/>',
    charger: '<rect x="4" y="3" width="16" height="10" rx="2"/><path d="M9 13v4M15 13v4M7 21h10"/><path d="M11 6l-2 3h4l-2 3"/>',
    measure: '<rect x="2" y="7" width="20" height="10" rx="1"/><path d="M6 7v3M10 7v4M14 7v3M18 7v4"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5 5l-7 7 2 2 7-7a4 4 0 0 0 5-5l-2.3 2.3-2-2z"/>',
    laser: '<rect x="9" y="3" width="6" height="14" rx="1"/><path d="M3 20h18"/><path d="M12 17v3"/><path d="M6 8h3M15 8h3"/>',
    compressor: '<rect x="3" y="8" width="14" height="9" rx="4"/><path d="M17 11h3v4h-3"/><path d="M6 17v3M14 17v3"/>',
    box: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5 5l-7 7 2 2 7-7a4 4 0 0 0 5-5l-2.3 2.3-2-2z"/>',
    // ---- หมวดเครื่องมือเพิ่มเติม (สไตล์เส้น สำหรับกริดหมวดหมู่) ----
    air: '<rect x="3" y="9" width="13" height="9" rx="4"/><path d="M16 12h3l2 2v2h-5"/><path d="M6 18v3M13 18v3"/>',
    weld: '<path d="M4 20l8-8"/><path d="M12 12l4-4"/><path d="M15 5l4 4-3 3-4-4z"/><path d="M16 14l4 5"/>',
    engine: '<rect x="3" y="10" width="11" height="7" rx="1"/><path d="M6 10V7h4v3"/><path d="M14 12h3l3 2v2h-6"/><path d="M4 17v2M13 17v2"/><path d="M8 7V5h3"/>',
    agri: '<path d="M12 21c0-6 2.5-9.5 9-10.5C20 17 16.5 20.5 12 21z"/><path d="M12 21c0-5-2.2-7.7-8-8.7C5 17.5 8 20.2 12 21z"/><path d="M12 21v-8"/>',
    pump: '<rect x="4" y="11" width="9" height="8" rx="1"/><path d="M8 11V6h6l4 4"/><path d="M13 15h6"/><path d="M10 6V4"/>',
    car: '<path d="M3 13l2.2-5.2A2 2 0 0 1 7 6.6h10a2 2 0 0 1 1.8 1.2L21 13"/><path d="M3 13h18v4a1 1 0 0 1-1 1h-1M5 18H4a1 1 0 0 1-1-1v-4"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/>',
    office: '<rect x="5" y="12" width="14" height="6" rx="1"/><path d="M7 12V4h10v8"/><path d="M8 18v2M16 18v2"/><path d="M9 15h6"/>',
    clean: '<path d="M9 9h5l1.5 3v8H9z"/><path d="M9 9V4h3v5"/><path d="M16 6h4M16 9h3M16 12h4"/>',
    ladder: '<path d="M7 3v18M17 3v18"/><path d="M7 7h10M7 11h10M7 15h10"/>',
    lift: '<path d="M3 5v11h10"/><path d="M14 16V9h4l3 4v3"/><circle cx="6.5" cy="18.5" r="1.6"/><circle cx="16.5" cy="18.5" r="1.6"/>',
    hammer: '<path d="M14 3l7 7-3 3-7-7z"/><path d="M11 8L3 16v4h4l8-8"/>',
    bolt: '<path d="M12 2l3.5 2v4L12 10 8.5 8V4z"/><path d="M12 10v12"/>',
    electric: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
    bearing: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="4.4" r="1"/><circle cx="12" cy="19.6" r="1"/><circle cx="4.4" cy="12" r="1"/><circle cx="19.6" cy="12" r="1"/>',
    generator: '<rect x="3" y="8" width="18" height="10" rx="2"/><path d="M7 8V6h10v2"/><path d="M9 13h2l1.5-2 1 4 1.5-2H18"/>',
    safety: '<path d="M3 16a9 9 0 0 1 18 0"/><path d="M2.5 16h19v2h-19z"/><path d="M10 7.2V4h4v3.2"/><path d="M12 7a4.5 4.5 0 0 1 4.4 4.6"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    pipe: '<path d="M4 8h7v8H4z"/><path d="M11 10h4V6h5v12h-5v-4h-4"/><path d="M4 6V4M8 6V4"/>',
    paint: '<rect x="9" y="8" width="6" height="12" rx="1"/><path d="M9 8V4h4v4"/><path d="M15 10l4-1.5M15 13h4M15 16l4 1.5"/>',
  };
  function iconSvg(key, size) {
    size = size || 48;
    var body = ICONS[key] || ICONS.tool;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  }
  // a full product "image" tile (icon on a branded backdrop)
  function productTile(p, opts) {
    opts = opts || {};
    var badge = "";
    if (S.available(p) <= 0) badge = '<span class="tile-badge out">หมดสต็อก</span>';
    else if (p.forRent && p.forSale) badge = '<span class="tile-badge both">เช่า/ซื้อ</span>';
    else if (p.forRent) badge = '<span class="tile-badge rent">ให้เช่า</span>';
    else badge = '<span class="tile-badge sale">ขาย</span>';
    var visual = p.image
      ? '<span class="tile-img" style="background-image:url(\'' + String(p.image).replace(/'/g, "%27") + '\')"></span>'
      : '<span class="tile-icon">' + iconSvg(p.icon, opts.lg ? 120 : 64) + "</span><span class=\"tile-grid\"></span>";
    // ป้าย "ใหม่" — สินค้าที่เพิ่มภายใน 30 วัน
    var isNew = p.createdAt && (Date.now() - p.createdAt) < 30 * 86400000;
    var newBadge = isNew ? '<span class="tile-new">ใหม่</span>' : "";
    // ป้ายวัสดุ (ปูน/เหล็ก/ไม้/กระเบื้อง) + เซฟตี้ — กวาดตามองรู้ทันทีว่าใช้กับงานอะไรได้
    var MAT = { concrete: "🧱", steel: "⚙️", wood: "🪵", tile: "🔲" };
    var mats = (Array.isArray(p.materials) ? p.materials : []).map(function (m) { return MAT[m] || ""; }).filter(Boolean).join(" ");
    var matStrip = (mats || p.safety)
      ? '<span class="tile-mats">' + (mats ? '<span class="tile-mat-ic">' + mats + "</span>" : "") + (p.safety ? '<span class="tile-safety" title="ต้องใช้อุปกรณ์ป้องกัน">⚠️</span>' : "") + "</span>"
      : "";
    return (
      '<div class="tile ' + (opts.lg ? "tile-lg" : "") + (p.image ? " has-img" : "") + '" data-cat="' + p.category + '">' +
      '<span class="tile-brand">' + p.brand + "</span>" +
      newBadge + badge + visual + matStrip +
      "</div>"
    );
  }

  /* ---------- header / footer ----------------------------------- */
  // active: 'home'|'shop'|'orders'
  function renderHeader(active) {
    var count = S.cartCount();
    return (
      '<header class="me-header"><div class="me-header-inner">' +
      '<a class="me-header-brand" href="index.html">' +
      '<span class="me-header-mark">M.E.<span style="color:var(--price-red)">T</span>ools</span>' +
      '<span class="me-header-loc">ท่ารั้ว · เชียงใหม่</span></a>' +
      '<nav class="me-header-nav">' +
      navLink("index.html", "หน้าแรก", active === "home") +
      navLink("shop.html", "สินค้า / หมวดหมู่", active === "shop" || active === "categories") +
      navLink("catalog.html", "แคตตาล็อก", active === "catalog") +
      navLink("warranty.html", "ลงทะเบียนประกัน", active === "warranty") +
      navLink("orders.html", "ติดตามคำสั่งซื้อ", active === "orders") +
      "</nav>" +
      '<div class="me-header-right">' + accountArea() +
      '<a href="cart.html" class="me-cart-link" aria-label="ตะกร้า">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>' +
      '<span class="me-cart-badge" data-cart-badge ' + (count ? "" : "hidden") + ">" + count + "</span></a>" +
      "</div></div></header>"
    );
  }
  function accountArea() {
    var s = S.session();
    if (s) {
      var staff = s.role === "employee" || s.role === "owner";
      return '<div class="me-acct"><a class="me-acct-name" href="' + (staff ? "admin/dashboard.html" : "account.html") + '">' +
        (s.role === "owner" ? "⭐ " : staff ? "👷 " : "👤 ") + esc(s.name) + "</a>" +
        (staff ? '<a class="me-acct-link" href="admin/dashboard.html">ระบบหลังร้าน</a>' : '<a class="me-acct-link" href="account.html">บัญชีของฉัน</a>') +
        '<button class="me-acct-link" data-logout type="button">ออกจากระบบ</button></div>';
    }
    return '<div class="me-acct">' +
      '<a class="me-btn me-btn-ghost me-btn-sm" href="login.html">เข้าสู่ระบบ</a>' +
      '<a class="me-btn me-btn-sm" href="register.html">สมัครสมาชิก</a></div>';
  }
  function navLink(href, label, on) {
    return '<a href="' + href + '"' + (on ? ' class="on"' : "") + ">" + label + "</a>";
  }
  function socialBtn(href, label, path) {
    if (!href) return "";
    return '<a class="me-soc" href="' + esc(href) + '" target="_blank" rel="noopener" aria-label="' + label + '">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + path + "</svg></a>";
  }
  function renderFooter() {
    var st = S.getSettings();
    var FB = '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>';
    var IG = '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6zM17.6 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>';
    var TT = '<path d="M15 3c.4 2.6 2 4.2 4.5 4.5v3.1c-1.6 0-3.1-.5-4.5-1.4v6.3a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.2a2.6 2.6 0 1 0 1.8 2.4V3H15z"/>';
    return (
      '<footer class="me-footer"><div class="me-footer-stripes"></div>' +
      '<div class="me-footer-inner">' +
        '<div class="me-footer-brand"><div class="me-footer-wm">M.E.<span style="color:var(--price-red)">T</span>ools</div>' +
          '<div class="me-footer-company">' + esc(st.company) + "</div>" +
          '<div class="me-footer-rows">' +
            '<div class="me-footer-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>' + esc(st.address) + "</span></div>" +
            (function () {
              var phs = (String(st.phone || "").match(/[0-9][0-9()+\-\s]{5,}[0-9]/g) || []).map(function (p) { return p.replace(/\s+/g, " ").trim(); }).filter(Boolean);
              if (!phs.length) return "";
              // เบอร์โทรทั้งหมดอยู่บรรทัดเดียว คั่นด้วย , (เช่น "053-xxx, 081-xxx")
              var links = phs.map(function (p) { var digits = p.replace(/\D/g, ""); return '<a href="tel:' + esc(digits) + '">' + esc(p) + "</a>"; }).join(", ");
              return '<div class="me-footer-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>' + links + "</span></div>";
            })() +
            (function () { var lineId = st.line || ""; if (!lineId) return ""; var lineHref = /^https?:\/\//i.test(lineId) ? lineId : "https://lin.ee/so6euhT"; return '<div class="me-footer-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span>LINE: <a href="' + esc(lineHref) + '" target="_blank" rel="noopener">' + esc(lineId) + "</a></span></div>"; })() +
          "</div>" +
          '<div class="me-socials">' + socialBtn(st.facebook, "Facebook", FB) + socialBtn(st.instagram, "Instagram", IG) + socialBtn(st.tiktok, "TikTok", TT) + "</div>" +
        "</div>" +
        '<div class="me-footer-col"><div class="me-footer-h">เมนู</div>' +
          '<a href="index.html">หน้าแรก</a><a href="shop.html">สินค้า / หมวดหมู่</a>' +
          '<a href="catalog.html">แคตตาล็อก</a><a href="warranty.html">ลงทะเบียนประกัน</a><a href="cart.html">ตะกร้า</a><a href="orders.html">ติดตามคำสั่งซื้อ</a></div>' +
        '<div class="me-footer-col"><div class="me-footer-h">ช่วยเหลือ</div>' +
          '<a href="guide.html">ความรู้ช่าง · ตารางช่วยช่าง</a><a href="index.html#faq">คำถามที่พบบ่อย</a><a href="#" data-open-chat>ติดต่อร้าน (แชท)</a>' +
          '<a href="account.html">บัญชีของฉัน</a><a href="login.html">เข้าสู่ระบบ</a><a href="register.html">สมัครสมาชิก</a></div>' +
        '<div class="me-footer-col"><div class="me-footer-h">เวลาทำการ</div>' +
          "<div>" + esc(st.hoursWeek) + "</div><div>" + esc(st.hoursSun) + "</div>" +
          (function () { var op = S.isOpenNow(); return '<div class="me-footer-pill ' + (op.open ? "open" : "closed") + '"><span class="dot' + (op.open ? "" : " dot-closed") + '"></span> ' + (op.open ? "เปิดอยู่" : "ปิดอยู่" + (op.reason ? " · " + esc(op.reason) : "")) + "</div>"; })() + "</div>" +
    "</div>" +
      '<div class="me-footer-foot">' +
      '  <span>© 2026 ' + esc(st.company) + ' · ท่ารั้ว เชียงใหม่</span>' +
      '  <span>พัฒนาโดย นายภูวิศทักษ์ ฐิติฤทธินันท์ | All Brands® are trademarks of their owners.</span>' +
      '</div></footer>'
    );
  }

  function mountChrome(active) {
    chromeActive = active;
    renderChrome();
    S.onChange(renderChrome);
    mountLineFab();
    mountWebChat();
    loadShopFeatures();
    // โหลด settings + ship_rates จาก cloud — ทำให้หน้าร้านเห็นค่าล่าสุดที่แอดมินบันทึก
    // โดยไม่ต้องล้าง localStorage หรือ login admin
    if (S.cloudLoadPublicSettings) S.cloudLoadPublicSettings();
    // โหลดแคตตาล็อกสินค้าจาก cloud ให้ "ทุกคน" (รวมเจ้าของ) — เก็บใน key แยก ไม่ทับ me_products
    // เจ้าของยังใช้ master ในเครื่องก่อนถ้ามี แต่ถ้าเครื่องนี้ยังว่าง (เปิดบนอุปกรณ์ใหม่) จะ fallback มาอันนี้
    // → หน้าร้าน re-render เมื่อ event "me-products-loaded"
    if (S.cloudLoadProducts) S.cloudLoadProducts();
  }

  // Phase B+: โหลดสวิตช์ฟีเจอร์ของร้าน (rentEnabled ฯลฯ) — body class ควบคุม CSS
  // bot_config/replies เป็น public read — ดึงตรงด้วย Firestore REST ไม่ต้อง auth
  function loadShopFeatures() {
    // ใช้ค่าใน localStorage ก่อน (เร็ว) แล้ว refresh จาก cloud
    try {
      var cached = localStorage.getItem("me_shopFeatures");
      if (cached) applyFeatures(JSON.parse(cached));
    } catch (e) {}
    var cfg = window.parseFbConfig ? window.parseFbConfig((S.firebaseCfg && S.firebaseCfg()) || "") : null;
    if (!cfg || !cfg.projectId) return;
    var url = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/default/documents/bot_config/replies";
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (doc) {
        if (!doc || !doc.fields) return;
        var v = doc.fields.rentEnabled;
        var rent = (v && typeof v.booleanValue === "boolean") ? v.booleanValue : true;
        var feats = { rentEnabled: rent };
        try { localStorage.setItem("me_shopFeatures", JSON.stringify(feats)); } catch (e) {}
        applyFeatures(feats);
      })
      .catch(function () {});
  }
  function applyFeatures(feats) {
    if (!feats) return;
    var body = document.body;
    if (feats.rentEnabled === false) body.classList.add("no-rent");
    else body.classList.remove("no-rent");
  }

  /* ---------- Phase A4-A5: web chat widget → Firestore bot_messages ---------- */
  // ลูกค้าคลิก "แชท" → sign in anonymous (lazy, ตอนเปิด) → write/listen bot_messages
  // ใช้ named DB "default" เดียวกับ bot-inbox เห็นแชทเรียลไทม์ + แอดมินตอบกลับได้
  var webchatState = { initted: false, unsub: null, db: null, fs: null, userId: null };
  function mountWebChat() {
    if (document.querySelector("[data-webchat]")) return;
    var box = document.createElement("div");
    box.className = "me-chat me-chat-right";
    box.setAttribute("data-webchat", "");
    box.innerHTML =
      '<button class="me-chat-fab" data-webchat-fab>' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> แชทกับร้าน</button>' +
      '<div class="me-chat-panel" data-webchat-panel hidden>' +
        '<div class="me-chat-head"><span>แชทกับ M.E.Tools</span><button data-webchat-close aria-label="ปิด">×</button></div>' +
        '<div class="me-chat-body" data-webchat-body><div class="me-chat-empty">พิมพ์ข้อความด้านล่างเพื่อเริ่มสนทนา</div></div>' +
        '<div class="me-chat-stage" data-webchat-stage hidden style="padding:6px 12px 0"></div>' +
        '<form class="me-chat-input" data-webchat-form><button type="button" class="me-chat-imgbtn" data-webchat-imgbtn title="แนบรูป" style="background:none;border:none;font-size:20px;cursor:pointer;padding:0 4px">📷</button><input type="file" accept="image/*" data-webchat-img style="display:none"><input data-webchat-text placeholder="พิมพ์ข้อความ…" autocomplete="off" maxlength="2000"><button class="me-btn me-btn-sm" type="submit">ส่ง</button></form>' +
      "</div>";
    document.body.appendChild(box);
    box.querySelector("[data-webchat-fab]").addEventListener("click", function () {
      var pn = box.querySelector("[data-webchat-panel]");
      if (pn.hidden) openWebChat(); else closeWebChat();
    });
    box.querySelector("[data-webchat-close]").addEventListener("click", closeWebChat);
    var wcStage = box.querySelector("[data-webchat-stage]");
    function renderWcStage() {
      if (!wcStage) return;
      if (!webchatState.pendingImg) { wcStage.hidden = true; wcStage.innerHTML = ""; return; }
      wcStage.hidden = false;
      wcStage.innerHTML = '<div style="display:inline-block;position:relative">' +
        '<img src="' + webchatState.pendingImg + '" style="max-width:110px;max-height:110px;border-radius:8px;border:1px solid #ccc;display:block">' +
        '<button type="button" data-wc-imgclr style="position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;border:none;background:#e11;color:#fff;font-size:13px;cursor:pointer">×</button></div>';
      var clr = wcStage.querySelector("[data-wc-imgclr]");
      if (clr) clr.onclick = function () { webchatState.pendingImg = ""; renderWcStage(); };
    }
    box.querySelector("[data-webchat-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = box.querySelector("[data-webchat-text]");
      var t = (inp.value || "").trim();
      var img = webchatState.pendingImg || "";
      if (!t && !img) return; // ไม่มีทั้งข้อความและรูป
      inp.value = ""; webchatState.pendingImg = ""; renderWcStage();
      sendWebChatMessage(t, img);
    });
    var wcImgBtn = box.querySelector("[data-webchat-imgbtn]");
    var wcImg = box.querySelector("[data-webchat-img]");
    if (wcImgBtn && wcImg) wcImgBtn.addEventListener("click", function () { wcImg.click(); });
    if (wcImg) wcImg.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      e.target.value = "";
      webChatCompress(f, function (dataUrl) { webchatState.pendingImg = dataUrl; renderWcStage(); }); // เลือกแล้วโชว์พรีวิวก่อน (ยังไม่ส่ง)
    });
  }
  // ย่อรูปก่อนส่ง (ฝั่งลูกค้าเว็บ)
  function webChatCompress(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 900, s = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        try { c.getContext("2d").drawImage(img, 0, 0, w, h); cb(c.toDataURL("image/jpeg", 0.75)); } catch (e) { cb(fr.result); }
      };
      img.onerror = function () { cb(fr.result); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function sendWebChatImage(dataUrl) { sendWebChatMessage("", dataUrl); }
  // ส่งข้อความ + รูป พร้อมกัน (รูปอย่างเดียวก็ได้, ข้อความอย่างเดียวก็ได้)
  function sendWebChatMessage(text, image) {
    if (!webchatState.initted) { initWebChatFirestore(); return; }
    if (!webchatState.userId || !webchatState.db) return;
    var fs = webchatState.fs;
    var doc = {
      userId: webchatState.userId, role: "user", source: "web", at: fs.serverTimestamp(),
      text: text || (image ? "[ลูกค้าส่งรูป]" : ""),
    };
    if (image) doc.image = image;
    fs.addDoc(fs.collection(webchatState.db, "bot_messages"), doc).then(function () {
      // มีข้อความ → ให้บอทตอบกลับ (รูปอย่างเดียวไม่เรียกบอท)
      if (text) return fetch("/api/ai-parse-product", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: webchatState.userId, text: text }) });
    }).catch(function (err) { console.error("[webchat send]", err); });
  }
  function openWebChat() {
    var box = document.querySelector("[data-webchat]"); if (!box) return;
    box.querySelector("[data-webchat-panel]").hidden = false;
    box.querySelector("[data-webchat-text]").focus();
    initWebChatFirestore();
  }
  function closeWebChat() {
    var p = document.querySelector("[data-webchat-panel]");
    if (p) p.hidden = true;
  }
  function initWebChatFirestore() {
    if (webchatState.initted) return;
    webchatState.initted = true;
    var cfg = window.parseFbConfig ? window.parseFbConfig(S.firebaseCfg ? S.firebaseCfg() : "") : null;
    if (!cfg) {
      setWebChatBody('<div class="me-chat-empty">ระบบยังไม่ได้ตั้ง Firebase — ทักผ่าน LINE ก่อนได้เลย</div>');
      return;
    }
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    Promise.all([
      import(base + "firebase-app.js"),
      import(base + "firebase-auth.js"),
      import(base + "firebase-firestore.js")
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
      var app;
      try { app = appMod.getApp("webchat"); }
      catch (e) { app = appMod.initializeApp(cfg, "webchat"); }
      var authInst = authMod.getAuth(app);
      return authMod.signInAnonymously(authInst).then(function (cred) {
        webchatState.userId = cred.user.uid;
        webchatState.db = fsMod.getFirestore(app, "default");
        webchatState.fs = {
          collection: fsMod.collection, addDoc: fsMod.addDoc,
          query: fsMod.query, where: fsMod.where, onSnapshot: fsMod.onSnapshot,
          serverTimestamp: fsMod.serverTimestamp
        };
        var q = fsMod.query(
          fsMod.collection(webchatState.db, "bot_messages"),
          fsMod.where("userId", "==", webchatState.userId)
        );
        webchatState.unsub = fsMod.onSnapshot(q, function (snap) {
          renderWebChatMsgs(snap.docs.map(function (d) { return d.data() || {}; }));
        }, function (err) {
          console.error("[webchat listener]", err);
        });
      });
    }).catch(function (err) {
      setWebChatBody('<div class="me-chat-empty">เชื่อมระบบไม่สำเร็จ — ลองทักผ่าน LINE</div>');
      console.error("[webchat init]", err);
    });
  }
  function sendWebChat(text) {
    if (!webchatState.initted) { initWebChatFirestore(); return; }
    if (!webchatState.userId || !webchatState.db) return;
    var fs = webchatState.fs;
    fs.addDoc(fs.collection(webchatState.db, "bot_messages"), {
      userId: webchatState.userId, role: "user", text: text,
      source: "web", at: fs.serverTimestamp()
    }).then(function () {
      // เรียก bot ให้ตอบกลับ — server-side คำนวณ reply + เขียน Firestore (role:"bot")
      // ถ้า admin กำลังคุย (human mode) server จะข้าม ไม่ตอบทับ
      return fetch("/api/ai-parse-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: webchatState.userId, text: text }),
      });
    }).catch(function (err) { console.error("[webchat send]", err); });
  }
  function renderWebChatMsgs(msgs) {
    var body = document.querySelector("[data-webchat-body]"); if (!body) return;
    if (!msgs || !msgs.length) {
      body.innerHTML = '<div class="me-chat-empty">เริ่มสนทนาเลย</div>';
      return;
    }
    // sort เก่า → ใหม่ ใช้ at ทั้งแบบ Timestamp และ string
    msgs.sort(function (a, b) {
      var aa = (a.at && a.at.toDate) ? a.at.toDate().getTime() : (a.at ? new Date(a.at).getTime() : 0);
      var bb = (b.at && b.at.toDate) ? b.at.toDate().getTime() : (b.at ? new Date(b.at).getTime() : 0);
      return aa - bb;
    });
    // flatten: paired (text + reply) → 2 bubbles, flat (role) → 1 bubble
    var bubbles = [];
    msgs.forEach(function (m) {
      if (m.role === "user") bubbles.push({ side: "me", text: m.text, image: m.image, video: m.video });
      else if (m.role === "admin") bubbles.push({ side: "shop", text: m.text, image: m.image, video: m.video, who: "ร้าน" });
      else if (m.role === "bot") bubbles.push({ side: "bot", text: m.text });
      else {
        if (m.text || m.image || m.video) bubbles.push({ side: "me", text: m.text, image: m.image, video: m.video });
        if (m.reply) bubbles.push({ side: "bot", text: m.reply });
      }
    });
    body.innerHTML = bubbles.map(function (b) {
      var isPlaceholder = (b.image || b.video) && (b.text === "[ลูกค้าส่งรูป]" || b.text === "[รูปภาพ]");
      return '<div class="me-chat-msg ' + b.side + '">' +
        (b.who ? '<span class="chat-who">' + esc(b.who) + '</span>' : "") +
        (b.video ? '<video src="' + esc(b.video) + '" controls preload="metadata" playsinline style="max-width:200px;max-height:220px;border-radius:8px;display:block"></video>' : "") +
        (b.image ? '<a href="' + esc(b.image) + '" target="_blank" rel="noopener"><img src="' + esc(b.image) + '" alt="รูป" style="max-width:170px;max-height:190px;border-radius:8px;display:block"></a>' : "") +
        (b.text && !isPlaceholder ? esc(b.text) : "") + '</div>';
    }).join("");
    body.scrollTop = body.scrollHeight;
  }
  function setWebChatBody(html) {
    var body = document.querySelector("[data-webchat-body]"); if (body) body.innerHTML = html;
  }

  /* ---------- LINE FAB (replaces in-page chat) ---------- */
  // คลิก → เปิด LINE link โดยตรง
  // - ในเบราว์เซอร์ปกติ: redirect ไป LINE Web → prompt เปิดแอป LINE
  // - ใน LINE in-app browser: เปิด chat กับ OA ทันที
  function openLineChat() {
    var href = (S.getSettings().line || "").trim();
    if (!/^https?:\/\//i.test(href)) href = "https://lin.ee/so6euhT";
    window.open(href, "_blank", "noopener");
  }
  function mountLineFab() {
    if (document.querySelector("[data-line-fab]")) return;
    var btn = document.createElement("button");
    btn.className = "me-chat-fab";
    btn.setAttribute("data-line-fab", "");
    btn.setAttribute("aria-label", "ติดต่อทาง LINE");
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M19.365 9.863c.349 0 .63.281.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.282.63.63 0 .349-.281.63-.63.63h-2.385a.63.63 0 01-.63-.63V8.108c0-.348.281-.63.63-.63h2.385c.349 0 .63.282.63.63 0 .348-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.198.031-.211 0-.391-.09-.51-.25l-2.443-3.318v2.94a.629.629 0 01-1.258 0V8.108a.628.628 0 01.43-.594c.064-.023.133-.034.197-.034.197 0 .388.103.51.262l2.456 3.33V8.108c0-.348.281-.63.63-.63.349 0 .63.282.63.63v4.771zm-5.741 0a.63.63 0 11-1.258 0V8.108a.629.629 0 111.258 0v4.771zm-2.563.63H4.822a.63.63 0 01-.63-.63V8.108a.629.629 0 111.258 0v4.141h1.756a.629.629 0 110 1.26zM24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.121.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314z"/>' +
      "</svg> LINE";
    btn.style.position = "fixed";
    btn.style.bottom = "22px";
    btn.style.left = "22px";
    btn.style.zIndex = "190";
    btn.style.background = "#06c755";
    btn.style.color = "#fff";
    btn.addEventListener("click", openLineChat);
    document.body.appendChild(btn);
  }
  var chromeActive = "";
  function renderChrome() {
    var h = document.querySelector("[data-header]");
    if (h) h.innerHTML = renderHeader(chromeActive);
    var f = document.querySelector("[data-footer]");
    if (f) f.innerHTML = renderFooter();
    document.querySelectorAll("[data-logout]").forEach(function (b) {
      b.addEventListener("click", function () { S.logout(); window.location.href = "index.html"; });
    });
    document.querySelectorAll("[data-open-chat]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); openLineChat(); });
    });
  }

  /* ---------- chat widget (rule-based "AI", owner-configurable) ---------- */
  // accept either strict JSON or the JS-object form copied straight from the Firebase console
  function parseFbConfig(raw) {
    raw = (raw || "").trim(); if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) {}
    try {
      var j = raw.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":').replace(/,(\s*[}\]])/g, "$1").replace(/'/g, '"');
      return JSON.parse(j);
    } catch (e) {}
    return null;
  }
  global.parseFbConfig = parseFbConfig;

  /* ---------- MEChat: real online chat (Firebase) with localStorage fallback ---------- */
  var MEChat = (function () {
    var db = null, ready = false, loading = false, q = [];
    function rawCfg() { return parseFbConfig(S.firebaseCfg ? S.firebaseCfg() : S.getSettings().firebaseConfig); }
    function enabled() { return !!rawCfg(); }
    function mode() { return enabled() ? "online" : "local"; }
    function loadScript(src, ok, err) { if (document.querySelector('script[src="' + src + '"]')) { ok(); return; } var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = err || ok; document.head.appendChild(s); }
    function ensure(cb) {
      if (ready) return cb(true);
      var c = rawCfg(); if (!c) return cb(false);
      q.push(cb); if (loading) return; loading = true;
      var base = "https://www.gstatic.com/firebasejs/10.12.2/";
      function boot() {
        try {
          if (!window.firebase) throw 0;
          if (!firebase.apps.length) firebase.initializeApp(c);
          db = firebase.firestore();
          // wait for anonymous sign-in so auth-required Firestore rules pass
          // (proceeds anyway if Anonymous auth isn't enabled — works under test-mode rules)
          if (firebase.auth) {
            firebase.auth().signInAnonymously().then(function () { ready = true; flush(true); }).catch(function () { ready = true; flush(true); });
          } else { ready = true; flush(true); }
        } catch (e) { flush(false); }
      }
      loadScript(base + "firebase-app-compat.js", function () {
        loadScript(base + "firebase-firestore-compat.js", function () {
          loadScript(base + "firebase-auth-compat.js", boot, boot); // auth optional
        }, function () { flush(false); });
      }, function () { flush(false); });
    }
    function flush(ok) { loading = false; q.splice(0).forEach(function (cb) { cb(ok); }); }
    function convId() { return S.chatConvId(); }
    function localSend(id, from, text, meta) {
      if (from === "user") S.chatPushUser(text, meta.escalated);
      else if (from === "bot") S.chatPushBot(text);
      else if (from === "shop") S.chatReplyShop(id, text);
    }
    function send(id, from, text, meta) {
      meta = meta || {};
      if (mode() === "online") {
        ensure(function (ok) {
          if (!ok) return localSend(id, from, text, meta);
          var ref = db.collection("chats").doc(id), patch = { updatedAt: Date.now(), lastText: text };
          if (meta.name) patch.name = meta.name; if (meta.email) patch.email = meta.email;
          if (from === "user" && meta.escalated) patch.needsShop = true;
          if (from === "shop") patch.needsShop = false;
          ref.set(patch, { merge: true });
          ref.collection("messages").add({ from: from, text: text, at: Date.now() });
        });
      } else localSend(id, from, text, meta);
    }
    function localConv(id, cb) { function emit() { var c = S.chatGetConv(id); cb(c ? c.messages : []); } emit(); var h = function () { emit(); }; window.addEventListener("me-store-change", h); window.addEventListener("storage", h); return function () { window.removeEventListener("me-store-change", h); window.removeEventListener("storage", h); }; }
    function localList(cb) { function emit() { cb(S.chatList()); } emit(); var h = function () { emit(); }; window.addEventListener("me-store-change", h); window.addEventListener("storage", h); return function () { window.removeEventListener("me-store-change", h); window.removeEventListener("storage", h); }; }
    function subscribeConv(id, cb) {
      if (mode() === "online") { var u = function () {}; ensure(function (ok) { if (!ok) { u = localConv(id, cb); return; } u = db.collection("chats").doc(id).collection("messages").orderBy("at").onSnapshot(function (s) { cb(s.docs.map(function (d) { return d.data(); })); }, function () {}); }); return function () { try { u(); } catch (e) {} }; }
      return localConv(id, cb);
    }
    function subscribeList(cb) {
      try { purgeOld(7); } catch (e) {} // แอดมินเปิดรายการแชท → ล้างของเก่าเกิน 7 วันบน cloud
      if (mode() === "online") { var u = function () {}; ensure(function (ok) { if (!ok) { u = localList(cb); return; } u = db.collection("chats").orderBy("updatedAt", "desc").onSnapshot(function (s) { cb(s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })); }, function () {}); }); return function () { try { u(); } catch (e) {} }; }
      return localList(cb);
    }
    // ลบแชทบน cloud ที่เงียบเกิน N วัน (ค่าเริ่ม 7) — ลบข้อความในห้องก่อนแล้วลบห้อง (best-effort)
    function purgeOld(days) {
      days = days || 7;
      if (mode() !== "online") return;
      ensure(function (ok) {
        if (!ok || !db) return;
        var cutoff = Date.now() - days * 86400000;
        db.collection("chats").where("updatedAt", "<", cutoff).get().then(function (snap) {
          snap.forEach(function (doc) {
            doc.ref.collection("messages").get().then(function (ms) {
              ms.forEach(function (md) { md.ref.delete().catch(function () {}); });
            }).catch(function () {}).then(function () { doc.ref.delete().catch(function () {}); });
          });
        }).catch(function () {});
      });
    }
    return { enabled: enabled, mode: mode, convId: convId, send: send, subscribeConv: subscribeConv, subscribeList: subscribeList, purgeOld: purgeOld };
  })();
  global.MEChat = MEChat;

  var chatUnsub = null;
  function mountChat() {
    if (document.querySelector("[data-chat]")) return;
    var box = document.createElement("div");
    box.className = "me-chat";
    box.setAttribute("data-chat", "");
    box.innerHTML =
      '<button class="me-chat-fab" data-chat-fab>' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> แชท</button>' +
      '<div class="me-chat-panel" data-chat-panel hidden>' +
        '<div class="me-chat-head"><span>แชทกับ M.E.Tools</span><button data-chat-close aria-label="ปิด">×</button></div>' +
        '<div class="me-chat-note" style="font-size:11px;color:#888;text-align:center;padding:5px 10px;border-bottom:1px solid rgba(0,0,0,.06)">🔒 ข้อความแชทจะถูกลบอัตโนมัติหลังครบ 7 วัน เพื่อความเป็นส่วนตัว</div>' +
        '<div class="me-chat-body" data-chat-body></div>' +
        '<form class="me-chat-input" data-chat-form><input data-chat-text placeholder="พิมพ์คำถาม เช่น เวลาเปิด, ค่าส่ง…" autocomplete="off"><button class="me-btn me-btn-sm" type="submit">ส่ง</button></form>' +
      "</div>";
    document.body.appendChild(box);
    box.querySelector("[data-chat-fab]").addEventListener("click", function () { var pn = box.querySelector("[data-chat-panel]"); if (pn.hidden) openChat(); else closeChat(); });
    box.querySelector("[data-chat-close]").addEventListener("click", closeChat);
    box.querySelector("[data-chat-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = box.querySelector("[data-chat-text]"); var t = inp.value.trim(); if (!t) return;
      var ans = chatAnswer(t); var s = S.session();
      var meta = { escalated: !ans.matched, name: (s && s.name) || "ผู้เยี่ยมชม", email: (s && s.email) || "" };
      MEChat.send(MEChat.convId(), "user", t, meta); inp.value = "";
      setTimeout(function () { MEChat.send(MEChat.convId(), "bot", ans.text, meta); }, 450);
    });
  }
  var chatGreeted = false;
  function openChat() {
    var box = document.querySelector("[data-chat]"); if (!box) { mountChat(); box = document.querySelector("[data-chat]"); }
    box.querySelector("[data-chat-panel]").hidden = false;
    if (chatUnsub) chatUnsub();
    chatUnsub = MEChat.subscribeConv(MEChat.convId(), function (msgs) {
      renderMsgs(msgs);
      if (!chatGreeted && (!msgs || !msgs.length)) { chatGreeted = true; var s = S.session(); MEChat.send(MEChat.convId(), "bot", S.getSettings().chatGreeting, { name: (s && s.name) || "ผู้เยี่ยมชม", email: (s && s.email) || "" }); }
    });
    box.querySelector("[data-chat-text]").focus();
  }
  function closeChat() { var p = document.querySelector("[data-chat-panel]"); if (p) p.hidden = true; if (chatUnsub) { chatUnsub(); chatUnsub = null; } }
  function renderMsgs(msgs) {
    var body = document.querySelector("[data-chat-body]"); if (!body) return;
    msgs = msgs || [];
    body.innerHTML = msgs.map(function (m) {
      var cls = m.from === "user" ? "me" : (m.from === "shop" ? "shop" : "bot");
      return '<div class="me-chat-msg ' + cls + '">' + (m.from === "shop" ? '<span class="chat-who">ร้าน</span>' : "") + esc(m.text) + "</div>";
    }).join("");
    body.scrollTop = body.scrollHeight;
  }
  function chatAnswer(text) {
    var st = S.getSettings(), t = (text || "").toLowerCase(), rules = st.chatRules || [];
    for (var i = 0; i < rules.length; i++) {
      var kws = String(rules[i].keywords || "").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      for (var j = 0; j < kws.length; j++) { if (kws[j] && t.indexOf(kws[j]) >= 0) return { text: rules[i].answer, matched: true }; }
    }
    return { text: st.chatFallback, matched: false };
  }
  function refreshCartBadge() { renderChrome(); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  /* ---------- toast --------------------------------------------- */
  var toastBox;
  function toast(msg, kind) {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.className = "me-toasts";
      document.body.appendChild(toastBox);
    }
    var t = document.createElement("div");
    t.className = "me-toast " + (kind || "");
    t.innerHTML = msg;
    toastBox.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); }, 250);
    }, 2600);
  }

  /* ---------- query param helper -------------------------------- */
  function qp(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  global.MEUI = {
    iconSvg: iconSvg, productTile: productTile,
    renderHeader: renderHeader, renderFooter: renderFooter,
    mountChrome: mountChrome, refreshCartBadge: refreshCartBadge,
    toast: toast, qp: qp,
  };
})(window);
