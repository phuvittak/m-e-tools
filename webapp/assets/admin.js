/* =================================================================
   M.E.Tools — Employee back office logic
   ================================================================= */
(function () {
  "use strict";
  var S = window.MEStore, U = window.MEUI;
  var view = document.body.getAttribute("data-admin");

  // permission gate per page (owner bypasses all). staff/botreplies are owner-only.
  var permFor = { dashboard: "dashboard", inventory: "inventory", orders: "orders", erp: "erp", settings: "settings" };
  if (view === "staff" || view === "botreplies") {
    if (!S.requirePerm(null, "../login.html")) return;
    if (!S.isOwner()) { window.location.href = "dashboard.html"; return; }
  } else if (view === "chat" || view === "botinbox" || view === "customers" || view === "warranty") {
    if (!S.requirePerm(null, "../login.html")) return; // any staff
  } else if (!S.requirePerm(permFor[view] || "dashboard", "../login.html")) return;

  mountShell(view);
  // ดึงข้อมูล admin จาก cloud ก่อนเริ่ม (settings/staff/ledger/etc.) — ทำเงียบ ๆ
  // ถ้า cloud ใหม่กว่า localStorage จะอัปเดต local แล้ว dispatch ให้ทุกหน้า re-render
  if (S.cloudLoadAdminData) S.cloudLoadAdminData();
  // โหลดแคตตาล็อกสินค้าจาก cloud → เจ้าของ/พนักงานเห็นสินค้าครบบนทุกอุปกรณ์ (แม้เครื่องนี้ยังไม่มี master)
  if (S.cloudLoadProducts) S.cloudLoadProducts();
  window.addEventListener("me-products-loaded", function () { if (window.__invRender) { try { window.__invRender(); } catch (e) {} } });
  // ลงทะเบียนเครื่องนี้เป็น admin แล้ว subscribe ออเดอร์จาก cloud (ทุกหน้าหลังร้าน) → ดูดลง local
  // ให้ทุกหน้า (แดชบอร์ด/คำสั่งซื้อ/ERP) เห็นออเดอร์ครบเหมือนกันทุกเครื่อง ผ่าน getOrders()
  if (S.ensureAdminRegistered) S.ensureAdminRegistered().then(function (uid) { if (uid) subscribeOrdersGlobal(); });
  // เรียลไทม์: settings/staff/สินค้า อัปเดตเองทุกหน้าหลังร้านเมื่อมีการแก้จากอีกเครื่อง
  if (S.startAdminRealtime) S.startAdminRealtime();
  ({ dashboard: initDashboard, inventory: initInventory, orders: initOrders, erp: initErp, settings: initSettings, staff: initStaff, chat: initChat, botinbox: initBotInbox, botreplies: initBotReplies, customers: initCustomers, warranty: initWarranty, import: function(){} }[view] || function () {})();

  // subscribe orders/{id} จาก Firestore แบบเรียลไทม์ → S.absorbCloudOrders() เขียนลง local me_orders
  function subscribeOrdersGlobal() {
    if (!S.loadFirebaseAuthAndDb || !S.absorbCloudOrders) return;
    S.loadFirebaseAuthAndDb("admin").then(function (m) {
      var fs = m.fsMod;
      fs.onSnapshot(fs.collection(m.db, "orders"), function (snap) {
        var list = snap.docs.map(function (d) {
          var data = d.data() || {};
          if (data.createdAtTs && data.createdAtTs.toDate) data.createdAt = data.createdAtTs.toDate().getTime();
          delete data.createdAtTs; delete data.updatedAtTs; // ไม่เก็บ Timestamp object ลง localStorage
          return data;
        });
        S.absorbCloudOrders(list);
      }, function (err) { console.warn("[orders global listener]", err && err.message); });
    }).catch(function () {});
  }

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
      botreplies: '<path d="M4 4h16v12H5.17L4 17.17V4z"/><path d="M7 8h10M7 12h7" stroke-linecap="round"/>',
      customers: '<path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="17" cy="6" r="3"/>',
      warranty: '<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>',
    };
    var nav = [
      ["dashboard.html", "dashboard", "แดชบอร์ด", "dashboard"],
      ["inventory.html", "inventory", "คลัง / สต็อก", "inventory"],
      ["orders.html", "orders", "คำสั่งซื้อ / เช่า", "orders"],
      ["erp.html", "erp", "ระบบ ERP / บัญชี", "erp"],
      ["settings.html", "settings", "ตั้งค่าเว็บไซต์", "settings"],
    ].filter(function (n) { return S.hasPerm(n[3]); });
    // แชทลูกค้าหน้าเว็บถูกถอดออก — ลูกค้าทักผ่าน LINE OA ตรง ดูทุกบทสนทนาในหน้า "แชทบอท LINE"
    nav.push(["bot-inbox.html", "botinbox", "กล่องข้อความออนไลน์", "botinbox"]);
    nav.push(["warranty.html", "warranty", "ลงทะเบียนประกัน", "warranty"]);
    nav.push(["customers.html", "customers", "สรุปลูกค้า", "customers"]);
    if (S.isOwner()) nav.push(["bot-replies.html", "botreplies", "คำตอบของบอท", "botreplies"]);
    if (S.isOwner()) nav.push(["import.html", "import", "นำเข้าสินค้า (AI)", "inventory"]);
    if (S.isOwner()) nav.push(["staff.html", "staff", "จัดการทีมงาน", "staff"]);

    var roleTag = sess.role === "owner" ? "แอดมิน" : "พนักงาน";
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

    mountBackToTop();
  }

  /* floating "back to top" button — appears once the page is scrolled down */
  function mountBackToTop() {
    if (document.querySelector(".back-to-top")) return;
    var btn = document.createElement("button");
    btn.className = "back-to-top";
    btn.type = "button";
    btn.setAttribute("aria-label", "กลับขึ้นบนสุด");
    btn.title = "กลับขึ้นบนสุด";
    btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6"/><path d="M5 12l7-7 7 7"/></svg>';
    btn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
    document.body.appendChild(btn);
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      btn.classList.toggle("show", y > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
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

    // ขายดี + คะแนนรีวิว — รวมยอดขายต่อสินค้าจากออเดอร์ (ไม่นับที่ยกเลิก) คู่กับดาวเฉลี่ย
    var bsBox = document.querySelector("[data-bestsellers]");
    if (bsBox) {
      var sold = {};
      S.getOrders().forEach(function (o) {
        if (o.status === "cancelled") return;
        (o.items || []).forEach(function (it) {
          if (!it.productId) return;
          var s = sold[it.productId] || (sold[it.productId] = { qty: 0, rev: 0 });
          s.qty += it.qty || 0; s.rev += (it.unitPrice || 0) * (it.qty || 0) * (it.days || 1);
        });
      });
      var rows = S.getProducts().map(function (p) {
        var s = sold[p.id] || { qty: 0, rev: 0 }, r = S.productRating(p);
        return { p: p, qty: s.qty, rev: s.rev, avg: r.avg, cnt: r.count };
      }).sort(function (a, b) { return b.qty - a.qty || b.rev - a.rev; });
      bsBox.innerHTML =
        "<thead><tr><th>สินค้า</th><th class=num>ขายไป</th><th class=num>ยอดขาย</th><th>คะแนนรีวิว</th></tr></thead><tbody>" +
        (rows.length ? rows.map(function (x) {
          var stars = ""; var f = Math.round(x.avg); for (var i = 1; i <= 5; i++) stars += '<span style="color:' + (i <= f ? "#F5A623" : "#ccc") + '">★</span>';
          return "<tr><td><b>" + esc(x.p.name) + "</b><br><span class=prod-sku>" + esc(S.categoryLabel(x.p.category)) + "</span></td>" +
            '<td class="num">' + x.qty + " ชิ้น</td>" +
            '<td class="num">' + S.money(x.rev) + "</td>" +
            "<td>" + stars + " " + (x.cnt ? '<span class="prod-sku">' + x.avg.toFixed(1) + " (" + x.cnt + ")</span>" : '<span class="prod-sku">ยังไม่มีรีวิว</span>') + "</td></tr>";
        }).join("") : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--fg-2)">ยังไม่มีข้อมูล</td></tr>') + "</tbody>";
    }
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
    var state = { q: "", cat: "", noloc: false };
    var search = document.querySelector("[data-search]");
    var catSel = document.querySelector("[data-catfilter]");
    var nolocChk = document.querySelector("[data-noloc]");
    var nolocCount = document.querySelector("[data-noloc-count]");
    catSel.innerHTML = '<option value="">ทุกหมวด</option>' + S.CATEGORIES.map(function (c) { return '<option value="' + c.key + '">' + c.label + "</option>"; }).join("");
    // a product has "no storage location" if location is blank or the placeholder
    function noLoc(p) { var l = (p.location || "").trim(); return !l || l === "ยังไม่ระบุ"; }
    search.addEventListener("input", function () { state.q = search.value.trim().toLowerCase(); render(); });
    catSel.addEventListener("change", function () { state.cat = catSel.value; render(); });
    if (nolocChk) nolocChk.addEventListener("change", function () { state.noloc = nolocChk.checked; render(); });
    document.querySelector("[data-add]").addEventListener("click", function () { openProductModal(null); });
    var syncBtn = document.querySelector("[data-sync-bot]");
    if (syncBtn) syncBtn.addEventListener("click", function () { syncCatalogToCloud(syncBtn); });

    function render() {
      var alertBox = document.querySelector("[data-alert]");
      var lowAll = S.getProducts().filter(function (p) { return S.available(p) <= 3; });
      alertBox.innerHTML = lowAll.length ? "⚠ มีสินค้าใกล้หมด <b>" + lowAll.length + "</b> รายการ — ควรเติมสต็อก" : "";
      alertBox.style.display = lowAll.length ? "block" : "none";

      // keep the "no location" badge count in sync with the whole catalog
      if (nolocCount) {
        var nl = S.getProducts().filter(noLoc).length;
        nolocCount.textContent = nl ? "(" + nl + ")" : "";
      }

      var list = S.getProducts().filter(function (p) {
        if (state.cat && p.category !== state.cat) return false;
        if (state.noloc && !noLoc(p)) return false;
        if (state.q) { var h = (p.name + " " + p.brand + " " + p.sku + " " + p.location).toLowerCase(); if (h.indexOf(state.q) < 0) return false; }
        return true;
      });
      var tb = document.querySelector("[data-invtable]");
      tb.innerHTML =
        "<thead><tr><th>สินค้า</th><th>หมวด</th><th class=num>คงเหลือ</th><th class=num>เช่าอยู่</th><th>ที่จัดเก็บ</th><th class=num>ต้นทุน</th><th class=num>ราคาขาย</th><th class=num>เช่า/วัน</th><th>จัดการ</th></tr></thead><tbody>" +
        list.map(function (p) {
          var av = S.available(p);
          return "<tr" + (p.hidden ? ' style="opacity:.45"' : "") + ">" +
            '<td><div class="prod-cell">' + miniVisual(p) +
              '<div><div class="prod-name">' + p.name + (p.hidden ? ' <span style="font-size:11px;color:#c00;font-weight:700">[ซ่อน]</span>' : "") + '</div><div class="prod-sku">' + p.sku + " · " + p.brand + " · " + saleRent(p) + "</div></div></div></td>" +
            "<td>" + S.categoryLabel(p.category) + "</td>" +
            '<td class="num"><span class="stock-n ' + (av <= 3 ? "low" : "") + '">' + av + "</span></td>" +
            '<td class="num"><span class="rented-n">' + (p.rented || 0) + "</span></td>" +
            '<td><span class="loc-tag">' + p.location + "</span></td>" +
            '<td class="num">' + S.money(p.cost) + "</td>" +
            '<td class="num">' + (p.forSale ? S.money(p.price) : "—") + "</td>" +
            '<td class="num">' + (p.forRent ? S.money(p.rentPerDay) : "—") + "</td>" +
            '<td><div class="row-actions">' +
              '<button class="btn btn-sm btn-ghost" data-edit="' + p.id + '">แก้ไข</button>' +
              '<button class="btn btn-sm btn-ghost" data-hideprod="' + p.id + '">' + (p.hidden ? "แสดง" : "ซ่อน") + "</button>" +
              '<button class="btn btn-sm" data-restock="' + p.id + '">+สต็อก</button>' +
              (S.hasPerm("inventory_delete") ? '<button class="btn btn-sm btn-danger" data-del="' + p.id + '">ลบ</button>' : "") +
            "</div></td></tr>";
        }).join("") + "</tbody>";

      tb.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { openProductModal(S.getProduct(b.dataset.edit)); }; });
      tb.querySelectorAll("[data-hideprod]").forEach(function (b) { b.onclick = function () { var pr = S.getProduct(b.dataset.hideprod); if (!pr) return; S.saveProduct(Object.assign({}, pr, { hidden: !pr.hidden })); U.toast(pr.hidden ? "แสดงสินค้าแล้ว" : "ซ่อนสินค้าแล้ว", "ok"); render(); }; });
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

  // ซิงค์แคตตาล็อกขึ้น cloud ด้วยมือ — เขียนทุก doc สินค้า (products/{id} รวมรูป) ให้หน้าร้านลูกค้า
  // อ่าน + เอกสารรวม products/catalog (ตัดรูปออก) ให้บอท LINE. auto-sync ทำงานตอนบันทึกอยู่แล้ว
  // จึงเหลือไว้สำหรับ "อัปโหลดสินค้าเดิมครั้งแรก" หรือดันซ้ำเมื่อมีปัญหา
  function syncCatalogToCloud(btn) {
    if (!S.cloudSyncAllProducts) { U.toast("ฟังก์ชันซิงค์ยังไม่พร้อม — ลองรีโหลดหน้า", "err"); return; }
    var origText = btn.textContent;
    btn.disabled = true;
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
      done("Timeout — ดู Console (F12) ว่าค้างขั้นไหน (อาจตั้ง Firebase Config / เปิด Anonymous Auth ยัง)", "err");
    }, 120000);

    btn.textContent = "กำลังซิงค์…";
    S.cloudSyncAllProducts(function (i, total) {
      if (!finished) btn.textContent = "ซิงค์ " + i + "/" + total + "…";
    }).then(function (count) {
      done("ซิงค์สินค้า " + count + " รายการขึ้น cloud แล้ว (รวมรูป + อัปเดตบอท LINE) ✓", "ok");
    }).catch(function (e) {
      var code = e && e.code ? " [" + e.code + "]" : "";
      done("ซิงค์ไม่สำเร็จ" + code + ": " + (e && e.message || e), "err");
    });
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

    var state = { messages: [], byUser: {}, activeUid: null, unsub: null, unsubProfiles: null, unsubSessions: null, prevCount: 0, fs: null, profiles: {}, sessions: {}, search: "", tab: "open" };
    // เวลาข้อความล่าสุด "จากลูกค้า" ของบทสนทนา (ไว้เทียบกับเวลาที่ปิด → เด้งกลับเองถ้าทักใหม่)
    function lastCustomerAt(c) {
      var t = "";
      (c.messages || []).forEach(function (m) {
        var isUser = !m.role || m.role === "user";
        if (isUser && (m.at || "") > t) t = m.at || "";
      });
      return t;
    }
    // บทสนทนา "ปิดแล้ว (เสร็จ)" = ถูกกดปิด และลูกค้ายังไม่ทักกลับมาหลังปิด
    function convClosed(c) {
      var s = state.sessions[c.userId];
      if (!s || !s.closed) return false;
      var closedAt = s.closedAt || "";
      return lastCustomerAt(c) <= closedAt; // ถ้าทักหลังปิด → ไม่ถือว่าปิด (เด้งกลับ)
    }
    function convReengaged(c) {
      var s = state.sessions[c.userId];
      return !!(s && s.closed && lastCustomerAt(c) > (s.closedAt || ""));
    }
    function closeCustomer(uid) {
      if (!state.fs) return;
      var fs = state.fs;
      fs.setDoc(fs.doc(fs.db, "bot_sessions", uid), { closed: true, closedAt: new Date().toISOString(), updatedAt: fs.serverTimestamp() }, { merge: true })
        .then(function () { if (window.U && U.toast) U.toast("ปิดลูกค้าแล้ว — ย้ายไปช่อง \"เสร็จแล้ว\"", "ok"); })
        .catch(function (err) { if (window.U && U.toast) U.toast("ปิดไม่สำเร็จ: " + err.message, "err"); });
    }
    function reopenCustomer(uid) {
      if (!state.fs) return;
      var fs = state.fs;
      fs.setDoc(fs.doc(fs.db, "bot_sessions", uid), { closed: false, updatedAt: fs.serverTimestamp() }, { merge: true })
        .then(function () { if (window.U && U.toast) U.toast("เปิดลูกค้ากลับมาแล้ว", "ok"); })
        .catch(function (err) { if (window.U && U.toast) U.toast("เปิดไม่สำเร็จ: " + err.message, "err"); });
    }

    if (refresh) refresh.addEventListener("click", function () {
      // listener อัปเดตเองอยู่แล้ว — ปุ่มนี้กลายเป็นปุ่ม re-subscribe เผื่อ connection ขาด
      if (state.unsub) { try { state.unsub(); } catch (e) {} state.unsub = null; }
      load();
    });
    // ค้นหาลูกค้า — กรองรายการบทสนทนาแบบเรียลไทม์
    var searchInput = document.querySelector("[data-search]");
    if (searchInput) searchInput.addEventListener("input", function () {
      state.search = (searchInput.value || "").trim().toLowerCase();
      if (state.messages.length) groupAndRender();
    });
    // แท็บ ต้องดูแล / เสร็จแล้ว
    document.querySelectorAll("[data-conv-tabs] [data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.tab = btn.getAttribute("data-tab");
        document.querySelectorAll("[data-conv-tabs] [data-tab]").forEach(function (b) { b.classList.toggle("on", b === btn); });
        state.activeUid = null;
        if (state.messages.length) groupAndRender();
      });
    });

    // reply bar — แอดมินตอบลูกค้าตรงในหน้า bot-inbox
    var replyInput = document.querySelector("[data-reply-input]");
    var replySend = document.querySelector("[data-reply-send]");
    if (replySend) replySend.addEventListener("click", sendReply);
    if (replyInput) replyInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
    });
    var replyImg = document.querySelector("[data-reply-img]");
    var replyImgBtn = document.querySelector("[data-reply-img-btn]");
    var replyStage = document.querySelector("[data-reply-stage]");
    var pendingReplyImg = ""; // รูปที่เลือกไว้ (ยังไม่ส่ง) — รอกดส่งพร้อมข้อความ
    if (replyImgBtn && replyImg) replyImgBtn.addEventListener("click", function () { replyImg.click(); });
    if (replyImg) replyImg.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      e.target.value = "";
      readImageFile(f, function (dataUrl) { pendingReplyImg = dataUrl; renderReplyStage(); });
    });
    function renderReplyStage() {
      if (!replyStage) return;
      if (!pendingReplyImg) { replyStage.style.display = "none"; replyStage.innerHTML = ""; return; }
      replyStage.style.display = "block";
      replyStage.innerHTML = '<div style="display:inline-flex;align-items:flex-start;gap:6px;position:relative">' +
        '<img src="' + pendingReplyImg + '" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid #ccc;display:block">' +
        '<button type="button" data-reply-imgclr style="position:absolute;top:-8px;right:-8px;width:22px;height:22px;border-radius:50%;border:none;background:#e11;color:#fff;font-size:14px;cursor:pointer">×</button></div>' +
        '<div style="font-size:12px;color:#888;margin-top:2px">รูปแนบ — พิมพ์ข้อความแล้วกดส่ง หรือกดส่งรูปอย่างเดียว</div>';
      var clr = replyStage.querySelector("[data-reply-imgclr]");
      if (clr) clr.onclick = function () { pendingReplyImg = ""; renderReplyStage(); };
    }
    load();

    function sendReply() {
      if (!state.activeUid) return;
      var text = (replyInput.value || "").trim();
      var image = pendingReplyImg;
      if (!text && !image) return; // ไม่มีทั้งข้อความและรูป
      replySend.disabled = true;
      var payload = { userId: state.activeUid };
      if (text) payload.text = text;
      if (image) payload.image = image;
      // แนบ Firebase ID token เพื่อให้ API ตรวจ admin uid
      var getToken = state.getIdToken ? state.getIdToken() : Promise.resolve("");
      getToken.then(function (token) {
        return fetch("/api/admin-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify(payload),
        });
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (r) {
          replySend.disabled = false;
          if (!r.ok) {
            if (r.body.error === "not-admin") {
              if (window.U && U.toast) U.toast("ยังไม่ใช่ admin — เพิ่ม admins/" + (r.body.uid || state.adminUid) + " ใน Firebase Console", "err");
            } else if (r.body.error === "missing-auth" || r.body.error === "invalid-token" || r.body.error === "expired-token") {
              if (window.U && U.toast) U.toast("Auth หมดอายุ — รีเฟรชหน้าเว็บ", "err");
            } else {
              if (window.U && U.toast) U.toast("ส่งไม่สำเร็จ: " + (r.body.error || ""), "err");
            }
            return;
          }
          replyInput.value = "";
          pendingReplyImg = ""; renderReplyStage();
          replyInput.focus();
          if (r.body.linePushed && window.U && U.toast) U.toast("ส่งเข้า LINE ลูกค้าแล้ว ✓", "ok");
        })
        .catch(function (e) {
          replySend.disabled = false;
          if (window.U && U.toast) U.toast("เครือข่ายผิดพลาด: " + (e.message || e), "err");
        });
    }

    function pauseBotFor(uid) {
      if (!state.fs) return;
      var fs = state.fs;
      fs.setDoc(fs.doc(fs.db, "bot_sessions", uid), {
        mode: "human", updatedAt: fs.serverTimestamp()
      }, { merge: true })
        .then(function () { if (window.U && U.toast) U.toast("ปิดบอท — ลูกค้าจะคุยกับแอดมิน", "ok"); })
        .catch(function (err) { if (window.U && U.toast) U.toast("ปิดบอทไม่สำเร็จ: " + err.message, "err"); });
    }

    function resumeBotFor(uid) {
      var getToken = state.getIdToken ? state.getIdToken() : Promise.resolve("");
      getToken.then(function (token) {
        return fetch("/api/admin-reply?action=resume", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({ userId: uid }),
        });
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (r) {
          if (r.ok) { if (window.U && U.toast) U.toast("เปิดบอทแล้ว — ลูกค้าย้ายไปช่องบอทตอบ", "ok"); }
          else if (r.body.error === "not-admin") { if (window.U && U.toast) U.toast("ยังไม่ใช่ admin — เพิ่ม admins/" + state.adminUid + " ใน Firebase Console", "err"); }
          else { if (window.U && U.toast) U.toast("เปิดบอทไม่สำเร็จ: " + (r.body.error || ""), "err"); }
        })
        .catch(function (e) {
          if (window.U && U.toast) U.toast("เครือข่ายผิดพลาด: " + (e.message || e), "err");
        });
    }

    function load() {
      alert("กำลังโหลดข้อความ…");
      // ใช้ Firestore modular SDK + onSnapshot — อัปเดตเรียลไทม์ไม่ต้องกดรีเฟรช
      var cfg = window.parseFbConfig ? window.parseFbConfig(S.firebaseCfg ? S.firebaseCfg() : "") : null;
      if (!cfg) { alert("ยังไม่ได้ตั้ง Firebase Config ในหน้า ตั้งค่าเว็บไซต์", "err"); return; }
      var base = "https://www.gstatic.com/firebasejs/10.12.2/";
      Promise.all([
        import(base + "firebase-app.js"),
        import(base + "firebase-auth.js"),
        import(base + "firebase-firestore.js")
      ]).then(function (mods) {
        var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
        var app;
        // ใช้ชื่อ "admin" เดียวกันทุก admin page → uid คงที่ข้ามหน้า
        try { app = appMod.getApp("admin"); }
        catch (e) { app = appMod.initializeApp(cfg, "admin"); }
        var authInst = authMod.getAuth(app);
        return authMod.signInAnonymously(authInst).then(function (cred) {
          var db = fsMod.getFirestore(app, "default");
          state.adminUid = cred.user.uid;
          state.getIdToken = function () { return cred.user.getIdToken(); };
          // โชว์ admin uid + ปุ่ม "เพิ่มฉันเป็น admin" — เฉพาะ "เจ้าของร้าน" เท่านั้น
          var uidBox = document.querySelector("[data-admin-uid]");
          if (uidBox && S.isOwner()) {
            uidBox.style.display = "block";
            uidBox.querySelector("[data-uid-val]").textContent = cred.user.uid;
            var copyBtn = uidBox.querySelector("[data-uid-copy]");
            if (copyBtn) copyBtn.onclick = function () {
              navigator.clipboard.writeText(cred.user.uid).then(function () {
                copyBtn.textContent = "คัดลอกแล้ว ✓";
                setTimeout(function () { copyBtn.textContent = "คัดลอก"; }, 1500);
              });
            };
            // ปุ่ม "เพิ่มฉันเป็น admin" — เขียน doc admins/{uid} ตรงจาก browser (bootstrap)
            var claimBtn = uidBox.querySelector("[data-uid-claim]");
            var claimStatus = uidBox.querySelector("[data-uid-claim-status]");
            if (claimBtn) claimBtn.onclick = function () {
              claimBtn.disabled = true;
              claimStatus.textContent = "กำลังเพิ่ม…";
              fsMod.setDoc(fsMod.doc(db, "admins", cred.user.uid), {
                addedAt: fsMod.serverTimestamp(),
                via: "self-bootstrap"
              }).then(function () {
                claimStatus.textContent = "✓ เพิ่มแล้ว — รีเฟรชหน้านี้ (Ctrl+Shift+R)";
                claimStatus.style.color = "#1b5e20";
                if (window.U && U.toast) U.toast("เพิ่มเป็น admin แล้ว — รีเฟรชเพื่อให้ทุกอย่างทำงาน", "ok");
              }).catch(function (err) {
                claimStatus.textContent = "ผิดพลาด: " + (err.message || err);
                claimStatus.style.color = "#a00";
                claimBtn.disabled = false;
              });
            };
          }
          // เก็บ helpers ที่ sendReply / promptRename ใช้ — ไม่ต้องโหลด SDK ซ้ำ
          state.fs = {
            db: db,
            collection: fsMod.collection,
            addDoc: fsMod.addDoc,
            doc: fsMod.doc,
            setDoc: fsMod.setDoc,
            deleteField: fsMod.deleteField,
            serverTimestamp: fsMod.serverTimestamp
          };
          // ฟัง customer_profiles เพื่อให้ชื่อลูกค้าอัปเดตเรียลไทม์
          var profCol = fsMod.collection(db, "customer_profiles");
          state.unsubProfiles = fsMod.onSnapshot(profCol, function (ps) {
            var map = {};
            ps.docs.forEach(function (d) { map[d.id] = d.data() || {}; });
            state.profiles = map;
            if (state.messages.length) groupAndRender();
          }, function (err) { console.warn("[profiles listener]", err); });
          // ฟัง bot_sessions — รู้ว่าใครอยู่โหมด human (รอเจ้าของตอบ) vs ai (บอทตอบเอง)
          var sessCol = fsMod.collection(db, "bot_sessions");
          state.unsubSessions = fsMod.onSnapshot(sessCol, function (ss) {
            var map = {};
            ss.docs.forEach(function (d) { map[d.id] = d.data() || {}; });
            state.sessions = map;
            if (state.messages.length) groupAndRender();
          }, function (err) { console.warn("[sessions listener]", err); });
          var col = fsMod.collection(db, "bot_messages");
          state.unsub = fsMod.onSnapshot(col, function (snap) {
            alert("");
            state.messages = snap.docs.map(function (d) {
              var f = d.data() || {};
              var atStr = "";
              if (f.at && typeof f.at.toDate === "function") atStr = f.at.toDate().toISOString();
              else if (f.at) atStr = String(f.at);
              return {
                userId: f.userId || "",
                role: f.role || "",
                text: f.text || "",
                reply: f.reply || "",
                image: f.image || "",
                video: f.video || "",
                source: f.source || "line",
                at: atStr
              };
            }).sort(function (a, b) { return (b.at || "").localeCompare(a.at || ""); });
            // แจ้ง toast เมื่อมีข้อความใหม่ (ครั้งแรก prevCount=0 ไม่แจ้ง)
            if (state.prevCount > 0 && state.messages.length > state.prevCount) {
              var diff = state.messages.length - state.prevCount;
              if (window.U && U.toast) U.toast("มีข้อความใหม่ " + diff + " ข้อความ", "ok");
            }
            state.prevCount = state.messages.length;
            groupAndRender();
          }, function (err) {
            var code = err && err.code ? " [" + err.code + "]" : "";
            alert("โหลดไม่สำเร็จ" + code + ": " + (err.message || err), "err");
            renderEmpty();
          });
        });
      }).catch(function (e) {
        var code = e && e.code ? " [" + e.code + "]" : "";
        alert("เชื่อม Firebase ไม่สำเร็จ" + code + ": " + (e.message || e), "err");
        renderEmpty();
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

      // conversation list — แยก 2 ช่อง: รอเจ้าของตอบ (human mode) vs บอทตอบเอง
      var convs = Object.values(byUser).sort(function (a, b) { return (b.lastAt || "").localeCompare(a.lastAt || ""); });
      var list = document.querySelector("[data-convs]");
      if (!convs.length) {
        list.innerHTML = '<div class="thread-empty">ยังไม่มีลูกค้าทักบอท</div>';
        renderEmpty();
        return;
      }
      // กรองด้วย search — เช็คในชื่อเล่น, ID, ทุก text + reply ในบทสนทนา
      var q = state.search;
      if (q) {
        convs = convs.filter(function (c) {
          var nick = (state.profiles[c.userId] && state.profiles[c.userId].nickname || "").toLowerCase();
          if (nick.indexOf(q) >= 0) return true;
          if (c.userId.toLowerCase().indexOf(q) >= 0) return true;
          for (var i = 0; i < c.messages.length; i++) {
            var m = c.messages[i];
            if ((m.text || "").toLowerCase().indexOf(q) >= 0) return true;
            if ((m.reply || "").toLowerCase().indexOf(q) >= 0) return true;
          }
          return false;
        });
      }

      // แยก "ปิดแล้ว (เสร็จ)" ออกจาก "ต้องดูแล (เปิด)" — เด้งกลับเองถ้าลูกค้าทักหลังปิด
      var openConvs = convs.filter(function (c) { return !convClosed(c); });
      var doneConvs = convs.filter(function (c) { return convClosed(c); });
      var on = document.querySelector("[data-tab-open-n]"); if (on) on.textContent = openConvs.length;
      var dn = document.querySelector("[data-tab-closed-n]"); if (dn) dn.textContent = doneConvs.length;

      if (state.tab === "closed") {
        list.innerHTML = '<div class="conv-section">' +
          '<div class="conv-section-head"><span>✓ เสร็จแล้ว</span><span>' + doneConvs.length + '</span></div>' +
          (doneConvs.length ? doneConvs.map(rowHtml).join("") : '<div class="conv-section-empty">ยังไม่มีที่ปิด</div>') + '</div>';
      } else {
        var humanConvs = openConvs.filter(function (c) { return state.sessions[c.userId] && state.sessions[c.userId].mode === "human"; });
        var botConvs   = openConvs.filter(function (c) { return !state.sessions[c.userId] || state.sessions[c.userId].mode !== "human"; });
        list.innerHTML =
          '<div class="conv-section human">' +
            '<div class="conv-section-head"><span>🔴 รอแอดมินตอบ</span><span>' + humanConvs.length + '</span></div>' +
            (humanConvs.length ? humanConvs.map(rowHtml).join("") : '<div class="conv-section-empty">ไม่มีลูกค้ารออยู่</div>') +
          '</div>' +
          '<div class="conv-section bot">' +
            '<div class="conv-section-head"><span>🤖 บอทตอบเอง</span><span>' + botConvs.length + '</span></div>' +
            (botConvs.length ? botConvs.map(rowHtml).join("") : '<div class="conv-section-empty">ไม่มีลูกค้าใหม่</div>') +
          '</div>';
      }
      var tabConvs = state.tab === "closed" ? doneConvs : openConvs;

      list.querySelectorAll("[data-uid]").forEach(function (row) {
        row.addEventListener("click", function (e) {
          // คลิกที่ปุ่มในแถว อย่าให้สลับบทสนทนา
          if (e.target.closest("[data-toggle-bot],[data-close-cust],[data-reopen-cust]")) return;
          list.querySelectorAll(".conv-row").forEach(function (r) { r.classList.remove("on"); });
          row.classList.add("on");
          state.activeUid = row.dataset.uid;
          renderThread(state.activeUid);
        });
      });
      list.querySelectorAll("[data-toggle-bot]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var uid = btn.getAttribute("data-toggle-bot");
          var action = btn.getAttribute("data-action");
          if (action === "pause") pauseBotFor(uid);
          else resumeBotFor(uid);
        });
      });
      list.querySelectorAll("[data-close-cust]").forEach(function (btn) {
        btn.addEventListener("click", function (e) { e.stopPropagation(); closeCustomer(btn.getAttribute("data-close-cust")); });
      });
      list.querySelectorAll("[data-reopen-cust]").forEach(function (btn) {
        btn.addEventListener("click", function (e) { e.stopPropagation(); reopenCustomer(btn.getAttribute("data-reopen-cust")); });
      });

      // auto-select: คงบทสนทนาที่เปิดอยู่ ถ้าไม่มี → เลือกตัวแรกของแท็บปัจจุบัน
      if (!state.activeUid || !byUser[state.activeUid]) {
        state.activeUid = (tabConvs[0] || convs[0]).userId;
      }
      var firstRow = list.querySelector('[data-uid="' + cssEsc(state.activeUid) + '"]');
      if (firstRow) { firstRow.classList.add("on"); renderThread(state.activeUid); }
    }

    function rowHtml(c) {
      var when = fmtRelative(c.lastAt);
      var nameTag = c.userId.slice(-8);
      var nick = (state.profiles[c.userId] && state.profiles[c.userId].nickname) || "";
      var customerMsgs = c.messages.filter(function (m) { return !m.role || m.role === "user"; });
      var lastSrc = (customerMsgs[0] && customerMsgs[0].source) || "line";
      var srcBadge = lastSrc === "web"
        ? '<span style="background:#e8f5e9;color:#1b5e20;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:600">เว็บ</span>'
        : '<span style="background:#06c755;color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:600">LINE</span>';
      var displayName = nick ? esc(nick) : '…' + esc(nameTag);
      var inHuman = state.sessions[c.userId] && state.sessions[c.userId].mode === "human";
      var toggleBtn = inHuman
        ? '<button class="resume" data-toggle-bot="' + esc(c.userId) + '" data-action="resume" type="button">เปิดบอท</button>'
        : '<button class="pause" data-toggle-bot="' + esc(c.userId) + '" data-action="pause" type="button">ปิดบอท</button>';
      // ปุ่มปิด/เปิดลูกค้า (จบการขาย). ถ้าทักกลับมาหลังปิด แสดงป้ายเตือน
      var isDone = state.sessions[c.userId] && state.sessions[c.userId].closed && lastCustomerAt(c) <= (state.sessions[c.userId].closedAt || "");
      var reeng = convReengaged(c);
      var closeBtn = isDone
        ? '<button class="resume" data-reopen-cust="' + esc(c.userId) + '" type="button">↩ เปิดใหม่</button>'
        : '<button class="pause" data-close-cust="' + esc(c.userId) + '" type="button" title="ปิดเมื่อขายเสร็จ">✓ ปิด</button>';
      var reengBadge = reeng ? '<span style="background:var(--price-red,#D7261E);color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;font-weight:700">💬 ทักกลับมา</span> ' : "";
      return '<div class="conv-row' + (reeng ? " reengaged" : "") + '" data-uid="' + esc(c.userId) + '">' +
        '<div class="who"><span>' + reengBadge + srcBadge + ' ' + displayName + '</span><span>' + c.messages.length + ' ข้อความ</span></div>' +
        '<div class="last">' + esc(c.lastText) + '</div>' +
        '<div class="meta"><span>' + when + '</span><span class="conv-actions">' + toggleBtn + " " + closeBtn + '</span></div>' +
        '</div>';
    }

    function renderEmpty() {
      document.querySelector("[data-thread]").innerHTML = '<div class="thread-empty">ยังไม่มีบทสนทนา</div>';
      var bar = document.querySelector("[data-reply-bar]");
      if (bar) bar.style.display = "none";
    }

    function renderThread(uid) {
      try { renderThreadInner(uid); }
      catch (e) {
        console.error("[renderThread]", e && e.message);
        var box = document.querySelector("[data-thread]");
        if (box) box.innerHTML = '<div class="thread-empty">แสดงบทสนทนาไม่สำเร็จ — ลองรีเฟรช</div>';
      }
    }
    function renderThreadInner(uid) {
      var conv = state.byUser[uid];
      var box = document.querySelector("[data-thread]");
      var bar = document.querySelector("[data-reply-bar]");
      if (!conv) {
        box.innerHTML = '<div class="thread-empty">เลือกบทสนทนาทางซ้าย</div>';
        if (bar) bar.style.display = "none";
        return;
      }
      if (bar) bar.style.display = "flex";
      var pairs = conv.messages.slice().sort(function (a, b) { return (a.at || "").localeCompare(b.at || ""); });
      var bubbles = [];
      pairs.forEach(function (m) {
        if (m.role) {
          bubbles.push({ side: m.role === "user" ? "left" : "right", role: m.role, text: m.text || "", image: m.image || "", video: m.video || "", at: m.at });
        } else {
          if (m.text || m.image || m.video) bubbles.push({ side: "left", role: "user", text: m.text || "", image: m.image || "", video: m.video || "", at: m.at });
          if (m.reply) bubbles.push({ side: "right", role: "bot", text: m.reply, at: m.at });
        }
      });
      var roleLabel = { user: "ลูกค้า", admin: "แอดมิน", bot: "บอท" };
      var nick = (state.profiles[uid] && state.profiles[uid].nickname) || "ลูกค้า";
      box.innerHTML =
        '<div class="thread-head">' +
          '<div class="thread-name">' +
            '<span>👤</span>' +
            '<b data-nick>' + esc(nick) + '</b>' +
            '<button class="edit-name" data-edit-nick title="แก้ไขชื่อ (ID ไม่เปลี่ยน)">✎ แก้ชื่อ</button>' +
            '<span class="thread-id">ID: …' + esc(uid.slice(-12)) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="thread-body">' +
          bubbles.map(function (b) {
            var bubbleClass = b.role === "bot" ? "bot" : b.side;
            var inner = (b.video ? '<video class="bubble-img" src="' + esc(b.video) + '" controls preload="metadata" playsinline></video>' : "") +
              (b.image ? '<a href="' + esc(b.image) + '" target="_blank" rel="noopener"><img class="bubble-img" src="' + esc(b.image) + '" alt="รูป" loading="lazy"></a>' : "") +
              (b.text ? '<div>' + esc(b.text) + "</div>" : "");
            return '<div class="bubble-row ' + b.side + '">' +
              '<div class="bubble-col">' +
                '<div class="bubble-role">' + esc(roleLabel[b.role] || "") + '</div>' +
                '<div class="bubble ' + bubbleClass + (b.image ? " has-img" : "") + '">' + inner + '</div>' +
                '<div class="bubble-meta">' + fmtAbsolute(b.at) + '</div>' +
              '</div>' +
              '</div>';
          }).join("") +
        '</div>';
      var editBtn = box.querySelector("[data-edit-nick]");
      if (editBtn) editBtn.addEventListener("click", function () { promptRename(uid); });
      box.scrollTop = box.scrollHeight;
    }

    function promptRename(uid) {
      var current = (state.profiles[uid] && state.profiles[uid].nickname) || "";
      var next = prompt("ตั้งชื่อลูกค้านี้ (ID ไม่เปลี่ยน):", current);
      if (next === null) return; // cancel
      next = String(next).trim().slice(0, 80);
      if (!state.fs) { if (window.U && U.toast) U.toast("ยังเชื่อม Firebase ไม่สำเร็จ", "err"); return; }
      var fs = state.fs;
      var ref = fs.doc(fs.db, "customer_profiles", uid);
      var payload = next
        ? { nickname: next, updatedAt: fs.serverTimestamp() }
        : { nickname: fs.deleteField(), updatedAt: fs.serverTimestamp() };
      fs.setDoc(ref, payload, { merge: true })
        .then(function () { if (window.U && U.toast) U.toast(next ? "บันทึกชื่อแล้ว" : "ล้างชื่อแล้ว", "ok"); })
        .catch(function (err) { if (window.U && U.toast) U.toast("บันทึกไม่สำเร็จ: " + (err.message || err), "err"); });
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

  /* ===================== BOT REPLIES EDITOR (Phase B) ===================== */
  // เจ้าของร้านแก้คำตอบของบอท + คีย์เวิร์ดที่บอทใช้จับคำสั้นๆ จากข้อความลูกค้า
  // เก็บใน Firestore: bot_config/replies { greeting, fallback, rules: [{id,label,keywords[],answer}] }
  // line-webhook.js จะอ่านจาก doc นี้ (B4 ต่อจากนี้)
  function initBotReplies() {
    var alertBox = document.querySelector("[data-alert]");
    var greetingEl = document.querySelector("[data-greeting]");
    var fallbackEl = document.querySelector("[data-fallback]");
    var rulesBox = document.querySelector("[data-rules]");
    var addBtn = document.querySelector("[data-add]");
    var saveBtn = document.querySelector("[data-save]");
    var statusEl = document.querySelector("[data-status]");

    var state = { fs: null, config: null, dirty: false };

    function setAlert(msg, kind) {
      if (!msg) { alertBox.style.display = "none"; return; }
      alertBox.textContent = msg; alertBox.style.display = "block";
      alertBox.style.background = kind === "err" ? "#fee" : "#efe";
    }
    function setStatus(msg) { statusEl.textContent = msg || ""; }

    function defaultConfig() {
      return {
        rentEnabled: true,
        greeting: [
          "🛠️ สวัสดีครับ M.E.Tools ท่ารั้ว",
          "ยินดีต้อนรับ — แจ้งข้อมูลที่ต้องการสอบถามได้โดย",
          "",
          "🔧 อะไหล่ — แจ้งชื่อรุ่นสินค้าและอะไหล่ที่ต้องการ",
          "⚙️ การใช้งาน — แจ้งปัญหาที่เกิดขึ้น",
          "📦 สินค้า — แจ้งชื่อรุ่นสินค้าที่สนใจ",
          "💰 เช่า — เครื่องมือเช่ารายวัน",
          "",
          "ทางแอดมินจะตอบกลับเร็วที่สุดภายใน 24 ชม.",
          "",
          "⏰ เวลาทำการ จ.-ส. 8:00-17:00 / อา. 8:00-15:00",
          "",
          "📞 หากไม่มีการตอบกลับ ติดต่อได้ที่ 081-3706466",
        ].join("\n"),
        fallback: "ขอบคุณสำหรับข้อความครับ 🙏\nสนใจดูเครื่องมือหมวดไหนเป็นพิเศษครับ?",
        rules: [
          { id: genId(), label: "ราคา", keywords: ["ราคา", "เท่าไหร่", "เท่าไร", "กี่บาท"], answer: "ราคาตามรุ่นครับ ดูสินค้าทั้งหมดได้ที่ https://metoolsshop.vercel.app/shop.html 🛒" },
          { id: genId(), label: "เวลาเปิด", keywords: ["เปิด", "ปิด", "เวลา", "กี่โมง"], answer: "ร้านเปิด จันทร์–เสาร์ 8:00–17:00 / อาทิตย์ 8:00–15:00 ครับ" },
          { id: genId(), label: "ที่อยู่", keywords: ["ที่อยู่", "ร้านอยู่", "แผนที่"], answer: "199/6 ม.7 ต.สันปูเลย อ.ดอยสะเก็ด จ.เชียงใหม่ 50220" },
          { id: genId(), label: "ส่งสินค้า", keywords: ["ส่ง", "ขนส่ง", "ค่าส่ง"], answer: "ส่งทั่วประเทศครับ — ค่าส่งคิดตามขนาดสินค้า สอบถามตอบกลับได้ทันที 🚚" },
        ]
      };
    }

    function genId() { return "r" + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

    function load() {
      setAlert("กำลังโหลด…");
      var cfg = window.parseFbConfig ? window.parseFbConfig(S.firebaseCfg ? S.firebaseCfg() : "") : null;
      if (!cfg) { setAlert("ยังไม่ได้ตั้ง Firebase Config ในหน้า ตั้งค่าเว็บไซต์", "err"); return; }
      var base = "https://www.gstatic.com/firebasejs/10.12.2/";
      Promise.all([
        import(base + "firebase-app.js"),
        import(base + "firebase-auth.js"),
        import(base + "firebase-firestore.js")
      ]).then(function (mods) {
        var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
        var app;
        try { app = appMod.getApp("admin"); }
        catch (e) { app = appMod.initializeApp(cfg, "admin"); }
        var authInst = authMod.getAuth(app);
        return authMod.signInAnonymously(authInst).then(function () {
          var db = fsMod.getFirestore(app, "default");
          state.fs = {
            db: db,
            doc: fsMod.doc,
            getDoc: fsMod.getDoc,
            setDoc: fsMod.setDoc,
            serverTimestamp: fsMod.serverTimestamp
          };
          var ref = fsMod.doc(db, "bot_config", "replies");
          return fsMod.getDoc(ref);
        });
      }).then(function (snap) {
        setAlert("");
        if (snap && snap.exists && snap.exists()) {
          var data = snap.data() || {};
          // เก่าอาจไม่มี rules array / rentEnabled — default true เพื่อ backward compat
          state.config = {
            rentEnabled: typeof data.rentEnabled === "boolean" ? data.rentEnabled : true,
            greeting: data.greeting || "",
            fallback: data.fallback || "",
            rules: Array.isArray(data.rules) ? data.rules.map(function (r) {
              return { id: r.id || genId(), label: r.label || "", keywords: r.keywords || [], answer: r.answer || "" };
            }) : []
          };
        } else {
          state.config = defaultConfig();
          setAlert("ยังไม่มีการตั้งค่า — แสดงค่าเริ่มต้น (กดบันทึกเพื่อเริ่มใช้)", "ok");
        }
        render();
      }).catch(function (e) {
        var code = e && e.code ? " [" + e.code + "]" : "";
        setAlert("โหลดไม่สำเร็จ" + code + ": " + (e.message || e), "err");
      });
    }

    function updateRentBtn() {
      var btn = document.querySelector("[data-rent-toggle-btn]");
      var hint = document.querySelector("[data-rent-toggle-hint]");
      var rentCb = document.querySelector("[data-feat-rent]");
      var on = !!state.config.rentEnabled;
      if (rentCb) rentCb.checked = on;
      if (btn) { btn.textContent = on ? "✅ เปิดการเช่า — กดเพื่อปิด" : "🚫 ปิดการเช่า — กดเพื่อเปิด"; btn.style.background = on ? "var(--dw-yellow,#FFB81C)" : "#f0f0f0"; }
      if (hint) hint.textContent = on ? "ลูกค้าจะเห็นปุ่มเช่าและราคาเช่าตามปกติ" : "ปุ่มซื้อสินค้าขยายเต็มช่อง — ไม่มีคำว่าเช่าที่ไหนเลย";
    }

    function render() {
      updateRentBtn();
      greetingEl.value = state.config.greeting || "";
      fallbackEl.value = state.config.fallback || "";
      var rules = state.config.rules || [];
      if (!rules.length) {
        rulesBox.innerHTML = '<div class="br-empty">ยังไม่มีกฎ — กด "+ เพิ่มคีย์เวิร์ด"</div>';
        return;
      }
      rulesBox.innerHTML = rules.map(function (r, i) {
        return '<div class="br-rule" data-rid="' + esc(r.id) + '">' +
          '<div class="br-rule-head">' +
            '<input data-rule-label placeholder="ชื่อกฎ (เช่น ราคา)" value="' + esc(r.label) + '">' +
            '<button class="br-rule-del" type="button" data-del>ลบ</button>' +
          '</div>' +
          '<div class="br-field">' +
            '<label>คีย์เวิร์ด (คั่นด้วย , — เจอตัวใดตัวหนึ่งก็ใช้ได้)</label>' +
            '<input data-rule-kw placeholder="ราคา, เท่าไหร่, กี่บาท" value="' + esc((r.keywords || []).join(", ")) + '">' +
          '</div>' +
          '<div class="br-field">' +
            '<label>คำตอบ</label>' +
            '<textarea data-rule-ans placeholder="ราคาตามรุ่นครับ ดูได้ที่ shop.html">' + esc(r.answer) + '</textarea>' +
          '</div>' +
        '</div>';
      }).join("");
      // wire up delete buttons
      rulesBox.querySelectorAll(".br-rule").forEach(function (card) {
        card.querySelector("[data-del]").addEventListener("click", function () {
          var id = card.getAttribute("data-rid");
          state.config.rules = state.config.rules.filter(function (r) { return r.id !== id; });
          render();
        });
      });
    }

    function collectFromDom() {
      var rentCb = document.querySelector("[data-feat-rent]");
      state.config.rentEnabled = rentCb ? !!rentCb.checked : true;
      state.config.greeting = greetingEl.value.trim();
      state.config.fallback = fallbackEl.value.trim();
      var rules = [];
      rulesBox.querySelectorAll(".br-rule").forEach(function (card) {
        var id = card.getAttribute("data-rid");
        var label = card.querySelector("[data-rule-label]").value.trim();
        var kw = card.querySelector("[data-rule-kw]").value
          .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        var ans = card.querySelector("[data-rule-ans]").value.trim();
        if (!kw.length && !ans) return; // skip empty
        rules.push({ id: id || genId(), label: label, keywords: kw, answer: ans });
      });
      state.config.rules = rules;
    }

    function save() {
      if (!state.fs) { setAlert("ยังเชื่อม Firebase ไม่สำเร็จ", "err"); return; }
      collectFromDom();
      saveBtn.disabled = true;
      setStatus("กำลังบันทึก…");
      var fs = state.fs;
      var ref = fs.doc(fs.db, "bot_config", "replies");
      var sess = S.session() || {};
      fs.setDoc(ref, {
        rentEnabled: state.config.rentEnabled,
        greeting: state.config.greeting,
        fallback: state.config.fallback,
        rules: state.config.rules,
        updatedAt: fs.serverTimestamp(),
        updatedBy: sess.email || sess.name || "owner"
      }).then(function () {
        saveBtn.disabled = false;
        setStatus("บันทึกแล้ว ✓");
        setTimeout(function () { setStatus(""); }, 2500);
        if (U && U.toast) U.toast("บันทึกคำตอบของบอทเรียบร้อย", "ok");
      }).catch(function (e) {
        saveBtn.disabled = false;
        setStatus("");
        setAlert("บันทึกไม่สำเร็จ: " + (e.message || e), "err");
      });
    }

    addBtn.addEventListener("click", function () {
      collectFromDom();
      state.config.rules.push({ id: genId(), label: "", keywords: [], answer: "" });
      render();
    });
    saveBtn.addEventListener("click", save);

    var rentToggleBtn = document.querySelector("[data-rent-toggle-btn]");
    if (rentToggleBtn) rentToggleBtn.addEventListener("click", function () {
      collectFromDom();
      state.config.rentEnabled = !state.config.rentEnabled;
      updateRentBtn();
      save();
    });

    // ===== Web chat config (bot_config/web_replies) — แยกจาก LINE bot =====
    var webGreetingEl = document.querySelector("[data-web-greeting]");
    var webFallbackEl = document.querySelector("[data-web-fallback]");
    var webRulesBox = document.querySelector("[data-web-rules]");
    var webAddBtn = document.querySelector("[data-web-add]");
    var webSaveBtn = document.querySelector("[data-web-save]");
    var webStatusEl = document.querySelector("[data-web-status]");

    if (webGreetingEl && webRulesBox) {
      var webState = { config: { greeting: "", fallback: "", rules: [] } };

      function renderWebRules() {
        var rules = webState.config.rules || [];
        if (!rules.length) {
          webRulesBox.innerHTML = '<div class="br-empty">ยังไม่มีกฎเว็บแชท — กด "+ เพิ่มคีย์เวิร์ดเว็บ"</div>';
          return;
        }
        webRulesBox.innerHTML = rules.map(function (r) {
          return '<div class="br-rule" data-wrid="' + esc(r.id) + '">' +
            '<div class="br-rule-head">' +
              '<input data-wr-label placeholder="ชื่อกฎ" value="' + esc(r.label) + '">' +
              '<button class="br-rule-del" type="button" data-wdel>ลบ</button>' +
            '</div>' +
            '<div class="br-field"><label>คีย์เวิร์ด (คั่น ,)</label>' +
              '<input data-wr-kw value="' + esc((r.keywords || []).join(", ")) + '">' +
            '</div>' +
            '<div class="br-field"><label>คำตอบ</label>' +
              '<textarea data-wr-ans>' + esc(r.answer) + '</textarea>' +
            '</div>' +
          '</div>';
        }).join("");
        webRulesBox.querySelectorAll(".br-rule").forEach(function (card) {
          card.querySelector("[data-wdel]").addEventListener("click", function () {
            var id = card.getAttribute("data-wrid");
            webState.config.rules = webState.config.rules.filter(function (r) { return r.id !== id; });
            renderWebRules();
          });
        });
      }

      function collectWebFromDom() {
        webState.config.greeting = webGreetingEl.value.trim();
        webState.config.fallback = webFallbackEl.value.trim();
        var rules = [];
        webRulesBox.querySelectorAll(".br-rule").forEach(function (card) {
          var id = card.getAttribute("data-wrid");
          var label = card.querySelector("[data-wr-label]").value.trim();
          var kw = card.querySelector("[data-wr-kw]").value
            .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
          var ans = card.querySelector("[data-wr-ans]").value.trim();
          if (!kw.length && !ans) return;
          rules.push({ id: id || genId(), label: label, keywords: kw, answer: ans });
        });
        webState.config.rules = rules;
      }

      function loadWebConfig() {
        // wait for Firebase to be ready (re-use state.fs from LINE bot load)
        var wait = function () {
          if (!state.fs) { setTimeout(wait, 300); return; }
          var fs = state.fs;
          var ref = fs.doc(fs.db, "bot_config", "web_replies");
          fs.getDoc(ref).then(function (snap) {
            if (snap && snap.exists && snap.exists()) {
              var d = snap.data() || {};
              webState.config = {
                greeting: d.greeting || "",
                fallback: d.fallback || "",
                rules: Array.isArray(d.rules) ? d.rules.map(function (r) {
                  return { id: r.id || genId(), label: r.label || "", keywords: r.keywords || [], answer: r.answer || "" };
                }) : []
              };
            }
            webGreetingEl.value = webState.config.greeting;
            webFallbackEl.value = webState.config.fallback;
            renderWebRules();
          }).catch(function () { renderWebRules(); });
        };
        wait();
      }

      function saveWebConfig() {
        if (!state.fs) { return; }
        collectWebFromDom();
        webSaveBtn.disabled = true;
        webStatusEl.textContent = "กำลังบันทึก…";
        var fs = state.fs;
        var ref = fs.doc(fs.db, "bot_config", "web_replies");
        var sess = S.session() || {};
        fs.setDoc(ref, {
          greeting: webState.config.greeting,
          fallback: webState.config.fallback,
          rules: webState.config.rules,
          updatedAt: fs.serverTimestamp(),
          updatedBy: sess.email || sess.name || "owner"
        }).then(function () {
          webSaveBtn.disabled = false;
          webStatusEl.textContent = "บันทึกแล้ว ✓";
          setTimeout(function () { webStatusEl.textContent = ""; }, 2500);
          if (U && U.toast) U.toast("บันทึกการตั้งค่าเว็บแชทเรียบร้อย", "ok");
        }).catch(function (e) {
          webSaveBtn.disabled = false;
          webStatusEl.textContent = "";
          setAlert("บันทึกเว็บแชทไม่สำเร็จ: " + (e.message || e), "err");
        });
      }

      webAddBtn.addEventListener("click", function () {
        collectWebFromDom();
        webState.config.rules.push({ id: genId(), label: "", keywords: [], answer: "" });
        renderWebRules();
      });
      webSaveBtn.addEventListener("click", saveWebConfig);

      loadWebConfig();
    }

    load();
  }

  /* ===================== CUSTOMERS SUMMARY (Phase E completion) ===================== */
  // หน้า "ใครอยากได้อะไร / ยอดซื้อต่อคน"
  // อ่าน Firestore orders (ทั้งหมด) → จัด group by userId → คำนวณยอดรวม, จัดอันดับ
  // นับเฉพาะออเดอร์ที่ "ยืนยันแล้ว" (status != cancelled) เพื่อไม่ให้ออเดอร์ที่ยกเลิกมาทำให้สับสน
  /* ===================== WARRANTY (ลงทะเบียนประกัน) ===================== */
  function initWarranty() {
    var root = document.querySelector("[data-warranty-root]"); if (!root) return;
    var all = [], tab = "all", q = "";
    var listBox = root.querySelector("[data-wl-list]");
    var countEl = root.querySelector("[data-wl-count]");
    var searchEl = root.querySelector("[data-wl-search]");
    var canDelete = S.isOwner();
    if (searchEl) searchEl.addEventListener("input", function () { q = searchEl.value.trim().toLowerCase(); render(); });
    root.querySelectorAll("[data-wl-tab]").forEach(function (b) {
      b.addEventListener("click", function () { tab = b.getAttribute("data-wl-tab"); root.querySelectorAll("[data-wl-tab]").forEach(function (x) { x.classList.toggle("on", x === b); }); render(); });
    });
    if (S.subscribeWarranties) S.subscribeWarranties(function (list) { all = list || []; render(); });
    else if (listBox) listBox.innerHTML = '<div class="wl-empty">ต้องตั้งค่า Firebase ให้พร้อมก่อน</div>';

    function regLabel(r) { return r === "staff" ? "พนักงานลงให้" : "ลูกค้าลงเอง"; }
    function matches(w) {
      if (tab === "customer" && w.registrant === "staff") return false;
      if (tab === "staff" && w.registrant !== "staff") return false;
      if (!q) return true;
      var hay = [(w.firstName || "") + " " + (w.lastName || ""), w.phone, w.serial, w.model, w.brand, w.email, w.lineId, w.id].join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    }
    function render() {
      if (!listBox) return;
      var list = all.filter(matches);
      if (countEl) countEl.textContent = list.length + " รายการ" + (all.length ? " (จากทั้งหมด " + all.length + ")" : "");
      if (!list.length) { listBox.innerHTML = '<div class="wl-empty">' + (all.length ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีการลงทะเบียนประกัน") + "</div>"; return; }
      listBox.innerHTML = list.map(function (w) {
        var name = esc((w.firstName || "") + " " + (w.lastName || "")).trim() || "—";
        var when = w.createdAt ? fmtAbsolute(new Date(w.createdAt).toISOString()) : "";
        var badge = '<span class="wl-badge ' + (w.registrant === "staff" ? "staff" : "cust") + '">' + regLabel(w.registrant) + "</span>";
        return '<div class="wl-item" data-wl-id="' + esc(w.id) + '">' +
          '<div class="wl-item-main"><div class="wl-item-name">' + name + " " + badge + "</div>" +
          '<div class="wl-item-sub">📞 ' + esc(w.phone || "—") + " · " + esc(w.brand || "") + " " + esc(w.model || "") + (w.serial ? " · SN: " + esc(w.serial) : "") + "</div>" +
          '<div class="wl-item-sub" style="color:#999">' + esc(when) + "</div></div>" +
          '<button class="btn btn-sm" data-wl-view="' + esc(w.id) + '">ดู</button>' +
          (canDelete ? '<button class="btn btn-sm btn-danger" data-wl-del="' + esc(w.id) + '">ลบ</button>' : "") +
          "</div>";
      }).join("");
      listBox.querySelectorAll("[data-wl-view]").forEach(function (b) { b.onclick = function () { openDetail(byId(b.dataset.wlView)); }; });
      listBox.querySelectorAll("[data-wl-del]").forEach(function (b) { b.onclick = function () {
        askPin("ลบใบลงทะเบียนประกันนี้", function () { S.deleteWarranty(b.dataset.wlDel).then(function () { U.toast("ลบแล้ว", "ok"); }).catch(function () { U.toast("ลบไม่สำเร็จ", "err"); }); });
      }; });
    }
    function byId(id) { return all.filter(function (w) { return w.id === id; })[0]; }
    function openDetail(w) {
      if (!w) return;
      var rows = [
        ["ผู้ลงทะเบียน", regLabel(w.registrant)], ["ชื่อ-นามสกุล", (w.firstName || "") + " " + (w.lastName || "")],
        ["เบอร์โทร", w.phone], ["อีเมล", w.email], ["LINE ID", w.lineId],
        ["ที่อยู่", w.address], ["จังหวัด", w.province], ["รหัสไปรษณีย์", w.postcode],
        ["วันที่ซื้อ", w.purchaseDate], ["Date code", w.dateCode], ["ร้าน/สาขา", (w.retailer || "") + (w.branch ? " · " + w.branch : "")],
        ["ยี่ห้อ", w.brand], ["ประเภท", w.category], ["รุ่น", w.model], ["รหัสสินค้า/SN", w.serial],
        ["หมายเหตุ", w.comment], ["เลขอ้างอิง", w.id],
      ].filter(function (r) { return (r[1] || "").toString().trim(); });
      var imgs = "";
      if (w.receipt) imgs += '<div><div class="wl-doc-label">ใบเสร็จ/ใบรับประกัน</div><a href="' + esc(w.receipt) + '" target="_blank" rel="noopener"><img class="wl-doc" src="' + esc(w.receipt) + '"></a></div>';
      if (w.otherDoc) imgs += '<div><div class="wl-doc-label">เอกสารอื่น</div><a href="' + esc(w.otherDoc) + '" target="_blank" rel="noopener"><img class="wl-doc" src="' + esc(w.otherDoc) + '"></a></div>';
      var modal = document.createElement("div");
      modal.className = "wl-modal";
      modal.innerHTML = '<div class="wl-modal-card"><button class="wl-modal-x" aria-label="ปิด">×</button>' +
        '<h2>ใบลงทะเบียนประกัน</h2>' +
        '<table class="wl-detail">' + rows.map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(String(r[1])) + "</td></tr>"; }).join("") + "</table>" +
        (imgs ? '<div class="wl-docs">' + imgs + "</div>" : "") + "</div>";
      modal.addEventListener("click", function (e) { if (e.target === modal || e.target.classList.contains("wl-modal-x")) document.body.removeChild(modal); });
      document.body.appendChild(modal);
    }
  }

  function initCustomers() {
    var alertBox = document.querySelector("[data-alert]");
    var byCatBox = document.querySelector("[data-by-category]");
    var byBrandBox = document.querySelector("[data-by-brand]");
    var rankTbody = document.querySelector("[data-rank] tbody");
    var searchInput = document.querySelector("[data-search]");
    var state = { orders: [], profiles: {}, search: "" };

    if (searchInput) searchInput.addEventListener("input", function () {
      state.search = (searchInput.value || "").trim().toLowerCase();
      renderRank();
    });

    function setAlert(msg, kind) {
      if (!msg) { alertBox.style.display = "none"; return; }
      alertBox.textContent = msg; alertBox.style.display = "block";
      alertBox.style.background = kind === "err" ? "#fee" : "#efe";
    }

    setAlert("กำลังโหลด…");
    if (!S.loadFirebaseAuthAndDb) { setAlert("ยังไม่ได้ตั้ง Firebase", "err"); return; }
    S.loadFirebaseAuthAndDb("admin").then(function (m) {
      var fs = m.fsMod;
      // โหลด orders + customer_profiles
      fs.onSnapshot(fs.collection(m.db, "orders"), function (snap) {
        state.orders = snap.docs
          .map(function (d) { return d.data() || {}; })
          .filter(function (o) { return o.status !== "cancelled"; }); // ตามที่ user สั่ง — ยกเลิกแล้วลบออกอัตโนมัติจากสรุป
        renderAll();
      }, function (err) { setAlert("โหลดออเดอร์ไม่สำเร็จ: " + err.message, "err"); });

      fs.onSnapshot(fs.collection(m.db, "customer_profiles"), function (snap) {
        var map = {};
        snap.docs.forEach(function (d) { map[d.id] = d.data() || {}; });
        state.profiles = map;
        renderAll();
      }, function () {});
    }).catch(function (err) { setAlert("เชื่อม Firebase ไม่สำเร็จ: " + err.message, "err"); });

    function renderAll() {
      setAlert("");
      renderKPIs();
      renderByCategory();
      renderByBrand();
      renderRank();
    }

    function renderKPIs() {
      var byUser = {};
      var revenue = 0;
      state.orders.forEach(function (o) {
        var uid = o.userId || o.userEmail || (o.customer && o.customer.email) || "unknown";
        byUser[uid] = true;
        revenue += (o.revenue || o.subtotal || 0);
      });
      var customerCount = Object.keys(byUser).length;
      document.querySelector("[data-kpi-customers]").textContent = customerCount;
      document.querySelector("[data-kpi-revenue]").textContent = S.money(revenue);
      document.querySelector("[data-kpi-orders]").textContent = state.orders.length;
      document.querySelector("[data-kpi-avg]").textContent = customerCount ? S.money(Math.round(revenue / customerCount)) : "—";
    }

    function aggregateBy(keyFn) {
      var totals = {};
      state.orders.forEach(function (o) {
        (o.items || []).forEach(function (it) {
          var key = keyFn(it);
          if (!key) return;
          totals[key] = (totals[key] || 0) + (it.qty || 0);
        });
      });
      return Object.keys(totals).map(function (k) { return { key: k, qty: totals[k] }; })
        .sort(function (a, b) { return b.qty - a.qty; });
    }

    function renderMeter(box, rows, labelMap) {
      if (!rows.length) { box.innerHTML = '<div class="cus-empty">ยังไม่มีข้อมูล</div>'; return; }
      var max = rows[0].qty || 1;
      box.innerHTML = rows.slice(0, 10).map(function (r) {
        var pct = Math.round((r.qty / max) * 100);
        var label = (labelMap && labelMap[r.key]) || r.key;
        return '<div class="cus-cat-row">' +
          '<div class="label">' + esc(label) + '</div>' +
          '<div class="meter"><div class="fill" style="width:' + pct + '%"></div></div>' +
          '<div class="val">' + r.qty + ' ชิ้น</div>' +
        '</div>';
      }).join("");
    }

    function renderByCategory() {
      // item มี productId แต่ไม่มี category — ต้องดูจาก products
      // category อาจไม่ถูก embed ใน item — ใช้ category จาก products ที่ admin ดู (local)
      // backup: เดาจากชื่อสินค้า
      var prodCat = {};
      S.getProducts().forEach(function (p) { prodCat[p.id] = p.category || ""; });
      var labelMap = {};
      (S.CATEGORIES || []).forEach(function (c) { labelMap[c.key] = c.label; });
      var rows = aggregateBy(function (it) { return prodCat[it.productId] || ""; });
      renderMeter(byCatBox, rows, labelMap);
    }

    function renderByBrand() {
      var prodBrand = {};
      S.getProducts().forEach(function (p) { prodBrand[p.id] = p.brand || ""; });
      var rows = aggregateBy(function (it) { return prodBrand[it.productId] || ""; });
      renderMeter(byBrandBox, rows);
    }

    function renderRank() {
      var byUser = {};
      state.orders.forEach(function (o) {
        var uid = o.userId || o.userEmail || (o.customer && o.customer.email) || "unknown";
        if (!byUser[uid]) byUser[uid] = { uid: uid, name: "", email: "", phone: "", total: 0, count: 0, items: [] };
        var rec = byUser[uid];
        rec.total += (o.revenue || o.subtotal || 0);
        rec.count += 1;
        if (!rec.name && o.customer && o.customer.name) rec.name = o.customer.name;
        if (!rec.email) rec.email = o.userEmail || (o.customer && o.customer.email) || "";
        if (!rec.phone && o.customer && o.customer.phone) rec.phone = o.customer.phone;
        (o.items || []).forEach(function (it) { rec.items.push(it.name || ""); });
        // override ด้วย nickname จาก customer_profiles ถ้ามี
        if (state.profiles[uid] && state.profiles[uid].nickname) rec.name = state.profiles[uid].nickname;
      });
      var ranked = Object.values(byUser).sort(function (a, b) { return b.total - a.total; });
      // filter ด้วย search (ดูชื่อ, อีเมล, รายการสินค้า)
      if (state.search) {
        ranked = ranked.filter(function (r) {
          var h = (r.name + " " + r.email + " " + r.phone + " " + r.items.join(" ")).toLowerCase();
          return h.indexOf(state.search) >= 0;
        });
      }
      if (!ranked.length) {
        rankTbody.innerHTML = '<tr><td colspan="6" class="cus-empty">' + (state.search ? "ไม่พบลูกค้า" : "ยังไม่มีลูกค้า") + '</td></tr>';
        return;
      }
      rankTbody.innerHTML = ranked.map(function (r, i) {
        return '<tr>' +
          '<td>#' + (i + 1) + '</td>' +
          '<td>' + esc(r.name || "—") + '</td>' +
          '<td>' + esc(r.email || "—") + '</td>' +
          '<td>' + esc(r.phone || "—") + '</td>' +
          '<td class="num">' + r.count + '</td>' +
          '<td class="num">' + S.money(r.total) + '</td>' +
        '</tr>';
      }).join("");
    }
  }

  // หาสินค้าที่ "น่าจะเป็นตัวเดียวกัน" ในคลัง — เทียบรหัส SKU (ที่กรอกเอง) ก่อน แล้วชื่อ+แบรนด์
  function findInventoryDuplicate(name, rawSku, brand) {
    var list = S.getProducts();
    var sku = (rawSku || "").trim().toLowerCase();
    var nm = (name || "").trim().toLowerCase();
    var br = (brand || "").trim().toLowerCase();
    if (sku && !/^sku-/.test(sku)) {
      var byS = list.filter(function (p) { return (p.sku || "").trim().toLowerCase() === sku; })[0];
      if (byS) return byS;
    }
    if (nm) {
      var byN = list.filter(function (p) { return (p.name || "").trim().toLowerCase() === nm && (p.brand || "").trim().toLowerCase() === br; })[0];
      if (byN) return byN;
    }
    return null;
  }
  // กล่องยืนยัน "พบสินค้าซ้ำ" — 2 ปุ่ม: ใช่ เพิ่มจำนวน / ไม่ใช่ เป็นสินค้าใหม่
  function confirmDuplicate(html, onYes, onNo) {
    var bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML =
      '<div class="modal"><div class="modal-head"><h3>⚠️ พบสินค้านี้ในคลังแล้ว</h3><button class="modal-x" aria-label="ปิด">×</button></div>' +
      '<div class="modal-body">' + html + "</div>" +
      '<div class="modal-foot"><button class="btn btn-ghost" data-no>ไม่ใช่ — เป็นสินค้าใหม่</button>' +
      '<button class="btn" data-yes>ใช่ — เพิ่มแค่จำนวน</button></div></div>';
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.querySelector(".modal-x").onclick = close;
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    bg.querySelector("[data-yes]").onclick = function () { close(); onYes(); };
    bg.querySelector("[data-no]").onclick = function () { close(); onNo(); };
  }

  function openProductModal(p) {
    var isNew = !p;
    var forceNew = false; // ผู้ใช้ยืนยันแล้วว่าเป็นสินค้าใหม่ (ข้ามการเช็กซ้ำ)
    p = p || { icon: "drill", category: "drill", brand: "DEWALT", forSale: true, forRent: true, stock: 0, rented: 0, cost: 0, price: 0, rentPerDay: 0, location: "", sku: "", name: "", desc: "", specs: [], images: [], warrantyYears: 1, motorType: "ไร้แปรงถ่าน (Brushless)", shipSize: "", hidden: false };
    // mutable specs array (shared between spec-rows IIFE and AI-parse IIFE)
    var specs = (p.specs || []).map(function (s) {
      if (Array.isArray(s)) return { k: String(s[0] || ""), v: String(s[1] || "") };
      if (s && typeof s === "object") return { k: String(s.label || s.k || ""), v: String(s.value || s.v || "") };
      if (typeof s === "string") { var m = s.match(/^([^:：—\t]+)[:：—\t]\s*(.*)$/); return m ? { k: m[1].trim(), v: m[2].trim() } : { k: s, v: "" }; }
      return { k: "", v: "" };
    });
    var icons = ["drill", "driver", "saw", "grinder", "rotary", "battery", "charger", "measure", "wrench", "laser", "compressor", "box", "tool"];
    var owner = S.isOwner();
    var pendingImages = (p.images && p.images.length) ? p.images.slice() : (p.image ? [p.image] : []);
    // media viewer fields (360 frames + exploded parts) — text <-> data helpers
    function textToParts(text) {
      return String(text || "").split("\n").map(function (line) {
        line = line.trim(); if (!line) return null;
        var seg = line.split("|").map(function (s) { return s.trim(); });
        var xy = (seg[0] || "").split(",");
        return { x: parseFloat(xy[0]) || 0, y: parseFloat(xy[1]) || 0, label: seg[1] || "", sku: seg[2] || "", image: seg[3] || "", note: seg[4] || "" };
      }).filter(Boolean);
    }
    function partsToText(parts) {
      return (parts || []).map(function (pt) {
        return [ (pt.x != null ? pt.x : "") + "," + (pt.y != null ? pt.y : ""), pt.label || "", pt.sku || "", pt.image || "", pt.note || "" ].join(" | ");
      }).join("\n");
    }
    var body =
      (owner
        ? '<div class="field"><label>รูปสินค้า — เพิ่มได้หลายรูป (รูปแรก = รูปหลัก)</label><div class="gal-edit" data-gallery></div>' +
          '<label class="btn btn-ghost btn-sm filebtn" style="margin-top:8px">+ เพิ่มรูป…<input type="file" accept="image/*" multiple data-imgfile></label></div>'
        : '<div class="img-hint" style="margin-bottom:6px">เฉพาะแอดมินเท่านั้นที่จัดการรูปสินค้าได้</div>') +
      '<div class="field"><label>ชื่อสินค้า</label><input data-f="name" value="' + esc(p.name) + '" placeholder="เช่น สว่านกระแทกไร้สาย 20V"></div>' +
      '<div class="f2"><div class="field"><label>แบรนด์</label><input data-f="brand" value="' + esc(p.brand) + '"></div>' +
      '<div class="field"><label>รหัส SKU</label><input data-f="sku" value="' + esc(p.sku) + '"></div></div>' +
      '<div class="f2"><div class="field"><label>หมวดหมู่</label><select data-f="category">' +
        S.getCategories().map(function (c) { var path = S.categoryPath(c.key).map(function (x) { return x.label; }).join(" › "); return '<option value="' + c.key + '"' + (p.category === c.key ? " selected" : "") + ">" + esc(path || c.label) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>ไอคอน</label><select data-f="icon">' +
        icons.map(function (i) { return '<option value="' + i + '"' + (p.icon === i ? " selected" : "") + ">" + i + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="field"><label>ที่จัดเก็บในคลัง (เห็นเฉพาะหลังร้าน · ลูกค้าไม่เห็น)</label><input data-f="location" value="' + esc(p.location) + '" placeholder="เช่น โซน A-1 · ชั้น 2"></div>' +
      '<div class="f2"><div class="field"><label>การรับประกัน (ปี · 0 = ตามเงื่อนไข)</label><input data-f="warrantyYears" type="number" min="0" value="' + (p.warrantyYears || 0) + '"></div>' +
      '<div class="field"><label>ระบบมอเตอร์</label><input data-f="motorType" value="' + esc(p.motorType || "") + '" placeholder="ไร้แปรงถ่าน / มีแปรงถ่าน / —"></div></div>' +
      '<div class="field"><label>ขนาด/น้ำหนักสำหรับจัดส่ง</label><input data-f="shipSize" value="' + esc(p.shipSize || "") + '" placeholder="เช่น 32 × 9 × 24 ซม. · ~2 กก."></div>' +
      '<div class="f2"><div class="field"><label>ต้นทุน/ชิ้น (บาท)</label><input data-f="cost" type="number" min="0" value="' + p.cost + '"></div>' +
      '<div class="field"><label>ราคาขาย / SRP (บาท)</label><input data-f="price" type="number" min="0" value="' + p.price + '"></div></div>' +
      '<div class="f2"><div class="field"><label>ค่าเช่า/วัน (บาท)</label><input data-f="rentPerDay" type="number" min="0" value="' + p.rentPerDay + '"></div>' +
      '<div class="field"><label>จำนวนในสต็อก</label><input data-f="stock" type="number" min="0" value="' + p.stock + '"></div></div>' +
      '<div class="f2"><div class="field"><label>ราคาคุม (บาท · โชว์ในแคตตาล็อก · 0 = ไม่โชว์)</label><input data-f="priceCtrl" type="number" min="0" value="' + (p.priceCtrl || 0) + '"></div>' +
      '<div class="field"><label>จำนวน/กล่อง (โชว์ในแคตตาล็อก · 0 = ไม่โชว์)</label><input data-f="qtyPerBox" type="number" min="0" value="' + (p.qtyPerBox || 0) + '"></div></div>' +
      '<div class="f-check"><label><input type="checkbox" data-f="forSale"' + (p.forSale ? " checked" : "") + "> ขายขาด</label>" +
        '<label><input type="checkbox" data-f="forRent"' + (p.forRent ? " checked" : "") + '> ให้เช่า</label>' +
        '<label><input type="checkbox" data-f="hidden"' + (p.hidden ? " checked" : "") + '> <span style="color:#c00">ซ่อนจากร้านค้า</span></label></div>' +
      '<div class="field"><label>ข้อมูลจำเพาะ (สเปค)</label>' +
        '<div data-specrows></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-addspec style="margin-top:6px">+ เพิ่มสเปค</button>' +
      '</div>' +
      '<div class="field"><label>จุดเด่น (พิมพ์ 1 ข้อ / 1 บรรทัด · โชว์ในแคตตาล็อก)</label>' +
        '<textarea data-f="highlights" rows="3" placeholder="เช่น ใช้งานง่าย ปรับแรงบิดได้ · น้ำหนักเบา จับถนัดมือ (1 ข้อต่อบรรทัด)">' + esc((p.highlights || []).join("\n")) + '</textarea></div>' +
      (owner
        ? '<div class="field"><label>360° เฟรมหมุน — วาง URL รูปทีละบรรทัด (เรียงตามลำดับหมุน · ต้องมี ≥ 2 รูปจึงจะแสดงแท็บหมุน)</label>' +
          '<textarea data-f="frames360" rows="3" placeholder="https://.../frame-01.jpg&#10;https://.../frame-02.jpg&#10;… (1 URL ต่อบรรทัด)">' + esc((p.frames360 || []).join("\n")) + '</textarea>' +
          '<div class="img-hint">ใช้รูปชุดที่ถ่ายรอบสินค้า (เช่น 24–36 เฟรม) — ลูกค้าจะลาก/เลื่อนเพื่อหมุนดูรอบทิศ · เว้นว่างถ้ายังไม่มี</div></div>' +
          '<div class="field"><label>จุดอะไหล่ / แยกชิ้น — 1 จุดต่อบรรทัด รูปแบบ: <code>x,y | ชื่อ | รหัส | URLรูป | หมายเหตุ</code></label>' +
          '<textarea data-f="parts" rows="3" placeholder="50,40 | หัวจับดอกสว่าน | CHK-13 | https://.../chuck.jpg | ถอดเปลี่ยนได้&#10;72,65 | แบตเตอรี่ 20V | BAT-20 |  | กดปลดสลักด้านล่าง">' + esc(partsToText(p.parts || [])) + '</textarea>' +
          '<div class="img-hint">x,y = ตำแหน่ง % บนรูป (0–100) · ลูกค้าดับเบิลคลิกจุดเพื่อแยกชิ้นส่วนออกมาดูทีละจุด · ช่องไหนไม่มีให้เว้นว่างได้ · เว้นทั้งช่องถ้ายังไม่มี</div></div>' +
          '<div class="field"><label>โมเดล 3 มิติ — วางลิงก์ Sketchfab หรือ URL ไฟล์ .glb / .gltf (ลูกค้าหมุน/ซูมดูสินค้ารอบทิศ)</label>' +
          '<input data-f="model3d" value="' + esc(p.model3d || "") + '" placeholder="https://sketchfab.com/3d-models/drill-2bf1fd1c09f8422fbc50333c39f7229c">' +
          '<div class="img-hint">รองรับลิงก์แชร์จาก Sketchfab (คัดลอกจากแถบที่อยู่ของหน้าโมเดล) หรือลิงก์ไฟล์ <code>.glb</code>/<code>.gltf</code> ที่โฮสต์ไว้ · เว้นว่างถ้ายังไม่มี — แท็บ “ดู 3 มิติ” จะโผล่อัตโนมัติเมื่อกรอก</div></div>'
        : '') +
      '<div class="field"><label>รายละเอียด</label>' +
      '<div style="display:flex;gap:8px;align-items:flex-start">' +
        '<textarea data-f="desc" rows="4" style="flex:1">' + esc(p.desc) + '</textarea>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-ai-parse style="white-space:nowrap;margin-top:2px" title="วางข้อมูลสินค้าดิบในช่อง รายละเอียด แล้วกด — AI จะแยกชื่อ, สเปค, แบรนด์ฯ ใส่ฟอร์มให้">✨ AI แยก</button>' +
      '</div>' +
      '<div class="img-hint">วางรายละเอียดสินค้าดิบในช่องแล้วกด "✨ AI แยก" — AI จะช่วยแยกชื่อ, สเปค, แบรนด์ฯ ให้อัตโนมัติ</div>' +
      '</div>';

    openModal(isNew ? "เพิ่มสินค้าใหม่" : "แก้ไขสินค้า", body, function (root) {
      function val(f) { var el = root.querySelector("[data-f=" + f + "]"); return el ? el.value : ""; }
      function chk(f) { var el = root.querySelector("[data-f=" + f + "]"); return el ? el.checked : false; }
      var name = val("name").trim();
      if (!name) { U.toast("กรุณากรอกชื่อสินค้า", "err"); return false; }
      var savedSpecs = [];
      root.querySelectorAll("[data-srow]").forEach(function (row) {
        var k = row.querySelector("[data-sk]"); var v = row.querySelector("[data-sv]");
        if (k && k.value.trim()) savedSpecs.push([k.value.trim(), v ? v.value.trim() : ""]);
      });
      var data = {
        id: p.id, name: name, brand: val("brand").trim() || "—", sku: val("sku").trim() || S.genId("SKU"),
        category: val("category"), icon: val("icon"), location: val("location").trim() || "ยังไม่ระบุ",
        cost: +val("cost") || 0, price: +val("price") || 0, rentPerDay: +val("rentPerDay") || 0,
        stock: +val("stock") || 0, forSale: chk("forSale"), forRent: chk("forRent"), hidden: chk("hidden"),
        desc: val("desc").trim(), specs: savedSpecs, rented: p.rented || 0,
        warrantyYears: +val("warrantyYears") || 0, motorType: val("motorType").trim() || "—", shipSize: val("shipSize").trim(),
        priceCtrl: +val("priceCtrl") || 0, qtyPerBox: +val("qtyPerBox") || 0,
        highlights: val("highlights").split("\n").map(function (s) { return s.trim(); }).filter(Boolean),
      };
      if (owner) {
        data.images = pendingImages.slice(); data.image = pendingImages[0] || "";
        data.frames360 = val("frames360").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        data.parts = textToParts(val("parts"));
        data.model3d = val("model3d").trim();
      } else {
        data.images = p.images || []; data.image = p.image || "";
        data.frames360 = p.frames360 || []; data.parts = p.parts || [];
        data.model3d = p.model3d || "";
      }
      // เพิ่มสินค้าใหม่ → เช็กก่อนว่ามีตัวนี้ในคลังอยู่แล้วไหม
      if (isNew && !forceNew) {
        var dup = findInventoryDuplicate(name, val("sku").trim(), val("brand").trim());
        if (dup) {
          var addQty = +val("stock") || 0;
          var newTotal = (dup.stock || 0) + addQty;
          var productBg = root.closest(".modal-bg");
          confirmDuplicate(
            '<div style="font-family:var(--font-body)">' +
            '<p style="margin:0 0 10px">มีสินค้านี้ในคลังอยู่แล้ว:</p>' +
            '<div style="border:2px solid var(--ink);border-radius:8px;padding:10px 12px;margin-bottom:12px">' +
              '<b>' + esc(dup.name) + "</b><br>" +
              '<span style="color:var(--fg-2);font-size:13px">รหัส: ' + esc(dup.sku || "—") + " · " + esc(dup.brand || "—") + " · คงเหลือ <b>" + (dup.stock || 0) + "</b> ชิ้น</span></div>" +
            '<p style="margin:0">ต้องการ <b>เพิ่มจำนวนอีก ' + addQty + " ชิ้น</b> ให้สินค้าตัวนี้ใช่ไหม? (รวมเป็น <b>" + newTotal + "</b> ชิ้น)</p>" +
            '<p style="margin:8px 0 0;color:var(--fg-2);font-size:13px">ถ้าเป็นแค่สินค้าคล้ายกัน (คนละตัว) ให้กด “ไม่ใช่ — เป็นสินค้าใหม่”</p></div>',
            function onYes() { // เพิ่มจำนวนให้ตัวที่มีอยู่
              try { S.saveProduct(Object.assign({}, dup, { stock: newTotal })); } catch (e) { U.toast("บันทึกไม่สำเร็จ", "err"); return; }
              U.toast("เพิ่ม " + addQty + " ชิ้นให้ " + dup.name + " แล้ว (รวม " + newTotal + " ชิ้น)", "ok");
              if (window.__invRender) window.__invRender();
              if (productBg) productBg.remove();
            },
            function onNo() { // ยืนยันเป็นสินค้าใหม่ → กดบันทึกซ้ำ (ข้ามเช็ก)
              forceNew = true;
              if (productBg) { var sb = productBg.querySelector("[data-save]"); if (sb) sb.click(); }
            }
          );
          return false; // คงหน้าต่างสินค้าไว้จนกว่าจะเลือก
        }
      }
      try { S.saveProduct(data); }
      catch (e) { U.toast("บันทึกไม่สำเร็จ — รูปอาจใหญ่เกินไป ลองใช้รูปเล็กลง", "err"); return false; }
      U.toast(isNew ? "เพิ่มสินค้าแล้ว" : "บันทึกการแก้ไขแล้ว", "ok");
      if (window.__invRender) window.__invRender();
      return true;
    });

    // wire spec rows + AI parse (shared scope via outer `specs` variable)
    (function () {
      var modalEl = document.querySelector(".modal-bg");
      if (!modalEl) return;
      var specRowsEl = modalEl.querySelector("[data-specrows]");
      var addSpecBtn = modalEl.querySelector("[data-addspec]");

      function renderSpecRows() {
        if (!specRowsEl) return;
        specRowsEl.innerHTML = specs.map(function (s, i) {
          return '<div class="spec-row" data-srow="' + i + '">' +
            '<input class="spec-k" data-sk="' + i + '" value="' + esc(s.k) + '" placeholder="รายการ เช่น แรงดัน">' +
            '<input class="spec-v" data-sv="' + i + '" value="' + esc(s.v) + '" placeholder="ค่า เช่น 20V">' +
            '<button type="button" class="btn btn-sm btn-danger" data-sdel="' + i + '">×</button></div>';
        }).join("");
        specRowsEl.querySelectorAll("[data-sdel]").forEach(function (b) {
          b.onclick = function () { syncSpecRows(); specs.splice(+b.dataset.sdel, 1); renderSpecRows(); };
        });
      }
      function syncSpecRows() {
        if (!specRowsEl) return;
        specRowsEl.querySelectorAll("[data-srow]").forEach(function (row) {
          var i = +row.dataset.srow; if (!specs[i]) return;
          var k = row.querySelector("[data-sk]"); if (k) specs[i].k = k.value;
          var v = row.querySelector("[data-sv]"); if (v) specs[i].v = v.value;
        });
      }
      renderSpecRows();
      if (addSpecBtn) addSpecBtn.addEventListener("click", function () { syncSpecRows(); specs.push({ k: "", v: "" }); renderSpecRows(); });

      var parseBtn = modalEl.querySelector("[data-ai-parse]");
      if (!parseBtn) return;
      parseBtn.addEventListener("click", function () {
        var descEl = modalEl.querySelector("[data-f=desc]");
        var raw = descEl ? descEl.value.trim() : "";
        if (!raw) { U.toast("กรุณาวางรายละเอียดสินค้าในช่อง 'รายละเอียด' ก่อนกด AI แยก", "err"); return; }
        parseBtn.disabled = true;
        parseBtn.textContent = "กำลังวิเคราะห์…";
        fetch("/api/ai-parse-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: raw })
        }).then(function (r) { return r.json(); }).then(function (data) {
          parseBtn.disabled = false;
          parseBtn.textContent = "✨ AI แยก";
          if (!data.ok || !data.parsed) { U.toast("AI แยกไม่สำเร็จ: " + (data.message || data.error || "ลองอีกครั้ง"), "err"); return; }
          var parsed = data.parsed;
          function setField(attr, val) {
            if (val === undefined || val === null || val === "") return;
            var el = modalEl.querySelector("[data-f=" + attr + "]");
            if (el) el.value = val;
          }
          setField("name", parsed.name);
          setField("brand", parsed.brand);
          setField("sku", parsed.sku);
          setField("motorType", parsed.motorType);
          setField("shipSize", parsed.shipSize);
          if (parsed.warrantyYears) setField("warrantyYears", parsed.warrantyYears);
          if (parsed.category) {
            var catEl = modalEl.querySelector("[data-f=category]");
            if (catEl) { var opt = catEl.querySelector('[value="' + parsed.category + '"]'); if (opt) catEl.value = parsed.category; }
          }
          // populate spec rows from parsed.specs (replaces existing rows)
          if (Array.isArray(parsed.specs) && parsed.specs.length) {
            specs = parsed.specs.map(function (s) {
              if (typeof s === "string") { var m = s.match(/^([^:：—\t]+)[:：—\t]\s*(.*)$/); return m ? { k: m[1].trim(), v: m[2].trim() } : { k: s, v: "" }; }
              if (Array.isArray(s)) return { k: String(s[0] || ""), v: String(s[1] || "") };
              return { k: String(s.label || s.k || s), v: String(s.value || s.v || "") };
            });
            renderSpecRows();
          }
          if (descEl && parsed.desc) descEl.value = parsed.desc;
          U.toast("AI แยกข้อมูลเรียบร้อย — ตรวจสอบแล้วกดบันทึก", "ok");
        }).catch(function () {
          parseBtn.disabled = false;
          parseBtn.textContent = "✨ AI แยก";
          U.toast("เชื่อมต่อ AI ไม่สำเร็จ", "err");
        });
      });
    })();

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

    // ออเดอร์จาก cloud ถูกดูดลง local me_orders โดย subscribeOrdersGlobal() แล้ว (ทำงานทุกหน้าหลังร้าน)
    // จึงอ่านจาก S.getOrders() ได้เลย และ re-render เมื่อมีข้อมูลใหม่เข้ามา (dispatch จาก absorbCloudOrders)
    S.onChange(render);

    function render() {
      var orders = S.getOrders().filter(function (o) {
        if (state.status && o.status !== state.status) return false;
        if (state.type && o.type !== state.type) return false;
        if (state.q) {
          var c = o.customer || {};
          var h = ((c.name || "") + " " + (c.phone || "") + " " + (o.id || "") + " " + (o.userEmail || "")).toLowerCase();
          if (h.indexOf(state.q) < 0) return false;
        }
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
            "<td>" + adminStatusBadges(o) + payInfo(o) + (o.staffMessage ? '<br><span class="prod-sku">📩 ' + esc(o.staffMessage) + "</span>" : "") + "</td>" +
            '<td><div class="ord-act">' + (opts ? '<select class="statussel" data-os="' + o.id + '">' + opts + "</select>" : '<span class="prod-sku">—</span>') +
              '<div class="ord-msg"><input data-msg="' + o.id + '" value="' + esc(o.staffMessage || "") + '" placeholder="ตอบลูกค้า เช่น ของถึงใน 2 วัน"><button class="btn btn-sm" data-sendmsg="' + o.id + '">ส่ง</button></div>' +
              (o.slip ? '<button class="btn btn-sm btn-ghost" data-viewslip="' + o.id + '">📄 ดูสลิป</button>' : "") +
              (o.payStatus === "pending" ? '<button class="btn btn-sm" data-confirmpay="' + o.id + '">✓ ยืนยันรับเงิน</button>' : "") +
              '<button class="btn btn-sm" data-printlabel="' + o.id + '">🖨️ พิมพ์ที่อยู่</button>' +
              (S.hasPerm("orders_delete") ? '<button class="btn btn-sm btn-danger" data-delorder="' + o.id + '">ลบคำสั่งซื้อ</button>' : "") +
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
      tb.querySelectorAll("[data-printlabel]").forEach(function (b) {
        b.onclick = function () { var ord = S.getOrders().filter(function (x) { return x.id === b.dataset.printlabel; })[0]; if (ord) printOrderLabel(ord); };
      });
      tb.querySelectorAll("[data-viewslip]").forEach(function (b) {
        b.onclick = function () { var ord = S.getOrders().filter(function (x) { return x.id === b.dataset.viewslip; })[0]; if (ord && ord.slip) viewSlip(ord); };
      });
      tb.querySelectorAll("[data-confirmpay]").forEach(function (b) {
        b.onclick = function () { S.confirmOrderPayment(b.dataset.confirmpay); U.toast("ยืนยันรับเงินแล้ว ✓", "ok"); render(); };
      });
    }
    render();
  }
  // ป้ายสถานะการชำระเงิน (ในตารางคำสั่งซื้อ)
  function payInfo(o) {
    if (o.payStatus === "pending") return '<br><span class="pay-chip pending">⏳ รอตรวจสลิป</span>' + (o.payAmount ? ' <span class="prod-sku">โอน ' + S.money(o.payAmount) + "</span>" : "");
    if (o.slip || o.payStatus === "verified") return '<br><span class="pay-chip ok">✅ ชำระแล้ว' + (o.slipRef ? " · " + esc(o.slipRef) : "") + "</span>";
    return "";
  }
  // แสดงรูปสลิปแบบ overlay
  function viewSlip(o) {
    var bg = document.createElement("div");
    bg.className = "slip-view-bg";
    bg.innerHTML = '<div class="slip-view"><button class="slip-view-x" aria-label="ปิด">×</button>' +
      '<div class="slip-view-cap">สลิป · ' + esc(o.id) + (o.slipRef ? " · ref " + esc(o.slipRef) : "") + "</div>" +
      '<img src="' + esc(o.slip) + '" alt="สลิป"></div>';
    bg.onclick = function (e) { if (e.target === bg || e.target.classList.contains("slip-view-x")) document.body.removeChild(bg); };
    document.body.appendChild(bg);
  }

  // พิมพ์ใบที่อยู่/ใบจัดส่งของคำสั่งซื้อ → เปิดผ่าน iframe ซ่อน แล้วสั่งพิมพ์ (เลือกเครื่องพิมพ์ในกล่องของระบบ)
  // รองรับเครื่องพิมพ์สติกเกอร์ 100×150 มม. (ตั้งขนาดกระดาษที่ไดรเวอร์) หรือ A4 ทั่วไป
  function printOrderLabel(o) {
    var st = S.getSettings();
    var c = o.customer || {};
    var deliver = o.fulfillment === "delivery";
    var addr = (o.address && o.address.text) || (deliver ? "—" : "รับเองที่ร้าน M.E.Tools");
    var items = (o.items || []).map(function (it) { return "• " + esc(it.name) + " ×" + it.qty; }).join("<br>");
    var shopPhone = String(st.phone || "").replace(/\s*,\s*/g, ", ");
    var doc =
      '<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบจัดส่ง ' + esc(o.id) + '</title><style>' +
      '@page{margin:8mm}' +
      '*{box-sizing:border-box}body{font-family:"Sarabun",system-ui,sans-serif;margin:0;color:#000}' +
      '.label{border:2px solid #000;border-radius:8px;padding:14px;max-width:150mm}' +
      '.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px}' +
      '.hd .b{font-weight:800;font-size:20px}.hd .o{font-weight:800;font-size:15px}' +
      '.sec{margin:8px 0}.k{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.04em}' +
      '.to{font-size:20px;font-weight:800;line-height:1.35}.to .ph{font-size:18px}' +
      '.ad{font-size:16px;line-height:1.45;margin-top:2px}' +
      '.row{display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:#222;margin-top:4px}' +
      '.items{font-size:14px;line-height:1.6;margin-top:2px}' +
      '.frm{border-top:1px dashed #888;margin-top:10px;padding-top:8px;font-size:12px;color:#444}' +
      '.chip{display:inline-block;border:1px solid #000;border-radius:4px;padding:1px 7px;font-size:12px;font-weight:700;margin-left:6px}' +
      '</style></head><body><div class="label">' +
      '<div class="hd"><div><div class="b">📦 ' + esc(st.company || "M.E.Tools") + '</div><div style="font-size:12px;color:#555">ใบจัดส่งสินค้า</div></div>' +
      '<div style="text-align:right"><div class="o">' + esc(o.id) + '</div><div style="font-size:12px">' + esc(S.fmtDate(o.createdAt)) + '</div>' +
      '<div><span class="chip">' + esc(deliver ? "จัดส่ง" : "รับที่ร้าน") + '</span></div></div></div>' +
      '<div class="sec"><div class="k">ผู้รับ / ส่งถึง</div>' +
      '<div class="to">' + esc(c.name || "—") + '<br><span class="ph">โทร. ' + esc(c.phone || "—") + '</span></div>' +
      '<div class="ad">' + esc(addr) + '</div></div>' +
      '<div class="sec"><div class="k">รายการสินค้า</div><div class="items">' + (items || "—") + '</div>' +
      '<div class="row"><div>ยอดรวม: <b>' + esc(S.money(o.total)) + '</b></div>' +
      (o.vat ? '<div>(รวม VAT ' + (o.vatPct || 7) + '% = ' + esc(S.money(o.vat)) + ')</div>' : "") +
      (o.shipping ? '<div>ค่าจัดส่ง: ' + esc(S.money(o.shipping)) + '</div>' : "") +
      (o.type === "rent" ? '<div>เช่า ' + esc(o.days || "") + ' วัน</div>' : "") + '</div></div>' +
      '<div class="frm"><b>ผู้ส่ง:</b> ' + esc(st.company || "M.E.Tools") + " · " + esc(shopPhone) + "<br>" + esc(st.address || "") + "</div>" +
      '</div></body></html>';
    var ifr = document.createElement("iframe");
    ifr.setAttribute("aria-hidden", "true");
    ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(ifr);
    var d = ifr.contentWindow.document;
    d.open(); d.write(doc); d.close();
    setTimeout(function () {
      try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e) { U.toast("เปิดหน้าต่างพิมพ์ไม่สำเร็จ", "err"); }
      setTimeout(function () { try { document.body.removeChild(ifr); } catch (e) {} }, 2000);
    }, 300);
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
    var simpleKeys = ["heroOverline", "heroTitle", "heroSub", "brandsTagline", "company", "address", "line", "facebook", "instagram", "tiktok", "hoursWeek", "hoursSun", "bankInfo", "authLoginTitle", "authLoginSub", "authRegTitle", "authRegSub", "deletePin", "googleClientId", "facebookAppId", "firebaseConfig", "hoursWeekOpen", "hoursWeekClose", "hoursSunOpen", "hoursSunClose"];
    var openSunEl = root.querySelector("[data-open-sun]"); if (openSunEl) openSunEl.checked = st.openSun !== false;
    // VAT + การรับบัตร
    var vatOnEl = root.querySelector("[data-vat-on]"); if (vatOnEl) vatOnEl.checked = st.vatEnabled !== false;
    var vatPctEl = root.querySelector("[data-vat-pct]"); if (vatPctEl) vatPctEl.value = (st.vatPct != null ? st.vatPct : 7);
    var vatModeEl = root.querySelector("[data-vat-mode]"); if (vatModeEl) vatModeEl.value = st.vatMode || "add";
    var cardOnEl = root.querySelector("[data-card-on]"); if (cardOnEl) cardOnEl.checked = !!st.cardPayOn;
    var cardThrEl = root.querySelector("[data-card-threshold]"); if (cardThrEl) cardThrEl.value = (st.cardThreshold != null ? st.cardThreshold : 45000);
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
    var phoneRaw = String(st.phone || "");
    var phones = (phoneRaw.match(/[0-9][0-9()+\-\s]{5,}[0-9]/g) || []).map(function (p) { return p.replace(/\s+/g, " ").trim(); }).filter(Boolean);
    if (!phones.length && phoneRaw.trim()) phones = [phoneRaw.trim()];
    var phoneList = root.querySelector("[data-phonelist]");
    function syncPhones() { if (!phoneList) return; phones = []; phoneList.querySelectorAll("[data-ph-val]").forEach(function (el) { phones.push(el.value); }); }
    function renderPhones() {
      if (!phoneList) return;
      var arr = phones.length ? phones : [""];
      phoneList.innerHTML = arr.map(function (p, i) {
        return '<div class="row-edit" data-ph="' + i + '" style="margin-bottom:6px"><input data-ph-val value="' + esc(p || "") + '" placeholder="เช่น 053-104699" style="flex:1">' +
          '<button class="btn btn-sm btn-danger" data-ph-del="' + i + '">ลบ</button></div>';
      }).join("");
      phoneList.querySelectorAll("[data-ph-del]").forEach(function (b) { b.onclick = function () { syncPhones(); phones.splice(+b.dataset.phDel, 1); renderPhones(); }; });
    }
    if (phoneList) { renderPhones(); var phAddBtn = root.querySelector("[data-phone-add]"); if (phAddBtn) phAddBtn.addEventListener("click", function () { syncPhones(); phones.push(""); renderPhones(); }); }
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
    var faq = (st.faq || []).map(function (f) { return { q: f.q, a: f.a, hidden: !!f.hidden }; });
    var faqList = root.querySelector("[data-faqlist]");
    function syncFaq() {
      faqList.querySelectorAll("[data-fq]").forEach(function (i) { faq[+i.dataset.fq].q = i.value; });
      faqList.querySelectorAll("[data-fa]").forEach(function (t) { faq[+t.dataset.fa].a = t.value; });
      faqList.querySelectorAll("[data-fh]").forEach(function (i) { faq[+i.dataset.fh].hidden = i.checked; });
    }
    function renderFaq() {
      faqList.innerHTML = faq.map(function (f, i) {
        return '<div class="faq-edit' + (f.hidden ? " is-hidden" : "") + '"><div style="display:flex;flex-direction:column;gap:8px;flex:1">' +
          '<input data-fq="' + i + '" value="' + esc(f.q) + '" placeholder="คำถาม">' +
          '<textarea data-fa="' + i + '" rows="2" placeholder="คำตอบ">' + esc(f.a) + "</textarea></div>" +
          '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' +
          '<label class="f-check" style="white-space:nowrap"><input type="checkbox" data-fh="' + i + '"' + (f.hidden ? " checked" : "") + "> ซ่อน</label>" +
          '<button class="btn btn-sm btn-danger" data-fdel="' + i + '">ลบ</button></div></div>';
      }).join("");
      faqList.querySelectorAll("[data-fq]").forEach(function (i) { i.onchange = function () { faq[+i.dataset.fq].q = i.value; }; });
      faqList.querySelectorAll("[data-fa]").forEach(function (t) { t.onchange = function () { faq[+t.dataset.fa].a = t.value; }; });
      faqList.querySelectorAll("[data-fh]").forEach(function (i) { i.onchange = function () { syncFaq(); renderFaq(); }; });
      faqList.querySelectorAll("[data-fdel]").forEach(function (b) { b.onclick = function () { syncFaq(); faq.splice(+b.dataset.fdel, 1); renderFaq(); }; });
    }
    renderFaq();
    root.querySelector("[data-faqadd]").addEventListener("click", function () { syncFaq(); faq.push({ q: "", a: "", hidden: false }); renderFaq(); });

    // ----- Brands editor -----
    var brands = (st.brands || []).map(function (b) { return { name: b.name, tag: b.tag, primary: !!b.primary, hidden: !!b.hidden }; });
    var brandList = root.querySelector("[data-brandlist]");
    function syncBrands() {
      if (!brandList) return;
      brandList.querySelectorAll("[data-bn]").forEach(function (i) { brands[+i.dataset.bn].name = i.value; });
      brandList.querySelectorAll("[data-bt]").forEach(function (i) { brands[+i.dataset.bt].tag = i.value; });
      brandList.querySelectorAll("[data-bp]").forEach(function (i) { brands[+i.dataset.bp].primary = i.checked; });
      brandList.querySelectorAll("[data-bh]").forEach(function (i) { brands[+i.dataset.bh].hidden = i.checked; });
    }
    var _dragSrcIdx = null;
    function renderBrands() {
      if (!brandList) return;
      brandList.innerHTML = brands.map(function (b, i) {
        return '<div class="row-edit' + (b.hidden ? " is-hidden" : "") + '" draggable="true" data-brow="' + i + '" style="cursor:grab">' +
          '<span style="color:var(--fg-2);font-size:18px;cursor:grab;padding:0 6px;user-select:none" title="ลากเพื่อจัดเรียง">⠿</span>' +
          '<input data-bn="' + i + '" value="' + esc(b.name) + '" placeholder="ชื่อแบรนด์" style="flex:1">' +
          '<input data-bt="' + i + '" value="' + esc(b.tag || "") + '" placeholder="คำอธิบายสั้น" style="flex:1.4">' +
          '<label class="f-check"><input type="checkbox" data-bp="' + i + '"' + (b.primary ? " checked" : "") + "> เด่น</label>" +
          '<label class="f-check"><input type="checkbox" data-bh="' + i + '"' + (b.hidden ? " checked" : "") + "> ซ่อน</label>" +
          '<button class="btn btn-sm btn-danger" data-bdel="' + i + '">ลบ</button></div>';
      }).join("");
      brandList.querySelectorAll("[data-bdel]").forEach(function (b) {
        b.onclick = function () { syncBrands(); brands.splice(+b.dataset.bdel, 1); renderBrands(); };
      });
      brandList.querySelectorAll("[data-bh]").forEach(function (i) { i.onchange = function () { syncBrands(); renderBrands(); }; });
      // drag-and-drop reorder
      brandList.querySelectorAll("[data-brow]").forEach(function (row) {
        row.addEventListener("dragstart", function (e) {
          syncBrands();
          _dragSrcIdx = +row.dataset.brow;
          e.dataTransfer.effectAllowed = "move";
          row.style.opacity = "0.4";
        });
        row.addEventListener("dragend", function () { row.style.opacity = ""; });
        row.addEventListener("dragover", function (e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; row.style.background = "var(--bg-hover,#f5f5f5)"; });
        row.addEventListener("dragleave", function () { row.style.background = ""; });
        row.addEventListener("drop", function (e) {
          e.preventDefault();
          row.style.background = "";
          var dst = +row.dataset.brow;
          if (_dragSrcIdx === null || _dragSrcIdx === dst) return;
          var moved = brands.splice(_dragSrcIdx, 1)[0];
          brands.splice(dst, 0, moved);
          _dragSrcIdx = null;
          renderBrands();
        });
      });
    }
    if (brandList) { renderBrands(); root.querySelector("[data-brand-add]").addEventListener("click", function () { syncBrands(); brands.push({ name: "", tag: "", primary: false, hidden: false }); renderBrands(); }); }

    // ----- categories editor (rename / icon / image / reorder) -----
    var CAT_ICONS = ["drill", "driver", "saw", "grinder", "rotary", "battery", "charger", "measure", "wrench", "laser", "compressor", "box", "tool",
      "air", "weld", "engine", "agri", "pump", "car", "office", "clean", "ladder", "lift", "hammer", "bolt", "electric", "bearing", "generator", "safety", "gear", "pipe", "paint"];
    // ชื่อไอคอนภาษาไทย (โชว์ในเมนูเลือกไอคอน ให้เข้าใจง่าย)
    var CAT_ICON_TH = {
      drill: "สว่าน", driver: "ไขควง", saw: "เลื่อย", grinder: "เครื่องเจียร", rotary: "สว่านโรตารี่",
      battery: "แบตเตอรี่", charger: "ที่ชาร์จ", measure: "เครื่องมือวัด", wrench: "ประแจ", laser: "เลเซอร์วัดระดับ",
      compressor: "ปั๊มลม", box: "กล่องเครื่องมือ", tool: "เครื่องมือทั่วไป", air: "เครื่องมือลม", weld: "เครื่องเชื่อม",
      engine: "เครื่องยนต์", agri: "เครื่องมือเกษตร", pump: "ปั๊มน้ำ", car: "อุปกรณ์ยานยนต์", office: "อุปกรณ์สำนักงาน",
      clean: "ทำความสะอาด", ladder: "บันได", lift: "รอก/ลิฟต์ยก", hammer: "ค้อน", bolt: "น็อต/สกรู",
      electric: "อุปกรณ์ไฟฟ้า", bearing: "ลูกปืน", generator: "เครื่องปั่นไฟ", safety: "อุปกรณ์เซฟตี้",
      gear: "เฟือง/อะไหล่", pipe: "ท่อ/ประปา", paint: "สี/งานพ่นสี",
    };
    var cats = S.getCategories();
    var catList = root.querySelector("[data-catlist]");
    function catPreview(c) {
      return c.image
        ? '<img src="' + esc(c.image) + '" alt="" style="width:30px;height:30px;object-fit:contain;border-radius:4px">'
        : U.iconSvg(c.icon || "tool", 30);
    }
    function syncCats() {
      if (!catList) return;
      catList.querySelectorAll("[data-cn]").forEach(function (i) { cats[+i.dataset.cn].label = i.value; });
      catList.querySelectorAll("[data-ci]").forEach(function (i) { var c = cats[+i.dataset.ci]; if (!c.image) c.icon = i.value; });
      catList.querySelectorAll("[data-cp]").forEach(function (i) { cats[+i.dataset.cp].parent = i.value; });
      catList.querySelectorAll("[data-ch]").forEach(function (i) { cats[+i.dataset.ch].hidden = i.checked; });
      catList.querySelectorAll("[data-cv]").forEach(function (i) { cats[+i.dataset.cv].vat = i.checked; });
    }
    // เซ็ตลูกหลานของ key (จาก cats ปัจจุบัน) — กันเลือกหมวดแม่เป็นตัวเอง/ลูกตัวเอง (วน loop)
    function catDescLocal(key) {
      var out = {}, q = [key], g = 0; out[key] = 1;
      while (q.length && g++ < 999) { var k = q.shift(); cats.forEach(function (c) { if ((c.parent || "") === k && !out[c.key]) { out[c.key] = 1; q.push(c.key); } }); }
      return out;
    }
    function catByKey(key) { for (var i = 0; i < cats.length; i++) if (cats[i].key === key) return cats[i]; return null; }
    function catDepth(key) { var d = 0, g = 0, c = catByKey(key); while (c && c.parent && g++ < 30) { d++; c = catByKey(c.parent); } return d; }
    function catPathLocal(key) { var labels = [], g = 0, c = catByKey(key); while (c && g++ < 30) { labels.unshift(c.label || c.key); c = c.parent ? catByKey(c.parent) : null; } return labels.join(" › "); }
    var _catDragIdx = null;
    function renderCats() {
      if (!catList) return;
      catList.innerHTML = cats.map(function (c, i) {
        var depth = catDepth(c.key);
        var lineage = depth === 0
          ? '⭐ หมวดหลัก (ชั้นบนสุด)'
          : 'ชั้นที่ ' + (depth + 1) + ' · ' + (depth === 1 ? 'หมวดรองของ' : 'หมวดย่อยของ') + ' ▸ ' + esc(catPathLocal(c.parent));
        return '<div class="row-edit' + (c.hidden ? " is-hidden" : "") + '" draggable="true" data-crow="' + i + '" style="cursor:grab;align-items:center;padding-left:' + (8 + depth * 20) + 'px;' + (depth ? "border-left:3px solid var(--dw-yellow-deep,#E8A800);" : "") + '">' +
          '<div style="flex:1 1 100%;font-family:var(--font-mono);font-size:11px;color:' + (depth ? "var(--fg-2)" : "var(--price-red,#D7261E)") + ';margin-bottom:2px">' + lineage + '</div>' +
          '<span style="color:var(--fg-2);font-size:18px;cursor:grab;padding:0 4px;user-select:none" title="ลากเพื่อจัดเรียง">⠿</span>' +
          '<span class="cat-lvl" title="ชั้นที่ ' + (depth + 1) + '" style="flex:0 0 auto;font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--ink);min-width:26px">L' + (depth + 1) + '</span>' +
          '<span style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;background:var(--bg-1,#f5f5f5);border-radius:6px">' + catPreview(c) + "</span>" +
          '<input data-cn="' + i + '" value="' + esc(c.label) + '" placeholder="ชื่อหมวด" style="flex:1;min-width:110px">' +
          (function () {
            var forbidden = catDescLocal(c.key);
            return '<select data-cp="' + i + '" title="หมวดแม่ (เว้นว่าง = หมวดบนสุด) — เลือกหมวดลึกเท่าไรก็ได้" style="flex:0 0 180px">' +
              '<option value="">— หมวดบนสุด (ชั้น 1) —</option>' +
              cats.filter(function (x) { return !forbidden[x.key]; }).map(function (x) {
                return '<option value="' + x.key + '"' + ((c.parent || "") === x.key ? " selected" : "") + ">" + esc(catPathLocal(x.key)) + "</option>";
              }).join("") + "</select>";
          })() +
          '<span style="font-size:12px;color:#888;white-space:nowrap;align-self:center">ไอคอน:</span>' +
          '<select data-ci="' + i + '"' + (c.image ? " disabled" : "") + ' title="เลือกรูปไอคอนของหมวดนี้ (รูปการ์ตูนหน้าหมวด)" style="flex:0 0 130px">' +
            CAT_ICONS.map(function (ic) { return '<option value="' + ic + '"' + ((c.icon || "tool") === ic ? " selected" : "") + ">" + (CAT_ICON_TH[ic] || ic) + "</option>"; }).join("") + "</select>" +
          '<label class="btn btn-sm" style="cursor:pointer;white-space:nowrap">⬆ รูป<input type="file" accept="image/*" data-cimg="' + i + '" style="display:none"></label>' +
          (c.image ? '<button type="button" class="btn btn-sm" data-cimgclr="' + i + '">ลบรูป</button>' : "") +
          '<label class="f-check" style="white-space:nowrap" title="หมวดนี้คิด VAT ไหม"><input type="checkbox" data-cv="' + i + '"' + (c.vat !== false ? " checked" : "") + "> VAT</label>" +
          '<label class="f-check" style="white-space:nowrap"><input type="checkbox" data-ch="' + i + '"' + (c.hidden ? " checked" : "") + "> ซ่อน</label>" +
          '<button type="button" class="btn btn-sm btn-danger" data-cdel="' + i + '">ลบ</button></div>';
      }).join("");
      catList.querySelectorAll("[data-cdel]").forEach(function (b) { b.onclick = function () { syncCats(); cats.splice(+b.dataset.cdel, 1); renderCats(); }; });
      catList.querySelectorAll("[data-cimgclr]").forEach(function (b) { b.onclick = function () { syncCats(); cats[+b.dataset.cimgclr].image = ""; renderCats(); }; });
      catList.querySelectorAll("[data-ci]").forEach(function (sel) { sel.addEventListener("change", function () { syncCats(); renderCats(); }); });
      catList.querySelectorAll("[data-cp]").forEach(function (sel) { sel.addEventListener("change", function () { syncCats(); renderCats(); }); });
      catList.querySelectorAll("[data-ch]").forEach(function (chk) { chk.addEventListener("change", function () { syncCats(); renderCats(); }); });
      catList.querySelectorAll("[data-cimg]").forEach(function (inp) {
        inp.addEventListener("change", function (e) {
          var f = e.target.files && e.target.files[0]; if (!f) return;
          var idx = +inp.dataset.cimg;
          readImageFile(f, function (d) { syncCats(); cats[idx].image = d; renderCats(); });
        });
      });
      catList.querySelectorAll("[data-crow]").forEach(function (row) {
        row.addEventListener("dragstart", function (e) { syncCats(); _catDragIdx = +row.dataset.crow; e.dataTransfer.effectAllowed = "move"; row.style.opacity = "0.4"; });
        row.addEventListener("dragend", function () { row.style.opacity = ""; });
        row.addEventListener("dragover", function (e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; row.style.background = "var(--bg-hover,#f5f5f5)"; });
        row.addEventListener("dragleave", function () { row.style.background = ""; });
        row.addEventListener("drop", function (e) {
          e.preventDefault(); row.style.background = "";
          var dst = +row.dataset.crow;
          if (_catDragIdx === null || _catDragIdx === dst) return;
          var moved = cats.splice(_catDragIdx, 1)[0];
          cats.splice(dst, 0, moved);
          _catDragIdx = null;
          renderCats();
        });
      });
    }
    if (catList) { renderCats(); var catAddBtn = root.querySelector("[data-cat-add]"); if (catAddBtn) catAddBtn.addEventListener("click", function () { syncCats(); cats.push({ key: "c" + Date.now().toString(36), label: "", icon: "tool", image: "", hidden: false, parent: "" }); renderCats(); }); }

    // ----- Promo banner -----
    var promo = Object.assign({ enabled: false, title: "", text: "", image: "", startDate: "", endDate: "", autoBroadcast: false, links: [], dateText: "", conditions: "" }, st.promo || {});
    var promoEnabled = root.querySelector("[data-promo-enabled]");
    if (promoEnabled) {
      promoEnabled.checked = !!promo.enabled;
      var promoTitle = root.querySelector("[data-promo-title]");
      promoTitle.value = promo.title || "";
      root.querySelector("[data-promo-text]").value = promo.text || "";
      var promoStart = root.querySelector("[data-promo-start]");
      var promoEnd = root.querySelector("[data-promo-end]");
      if (promoStart) promoStart.value = promo.startDate || "";
      if (promoEnd) promoEnd.value = promo.endDate || "";
      var promoAnchor = root.querySelector("[data-promo-anchor]");
      var promoBefore = root.querySelector("[data-promo-before]");
      var promoAfter = root.querySelector("[data-promo-after]");
      var promoRecurring = root.querySelector("[data-promo-recurring]");
      var promoAnchorWrap = root.querySelector("[data-promo-anchor-wrap]");
      if (promoAnchor) promoAnchor.value = promo.anchorDate || "";
      if (promoBefore) promoBefore.value = (promo.beforeDays != null && promo.beforeDays !== "") ? promo.beforeDays : 1;
      if (promoAfter) promoAfter.value = (promo.afterDays != null && promo.afterDays !== "") ? promo.afterDays : 2;
      if (promoRecurring) promoRecurring.checked = !!promo.recurring;
      // อ็อบเจกต์โปรปัจจุบันจากค่าในฟอร์ม (ไว้คำนวณ token/ช่วงวันแบบสด)
      var curPromo = function () {
        var dtEl = root.querySelector("[data-promo-datetext]");
        return { title: promoTitle.value, recurring: !!(promoRecurring && promoRecurring.checked), anchorDate: (promoAnchor && promoAnchor.value) || "", beforeDays: (promoBefore && promoBefore.value) || "", afterDays: (promoAfter && promoAfter.value) || "", startDate: (promoStart && promoStart.value) || "", endDate: (promoEnd && promoEnd.value) || "", dateText: (dtEl && dtEl.value) || "" };
      };
      // ตัวอย่างหัวข้อหลังเติม token + ช่วงวันที่อัตโนมัติ — อัปเดตสดเมื่อพิมพ์/เปลี่ยนวันที่
      var titlePrev = root.querySelector("[data-promo-titleprev]");
      var winPrev = root.querySelector("[data-promo-windowprev]");
      var updPromoPrev = function () {
        var p = curPromo();
        // โหมดทำซ้ำ: ซ่อนช่องวันที่โปรซ้ำ (ไม่ต้องเลือก)
        if (promoAnchorWrap) promoAnchorWrap.style.display = p.recurring ? "none" : "";
        if (titlePrev && S.fillPromoTokens) {
          if (!/\{dd\}|\{date\}/.test(p.title || "")) titlePrev.textContent = "";
          else titlePrev.textContent = " → ตัวอย่าง: “" + S.fillPromoTokens(p.title, p) + "”";
        }
        if (winPrev && S.promoDateText) {
          var dt = S.promoDateText(p);
          winPrev.textContent = (dt && (p.recurring || p.anchorDate)) ? ((p.recurring ? " → รอบถัดไป: " : " → ช่วงโปร: ") + dt) : "";
        }
      };
      promoTitle.addEventListener("input", updPromoPrev);
      if (promoStart) promoStart.addEventListener("change", updPromoPrev);
      if (promoAnchor) promoAnchor.addEventListener("change", updPromoPrev);
      if (promoBefore) promoBefore.addEventListener("input", updPromoPrev);
      if (promoAfter) promoAfter.addEventListener("input", updPromoPrev);
      if (promoRecurring) promoRecurring.addEventListener("change", updPromoPrev);
      updPromoPrev();
      var promoDateText = root.querySelector("[data-promo-datetext]");
      var promoConditions = root.querySelector("[data-promo-conditions]");
      if (promoDateText) promoDateText.value = promo.dateText || "";
      if (promoConditions) promoConditions.value = promo.conditions || "";
      var promoBroadcast = root.querySelector("[data-promo-broadcast]");
      if (promoBroadcast) promoBroadcast.checked = !!promo.autoBroadcast;
      // ----- ตัวแก้ไขลิงก์ร้าน (label + url ทีละแถว) -----
      var plinks = (promo.links || []).map(function (l) { return { label: l.label || "", url: l.url || "" }; });
      var plinkBox = root.querySelector("[data-promo-links]");
      // var (ไม่ใช่ function decl) เพราะ strict mode block-scope — ต้องเรียกได้จาก save handler ด้านล่าง
      var syncPLinks = function () {
        if (!plinkBox) return;
        plinkBox.querySelectorAll("[data-pll]").forEach(function (i) { plinks[+i.dataset.pll].label = i.value; });
        plinkBox.querySelectorAll("[data-plu]").forEach(function (i) { plinks[+i.dataset.plu].url = i.value; });
      };
      var renderPLinks = function () {
        if (!plinkBox) return;
        plinkBox.innerHTML = plinks.map(function (l, i) {
          return '<div class="row-edit" style="display:flex;gap:6px;margin-bottom:6px">' +
            '<input data-pll="' + i + '" value="' + esc(l.label) + '" placeholder="ชื่อช่อง เช่น Shopee Mall" style="flex:1">' +
            '<input data-plu="' + i + '" value="' + esc(l.url) + '" placeholder="วางลิงก์ https://…" style="flex:1.6">' +
            '<button class="btn btn-sm btn-danger" data-pldel="' + i + '">ลบ</button></div>';
        }).join("");
        plinkBox.querySelectorAll("[data-pldel]").forEach(function (b) {
          b.onclick = function () { syncPLinks(); plinks.splice(+b.dataset.pldel, 1); renderPLinks(); };
        });
      }
      renderPLinks();
      var plinkAdd = root.querySelector("[data-promo-link-add]");
      if (plinkAdd) plinkAdd.addEventListener("click", function () { syncPLinks(); plinks.push({ label: "", url: "" }); renderPLinks(); });
      // ----- รูปโปรหลายรูป (เลื่อนซ้าย-ขวาบนเว็บ + image carousel บน LINE) -----
      var pimages = (promo.images && promo.images.length) ? promo.images.slice() : (promo.image ? [promo.image] : []);
      var promoPrev = root.querySelector("[data-promo-prev]");
      var drawPromo = function () {
        if (!promoPrev) return;
        if (!pimages.length) { promoPrev.innerHTML = '<span class="img-hint">ยังไม่มีรูป — กด “เพิ่มรูป” ด้านล่าง</span>'; return; }
        promoPrev.innerHTML = '<div class="pcount">มีทั้งหมด ' + pimages.length + ' รูป (ลูกค้าปัดดูทีละใบ)</div>' +
          pimages.map(function (src, i) {
            return '<div class="ptile">' +
              '<span class="pnum">' + (i + 1) + "</span>" +
              '<img src="' + src + '" alt="รูปที่ ' + (i + 1) + '">' +
              '<button type="button" class="pdel" data-pimgdel="' + i + '" title="ลบรูปนี้">×</button></div>';
          }).join("");
        promoPrev.querySelectorAll("[data-pimgdel]").forEach(function (b) {
          b.onclick = function () { pimages.splice(+b.dataset.pimgdel, 1); drawPromo(); };
        });
      };
      drawPromo();
      root.querySelector("[data-promo-file]").addEventListener("change", function (e) {
        var files = Array.prototype.slice.call(e.target.files || []);
        if (!files.length) return;
        var loaded = 0;
        files.forEach(function (f) { readImageFile(f, function (d) { pimages.push(d); if (++loaded === files.length) drawPromo(); }); });
        e.target.value = "";
      });
      root.querySelector("[data-promo-clear]").addEventListener("click", function () { pimages = []; drawPromo(); });
      // ส่งโปรหาเพื่อนทุกคน (LINE) ทันที — ต้องบันทึกตั้งค่าก่อน เพื่อให้ API อ่าน promo ล่าสุด
      var sendNow = root.querySelector("[data-promo-sendnow]");
      var sendStatus = root.querySelector("[data-promo-sendstatus]");
      if (sendNow) sendNow.addEventListener("click", function () {
        if (sendStatus) sendStatus.textContent = "กำลังส่ง… (บันทึกตั้งค่าก่อนถ้าเพิ่งแก้)";
        sendNow.disabled = true;
        var tokP = S.adminIdToken ? S.adminIdToken() : Promise.resolve("");
        tokP.then(function (token) {
          return fetch("/api/broadcast-promo", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: "{}" });
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
          .then(function (r) {
            sendNow.disabled = false;
            if (r.ok) { if (sendStatus) sendStatus.textContent = "ส่งหาเพื่อนทุกคนแล้ว ✓"; if (window.U && U.toast) U.toast("ส่งโปรหาเพื่อนทุกคนใน LINE แล้ว ✓", "ok"); }
            else { var msg = r.body.error === "promo-disabled" ? "เปิดใช้งานแบนเนอร์โปร + บันทึกก่อนส่ง" : (r.body.error === "not-admin" ? "ยังไม่ใช่ admin" : "ส่งไม่สำเร็จ: " + (r.body.error || "")); if (sendStatus) sendStatus.textContent = msg; if (window.U && U.toast) U.toast(msg, "err"); }
          }).catch(function () { sendNow.disabled = false; if (sendStatus) sendStatus.textContent = "ส่งไม่สำเร็จ"; });
      });
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
      syncFaq(); syncBrands(); syncFlashItems(); syncSdays(); syncPhones(); syncCats();
      var patch = {};
      simpleKeys.forEach(function (k) { var el = root.querySelector('[data-set="' + k + '"]'); patch[k] = el ? el.value : st[k]; });
      patch.phone = phones.map(function (p) { return p.trim(); }).filter(Boolean).join(", ");
      patch.categories = cats.filter(function (c) { return (c.label || "").trim(); }).map(function (c) { return { key: c.key, label: c.label.trim(), icon: c.icon || "tool", image: c.image || "", hidden: !!c.hidden, parent: c.parent || "", vat: c.vat !== false }; });
      if (openSunEl) patch.openSun = openSunEl.checked;
      if (vatOnEl) patch.vatEnabled = vatOnEl.checked;
      if (vatPctEl) patch.vatPct = +vatPctEl.value || 0;
      if (vatModeEl) patch.vatMode = vatModeEl.value;
      if (cardOnEl) patch.cardPayOn = cardOnEl.checked;
      if (cardThrEl) patch.cardThreshold = +cardThrEl.value || 0;
      patch.specialDays = sdays.filter(function (d) { return d.date; });
      patch.heroPhrases = phrasesEl.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      patch.faq = faq.filter(function (f) { return (f.q || "").trim(); });
      patch.qrImage = pendingQR;
      patch.brands = brands.filter(function (b) { return (b.name || "").trim(); });
      if (promoEnabled) { syncPLinks(); patch.promo = { enabled: promoEnabled.checked, title: root.querySelector("[data-promo-title]").value, text: root.querySelector("[data-promo-text]").value, images: pimages, image: pimages[0] || "", startDate: (promoStart && promoStart.value) || "", endDate: (promoEnd && promoEnd.value) || "", autoBroadcast: !!(root.querySelector("[data-promo-broadcast]") && root.querySelector("[data-promo-broadcast]").checked), links: plinks.filter(function (l) { return (l.url || "").trim(); }), dateText: (promoDateText && promoDateText.value) || "", conditions: (promoConditions && promoConditions.value) || "", anchorDate: (promoAnchor && promoAnchor.value) || "", beforeDays: (promoBefore && promoBefore.value !== "") ? Math.max(0, parseInt(promoBefore.value, 10) || 0) : 1, afterDays: (promoAfter && promoAfter.value !== "") ? Math.max(0, parseInt(promoAfter.value, 10) || 0) : 2, recurring: !!(promoRecurring && promoRecurring.checked) }; }
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
    var groupLabels = { access: "เข้าถึง / ใช้งานหน้า", danger: "สิทธิ์ลบข้อมูลถาวร (เปิดเฉพาะคนที่ไว้ใจ)" };
    // สร้างชุด checkbox สิทธิ์ แบ่งตามกลุ่มจาก S.PERM_DEFS
    //   attr = ชื่อ data-attribute ของ input, idAttr = แอตทริบิวต์เสริม (เช่น data-id="..")
    //   checkedFn(key) → true/false ว่าติ๊กไว้ไหม
    function permChecks(attr, idAttr, checkedFn) {
      var groups = {};
      S.PERM_DEFS.forEach(function (d) { (groups[d.group] = groups[d.group] || []).push(d); });
      return Object.keys(groups).map(function (g) {
        return '<div class="perm-group' + (g === "danger" ? " perm-danger" : "") + '">' +
          '<div class="perm-group-title">' + (groupLabels[g] || g) + "</div>" +
          '<div class="perm-grid">' + groups[g].map(function (d) {
            return '<label class="f-check"><input type="checkbox" ' + attr + '="' + d.key + '"' + idAttr +
              (checkedFn(d.key) ? " checked" : "") + "> " + d.label + "</label>";
          }).join("") + "</div></div>";
      }).join("");
    }
    function render() {
      var staff = S.getStaff();
      root.innerHTML = staff.map(function (m) {
        var owner = m.role === "owner";
        return '<div class="panel"><div class="panel-head"><h2>' + (owner ? "⭐ แอดมิน" : "👷 พนักงาน") + "</h2>" +
          (owner ? "" : '<button class="btn btn-sm btn-danger" data-del="' + m.id + '">ลบพนักงาน</button>') + "</div>" +
          '<div class="f2"><div class="field"><label>ชื่อ</label><input data-f="name" data-id="' + m.id + '" value="' + esc(m.name) + '"></div>' +
          '<div class="field"><label>อีเมล (ใช้เข้าสู่ระบบ)</label><input data-f="email" data-id="' + m.id + '" value="' + esc(m.email) + '"></div></div>' +
          '<div class="field"><label>รหัสผ่าน</label><input data-f="password" data-id="' + m.id + '" value="' + esc(m.password) + '"></div>' +
          (owner ? '<div class="img-hint">แอดมินมีสิทธิ์ใช้งานทุกระบบโดยอัตโนมัติ</div>'
            : '<div class="field"><label>สิทธิ์การใช้ระบบหลังร้าน</label>' +
              permChecks("data-perm", ' data-id="' + m.id + '"', function (k) { return m.perms && m.perms[k]; }) + "</div>") +
          '<button class="btn" data-save="' + m.id + '">บันทึก</button></div>';
      }).join("") +
      '<div class="panel"><div class="panel-head"><h2>+ เพิ่มพนักงานใหม่</h2></div>' +
        '<div class="f2"><div class="field"><label>ชื่อ</label><input data-new="name"></div>' +
        '<div class="field"><label>อีเมล</label><input data-new="email"></div></div>' +
        '<div class="field"><label>รหัสผ่าน</label><input data-new="password"></div>' +
        '<div class="field"><label>สิทธิ์</label>' + permChecks("data-newperm", "", function (k) { return k === "dashboard"; }) + "</div>" +
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
    if (p.image) return '<div class="prod-mini" style="background-image:url(\'' + String(p.image).replace(/'/g, "%27") + '\');background-size:cover;background-position:center"></div>';
    return '<div class="prod-mini">' + U.iconSvg(p.icon, 24) + "</div>";
  }
  function statusTh(s) { return { new: "ใหม่", paid: "ชำระแล้ว", fulfilled: "ส่งมอบแล้ว", returned: "คืนแล้ว", cancelled: "ยกเลิก" }[s] || s; }
  function saleRent(p) { return [p.forSale ? "ขาย" : null, p.forRent ? "เช่า" : null].filter(Boolean).join("+") || "—"; }
  function esc(s) { return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
})();
