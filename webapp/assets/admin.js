/* =================================================================
   M.E.Tools — Employee back office logic
   ================================================================= */
(function () {
  "use strict";
  var S = window.MEStore, U = window.MEUI;
  var view = document.body.getAttribute("data-admin");

  // permission gate per page (owner bypasses all). staff page is owner-only.
  var permFor = { dashboard: "dashboard", inventory: "inventory", orders: "orders", erp: "erp", settings: "settings" };
  if (view === "staff") {
    if (!S.requirePerm(null, "../login.html")) return;
    if (!S.isOwner()) { window.location.href = "dashboard.html"; return; }
  } else if (view === "chat" || view === "botinbox") {
    if (!S.requirePerm(null, "../login.html")) return; // any staff
  } else if (!S.requirePerm(permFor[view] || "dashboard", "../login.html")) return;

  mountShell(view);
  ({ dashboard: initDashboard, inventory: initInventory, orders: initOrders, erp: initErp, settings: initSettings, staff: initStaff, chat: initChat, botinbox: initBotInbox }[view] || function () {})();

  /* ---------- shell / sidebar ---------- */
  function mountShell(active) {
    var sess = S.session() || { name: "พนักงาน" };
    var ICON = {
      dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
      inventory: '<path d="M3 9l9-6 9 6"/><path d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"/><path d="M9 21V12h6v9"/>',
      orders: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h6"/>',
      erp: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
      staff: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      botinbox: '<path d="M12 2C6.48 2 2 6.04 2 11c0 2.5 1.16 4.74 3 6.33V22l3.83-2.1c1.01.23 2.07.35 3.17.35 5.52 0 10-4.04 10-9s-4.48-9-10-9z"/><circle cx="8.5" cy="11" r="1.2" fill="currentColor"/><circle cx="12" cy="11" r="1.2" fill="currentColor"/><circle cx="15.5" cy="11" r="1.2" fill="currentColor"/>',
    };
    var nav = [
      ["dashboard.html", "dashboard", "แดชบอร์ด", "dashboard"],
      ["inventory.html", "inventory", "คลัง / สต็อก", "inventory"],
      ["orders.html", "orders", "คำสั่งซื้อ / เช่า", "orders"],
      ["erp.html", "erp", "ระบบ ERP / บัญชี", "erp"],
      ["settings.html", "settings", "ตั้งค่าเว็บไซต์", "settings"],
    ].filter(function (n) { return S.hasPerm(n[3]); });
    // แชทลูกค้าหน้าเว็บถูกถอดออก — ลูกค้าทักผ่าน LINE OA ตรง ดูทุกบทสนทนาในหน้า "แชทบอท LINE"
    nav.push(["bot-inbox.html", "botinbox", "แชทบอท LINE", "botinbox"]);
    if (S.isOwner()) nav.push(["staff.html", "staff", "จัดการทีมงาน", "staff"]);

    var roleTag = sess.role === "owner" ? "เจ้าของร้าน" : "พนักงาน";
    var side =
      '<aside class="side"><div class="side-brand">M.E.<span>T</span>ools</div>' +
      '<div class="side-tag">ระบบหลังร้าน · ท่ารั้ว</div>' +
      '<nav class="side-nav">' +
      nav.map(function (n) {
        return '<a href="' + n[0] + '" class="' + (active === n[1] ? "on" : "") + '">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[n[3]] + "</svg>" + n[2] + "</a>";
      }).join("") + "</nav>" +
      '<div class="side-foot"><div class="side-user">' + roleTag + "<b>" + sess.name + "</b></div>" +
      '<a href="../index.html" target="_blank">↗ ดูหน้าร้าน</a>' +
      '<button data-logout>⎋ ออกจากระบบ</button></div></aside>';

    var shell = document.querySelector("[data-shell]");
    shell.insertAdjacentHTML("afterbegin", side);
    document.querySelector("[data-logout]").addEventListener("click", function () { S.logout(); window.location.href = "../login.html"; });
  }

  /* ===================== DASHBOARD ===================== */
  function initDashboard() {
    var m = S.getMetrics();
    var k = document.querySelector("[data-kpis]");
    k.innerHTML =
      kpi("accent", "รายได้รวม", S.money(m.revenue), m.orderCount + " คำสั่งซื้อ") +
      kpi("", "ต้นทุนสินค้า", S.money(m.cost), "ต้นทุนที่ขายออกไป") +
      kpi("profit", "กำไรสุทธิ", S.money(m.profit), "อัตรากำไร " + Math.round(m.margin * 100) + "%") +
      kpi("dark", "มูลค่าสต็อก (ราคาขาย)", S.money(m.inventoryRetailValue), "ต้นทุนสต็อก " + S.money(m.inventoryCostValue)) +
      kpi("", "ชิ้นในสต็อก", m.unitsInStock.toLocaleString("th-TH"), m.productCount + " รายการสินค้า") +
      kpi("", "กำลังถูกเช่าอยู่", m.rentedOut + " ชิ้น", "ยังไม่ส่งคืน") +
      kpi(m.lowStockCount ? "accent" : "", "สินค้าใกล้หมด", m.lowStockCount + " รายการ", "เหลือ ≤ 3 ชิ้น") +
      kpi("", "กำไรเฉลี่ย/ออเดอร์", S.money(m.orderCount ? m.profit / m.orderCount : 0), "ต่อคำสั่งซื้อ");

    // line chart
    document.querySelector("[data-chart]").innerHTML = lineChart(S.revenueByDay(7));

    // low stock list
    var low = S.getProducts().filter(function (p) { return S.available(p) <= 3; }).sort(function (a, b) { return S.available(a) - S.available(b); });
    var lowBox = document.querySelector("[data-lowstock]");
    lowBox.innerHTML = low.length
      ? low.map(function (p) {
          return '<div class="order-line" style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-3);font-family:var(--font-body);font-size:14px">' +
            "<span><b>" + p.name + "</b><br><span class=prod-sku>" + p.location + "</span></span>" +
            '<span class="stock-n low">' + S.available(p) + " ชิ้น</span></div>";
        }).join("")
      : '<p style="font-family:var(--font-body);color:var(--fg-2)">สต็อกเพียงพอทุกรายการ ✓</p>';

    // recent orders
    var recent = S.getOrders().slice(0, 6);
    var rb = document.querySelector("[data-recent]");
    rb.innerHTML =
      "<thead><tr><th>คำสั่งซื้อ</th><th>ลูกค้า</th><th>ประเภท</th><th class=num>ยอด</th><th class=num>กำไร</th><th>สถานะ</th></tr></thead><tbody>" +
      recent.map(function (o) {
        return "<tr><td><b>" + o.id + "</b><br><span class=prod-sku>" + S.fmtDate(o.createdAt) + "</span></td>" +
          "<td>" + o.customer.name + "</td>" +
          '<td><span class="chip ' + o.type + '">' + S.typeLabel(o.type) + "</span></td>" +
          '<td class="num">' + S.money(o.total) + "</td>" +
          '<td class="num">' + S.money((o.revenue || 0) - (o.cost || 0)) + "</td>" +
          "<td>" + adminStatusBadges(o) + "</td></tr>";
      }).join("") + "</tbody>";
  }
  function kpi(cls, k, v, sub) {
    return '<div class="kpi ' + cls + '"><div class="kpi-k">' + k + '</div><div class="kpi-v">' + v + '</div><div class="kpi-sub">' + (sub || "") + "</div></div>";
  }
  function lineChart(days) {
    var W = 700, H = 230, L = 14, R = 14, T = 20, B = 30;
    var plotW = W - L - R, plotH = H - T - B, n = days.length;
    var max = Math.max(1, Math.max.apply(null, days.map(function (d) { return Math.max(d.revenue, d.profit); })));
    function X(i) { return L + (n <= 1 ? plotW / 2 : i * plotW / (n - 1)); }
    function Y(v) { return T + plotH * (1 - v / max); }
    var grid = "";
    for (var k = 0; k <= 3; k++) { var gy = T + plotH * k / 3; grid += '<line class="grid-line" x1="' + L + '" y1="' + gy + '" x2="' + (W - R) + '" y2="' + gy + '"/>'; }
    var revPts = days.map(function (d, i) { return X(i) + "," + Y(d.revenue); }).join(" ");
    var profPts = days.map(function (d, i) { return X(i) + "," + Y(d.profit); }).join(" ");
    var area = "M " + X(0) + "," + (T + plotH) + " L " + days.map(function (d, i) { return X(i) + "," + Y(d.revenue); }).join(" L ") + " L " + X(n - 1) + "," + (T + plotH) + " Z";
    var dots = "", xlabs = "", vlabs = "";
    days.forEach(function (d, i) {
      dots += '<circle class="dot dot-rev" cx="' + X(i) + '" cy="' + Y(d.revenue) + '" r="4"/>';
      dots += '<circle class="dot dot-prof" cx="' + X(i) + '" cy="' + Y(d.profit) + '" r="4"/>';
      var wd = new Date(d.date), dn = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][wd.getDay()];
      xlabs += '<text class="xlab" x="' + X(i) + '" y="' + (H - 8) + '">' + dn + " " + wd.getDate() + "</text>";
      if (d.revenue) vlabs += '<text class="vlab" x="' + X(i) + '" y="' + (Y(d.revenue) - 9) + '">' + Math.round(d.revenue / 1000 * 10) / 10 + "k</text>";
    });
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="กราฟรายได้และกำไร">' + grid +
      '<path class="area-rev" d="' + area + '"/>' +
      '<polyline class="ln ln-rev" points="' + revPts + '"/><polyline class="ln ln-prof" points="' + profPts + '"/>' +
      dots + vlabs + xlabs + "</svg>";
  }
  function adminStatusBadges(o) {
    if (o.status === "cancelled") return '<span class="chip cancelled">ยกเลิก</span>';
    if (o.status === "returned") return '<span class="chip returned">คืนแล้ว</span>';
    if (o.status === "received") return '<span class="chip fulfilled">ได้รับสินค้าแล้ว</span>';
    return '<span class="chip paid">ชำระแล้ว</span> <span class="chip new">รอรับสินค้า</span>';
  }

  /* ===================== INVENTORY ===================== */
  function initInventory() {
    var state = { q: "", cat: "" };
    var search = document.querySelector("[data-search]");
    var catSel = document.querySelector("[data-catfilter]");
    catSel.innerHTML = '<option value="">ทุกหมวด</option>' + S.CATEGORIES.map(function (c) { return '<option value="' + c.key + '">' + c.label + "</option>"; }).join("");
    search.addEventListener("input", function () { state.q = search.value.trim().toLowerCase(); render(); });
    catSel.addEventListener("change", function () { state.cat = catSel.value; render(); });
    document.querySelector("[data-add]").addEventListener("click", function () { openProductModal(null); });
    var syncBtn = document.querySelector("[data-sync-bot]");
    if (syncBtn) syncBtn.addEventListener("click", function () { syncProductsToFirebase(syncBtn); });

    function render() {
      var alertBox = document.querySelector("[data-alert]");
      var lowAll = S.getProducts().filter(function (p) { return S.available(p) <= 3; });
      alertBox.innerHTML = lowAll.length ? "⚠ มีสินค้าใกล้หมด <b>" + lowAll.length + "</b> รายการ — ควรเติมสต็อก" : "";
      alertBox.style.display = lowAll.length ? "block" : "none";

      var list = S.getProducts().filter(function (p) {
        if (state.cat && p.category !== state.cat) return false;
        if (state.q) { var h = (p.name + " " + p.brand + " " + p.sku + " " + p.location).toLowerCase(); if (h.indexOf(state.q) < 0) return false; }
        return true;
      });
      var tb = document.querySelector("[data-invtable]");
      tb.innerHTML =
        "<thead><tr><th>สินค้า</th><th>หมวด</th><th class=num>คงเหลือ</th><th class=num>เช่าอยู่</th><th>ที่จัดเก็บ</th><th class=num>ต้นทุน</th><th class=num>ราคาขาย</th><th class=num>เช่า/วัน</th><th>จัดการ</th></tr></thead><tbody>" +
        list.map(function (p) {
          var av = S.available(p);
          return "<tr>" +
            '<td><div class="prod-cell">' + miniVisual(p) +
              '<div><div class="prod-name">' + p.name + '</div><div class="prod-sku">' + p.sku + " · " + p.brand + " · " + saleRent(p) + "</div></div></div></td>" +
            "<td>" + S.categoryLabel(p.category) + "</td>" +
            '<td class="num"><span class="stock-n ' + (av <= 3 ? "low" : "") + '">' + av + "</span></td>" +
            '<td class="num"><span class="rented-n">' + (p.rented || 0) + "</span></td>" +
            '<td><span class="loc-tag">' + p.location + "</span></td>" +
            '<td class="num">' + S.money(p.cost) + "</td>" +
            '<td class="num">' + (p.forSale ? S.money(p.price) : "—") + "</td>" +
            '<td class="num">' + (p.forRent ? S.money(p.rentPerDay) : "—") + "</td>" +
            '<td><div class="row-actions">' +
              '<button class="btn btn-sm btn-ghost" data-edit="' + p.id + '">แก้ไข</button>' +
              '<button class="btn btn-sm" data-restock="' + p.id + '">+สต็อก</button>' +
              '<button class="btn btn-sm btn-danger" data-del="' + p.id + '">ลบ</button>' +
            "</div></td></tr>";
        }).join("") + "</tbody>";

      tb.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { openProductModal(S.getProduct(b.dataset.edit)); }; });
      tb.querySelectorAll("[data-restock]").forEach(function (b) {
        b.onclick = function () {
          var n = prompt("เพิ่มสต็อกกี่ชิ้น? (ใส่จำนวนลบเพื่อหักออก)", "5");
          if (n === null) return;
          var d = parseInt(n, 10); if (isNaN(d)) return;
          S.adjustStock(b.dataset.restock, d); U.toast("ปรับสต็อกแล้ว", "ok"); render();
        };
      });
      tb.querySelectorAll("[data-del]").forEach(function (b) {
        b.onclick = function () {
          var p = S.getProduct(b.dataset.del);
          if (confirm("ลบสินค้า \"" + p.name + "\" ?")) { S.deleteProduct(p.id); U.toast("ลบสินค้าแล้ว", "ok"); render(); }
        };
      });
    }
    render();
    window.__invRender = render;
  }

  /* ---------- sync products → Firestore (for LINE bot) ---------- */
  // ใช้ Firestore REST API (รองรับ named database "default" ที่ compat SDK ไม่รองรับ)
  // Firebase Auth (anonymous) ใช้แค่เอา ID token ให้ผ่าน rules ที่ต้องการ request.auth != null
  var FIRESTORE_DB = "default"; // ชื่อ database ใน Firebase Console (ไม่ใช่ "(default)")

  // แปลง JS value → Firestore REST typed format
  function toFsValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") {
      if (Number.isInteger(v)) return { integerValue: String(v) };
      return { doubleValue: v };
    }
    if (typeof v === "string") return { stringValue: v };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
    if (typeof v === "object") {
      var fields = {};
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) fields[k] = toFsValue(v[k]);
      return { mapValue: { fields: fields } };
    }
    return { nullValue: null };
  }
  function toFsFields(obj) {
    var fields = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) fields[k] = toFsValue(obj[k]);
    return fields;
  }

  function syncProductsToFirebase(btn) {
    var cfg = window.parseFbConfig ? window.parseFbConfig(S.firebaseCfg ? S.firebaseCfg() : "") : null;
    if (!cfg) { U.toast("ยังไม่ได้ตั้ง Firebase Config ในหน้า ตั้งค่าเว็บไซต์", "err"); return; }

    var origText = btn.textContent;
    btn.disabled = true;
    function status(s) { btn.textContent = s; console.log("[sync]", s); }
    var finished = false;
    function done(msg, kind) {
      if (finished) return;
      finished = true;
      clearTimeout(hardTimeout);
      btn.disabled = false; btn.textContent = origText;
      U.toast(msg, kind);
      console.log("[sync] done —", kind, msg);
    }
    var hardTimeout = setTimeout(function () {
      done("Timeout 30 วิ — ดู Console (F12) ว่าค้างขั้นไหน", "err");
    }, 30000);

    status("โหลด SDK…");

    function go() {
      status("เริ่ม Firebase…");
      try {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
      } catch (e) { done("Firebase init: " + e.message, "err"); return; }
      if (!firebase.auth) { done("Firebase Auth ไม่ได้โหลด", "err"); return; }
      status("เข้าสู่ระบบ…");
      firebase.auth().signInAnonymously().then(function (cred) {
        status("เตรียมข้อมูล…");
        var items = S.getProducts().map(function (p) {
          var clean = {};
          for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && k !== "images" && k !== "image") clean[k] = p[k];
          clean.available = S.available(p);
          if (Array.isArray(clean.specs)) {
            clean.specs = clean.specs.map(function (s) {
              if (Array.isArray(s)) return { label: String(s[0] || ""), value: String(s[1] || "") };
              if (s && typeof s === "object") return { label: String(s.label || ""), value: String(s.value || "") };
              return { label: "", value: String(s || "") };
            });
          }
          return clean;
        });
        var body = { fields: toFsFields({ items: items, count: items.length, updatedAt: new Date() }) };
        return cred.user.getIdToken().then(function (token) {
          status("กำลังเขียน " + items.length + " รายการ…");
          var url = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId +
            "/databases/" + FIRESTORE_DB + "/documents/products/catalog";
          return fetch(url, {
            method: "PATCH",
            headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }).then(function (res) {
            return res.text().then(function (txt) { return { ok: res.ok, status: res.status, text: txt }; });
          });
        });
      }).then(function (result) {
        if (result.ok) {
          done("ซิงค์สินค้า " + S.getProducts().length + " รายการไปบอท LINE แล้ว ✓", "ok");
        } else {
          var snippet = (result.text || "").slice(0, 200);
          done("ซิงค์ไม่สำเร็จ [HTTP " + result.status + "]: " + snippet, "err");
        }
      }).catch(function (e) {
        var code = e && e.code ? " [" + e.code + "]" : "";
        done("ซิงค์ไม่สำเร็จ" + code + ": " + (e.message || e), "err");
      });
    }

    function loadScript(src, ok, err) {
      if (document.querySelector('script[src="' + src + '"]')) { ok(); return; }
      var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = err || ok;
      document.head.appendChild(s);
    }
    if (window.firebase && firebase.auth) { go(); return; }
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    loadScript(base + "firebase-app-compat.js", function () {
      loadScript(base + "firebase-auth-compat.js", go, function () { done("โหลด Firebase Auth SDK ไม่สำเร็จ", "err"); });
    }, function () { done("โหลด Firebase SDK ไม่สำเร็จ — ลองปิด ad blocker", "err"); });
  }

  /* ---------- shared: ensure Firebase Auth + return ID token --------------- */
  function withFirebaseAuth(cb) {
    var cfg = window.parseFbConfig ? window.parseFbConfig(S.firebaseCfg ? S.firebaseCfg() : "") : null;
    if (!cfg) return cb(null, new Error("ยังไม่ได้ตั้ง Firebase Config"));
    function loadScript(src, ok, err) {
      if (document.querySelector('script[src="' + src + '"]')) { ok(); return; }
      var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = err || ok;
      document.head.appendChild(s);
    }
    function go() {
      try { if (!firebase.apps.length) firebase.initializeApp(cfg); }
      catch (e) { return cb(null, e); }
      if (!firebase.auth) return cb(null, new Error("Firebase Auth ไม่ได้โหลด"));
      firebase.auth().signInAnonymously()
        .then(function (cred) { return cred.user.getIdToken(); })
        .then(function (token) { cb({ token: token, projectId: cfg.projectId }, null); })
        .catch(function (e) { cb(null, e); });
    }
    if (window.firebase && firebase.auth) return go();
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    loadScript(base + "firebase-app-compat.js", function () {
      loadScript(base + "firebase-auth-compat.js", go, function () { cb(null, new Error("โหลด Firebase Auth ไม่สำเร็จ")); });
    }, function () { cb(null, new Error("โหลด Firebase SDK ไม่สำเร็จ")); });
  }

  /* ---------- ปลด Firestore REST typed value → JS plain ---------------- */
  function fromFsValue(v) {
    if (!v || typeof v !== "object") return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue" in v) return null;
    if ("mapValue" in v) {
      var out = {}, f = v.mapValue.fields || {};
      for (var k in f) out[k] = fromFsValue(f[k]);
      return out;
    }
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFsValue);
    return null;
  }
  function fromFsFields(fields) {
    var out = {};
    for (var k in fields || {}) out[k] = fromFsValue(fields[k]);
    return out;
  }

  /* ===================== BOT INBOX (Phase 2.5) ===================== */
  function initBotInbox() {
    var refresh = document.querySelector("[data-refresh]");
    var alertBox = document.querySelector("[data-alert]");
    function alert(msg, kind) {
      if (!msg) { alertBox.style.display = "none"; return; }
      alertBox.textContent = msg; alertBox.style.display = "block";
      alertBox.style.background = kind === "err" ? "#fee" : "#efe";
    }

    var state = { messages: [], byUser: {}, activeUid: null };

    if (refresh) refresh.addEventListener("click", load);
    load();

    function load() {
      alert("กำลังโหลดข้อความ…");
      withFirebaseAuth(function (auth, err) {
        if (err) { alert("ไม่สามารถเชื่อม Firebase: " + err.message, "err"); return; }
        var url = "https://firestore.googleapis.com/v1/projects/" + auth.projectId +
          "/databases/default/documents/bot_messages?pageSize=500";
        fetch(url, { headers: { "Authorization": "Bearer " + auth.token } })
          .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, status: res.status, body: j }; }); })
          .then(function (r) {
            if (!r.ok) {
              alert("โหลดไม่สำเร็จ [HTTP " + r.status + "]: " + (r.body.error && r.body.error.message ? r.body.error.message : ""), "err");
              renderEmpty();
              return;
            }
            alert("");
            var docs = r.body.documents || [];
            state.messages = docs.map(function (d) {
              var f = fromFsFields(d.fields || {});
              return {
                userId: f.userId || "",
                text: f.text || "",
                reply: f.reply || "",
                source: f.source || "line",
                at: f.at || d.createTime || ""
              };
            }).sort(function (a, b) { return (b.at || "").localeCompare(a.at || ""); });
            groupAndRender();
          })
          .catch(function (e) {
            alert("โหลดผิดพลาด: " + (e.message || e), "err");
            renderEmpty();
          });
      });
    }

    function groupAndRender() {
      // group by userId
      var byUser = {};
      state.messages.forEach(function (m) {
        if (!byUser[m.userId]) byUser[m.userId] = { userId: m.userId, messages: [], lastAt: m.at, lastText: m.text };
        byUser[m.userId].messages.push(m);
        if ((m.at || "") > (byUser[m.userId].lastAt || "")) {
          byUser[m.userId].lastAt = m.at; byUser[m.userId].lastText = m.text;
        }
      });
      state.byUser = byUser;

      var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      var weekStart = new Date(Date.now() - 7 * 86400000);
      var todayMsgs = state.messages.filter(function (m) { return new Date(m.at) >= todayStart; });
      var weekMsgs = state.messages.filter(function (m) { return new Date(m.at) >= weekStart; });
      var todayUsers = {}; todayMsgs.forEach(function (m) { todayUsers[m.userId] = 1; });

      document.querySelector("[data-kpi-today]").textContent = todayMsgs.length;
      document.querySelector("[data-kpi-users]").textContent = Object.keys(todayUsers).length;
      document.querySelector("[data-kpi-week]").textContent = weekMsgs.length;
      document.querySelector("[data-kpi-total]").textContent = Object.keys(byUser).length;

      // keyword cloud — นับคำเด่นที่ยาว 2+ ตัวอักษร จากข้อความ 7 วัน
      var freq = {};
      weekMsgs.forEach(function (m) {
        var words = (m.text || "").toLowerCase().split(/\s+/);
        words.forEach(function (w) {
          w = w.replace(/[.,!?"()\[\]{}:;]/g, "").trim();
          if (w.length >= 2 && w.length < 30) freq[w] = (freq[w] || 0) + 1;
        });
      });
      var top = Object.keys(freq).map(function (k) { return [k, freq[k]]; })
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 20);
      var kw = document.querySelector("[data-keywords]");
      kw.innerHTML = top.length
        ? top.map(function (p) { return '<span class="keyword-pill"><b>' + p[1] + '</b>' + esc(p[0]) + '</span>'; }).join("")
        : '<span style="color:var(--fg-2); font-size:13px">ยังไม่มีข้อความใน 7 วันที่ผ่านมา</span>';

      // conversation list
      var convs = Object.values(byUser).sort(function (a, b) { return (b.lastAt || "").localeCompare(a.lastAt || ""); });
      var list = document.querySelector("[data-convs]");
      if (!convs.length) {
        list.innerHTML = '<div class="thread-empty">ยังไม่มีลูกค้าทักบอท</div>';
        renderEmpty();
        return;
      }
      list.innerHTML = convs.map(function (c) {
        var when = fmtRelative(c.lastAt);
        var nameTag = c.userId.slice(-8);
        // source tag — ส่วนใหญ่จะเป็น LINE; ในอนาคตอาจรวม web ด้วย
        var lastSrc = (c.messages[0] && c.messages[0].source) || "line";
        var srcBadge = lastSrc === "web"
          ? '<span style="background:#e8f5e9;color:#1b5e20;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:600">เว็บ</span>'
          : '<span style="background:#06c755;color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:600">LINE</span>';
        return '<div class="conv-row" data-uid="' + esc(c.userId) + '">' +
          '<div class="who"><span>' + srcBadge + ' …' + esc(nameTag) + '</span><span>' + c.messages.length + ' ข้อความ</span></div>' +
          '<div class="last">' + esc(c.lastText) + '</div>' +
          '<div class="meta"><span>' + when + '</span></div>' +
          '</div>';
      }).join("");
      list.querySelectorAll("[data-uid]").forEach(function (row) {
        row.addEventListener("click", function () {
          list.querySelectorAll(".conv-row").forEach(function (r) { r.classList.remove("on"); });
          row.classList.add("on");
          state.activeUid = row.dataset.uid;
          renderThread(state.activeUid);
        });
      });
      // auto-select first
      if (!state.activeUid || !byUser[state.activeUid]) state.activeUid = convs[0].userId;
      var firstRow = list.querySelector('[data-uid="' + cssEsc(state.activeUid) + '"]');
      if (firstRow) { firstRow.classList.add("on"); renderThread(state.activeUid); }
    }

    function renderEmpty() {
      document.querySelector("[data-thread]").innerHTML = '<div class="thread-empty">ยังไม่มีบทสนทนา</div>';
    }

    function renderThread(uid) {
      var conv = state.byUser[uid];
      var box = document.querySelector("[data-thread]");
      if (!conv) { box.innerHTML = '<div class="thread-empty">เลือกบทสนทนาทางซ้าย</div>'; return; }
      var msgs = conv.messages.slice().sort(function (a, b) { return (a.at || "").localeCompare(b.at || ""); });
      box.innerHTML =
        '<div style="margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid var(--border-3)">' +
        '<div style="font-weight:600; font-size:14px">👤 ลูกค้า ID: …' + esc(uid.slice(-12)) + '</div>' +
        '<div style="font-size:12px; color:var(--fg-2); margin-top:2px">' + msgs.length + ' ข้อความทั้งหมด · เริ่มทัก ' + fmtAbsolute(msgs[0].at) + '</div>' +
        '</div>' +
        msgs.map(function (m) {
          return '<div class="msg-pair">' +
            '<div class="msg-line user"><span class="role">ลูกค้า</span><div class="body">' + esc(m.text) + '</div></div>' +
            '<div class="msg-line bot"><span class="role">บอท</span><div class="body">' + esc(m.reply) + '</div></div>' +
            '<div class="msg-time">' + fmtAbsolute(m.at) + '</div>' +
            '</div>';
        }).join("");
    }

    function fmtRelative(iso) {
      if (!iso) return "—";
      var d = new Date(iso), now = new Date(), diff = (now - d) / 1000;
      if (diff < 60) return "เมื่อสักครู่";
      if (diff < 3600) return Math.floor(diff / 60) + " นาทีที่แล้ว";
      if (diff < 86400) return Math.floor(diff / 3600) + " ชั่วโมงที่แล้ว";
      if (diff < 7 * 86400) return Math.floor(diff / 86400) + " วันที่แล้ว";
      return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    }
    function fmtAbsolute(iso) {
      if (!iso) return "—";
      return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    }
    function cssEsc(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
  }

  function openProductModal(p) {
    var isNew = !p;
    p = p || { icon: "drill", category: "drill", brand: "DEWALT", forSale: true, forRent: true, stock: 0, rented: 0, cost: 0, price: 0, rentPerDay: 0, location: "", sku: "", name: "", desc: "", specs: [], images: [], warrantyYears: 1, motorType: "ไร้แปรงถ่าน (Brushless)", shipSize: "" };
    var icons = ["drill", "driver", "saw", "grinder", "rotary", "battery", "charger", "measure", "wrench", "laser", "compressor", "box", "tool"];
    var owner = S.isOwner();
    var pendingImages = (p.images && p.images.length) ? p.images.slice() : (p.image ? [p.image] : []);
    var body =
      (owner
        ? '<div class="field"><label>รูปสินค้า — เพิ่มได้หลายรูป (รูปแรก = รูปหลัก)</label><div class="gal-edit" data-gallery></div>' +
          '<label class="btn btn-ghost btn-sm filebtn" style="margin-top:8px">+ เพิ่มรูป…<input type="file" accept="image/*" multiple data-imgfile></label></div>'
        : '<div class="img-hint" style="margin-bottom:6px">เฉพาะเจ้าของร้านเท่านั้นที่จัดการรูปสินค้าได้</div>') +
      '<div class="field"><label>ชื่อสินค้า</label><input data-f="name" value="' + esc(p.name) + '" placeholder="เช่น สว่านกระแทกไร้สาย 20V"></div>' +
      '<div class="f2"><div class="field"><label>แบรนด์</label><input data-f="brand" value="' + esc(p.brand) + '"></div>' +
      '<div class="field"><label>รหัส SKU</label><input data-f="sku" value="' + esc(p.sku) + '"></div></div>' +
      '<div class="f2"><div class="field"><label>หมวดหมู่</label><select data-f="category">' +
        S.CATEGORIES.map(function (c) { return '<option value="' + c.key + '"' + (p.category === c.key ? " selected" : "") + ">" + c.label + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>ไอคอน</label><select data-f="icon">' +
        icons.map(function (i) { return '<option value="' + i + '"' + (p.icon === i ? " selected" : "") + ">" + i + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="field"><label>ที่จัดเก็บในคลัง (เห็นเฉพาะหลังร้าน · ลูกค้าไม่เห็น)</label><input data-f="location" value="' + esc(p.location) + '" placeholder="เช่น โซน A-1 · ชั้น 2"></div>' +
      '<div class="f2"><div class="field"><label>การรับประกัน (ปี · 0 = ตามเงื่อนไข)</label><input data-f="warrantyYears" type="number" min="0" value="' + (p.warrantyYears || 0) + '"></div>' +
      '<div class="field"><label>ระบบมอเตอร์</label><input data-f="motorType" value="' + esc(p.motorType || "") + '" placeholder="ไร้แปรงถ่าน / มีแปรงถ่าน / —"></div></div>' +
      '<div class="field"><label>ขนาด/น้ำหนักสำหรับจัดส่ง</label><input data-f="shipSize" value="' + esc(p.shipSize || "") + '" placeholder="เช่น 32 × 9 × 24 ซม. · ~2 กก."></div>' +
      '<div class="f2"><div class="field"><label>ต้นทุน/ชิ้น (บาท)</label><input data-f="cost" type="number" min="0" value="' + p.cost + '"></div>' +
      '<div class="field"><label>ราคาขาย (บาท)</label><input data-f="price" type="number" min="0" value="' + p.price + '"></div></div>' +
      '<div class="f2"><div class="field"><label>ค่าเช่า/วัน (บาท)</label><input data-f="rentPerDay" type="number" min="0" value="' + p.rentPerDay + '"></div>' +
      '<div class="field"><label>จำนวนในสต็อก</label><input data-f="stock" type="number" min="0" value="' + p.stock + '"></div></div>' +
      '<div class="f-check"><label><input type="checkbox" data-f="forSale"' + (p.forSale ? " checked" : "") + "> ขายขาด</label>" +
        '<label><input type="checkbox" data-f="forRent"' + (p.forRent ? " checked" : "") + "> ให้เช่า</label></div>" +
      '<div class="field"><label>รายละเอียด</label><textarea data-f="desc" rows="3">' + esc(p.desc) + "</textarea></div>";

    openModal(isNew ? "เพิ่มสินค้าใหม่" : "แก้ไขสินค้า", body, function (root) {
      function val(f) { var el = root.querySelector("[data-f=" + f + "]"); return el ? el.value : ""; }
      function chk(f) { var el = root.querySelector("[data-f=" + f + "]"); return el ? el.checked : false; }
      var name = val("name").trim();
      if (!name) { U.toast("กรุณากรอกชื่อสินค้า", "err"); return false; }
      var data = {
        id: p.id, name: name, brand: val("brand").trim() || "—", sku: val("sku").trim() || S.genId("SKU"),
        category: val("category"), icon: val("icon"), location: val("location").trim() || "ยังไม่ระบุ",
        cost: +val("cost") || 0, price: +val("price") || 0, rentPerDay: +val("rentPerDay") || 0,
        stock: +val("stock") || 0, forSale: chk("forSale"), forRent: chk("forRent"),
        desc: val("desc").trim(), specs: p.specs || [], rented: p.rented || 0,
        warrantyYears: +val("warrantyYears") || 0, motorType: val("motorType").trim() || "—", shipSize: val("shipSize").trim(),
      };
      if (owner) { data.images = pendingImages.slice(); data.image = pendingImages[0] || ""; }
      else { data.images = p.images || []; data.image = p.image || ""; }
      try { S.saveProduct(data); }
      catch (e) { U.toast("บันทึกไม่สำเร็จ — รูปอาจใหญ่เกินไป ลองใช้รูปเล็กลง", "err"); return false; }
      U.toast(isNew ? "เพิ่มสินค้าแล้ว" : "บันทึกการแก้ไขแล้ว", "ok");
      if (window.__invRender) window.__invRender();
      return true;
    });

    // wire multi-image gallery (owner only)
    if (owner) {
      var modalEl = document.querySelector(".modal-bg");
      var gal = modalEl.querySelector("[data-gallery]");
      function drawGallery() {
        gal.innerHTML = pendingImages.length
          ? pendingImages.map(function (im, i) { return '<div class="gal-item">' + (i === 0 ? '<span class="gal-main">รูปหลัก</span>' : "") + '<img src="' + im + '"><button type="button" class="gal-del" data-galdel="' + i + '">×</button></div>'; }).join("")
          : '<span class="img-hint">ยังไม่มีรูป — จะใช้ไอคอนตามหมวด</span>';
        gal.querySelectorAll("[data-galdel]").forEach(function (b) { b.onclick = function () { pendingImages.splice(+b.dataset.galdel, 1); drawGallery(); }; });
      }
      drawGallery();
      modalEl.querySelector("[data-imgfile]").addEventListener("change", function (e) {
        var files = Array.prototype.slice.call(e.target.files || []);
        if (!files.length) return;
        var loaded = 0;
        files.forEach(function (f) { readImageFile(f, function (d) { pendingImages.push(d); if (++loaded === files.length) drawGallery(); }); });
        e.target.value = "";
      });
    }
  }

  // read an image File, downscale to <=800px, return a JPEG data URL
  function readImageFile(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 800, w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        try {
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          cb(c.toDataURL("image/jpeg", 0.82));
        } catch (e) { cb(reader.result); }
      };
      img.onerror = function () { cb(reader.result); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ===================== ORDERS ===================== */
  function initOrders() {
    var state = { status: "", type: "", q: "" };
    var ss = document.querySelector("[data-statusfilter]");
    var ts = document.querySelector("[data-typefilter]");
    var cs = document.querySelector("[data-customer]");
    ss.addEventListener("change", function () { state.status = ss.value; render(); });
    ts.addEventListener("change", function () { state.type = ts.value; render(); });
    cs.addEventListener("input", function () { state.q = cs.value.trim().toLowerCase(); render(); });
    document.querySelector("[data-shipcfg]").addEventListener("click", openShipEditor);

    function render() {
      var orders = S.getOrders().filter(function (o) {
        if (state.status && o.status !== state.status) return false;
        if (state.type && o.type !== state.type) return false;
        if (state.q) { var h = (o.customer.name + " " + o.customer.phone + " " + o.id).toLowerCase(); if (h.indexOf(state.q) < 0) return false; }
        return true;
      });
      var rev = 0, prof = 0;
      orders.forEach(function (o) { if (o.status !== "cancelled") { rev += o.revenue || 0; prof += (o.revenue || 0) - (o.cost || 0); } });
      document.querySelector("[data-osum]").innerHTML =
        "แสดง <b>" + orders.length + "</b> คำสั่งซื้อ · รายได้รวม <b>" + S.money(rev) + "</b> · กำไรรวม <b>" + S.money(prof) + "</b>";

      var tb = document.querySelector("[data-ordtable]");
      if (!orders.length) { tb.innerHTML = '<tbody><tr><td colspan="7" style="text-align:center;padding:32px;color:var(--fg-2)">ไม่มีคำสั่งซื้อที่ตรงกับเงื่อนไข</td></tr></tbody>'; return; }
      tb.innerHTML =
        "<thead><tr><th>คำสั่งซื้อ</th><th>ลูกค้า</th><th>รายการ</th><th class=num>ยอด</th><th class=num>กำไร</th><th>สถานะ</th><th>เปลี่ยนสถานะ</th></tr></thead><tbody>" +
        orders.map(function (o) {
          var opts = statusOptions(o);
          var addr = o.fulfillment === "delivery" && o.address ? "<br><span class=prod-sku>" + o.address.text + "</span>" : "";
          return "<tr><td><b>" + o.id + '</b> <span class="chip ' + o.type + '">' + S.typeLabel(o.type) + "</span> " +
            '<span class="chip ' + (o.fulfillment === "delivery" ? "rent" : "new") + '">' + S.fulfillmentLabel(o.fulfillment) + "</span>" +
            "<br><span class=prod-sku>" + S.fmtDate(o.createdAt) + (o.type === "rent" ? " · " + o.days + " วัน" : "") + "</span></td>" +
            "<td>" + o.customer.name + "<br><span class=prod-sku>" + o.customer.phone + "</span>" + addr + "</td>" +
            "<td>" + o.items.map(function (it) { return it.name + " ×" + it.qty; }).join("<br>") + (o.shipping ? '<br><span class="prod-sku">+ ค่าจัดส่ง ' + S.money(o.shipping) + "</span>" : "") + "</td>" +
            '<td class="num">' + S.money(o.total) + "</td>" +
            '<td class="num">' + S.money((o.revenue || 0) - (o.cost || 0)) + "</td>" +
            "<td>" + adminStatusBadges(o) + (o.staffMessage ? '<br><span class="prod-sku">📩 ' + esc(o.staffMessage) + "</span>" : "") + "</td>" +
            '<td><div class="ord-act">' + (opts ? '<select class="statussel" data-os="' + o.id + '">' + opts + "</select>" : '<span class="prod-sku">—</span>') +
              '<div class="ord-msg"><input data-msg="' + o.id + '" value="' + esc(o.staffMessage || "") + '" placeholder="ตอบลูกค้า เช่น ของถึงใน 2 วัน"><button class="btn btn-sm" data-sendmsg="' + o.id + '">ส่ง</button></div>' +
              (S.isOwner() ? '<button class="btn btn-sm btn-danger" data-delorder="' + o.id + '">ลบคำสั่งซื้อ</button>' : "") +
            "</div></td></tr>";
        }).join("") + "</tbody>";

      tb.querySelectorAll("[data-os]").forEach(function (sel) {
        sel.onchange = function () {
          if (!sel.value) return;
          var cancelling = sel.value === "cancelled";
          S.setOrderStatus(sel.dataset.os, sel.value);
          U.toast(cancelling ? "ยกเลิกแล้ว · ส่งอีเมลแจ้งลูกค้าแล้ว (จำลอง)" : "อัปเดตสถานะแล้ว", cancelling ? "err" : "ok");
          render();
        };
      });
      tb.querySelectorAll("[data-sendmsg]").forEach(function (b) {
        b.onclick = function () {
          var inp = tb.querySelector('[data-msg="' + b.dataset.sendmsg + '"]');
          S.saveOrderMessage(b.dataset.sendmsg, inp.value.trim());
          U.toast("ส่งข้อความถึงลูกค้าแล้ว · แจ้งอีเมล (จำลอง)", "ok"); render();
        };
      });
      tb.querySelectorAll("[data-delorder]").forEach(function (b) {
        b.onclick = function () { askPin("ลบคำสั่งซื้อ " + b.dataset.delorder, function () { S.deleteOrder(b.dataset.delorder); U.toast("ลบคำสั่งซื้อแล้ว", "ok"); render(); }); };
      });
    }
    render();
  }
  // next valid transitions for an order, per the pay→receive→(return) flow
  function statusOptions(o) {
    var opts = [];
    if (o.status === "paid") {
      opts.push(["received", o.fulfillment === "pickup" ? "ลูกค้ามารับแล้ว" : "จัดส่ง/ได้รับแล้ว"]);
      opts.push(["cancelled", "ยกเลิกคำสั่งซื้อ"]);
    } else if (o.status === "received" && o.type === "rent") {
      opts.push(["returned", "รับคืนสินค้าแล้ว"]);
    }
    if (!opts.length) return "";
    return "<option value=''>— เปลี่ยนเป็น —</option>" + opts.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + "</option>"; }).join("");
  }

  function openShipEditor() {
    function build() {
      var rates = S.getShipRates();
      var provs = S.provinces();
      var body =
        '<p style="font-family:var(--font-body);font-size:13px;color:var(--fg-2);margin:0 0 6px">ค่าจัดส่งต่อ 1 คำสั่งซื้อ (บาท) — ปรับได้ตามระยะทางของแต่ละจังหวัด (ลูกค้าจะไม่เห็นค่าส่งแยก ระบบรวมในยอดให้)</p>' +
        provs.map(function (p) {
          return '<div class="f2" style="grid-template-columns:1fr 120px;align-items:center;gap:10px">' +
            '<div style="font-family:var(--font-body);font-size:14px;font-weight:600">' + esc(p) + "</div>" +
            '<input type="number" min="0" data-ship-prov="' + esc(p) + '" value="' + (rates[p] != null ? rates[p] : S.getShippingFee(p)) + '"></div>';
        }).join("");
      openModal("ตั้งค่าค่าจัดส่งรายจังหวัด (" + provs.length + " จังหวัด)", body, function (root) {
        root.querySelectorAll("[data-ship-prov]").forEach(function (i) { S.setShipRate(i.getAttribute("data-ship-prov"), i.value); });
        U.toast("บันทึกค่าจัดส่งแล้ว", "ok");
        return true;
      });
    }
    if (window.MEGeoLoad) { U.toast("กำลังโหลดรายชื่อจังหวัดทั้งหมด…"); window.MEGeoLoad().then(function (n) { if (n) S.setGeoData(n); build(); }); }
    else build();
  }

  /* ===================== SITE SETTINGS ===================== */
  function initSettings() {
    var st = S.getSettings();
    var root = document.querySelector("[data-setroot]");
    var simpleKeys = ["heroOverline", "heroTitle", "heroSub", "brandsTagline", "company", "address", "phone", "line", "facebook", "instagram", "tiktok", "hoursWeek", "hoursSun", "bankInfo", "chatGreeting", "chatFallback", "authLoginTitle", "authLoginSub", "authRegTitle", "authRegSub", "deletePin", "googleClientId", "facebookAppId", "firebaseConfig", "hoursWeekOpen", "hoursWeekClose", "hoursSunOpen", "hoursSunClose"];
    var openSunEl = root.querySelector("[data-open-sun]"); if (openSunEl) openSunEl.checked = st.openSun !== false;
    var sdays = (st.specialDays || []).map(function (d) { return { date: d.date, open: !!d.open, note: d.note || "" }; });
    var sdayList = root.querySelector("[data-sdaylist]");
    function syncSdays() { if (!sdayList) return; sdayList.querySelectorAll("[data-sd]").forEach(function (r) { var i = +r.getAttribute("data-sd"); sdays[i].date = r.querySelector("[data-sd-date]").value; sdays[i].open = r.querySelector("[data-sd-open]").checked; sdays[i].note = r.querySelector("[data-sd-note]").value; }); }
    function renderSdays() {
      if (!sdayList) return;
      sdayList.innerHTML = sdays.map(function (d, i) {
        return '<div class="row-edit" data-sd="' + i + '"><input type="date" data-sd-date value="' + esc(d.date || "") + '">' +
          '<label class="f-check"><input type="checkbox" data-sd-open' + (d.open ? " checked" : "") + "> เปิด</label>" +
          '<input data-sd-note value="' + esc(d.note || "") + '" placeholder="หมายเหตุ เช่น หยุดสงกรานต์" style="flex:1">' +
          '<button class="btn btn-sm btn-danger" data-sd-del="' + i + '">ลบ</button></div>';
      }).join("");
      sdayList.querySelectorAll("[data-sd-del]").forEach(function (b) { b.onclick = function () { syncSdays(); sdays.splice(+b.dataset.sdDel, 1); renderSdays(); }; });
    }
    if (sdayList) { renderSdays(); root.querySelector("[data-sday-add]").addEventListener("click", function () { syncSdays(); sdays.push({ date: "", open: false, note: "" }); renderSdays(); }); }
    simpleKeys.forEach(function (k) { var el = root.querySelector('[data-set="' + k + '"]'); if (el) el.value = st[k] || ""; });
    var phrasesEl = root.querySelector('[data-set="heroPhrases"]'); if (phrasesEl) phrasesEl.value = (st.heroPhrases || []).join("\n");

    // QR image
    var pendingQR = st.qrImage || "";
    var qrPrev = root.querySelector("[data-qrprev]");
    function drawQR() { qrPrev.innerHTML = pendingQR ? '<img src="' + pendingQR + '">' : '<span class="img-hint">ยังไม่ได้ตั้งค่า — ใช้ QR ตัวอย่างอัตโนมัติ</span>'; }
    drawQR();
    root.querySelector("[data-qrfile]").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; readImageFile(f, function (d) { pendingQR = d; drawQR(); }); });
    root.querySelector("[data-qrclear]").addEventListener("click", function () { pendingQR = ""; drawQR(); });

    // FAQ editor
    var faq = (st.faq || []).map(function (f) { return { q: f.q, a: f.a }; });
    var faqList = root.querySelector("[data-faqlist]");
    function syncFaq() {
      faqList.querySelectorAll("[data-fq]").forEach(function (i) { faq[+i.dataset.fq].q = i.value; });
      faqList.querySelectorAll("[data-fa]").forEach(function (t) { faq[+t.dataset.fa].a = t.value; });
    }
    function renderFaq() {
      faqList.innerHTML = faq.map(function (f, i) {
        return '<div class="faq-edit"><div style="display:flex;flex-direction:column;gap:8px;flex:1">' +
          '<input data-fq="' + i + '" value="' + esc(f.q) + '" placeholder="คำถาม">' +
          '<textarea data-fa="' + i + '" rows="2" placeholder="คำตอบ">' + esc(f.a) + "</textarea></div>" +
          '<button class="btn btn-sm btn-danger" data-fdel="' + i + '">ลบ</button></div>';
      }).join("");
      faqList.querySelectorAll("[data-fq]").forEach(function (i) { i.onchange = function () { faq[+i.dataset.fq].q = i.value; }; });
      faqList.querySelectorAll("[data-fa]").forEach(function (t) { t.onchange = function () { faq[+t.dataset.fa].a = t.value; }; });
      faqList.querySelectorAll("[data-fdel]").forEach(function (b) { b.onclick = function () { syncFaq(); faq.splice(+b.dataset.fdel, 1); renderFaq(); }; });
    }
    renderFaq();
    root.querySelector("[data-faqadd]").addEventListener("click", function () { syncFaq(); faq.push({ q: "", a: "" }); renderFaq(); });

    // ----- Chat rules editor -----
    var chat = (st.chatRules || []).map(function (r) { return { keywords: r.keywords, answer: r.answer }; });
    var chatList = root.querySelector("[data-chatlist]");
    function syncChat() {
      if (!chatList) return;
      chatList.querySelectorAll("[data-ck]").forEach(function (i) { chat[+i.dataset.ck].keywords = i.value; });
      chatList.querySelectorAll("[data-ca]").forEach(function (t) { chat[+t.dataset.ca].answer = t.value; });
    }
    function renderChat() {
      if (!chatList) return;
      chatList.innerHTML = chat.map(function (c, i) {
        return '<div class="faq-edit"><div style="display:flex;flex-direction:column;gap:8px;flex:1">' +
          '<input data-ck="' + i + '" value="' + esc(c.keywords || "") + '" placeholder="คำค้น เช่น เวลา, เปิด, กี่โมง">' +
          '<textarea data-ca="' + i + '" rows="2" placeholder="คำตอบ">' + esc(c.answer || "") + "</textarea></div>" +
          '<button class="btn btn-sm btn-danger" data-cdel="' + i + '">ลบ</button></div>';
      }).join("");
      chatList.querySelectorAll("[data-cdel]").forEach(function (b) { b.onclick = function () { syncChat(); chat.splice(+b.dataset.cdel, 1); renderChat(); }; });
    }
    if (chatList) { renderChat(); root.querySelector("[data-chatadd]").addEventListener("click", function () { syncChat(); chat.push({ keywords: "", answer: "" }); renderChat(); }); }

    // ----- Brands editor -----
    var brands = (st.brands || []).map(function (b) { return { name: b.name, tag: b.tag, primary: !!b.primary }; });
    var brandList = root.querySelector("[data-brandlist]");
    function syncBrands() {
      if (!brandList) return;
      brandList.querySelectorAll("[data-bn]").forEach(function (i) { brands[+i.dataset.bn].name = i.value; });
      brandList.querySelectorAll("[data-bt]").forEach(function (i) { brands[+i.dataset.bt].tag = i.value; });
      brandList.querySelectorAll("[data-bp]").forEach(function (i) { brands[+i.dataset.bp].primary = i.checked; });
    }
    function renderBrands() {
      if (!brandList) return;
      brandList.innerHTML = brands.map(function (b, i) {
        return '<div class="row-edit"><input data-bn="' + i + '" value="' + esc(b.name) + '" placeholder="ชื่อแบรนด์" style="flex:1">' +
          '<input data-bt="' + i + '" value="' + esc(b.tag || "") + '" placeholder="คำอธิบายสั้น" style="flex:1.4">' +
          '<label class="f-check"><input type="checkbox" data-bp="' + i + '"' + (b.primary ? " checked" : "") + "> เด่น</label>" +
          '<button class="btn btn-sm btn-danger" data-bdel="' + i + '">ลบ</button></div>';
      }).join("");
      brandList.querySelectorAll("[data-bdel]").forEach(function (b) { b.onclick = function () { syncBrands(); brands.splice(+b.dataset.bdel, 1); renderBrands(); }; });
    }
    if (brandList) { renderBrands(); root.querySelector("[data-brand-add]").addEventListener("click", function () { syncBrands(); brands.push({ name: "", tag: "", primary: false }); renderBrands(); }); }

    // ----- Promo banner -----
    var promo = Object.assign({ enabled: false, title: "", text: "", image: "" }, st.promo || {});
    var promoEnabled = root.querySelector("[data-promo-enabled]");
    if (promoEnabled) {
      promoEnabled.checked = !!promo.enabled;
      root.querySelector("[data-promo-title]").value = promo.title || "";
      root.querySelector("[data-promo-text]").value = promo.text || "";
      var promoPrev = root.querySelector("[data-promo-prev]");
      var drawPromo = function () { promoPrev.innerHTML = promo.image ? '<img src="' + promo.image + '">' : '<span class="img-hint">ไม่มีรูป</span>'; };
      drawPromo();
      root.querySelector("[data-promo-file]").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (!f) return; readImageFile(f, function (d) { promo.image = d; drawPromo(); }); });
      root.querySelector("[data-promo-clear]").addEventListener("click", function () { promo.image = ""; drawPromo(); });
    }

    // ----- Flash sale -----
    var flash = Object.assign({ enabled: false, title: "ลดพิเศษสุดคุ้ม", endTime: 0, items: [] }, st.flashSale || {});
    flash.items = (flash.items || []).map(function (x) { return { productId: x.productId, salePrice: x.salePrice, wasPrice: x.wasPrice }; });
    var flashEnabled = root.querySelector("[data-flash-enabled]");
    var flashList = root.querySelector("[data-flashlist]");
    var prodOpts = S.getProducts().map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; }).join("");
    function syncFlashItems() {
      if (!flashList) return;
      flashList.querySelectorAll("[data-fpid]").forEach(function (s) { flash.items[+s.dataset.fpid].productId = s.value; });
      flashList.querySelectorAll("[data-fsale]").forEach(function (s) { flash.items[+s.dataset.fsale].salePrice = +s.value || 0; });
      flashList.querySelectorAll("[data-fwas]").forEach(function (s) { flash.items[+s.dataset.fwas].wasPrice = +s.value || 0; });
    }
    function renderFlashItems() {
      if (!flashList) return;
      flashList.innerHTML = flash.items.map(function (it, i) {
        var opts = S.getProducts().map(function (p) { return '<option value="' + p.id + '"' + (p.id === it.productId ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("");
        return '<div class="row-edit"><select data-fpid="' + i + '" style="flex:1.6">' + opts + "</select>" +
          '<input type="number" data-fsale="' + i + '" value="' + (it.salePrice || "") + '" placeholder="ราคาลด" style="width:110px">' +
          '<input type="number" data-fwas="' + i + '" value="' + (it.wasPrice || "") + '" placeholder="ราคาเดิม" style="width:110px">' +
          '<button class="btn btn-sm btn-danger" data-fdelitem="' + i + '">ลบ</button></div>';
      }).join("");
      flashList.querySelectorAll("[data-fdelitem]").forEach(function (b) { b.onclick = function () { syncFlashItems(); flash.items.splice(+b.dataset.fdelitem, 1); renderFlashItems(); }; });
    }
    if (flashEnabled) {
      flashEnabled.checked = !!flash.enabled;
      root.querySelector("[data-flash-title]").value = flash.title || "";
      if (flash.endTime) root.querySelector("[data-flash-end]").value = toLocalInput(flash.endTime);
      renderFlashItems();
      root.querySelector("[data-flash-additem]").addEventListener("click", function () { syncFlashItems(); var p = S.getProducts()[0]; flash.items.push({ productId: p ? p.id : "", salePrice: 0, wasPrice: p ? p.price : 0 }); renderFlashItems(); });
    }

    function doSave() {
      syncFaq(); syncBrands(); syncFlashItems(); syncChat(); syncSdays();
      var patch = {};
      simpleKeys.forEach(function (k) { var el = root.querySelector('[data-set="' + k + '"]'); patch[k] = el ? el.value : st[k]; });
      if (openSunEl) patch.openSun = openSunEl.checked;
      patch.specialDays = sdays.filter(function (d) { return d.date; });
      patch.heroPhrases = phrasesEl.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      patch.faq = faq.filter(function (f) { return (f.q || "").trim(); });
      patch.chatRules = chat.filter(function (c) { return (c.keywords || "").trim() && (c.answer || "").trim(); });
      patch.qrImage = pendingQR;
      patch.brands = brands.filter(function (b) { return (b.name || "").trim(); });
      if (promoEnabled) patch.promo = { enabled: promoEnabled.checked, title: root.querySelector("[data-promo-title]").value, text: root.querySelector("[data-promo-text]").value, image: promo.image };
      if (flashEnabled) {
        var endStr = root.querySelector("[data-flash-end]").value;
        patch.flashSale = { enabled: flashEnabled.checked, title: root.querySelector("[data-flash-title]").value, endTime: endStr ? new Date(endStr).getTime() : 0, items: flash.items.filter(function (x) { return x.productId; }) };
      }
      if (patch.firebaseConfig && patch.firebaseConfig.trim()) {
        if (!window.parseFbConfig(patch.firebaseConfig)) { U.toast("Firebase Config อ่านไม่ได้ — วางทั้งก้อนตั้งแต่ { ถึง } ที่ก๊อปจาก Firebase Console", "err"); return; }
      }
      try { S.saveSettings(patch); U.toast("บันทึกการตั้งค่าแล้ว — หน้าร้านอัปเดตทันที", "ok"); }
      catch (e) { U.toast("บันทึกไม่สำเร็จ — รูปอาจใหญ่เกินไป", "err"); }
    }
    document.querySelectorAll("[data-savesettings]").forEach(function (b) { b.addEventListener("click", doSave); });
  }
  function toLocalInput(ms) {
    var d = new Date(ms - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  }

  /* ===================== ERP / ACCOUNTING ===================== */
  function initErp() {
    var permLbl = { income: "รายรับ", expense: "รายจ่าย" };
    renderPnl(); renderLedger(); renderSuppliers(); renderPO(); renderCustomers(); renderSales();
    document.querySelector("[data-salesperiod]").addEventListener("change", renderSales);

    function periodStart(p) {
      var d = new Date(); d.setHours(0, 0, 0, 0);
      if (p === "week") { var dow = (d.getDay() + 6) % 7; return d.getTime() - dow * 86400000; }
      if (p === "month") { d.setDate(1); return d.getTime(); }
      if (p === "year") { d.setMonth(0, 1); return d.getTime(); }
      return d.getTime();
    }
    function renderSales() {
      var p = document.querySelector("[data-salesperiod]").value, start = periodStart(p);
      var os = S.getOrders().filter(function (o) { return o.status !== "cancelled" && o.createdAt >= start; });
      var total = os.reduce(function (s, o) { return s + (o.revenue || 0); }, 0);
      document.querySelector("[data-salesreport]").innerHTML =
        '<div class="kpis" style="margin-bottom:16px">' + kpi("accent", "ยอดขายรวม", S.money(total), "") + kpi("", "จำนวนคำสั่งซื้อ", os.length + " รายการ", "") + "</div>" +
        '<div class="table-wrap"><table class="data"><thead><tr><th>เลขที่คำสั่งซื้อ</th><th>วันที่</th><th>ลูกค้า</th><th class=num>ยอด</th></tr></thead><tbody>' +
        (os.length ? os.map(function (o) { return "<tr><td><b>" + o.id + "</b></td><td>" + S.fmtDate(o.createdAt) + "</td><td>" + esc(o.customer.name) + '</td><td class="num">' + S.money(o.total) + "</td></tr>"; }).join("") : '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--fg-2)">ไม่มีคำสั่งซื้อในช่วงนี้</td></tr>') +
        "</tbody></table></div>";
    }

    function renderPnl() {
      var p = S.getPnL();
      document.querySelector("[data-pnl]").innerHTML =
        kpi("accent", "ยอดขาย (รายได้)", S.money(p.salesRevenue), "จากคำสั่งซื้อ") +
        kpi("", "ต้นทุนขาย (COGS)", S.money(p.cogs), "ของที่ขายออก") +
        kpi("", "กำไรขั้นต้น", S.money(p.grossProfit), "ขาย − ต้นทุน") +
        kpi("", "รายรับอื่น", S.money(p.otherIncome), "บันทึกเอง") +
        kpi("", "ค่าใช้จ่าย", S.money(p.expenses), "บันทึกเอง") +
        kpi("profit", "กำไรสุทธิ", S.money(p.netProfit), "หลังหักทุกอย่าง");
    }
    function renderLedger() {
      var rows = S.getLedger();
      var box = document.querySelector("[data-ledger]");
      box.innerHTML = "<table class=\"data\"><thead><tr><th>วันที่</th><th>ประเภท</th><th>หมวด</th><th>รายละเอียด</th><th class=num>จำนวน</th><th></th></tr></thead><tbody>" +
        (rows.length ? rows.map(function (e) {
          return "<tr><td>" + S.fmtDate(e.date) + '</td><td><span class="chip ' + (e.type === "income" ? "fulfilled" : "cancelled") + '">' + permLbl[e.type] + "</span></td><td>" + esc(e.category || "") + "</td><td>" + esc(e.note || "") + '</td><td class="num">' + S.money(e.amount) + '</td><td><button class="btn btn-sm btn-danger" data-led-del="' + e.id + '">ลบ</button></td></tr>';
        }).join("") : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--fg-2)">ยังไม่มีรายการ</td></tr>') + "</tbody></table>";
      box.querySelectorAll("[data-led-del]").forEach(function (b) { b.onclick = function () { S.deleteLedgerEntry(b.dataset.ledDel); renderLedger(); renderPnl(); }; });
    }
    document.querySelector("[data-led-add]").onclick = function () {
      var amt = +document.querySelector("[data-led-amt]").value || 0;
      if (!amt) { U.toast("กรอกจำนวนเงิน", "err"); return; }
      S.saveLedgerEntry({ type: document.querySelector("[data-led-type]").value, category: document.querySelector("[data-led-cat]").value.trim() || "ทั่วไป", note: document.querySelector("[data-led-note]").value.trim(), amount: amt });
      document.querySelector("[data-led-cat]").value = ""; document.querySelector("[data-led-note]").value = ""; document.querySelector("[data-led-amt]").value = "";
      U.toast("บันทึกแล้ว", "ok"); renderLedger(); renderPnl();
    };
    function renderSuppliers() {
      var list = S.getSuppliers();
      var box = document.querySelector("[data-suppliers]");
      box.innerHTML = "<table class=\"data\"><thead><tr><th>ผู้จัดจำหน่าย</th><th>โทร</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>" +
        (list.length ? list.map(function (s) { return "<tr><td>" + esc(s.name) + "</td><td>" + esc(s.phone || "") + "</td><td>" + esc(s.note || "") + '</td><td><button class="btn btn-sm btn-danger" data-sup-del="' + s.id + '">ลบ</button></td></tr>'; }).join("") : '<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--fg-2)">ยังไม่มีผู้จัดจำหน่าย</td></tr>') + "</tbody></table>";
      box.querySelectorAll("[data-sup-del]").forEach(function (b) { b.onclick = function () { S.deleteSupplier(b.dataset.supDel); renderSuppliers(); renderPO(); }; });
    }
    document.querySelector("[data-sup-add]").onclick = function () {
      var n = document.querySelector("[data-sup-name]").value.trim();
      if (!n) { U.toast("กรอกชื่อผู้จัดจำหน่าย", "err"); return; }
      S.saveSupplier({ name: n, phone: document.querySelector("[data-sup-phone]").value.trim(), note: document.querySelector("[data-sup-note]").value.trim() });
      document.querySelector("[data-sup-name]").value = ""; document.querySelector("[data-sup-phone]").value = ""; document.querySelector("[data-sup-note]").value = "";
      U.toast("เพิ่มผู้จัดจำหน่ายแล้ว", "ok"); renderSuppliers(); renderPO();
    };
    function renderPO() {
      var prodSel = document.querySelector("[data-po-product]"), supSel = document.querySelector("[data-po-supplier]");
      prodSel.innerHTML = S.getProducts().map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + " (" + p.sku + ")</option>"; }).join("");
      supSel.innerHTML = '<option value="">— ไม่ระบุ —</option>' + S.getSuppliers().map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + "</option>"; }).join("");
      var first = S.getProducts()[0]; document.querySelector("[data-po-cost]").value = first ? first.cost : "";
      var purch = S.getPurchases(), owner = S.isOwner();
      var el = document.querySelector("[data-po-list]");
      el.innerHTML = "<table class=\"data\"><thead><tr><th>เลขที่</th><th>วันที่</th><th>ผู้จัดจำหน่าย</th><th>รายการ</th><th class=num>รวมต้นทุน</th>" + (owner ? "<th></th>" : "") + "</tr></thead><tbody>" +
        (purch.length ? purch.map(function (po) { return "<tr><td>" + po.id + "</td><td>" + S.fmtDate(po.date) + "</td><td>" + esc(po.supplierName || "-") + "</td><td>" + po.items.map(function (it) { return esc(it.name) + " ×" + it.qty; }).join("<br>") + '</td><td class="num">' + S.money(po.total) + "</td>" + (owner ? '<td><button class="btn btn-sm btn-danger" data-delpo="' + po.id + '">ลบ</button></td>' : "") + "</tr>"; }).join("") : '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--fg-2)">ยังไม่มีการรับสินค้าเข้า</td></tr>') + "</tbody></table>";
      el.querySelectorAll("[data-delpo]").forEach(function (b) { b.onclick = function () { askPin("ลบใบรับสินค้าเข้า " + b.dataset.delpo, function () { S.deletePurchase(b.dataset.delpo); U.toast("ลบแล้ว", "ok"); renderPO(); renderPnl(); }); }; });
    }
    document.querySelector("[data-po-product]").addEventListener("change", function () { var p = S.getProduct(this.value); document.querySelector("[data-po-cost]").value = p ? p.cost : ""; });
    document.querySelector("[data-po-add]").onclick = function () {
      var pid = document.querySelector("[data-po-product]").value, qty = +document.querySelector("[data-po-qty]").value || 0, cost = +document.querySelector("[data-po-cost]").value || 0;
      if (!pid || qty <= 0) { U.toast("เลือกสินค้าและจำนวน", "err"); return; }
      var prod = S.getProduct(pid), supId = document.querySelector("[data-po-supplier]").value, sup = S.getSuppliers().filter(function (s) { return s.id === supId; })[0];
      S.receivePurchase({ supplierId: supId, supplierName: sup ? sup.name : "", items: [{ productId: pid, name: prod.name, qty: qty, unitCost: cost || prod.cost }] });
      document.querySelector("[data-po-qty]").value = "";
      U.toast("รับสินค้าเข้าสต็อกแล้ว +" + qty + " ชิ้น", "ok"); renderPO(); renderPnl(); renderLedger();
    };
    function renderCustomers() {
      var box = document.querySelector("[data-customers]");
      function ordersOf(u) { return S.getOrders().filter(function (o) { return custMatch(o, u); }); }
      function draw(q) {
        var rows = S.getUsers().map(function (u) { var os = ordersOf(u); var tot = os.reduce(function (s, o) { return s + (o.status !== "cancelled" ? o.total : 0); }, 0); return { u: u, os: os, tot: tot }; });
        if (q) rows = rows.filter(function (x) { return x.os.some(function (o) { return o.items.some(function (it) { return it.name.toLowerCase().indexOf(q) >= 0; }); }); });
        rows.sort(function (a, b) { return b.tot - a.tot; });
        box.innerHTML = '<div class="search-admin"><input data-custsearch type="text" placeholder="ค้นหาว่าใครซื้อสินค้าอะไร เช่น สว่าน" value="' + esc(q || "") + '"></div>' +
          "<table class=\"data\"><thead><tr><th>อันดับ</th><th>ชื่อ</th><th>อีเมล</th><th>โทร</th><th class=num>คำสั่งซื้อ</th><th class=num>ยอดรวม</th><th></th></tr></thead><tbody>" +
          (rows.length ? rows.map(function (x, i) { return "<tr><td><b>#" + (i + 1) + "</b></td><td>" + esc(x.u.name) + "</td><td>" + esc(x.u.email) + "</td><td>" + esc(x.u.phone || "") + '</td><td class="num">' + x.os.length + '</td><td class="num">' + S.money(x.tot) + '</td><td><button class="btn btn-sm btn-ghost" data-custview="' + esc(x.u.email) + '">ดู</button></td></tr>'; }).join("") : '<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--fg-2)">ไม่พบลูกค้า</td></tr>') + "</tbody></table>";
        var si = box.querySelector("[data-custsearch]");
        si.oninput = function () { var v = si.value.trim().toLowerCase(); draw(v); var n = box.querySelector("[data-custsearch]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
        box.querySelectorAll("[data-custview]").forEach(function (b) { b.onclick = function () { openCustomer(b.dataset.custview); }; });
      }
      draw("");
    }
  }
  function custMatch(o, u) {
    var oe = (o.userEmail || (o.customer && o.customer.email) || "").toLowerCase();
    return (oe && oe === (u.email || "").toLowerCase()) || (o.customer && o.customer.phone && u.phone && o.customer.phone === u.phone);
  }
  function openCustomer(email) {
    var u = S.getUsers().filter(function (x) { return x.email === email; })[0]; if (!u) return;
    var orders = S.getOrders().filter(function (o) { return custMatch(o, u); });
    function body(q) {
      var rows = []; orders.forEach(function (o) { o.items.forEach(function (it) { if (q && it.name.toLowerCase().indexOf(q) < 0) return; rows.push({ o: o, it: it }); }); });
      var spent = orders.reduce(function (s, o) { return s + (o.status !== "cancelled" ? o.total : 0); }, 0);
      return '<div style="font-family:var(--font-body);margin:0 0 10px">' + esc(u.email) + (u.phone ? " · " + esc(u.phone) : "") + " · ยอดซื้อรวม <b>" + S.money(spent) + "</b></div>" +
        '<div class="field"><input data-itemsearch placeholder="ค้นหาสินค้าที่ลูกค้าคนนี้ซื้อ เช่น สว่าน" value="' + esc(q || "") + '"></div>' +
        "<table class=\"data\"><thead><tr><th>คำสั่งซื้อ</th><th>วันที่</th><th>สินค้า</th><th class=num>จำนวน</th><th class=num>ราคา</th></tr></thead><tbody>" +
        (rows.length ? rows.map(function (r) { return "<tr><td>" + r.o.id + "</td><td>" + S.fmtDate(r.o.createdAt) + "</td><td>" + esc(r.it.name) + '</td><td class="num">' + r.it.qty + '</td><td class="num">' + S.money(r.it.unitPrice * r.it.qty * (r.it.days || 1)) + "</td></tr>"; }).join("") : '<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--fg-2)">ไม่พบสินค้า</td></tr>') + "</tbody></table>";
    }
    openModal("ลูกค้า: " + u.name, body(""), function () { return true; });
    var mb = document.querySelector(".modal-bg .modal-body");
    function rewire() { var si = mb.querySelector("[data-itemsearch]"); if (!si) return; si.oninput = function () { var v = si.value.trim().toLowerCase(); mb.innerHTML = body(v); rewire(); var n = mb.querySelector("[data-itemsearch]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; }
    rewire();
  }

  /* ===================== STAFF MANAGEMENT (owner) ===================== */
  function initStaff() {
    var root = document.querySelector("[data-staffroot]");
    var permLabels = { dashboard: "แดชบอร์ด", inventory: "คลัง/สต็อก", orders: "คำสั่งซื้อ", erp: "ERP/บัญชี", settings: "ตั้งค่าเว็บไซต์" };
    function render() {
      var staff = S.getStaff();
      root.innerHTML = staff.map(function (m) {
        var owner = m.role === "owner";
        return '<div class="panel"><div class="panel-head"><h2>' + (owner ? "⭐ เจ้าของร้าน" : "👷 พนักงาน") + "</h2>" +
          (owner ? "" : '<button class="btn btn-sm btn-danger" data-del="' + m.id + '">ลบพนักงาน</button>') + "</div>" +
          '<div class="f2"><div class="field"><label>ชื่อ</label><input data-f="name" data-id="' + m.id + '" value="' + esc(m.name) + '"></div>' +
          '<div class="field"><label>อีเมล (ใช้เข้าสู่ระบบ)</label><input data-f="email" data-id="' + m.id + '" value="' + esc(m.email) + '"></div></div>' +
          '<div class="field"><label>รหัสผ่าน</label><input data-f="password" data-id="' + m.id + '" value="' + esc(m.password) + '"></div>' +
          (owner ? '<div class="img-hint">เจ้าของมีสิทธิ์ใช้งานทุกระบบโดยอัตโนมัติ</div>'
            : '<div class="field"><label>สิทธิ์การใช้ระบบหลังร้าน</label><div class="perm-grid">' +
              S.PERM_KEYS.map(function (k) { return '<label class="f-check"><input type="checkbox" data-perm="' + k + '" data-id="' + m.id + '"' + (m.perms && m.perms[k] ? " checked" : "") + "> " + permLabels[k] + "</label>"; }).join("") + "</div></div>") +
          '<button class="btn" data-save="' + m.id + '">บันทึก</button></div>';
      }).join("") +
      '<div class="panel"><div class="panel-head"><h2>+ เพิ่มพนักงานใหม่</h2></div>' +
        '<div class="f2"><div class="field"><label>ชื่อ</label><input data-new="name"></div>' +
        '<div class="field"><label>อีเมล</label><input data-new="email"></div></div>' +
        '<div class="field"><label>รหัสผ่าน</label><input data-new="password"></div>' +
        '<div class="field"><label>สิทธิ์</label><div class="perm-grid">' + S.PERM_KEYS.map(function (k) { return '<label class="f-check"><input type="checkbox" data-newperm="' + k + '"' + (k === "dashboard" ? " checked" : "") + "> " + permLabels[k] + "</label>"; }).join("") + "</div></div>" +
        '<button class="btn" data-add-staff>เพิ่มพนักงาน</button></div>';

      root.querySelectorAll("[data-save]").forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.save, m = { id: id };
          root.querySelectorAll('[data-f][data-id="' + id + '"]').forEach(function (i) { m[i.dataset.f] = i.value; });
          if (root.querySelector('[data-perm][data-id="' + id + '"]')) {
            var perms = {}; root.querySelectorAll('[data-perm][data-id="' + id + '"]').forEach(function (c) { perms[c.dataset.perm] = c.checked; }); m.perms = perms;
          }
          S.saveStaffMember(m); U.toast("บันทึกแล้ว", "ok"); render();
        };
      });
      root.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { if (confirm("ลบพนักงานคนนี้?")) { S.deleteStaff(b.dataset.del); U.toast("ลบแล้ว", "ok"); render(); } }; });
      root.querySelector("[data-add-staff]").onclick = function () {
        var m = { name: root.querySelector("[data-new=name]").value.trim(), email: root.querySelector("[data-new=email]").value.trim(), password: root.querySelector("[data-new=password]").value };
        if (!m.name || !m.email || !m.password) { U.toast("กรอกชื่อ อีเมล และรหัสผ่านให้ครบ", "err"); return; }
        var perms = {}; root.querySelectorAll("[data-newperm]").forEach(function (c) { perms[c.dataset.newperm] = c.checked; }); m.perms = perms;
        S.saveStaffMember(m); U.toast("เพิ่มพนักงานแล้ว", "ok"); render();
      };
    }
    render();
  }

  /* ===================== CHAT INBOX (LINE-OA style, real-time) ===================== */
  function initChat() {
    var listEl = document.querySelector("[data-chatlist]");
    var threadEl = document.querySelector("[data-chatthread]");
    var activeId = null, convUnsub = null, convs = [];
    var C = window.MEChat;
    var modeNote = document.querySelector("[data-chatmode]");
    if (modeNote) modeNote.textContent = C.mode() === "online" ? "● ออนไลน์ (เรียลไทม์ ข้ามอุปกรณ์)" : "● โหมดออฟไลน์ (ตั้งค่า Firebase ในหน้าตั้งค่าเพื่อใช้ข้ามเครื่อง)";
    threadEl.innerHTML = '<div class="img-hint" style="padding:20px">เลือกการสนทนาทางซ้ายเพื่อตอบลูกค้า</div>';
    C.subscribeList(function (list) { convs = list; renderList(); });
    function renderList() {
      listEl.innerHTML = convs.length ? convs.map(function (c) {
        var last = (c.messages && c.messages.length) ? c.messages[c.messages.length - 1].text : (c.lastText || "");
        return '<button class="chat-li' + (c.id === activeId ? " on" : "") + (c.needsShop ? " need" : "") + '" data-conv="' + esc(c.id) + '">' +
          '<div class="chat-li-name">' + esc(c.name || "ลูกค้า") + (c.needsShop ? ' <span class="chat-badge">รอตอบ</span>' : "") + "</div>" +
          '<div class="chat-li-last">' + esc(last) + "</div></button>";
      }).join("") : '<div class="img-hint" style="padding:14px">ยังไม่มีข้อความจากลูกค้า</div>';
      listEl.querySelectorAll("[data-conv]").forEach(function (b) { b.onclick = function () { openConv(b.dataset.conv); }; });
    }
    function openConv(id) {
      activeId = id; renderList();
      if (convUnsub) convUnsub();
      convUnsub = C.subscribeConv(id, function (msgs) { renderThread(id, msgs); });
    }
    function renderThread(id, msgs) {
      var c = convs.filter(function (x) { return x.id === id; })[0] || {};
      var prev = threadEl.querySelector("[data-replytext]"); var pv = prev ? prev.value : ""; var focused = prev && document.activeElement === prev;
      threadEl.innerHTML = '<div class="chat-thread-head">' + esc(c.name || "ลูกค้า") + (c.email ? " · " + esc(c.email) : "") + "</div>" +
        '<div class="chat-thread-body" data-tbody>' + (msgs || []).map(function (m) {
          var cls = m.from === "user" ? "them" : (m.from === "shop" ? "meShop" : "bot");
          return '<div class="me-chat-msg ' + cls + '">' + (m.from === "bot" ? '<span class="chat-who">AI</span>' : "") + esc(m.text) + "</div>";
        }).join("") + "</div>" +
        '<form class="chat-thread-input" data-reply><input data-replytext placeholder="พิมพ์ตอบลูกค้า…" autocomplete="off"><button class="btn" type="submit">ส่ง</button></form>';
      var tb = threadEl.querySelector("[data-tbody]"); tb.scrollTop = tb.scrollHeight;
      var ri = threadEl.querySelector("[data-replytext]"); ri.value = pv; if (focused) ri.focus();
      threadEl.querySelector("[data-reply]").onsubmit = function (e) { e.preventDefault(); var t = ri.value.trim(); if (!t) return; C.send(id, "shop", t, {}); ri.value = ""; };
    }
  }

  // confirm-with-PIN before deleting data
  function askPin(title, onOk) {
    openModal(title || "ยืนยันการลบ",
      '<p style="font-family:var(--font-body);margin:0 0 10px">การลบนี้ลบถาวร — กรุณากรอกรหัสยืนยันการลบ (ตั้งได้ในหน้าตั้งค่า → ความปลอดภัย)</p>' +
      '<div class="field"><label>รหัสยืนยันการลบ</label><input type="password" data-pin autocomplete="off"></div>',
      function (root) { if (!S.checkPin(root.querySelector("[data-pin]").value)) { U.toast("รหัสไม่ถูกต้อง", "err"); return false; } onOk(); return true; });
  }

  /* ---------- generic modal ---------- */
  function openModal(title, bodyHtml, onSave) {
    var bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML =
      '<div class="modal"><div class="modal-head"><h3>' + title + '</h3><button class="modal-x" aria-label="ปิด">×</button></div>' +
      '<div class="modal-body">' + bodyHtml + "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-cancel>ยกเลิก</button><button class="btn" data-save>บันทึก</button></div></div>';
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.querySelector(".modal-x").onclick = close;
    bg.querySelector("[data-cancel]").onclick = close;
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    bg.querySelector("[data-save]").onclick = function () {
      var ok = onSave(bg.querySelector(".modal-body"));
      if (ok !== false) close();
    };
  }

  /* ---------- helpers ---------- */
  function miniVisual(p) {
    if (p.image) return '<div class="prod-mini" style="background-image:url(' + JSON.stringify(p.image) + ');background-size:cover;background-position:center"></div>';
    return '<div class="prod-mini">' + U.iconSvg(p.icon, 24) + "</div>";
  }
  function statusTh(s) { return { new: "ใหม่", paid: "ชำระแล้ว", fulfilled: "ส่งมอบแล้ว", returned: "คืนแล้ว", cancelled: "ยกเลิก" }[s] || s; }
  function saleRent(p) { return [p.forSale ? "ขาย" : null, p.forRent ? "เช่า" : null].filter(Boolean).join("+") || "—"; }
  function esc(s) { return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
})();
