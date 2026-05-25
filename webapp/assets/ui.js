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
        window.addEventListener("load", function () { navigator.serviceWorker.register(base + "sw.js", { scope: base }).catch(function () {}); });
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
      ? '<span class="tile-img" style="background-image:url(' + JSON.stringify(p.image) + ')"></span>'
      : '<span class="tile-icon">' + iconSvg(p.icon, opts.lg ? 120 : 64) + "</span><span class=\"tile-grid\"></span>";
    return (
      '<div class="tile ' + (opts.lg ? "tile-lg" : "") + (p.image ? " has-img" : "") + '" data-cat="' + p.category + '">' +
      '<span class="tile-brand">' + p.brand + "</span>" +
      badge + visual +
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
      navLink("shop.html", "สินค้า / เช่า-ซื้อ", active === "shop") +
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
      return '<div class="me-acct"><span class="me-acct-name">' +
        (s.role === "owner" ? "⭐ " : staff ? "👷 " : "👤 ") + esc(s.name) + "</span>" +
        (staff ? '<a class="me-acct-link" href="admin/dashboard.html">ระบบหลังร้าน</a>' : "") +
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
            String(st.phone || "").split(/[,\n]/).map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
              return '<div class="me-footer-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="tel:' + esc(p.replace(/[^0-9+]/g, "")) + '">' + esc(p) + "</a></div>";
            }).join("") +
            '<div class="me-footer-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span>LINE: ' + esc(st.line) + "</span></div>" +
          "</div>" +
          '<div class="me-socials">' + socialBtn(st.facebook, "Facebook", FB) + socialBtn(st.instagram, "Instagram", IG) + socialBtn(st.tiktok, "TikTok", TT) + "</div>" +
        "</div>" +
        '<div class="me-footer-col"><div class="me-footer-h">เมนู</div>' +
          '<a href="index.html">หน้าแรก</a><a href="shop.html">สินค้า / เช่า-ซื้อ</a>' +
          '<a href="cart.html">ตะกร้า</a><a href="orders.html">ติดตามคำสั่งซื้อ</a></div>' +
        '<div class="me-footer-col"><div class="me-footer-h">ช่วยเหลือ</div>' +
          '<a href="index.html#faq">คำถามที่พบบ่อย</a><a href="#" data-open-chat>ติดต่อร้าน (แชท)</a>' +
          '<a href="login.html">เข้าสู่ระบบ</a><a href="register.html">สมัครสมาชิก</a></div>' +
        '<div class="me-footer-col"><div class="me-footer-h">เวลาทำการ</div>' +
          "<div>" + esc(st.hoursWeek) + "</div><div>" + esc(st.hoursSun) + "</div>" +
          (function () { var op = S.isOpenNow(); return '<div class="me-footer-pill ' + (op.open ? "open" : "closed") + '"><span class="dot' + (op.open ? "" : " dot-closed") + '"></span> ' + (op.open ? "เปิดอยู่" : "ปิดอยู่" + (op.reason ? " · " + esc(op.reason) : "")) + "</div>"; })() + "</div>" +
      "</div>" +
      '<div class="me-footer-foot"><span>© 2026 ' + esc(st.company) + " · แยกท่ารั้ว เชียงใหม่</span>" +
      "<span>DEWALT® is a trademark of Stanley Black &amp; Decker.</span></div></footer>"
    );
  }

  function mountChrome(active) {
    chromeActive = active;
    renderChrome();
    S.onChange(renderChrome);
    mountChat();
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
      b.addEventListener("click", function (e) { e.preventDefault(); openChat(); });
    });
  }

  /* ---------- chat widget (rule-based "AI", owner-configurable) ---------- */
  /* ---------- MEChat: real online chat (Firebase) with localStorage fallback ---------- */
  var MEChat = (function () {
    var db = null, ready = false, loading = false, q = [];
    function rawCfg() { try { var r = (S.getSettings().firebaseConfig || "").trim(); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
    function enabled() { return !!rawCfg(); }
    function mode() { return enabled() ? "online" : "local"; }
    function loadScript(src, ok, err) { if (document.querySelector('script[src="' + src + '"]')) { ok(); return; } var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = err || ok; document.head.appendChild(s); }
    function ensure(cb) {
      if (ready) return cb(true);
      var c = rawCfg(); if (!c) return cb(false);
      q.push(cb); if (loading) return; loading = true;
      var base = "https://www.gstatic.com/firebasejs/10.12.2/";
      loadScript(base + "firebase-app-compat.js", function () {
        loadScript(base + "firebase-firestore-compat.js", function () {
          try { if (!window.firebase) throw 0; if (!firebase.apps.length) firebase.initializeApp(c); db = firebase.firestore(); ready = true; flush(true); }
          catch (e) { flush(false); }
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
      if (mode() === "online") { var u = function () {}; ensure(function (ok) { if (!ok) { u = localList(cb); return; } u = db.collection("chats").orderBy("updatedAt", "desc").onSnapshot(function (s) { cb(s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })); }, function () {}); }); return function () { try { u(); } catch (e) {} }; }
      return localList(cb);
    }
    return { enabled: enabled, mode: mode, convId: convId, send: send, subscribeConv: subscribeConv, subscribeList: subscribeList };
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
