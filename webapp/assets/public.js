/* =================================================================
   M.E.Tools — public storefront page logic
   ================================================================= */
(function () {
  "use strict";
  var S = window.MEStore, U = window.MEUI;
  var page = document.body.getAttribute("data-page");

  U.mountChrome(page === "home" ? "home" : page === "shop" || page === "product" ? "shop" : page === "orders" ? "orders" : page === "catalog" ? "catalog" : "");

  var routes = { home: initHome, shop: initShop, product: initProduct, cart: initCart, orders: initOrders, login: initLogin, register: initRegister };
  if (routes[page]) routes[page]();

  /* ===================== AUTH ===================== */
  function applyAuthText(kind) {
    var st = S.getSettings();
    setText("[data-auth-title]", kind === "register" ? st.authRegTitle : st.authLoginTitle);
    setText("[data-auth-sub]", kind === "register" ? st.authRegSub : st.authLoginSub);
  }
  function wireSocial() {
    document.querySelectorAll("[data-social]").forEach(function (b) {
      b.addEventListener("click", function () { socialLogin(b.getAttribute("data-social")); });
    });
  }
  function initLogin() {
    applyAuthText("login");
    wireSocial();
    var form = document.querySelector("[data-login]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector("[data-email]").value;
      var pass = form.querySelector("[data-pass]").value;
      // 1) staff/owner ใน localStorage ก่อน (ต้อง local เสมอ เพื่อความปลอดภัย)
      var local = S.loginUser(email, pass);
      if (local.ok && (local.role === "owner" || local.role === "employee")) {
        U.toast("เข้าสู่ระบบสำเร็จ", "ok");
        setTimeout(function () { window.location.href = "admin/dashboard.html"; }, 400);
        return;
      }
      // 2) ลูกค้า — ลอง Firebase Auth (cross-device) ก่อน
      S.loginUserCloud(email, pass).then(function (r) {
        U.toast("เข้าสู่ระบบสำเร็จ", "ok");
        setTimeout(function () { window.location.href = redirectAfterAuth(); }, 400);
      }).catch(function (err) {
        // 3) fallback localStorage ลูกค้าเก่า (สมัครก่อน Phase D)
        if (local.ok) {
          U.toast("เข้าสู่ระบบสำเร็จ (โหมดออฟไลน์)", "ok");
          setTimeout(function () { window.location.href = redirectAfterAuth(); }, 400);
          return;
        }
        // แปลง Firebase error code เป็นภาษาไทย
        var code = err && err.code ? err.code : "";
        var msg = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        if (code === "auth/user-not-found") msg = "ไม่พบบัญชีอีเมลนี้ — กรุณาสมัครก่อน";
        else if (code === "auth/wrong-password" || code === "auth/invalid-credential") msg = "รหัสผ่านไม่ถูกต้อง";
        else if (code === "auth/too-many-requests") msg = "ลองเข้าระบบบ่อยเกินไป รอสักครู่แล้วลองใหม่";
        else if (code === "auth/network-request-failed") msg = "เครือข่ายมีปัญหา ลองใหม่";
        U.toast(msg, "err");
      });
    });
  }
  function initRegister() {
    applyAuthText("register");
    wireSocial();
    var form = document.querySelector("[data-register]");
    var phoneVerified = false, otpCode = null;
    var phoneI = form.querySelector("[data-phone]");
    var otpBox = form.querySelector("[data-otp-box]"), otpStatus = form.querySelector("[data-otp-status]");
    form.querySelector("[data-otp-send]").addEventListener("click", function () {
      var digits = phoneI.value.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 10) { U.toast("กรุณากรอกเบอร์โทรให้ครบ (9–10 หลัก)", "err"); return; }
      otpCode = ("" + Math.floor(100000 + Math.random() * 900000));
      otpBox.hidden = false;
      otpStatus.className = "otp-status sending";
      otpStatus.textContent = "ส่งรหัส OTP แล้ว (โหมดสาธิต รหัสคือ " + otpCode + ")";
      U.toast("ส่ง OTP ไปยัง " + phoneI.value + " แล้ว (สาธิต)", "ok");
    });
    form.querySelector("[data-otp-check]").addEventListener("click", function () {
      if (form.querySelector("[data-otp]").value.trim() === otpCode && otpCode) {
        phoneVerified = true; otpStatus.className = "otp-status ok"; otpStatus.textContent = "ยืนยันเบอร์โทรแล้ว ✓";
      } else { U.toast("รหัส OTP ไม่ถูกต้อง", "err"); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!phoneVerified) { U.toast("กรุณายืนยันเบอร์โทรด้วย OTP ก่อน", "err"); return; }
      var pass = form.querySelector("[data-pass]").value, pass2 = form.querySelector("[data-pass2]").value;
      if (pass !== pass2) { U.toast("รหัสผ่านไม่ตรงกัน", "err"); return; }
      if (pass.length < 6) { U.toast("รหัสผ่านต้องยาวอย่างน้อย 6 ตัว", "err"); return; }
      var payload = {
        name: form.querySelector("[data-name]").value.trim(),
        email: form.querySelector("[data-email]").value,
        phone: phoneI.value.trim(),
        password: pass
      };
      // ลอง Firebase Auth ก่อน (cross-device); ถ้าไม่ได้ค่อย fall back localStorage
      S.registerUserCloud(payload).then(function (r) {
        U.toast("สมัครสมาชิกสำเร็จ ยินดีต้อนรับ!", "ok");
        setTimeout(function () { window.location.href = redirectAfterAuth(); }, 500);
      }).catch(function (err) {
        var code = err && err.code ? err.code : "";
        if (code === "auth/email-already-in-use") { U.toast("อีเมลนี้สมัครแล้ว — ลองเข้าสู่ระบบแทน", "err"); return; }
        if (code === "auth/invalid-email") { U.toast("รูปแบบอีเมลไม่ถูกต้อง", "err"); return; }
        if (code === "auth/weak-password") { U.toast("รหัสผ่านอ่อนเกินไป (≥ 6 ตัวอักษร)", "err"); return; }
        // อาจเป็น Firebase Config ยังไม่ได้ตั้ง → fallback localStorage แบบเดิม
        var local = S.registerUser(payload);
        if (local.ok) { U.toast("สมัครสมาชิกสำเร็จ (โหมดออฟไลน์)", "ok"); setTimeout(function () { window.location.href = redirectAfterAuth(); }, 500); }
        else U.toast(local.error || err.message || "สมัครไม่สำเร็จ", "err");
      });
    });
  }
  function redirectAfterAuth() { var r = U.qp("next"); return r ? decodeURIComponent(r) : "index.html"; }

  function socialLogin(provider) {
    // Google → ใช้ Firebase Auth ตรง ๆ ไม่ต้องตั้ง Client ID เพิ่ม (Firebase Console เปิด provider พอ)
    // Facebook → ยังใช้ flow เก่าก่อน
    if (provider === "google") {
      S.loginGoogleCloud().then(function () {
        U.toast("เข้าสู่ระบบด้วย Google สำเร็จ", "ok");
        setTimeout(function () { location.href = redirectAfterAuth(); }, 500);
      }).catch(function (err) {
        var code = err && err.code ? err.code : "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
        if (code === "auth/operation-not-allowed") { U.toast("Google sign-in ยังไม่ได้เปิดใน Firebase Console", "err"); return; }
        if (code === "auth/popup-blocked") { U.toast("เบราว์เซอร์บล็อกป๊อปอัพ — กรุณาอนุญาตและลองใหม่", "err"); return; }
        // อาจไม่ได้ตั้ง Firebase Config — fallback ของเก่า
        var st = S.getSettings();
        if (st.googleClientId) { googleSignIn(st.googleClientId); return; }
        U.toast("เข้าสู่ระบบด้วย Google ไม่สำเร็จ: " + (err.message || err), "err");
      });
      return;
    }
    var st = S.getSettings();
    var id = st.facebookAppId;
    if (!id) { U.toast("ผู้ดูแลร้านยังไม่ได้เชื่อมต่อ Facebook — ตั้งค่า App ID ได้ในระบบหลังร้าน", "err"); return; }
    facebookSignIn(id);
  }
  function loadScript(src, cb) {
    if (document.querySelector('script[src="' + src + '"]')) { cb(); return; }
    var s = document.createElement("script"); s.src = src; s.async = true; s.onload = cb; s.onerror = function () { U.toast("โหลดสคริปต์ไม่สำเร็จ", "err"); }; document.head.appendChild(s);
  }
  function googleSignIn(clientId) {
    loadScript("https://accounts.google.com/gsi/client", function () {
      if (!window.google || !google.accounts || !google.accounts.id) { U.toast("เชื่อมต่อ Google ไม่สำเร็จ", "err"); return; }
      google.accounts.id.initialize({ client_id: clientId, callback: function (resp) {
        try {
          var part = resp.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
          var p = JSON.parse(decodeURIComponent(escape(atob(part))));
          var r = S.socialUpsert(p.email, p.name, "google");
          if (r.ok) { U.toast("เข้าสู่ระบบด้วย Google สำเร็จ", "ok"); setTimeout(function () { location.href = redirectAfterAuth(); }, 500); }
        } catch (e) { U.toast("เข้าสู่ระบบด้วย Google ไม่สำเร็จ", "err"); }
      } });
      google.accounts.id.prompt();
    });
  }
  function facebookSignIn(appId) {
    loadScript("https://connect.facebook.net/en_US/sdk.js", function () {
      if (!window.FB) { U.toast("เชื่อมต่อ Facebook ไม่สำเร็จ", "err"); return; }
      FB.init({ appId: appId, version: "v19.0", cookie: true, xfbml: false });
      FB.login(function (resp) {
        if (resp.authResponse) {
          FB.api("/me", { fields: "name,email" }, function (u) {
            var r = S.socialUpsert(u.email || (u.id + "@facebook.local"), u.name, "facebook");
            if (r.ok) { U.toast("เข้าสู่ระบบด้วย Facebook สำเร็จ", "ok"); setTimeout(function () { location.href = redirectAfterAuth(); }, 500); }
          });
        }
      }, { scope: "public_profile,email" });
    });
  }

  /* ===================== HOME ===================== */
  function initHome() {
    // editable hero content + typewriter
    var st = S.getSettings();
    setText("[data-hero-overline]", st.heroOverline);
    setText("[data-hero-title]", st.heroTitle);
    setText("[data-hero-sub]", st.heroSub);
    renderBrandsTagline(st.brandsTagline);
    renderBrands(st.brands);
    renderPromo(st.promo);
    renderFlash(st.flashSale);
    var typeEl = document.querySelector("[data-hero-type]");
    if (typeEl) {
      var phrases = (st.heroPhrases && st.heroPhrases.length) ? st.heroPhrases : ["เช่าก็ได้ ซื้อก็ดี"];
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) typeEl.textContent = phrases[0];
      else typewriter(typeEl, phrases);
    }

    var box = document.querySelector("[data-cats]");
    if (box) {
      var products = S.getProducts();
      box.innerHTML = S.CATEGORIES.map(function (c) {
        var n = products.filter(function (p) { return p.category === c.key; }).length;
        return (
          '<a class="me-cat" href="shop.html?cat=' + c.key + '">' +
          '<span class="me-cat-ic">' + U.iconSvg(iconForCat(c.key), 40) + "</span>" +
          '<span class="me-cat-name">' + c.label + "</span>" +
          '<span class="me-cat-count">' + n + " รายการ</span></a>"
        );
      }).join("");
    }
    var feat = document.querySelector("[data-featured]");
    if (feat) {
      feat.innerHTML = S.getProducts().slice(0, 6).map(cardHtml).join("");
      wireCards(feat);
    }
    // FAQ accordion (editable in back office)
    var faqBox = document.querySelector("[data-faq]");
    if (faqBox) {
      faqBox.innerHTML = (st.faq || []).map(function (f, i) {
        return '<div class="faq-item"><button type="button" class="faq-q" data-faq-q="' + i + '"><span>' + esc(f.q) + '</span><span class="faq-ic">+</span></button>' +
          '<div class="faq-a">' + esc(f.a) + "</div></div>";
      }).join("");
      faqBox.querySelectorAll("[data-faq-q]").forEach(function (b) {
        b.addEventListener("click", function () { b.parentElement.classList.toggle("open"); });
      });
    }
    var form = document.querySelector("[data-search-form]");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = form.querySelector("[name=q]").value.trim();
        var cat = form.querySelector("[name=cat]").value;
        var url = "shop.html?";
        if (q) url += "q=" + encodeURIComponent(q) + "&";
        if (cat) url += "cat=" + cat;
        window.location.href = url;
      });
    }
  }

  /* ===================== SHOP ===================== */
  function initShop() {
    var state = { q: U.qp("q") || "", cats: U.qp("cat") ? [U.qp("cat")] : [], brands: U.qp("brand") ? [U.qp("brand")] : [], mode: U.qp("mode") || "all", sort: "default", priceMin: 0, priceMax: 0, inStock: false };

    var products = S.getProducts();
    var fbox = document.querySelector("[data-filters]");
    var allBrands = uniq(products.map(function (p) { return p.brand; }).filter(Boolean));
    var catCounts = {};
    products.forEach(function (p) { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });

    fbox.innerHTML =
      "<h3>ตัวกรอง</h3>" +
      '<div class="filter-group"><span class="lbl">ช่วงราคา (บาท)</span>' +
      '<div class="price-range-row">' +
      '<input type="number" min="0" step="100" placeholder="ต่ำสุด" data-pmin class="price-inp"> –' +
      '<input type="number" min="0" step="100" placeholder="สูงสุด" data-pmax class="price-inp">' +
      '</div></div>' +
      '<div class="filter-group">' +
      '<label class="check"><input type="checkbox" data-f="instock"> เฉพาะมีสต็อก</label></div>' +
      '<div class="filter-group"><span class="lbl">ประเภทสินค้า</span>' +
      S.CATEGORIES.map(function (c) {
        var n = catCounts[c.key] || 0;
        return '<label class="check"><input type="checkbox" data-f="cat" value="' + c.key + '"' + (state.cats.indexOf(c.key) >= 0 ? " checked" : "") + '> ' + c.label + ' <span class="filter-count">(' + n + ')</span></label>';
      }).join("") + "</div>" +
      '<div class="filter-group"><span class="lbl">แบรนด์</span>' +
      allBrands.map(function (b) { return '<label class="check"><input type="checkbox" data-f="brand" value="' + b + '"' + (state.brands.indexOf(b) >= 0 ? " checked" : "") + '> ' + b + '</label>'; }).join("") + "</div>" +
      '<div class="filter-group"><span class="lbl">รูปแบบ</span>' +
      '<label class="check"><input type="radio" name="mode" data-f="mode" value="all" checked> ทั้งหมด</label>' +
      '<label class="check"><input type="radio" name="mode" data-f="mode" value="buy"> ซื้อสินค้า</label>' +
      '<label class="check" data-rent-only><input type="radio" name="mode" data-f="mode" value="rent"> เช่าสินค้า</label></div>' +
      '<button class="me-btn me-btn-ghost me-btn-sm" data-clear>ล้างตัวกรอง</button>';

    var pminEl = fbox.querySelector("[data-pmin]");
    var pmaxEl = fbox.querySelector("[data-pmax]");
    pminEl.addEventListener("input", function () { state.priceMin = parseInt(pminEl.value, 10) || 0; render(); });
    pmaxEl.addEventListener("input", function () { state.priceMax = parseInt(pmaxEl.value, 10) || 0; render(); });

    var sinput = document.querySelector("[data-q]");
    if (sinput) { sinput.value = state.q; sinput.addEventListener("input", function () { state.q = sinput.value.trim(); render(); }); }
    var sortSel = document.querySelector("[data-sort]");
    if (sortSel) sortSel.addEventListener("change", function () { state.sort = sortSel.value; render(); });

    fbox.addEventListener("change", function (e) {
      var f = e.target.getAttribute("data-f");
      if (f === "cat") state.cats = checkedValues(fbox, "cat");
      else if (f === "brand") state.brands = checkedValues(fbox, "brand");
      else if (f === "mode") state.mode = e.target.value;
      else if (f === "instock") state.inStock = e.target.checked;
      render();
    });
    fbox.querySelector("[data-clear]").addEventListener("click", function () {
      state.q = ""; state.cats = []; state.brands = []; state.mode = "all"; state.sort = "default"; state.priceMin = 0; state.priceMax = 0; state.inStock = false;
      if (sinput) sinput.value = "";
      if (pminEl) pminEl.value = "";
      if (pmaxEl) pmaxEl.value = "";
      fbox.querySelectorAll("input[type=checkbox]").forEach(function (c) { c.checked = false; });
      var allRadio = fbox.querySelector("input[value=all]"); if (allRadio) allRadio.checked = true;
      if (sortSel) sortSel.value = "default";
      render();
    });

    function render() {
      var list = S.getProducts().filter(function (p) {
        if (state.q) { var hay = (p.name + " " + p.brand + " " + p.sku + " " + S.categoryLabel(p.category)).toLowerCase(); if (hay.indexOf(state.q.toLowerCase()) < 0) return false; }
        if (state.cats.length && state.cats.indexOf(p.category) < 0) return false;
        if (state.brands.length && state.brands.indexOf(p.brand) < 0) return false;
        if (state.mode === "buy" && !p.forSale) return false;
        if (state.mode === "rent" && !p.forRent) return false;
        if (state.inStock && S.available(p) <= 0) return false;
        if (state.priceMin || state.priceMax) {
          var effPrice = state.mode === "rent" ? (p.rentPerDay || p.price || 0) : (p.price || p.rentPerDay || 0);
          if (state.priceMin && effPrice < state.priceMin) return false;
          if (state.priceMax && effPrice > state.priceMax) return false;
        }
        return true;
      });
      if (state.sort === "price-asc") list.sort(function (a, b) { return (a.price || a.rentPerDay || 0) - (b.price || b.rentPerDay || 0); });
      else if (state.sort === "price-desc") list.sort(function (a, b) { return (b.price || b.rentPerDay || 0) - (a.price || a.rentPerDay || 0); });
      else if (state.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name, "th"); });

      var grid = document.querySelector("[data-cards]");
      grid.innerHTML = list.length ? list.map(cardHtml).join("")
        : '<div class="empty" style="grid-column:1/-1"><div class="empty-ic">' + U.iconSvg("tool", 56) + "</div><h3>ไม่พบสินค้าที่ตรงกับตัวกรอง</h3><p>ลองล้างตัวกรองหรือค้นด้วยคำอื่น</p></div>";
      wireCards(grid);
      var rc = document.querySelector("[data-count]");
      if (rc) rc.textContent = "พบ " + list.length + " รายการ";
    }
    render();
  }

  /* ===================== PRODUCT ===================== */
  function initProduct() {
    var id = U.qp("id");
    var p = S.getProduct(id);
    var root = document.querySelector("[data-product]");
    if (!p) { root.innerHTML = '<div class="empty"><h3>ไม่พบสินค้านี้</h3><a class="me-btn" href="shop.html">กลับไปหน้าสินค้า</a></div>'; return; }

    document.title = p.name + " — M.E.Tools";
    var avail = S.available(p);
    var mode = p.forSale ? "buy" : "rent";
    var qty = 1, days = 1;

    root.innerHTML =
      '<div class="crumbs"><a href="index.html">หน้าแรก</a> / <a href="shop.html">สินค้า</a> / ' +
        '<a href="shop.html?cat=' + p.category + '">' + S.categoryLabel(p.category) + "</a> / " + p.name + "</div>" +
      '<div class="pd-grid"><div>' + productGallery(p) + "</div>" +
        '<div class="pd-info"><span class="pd-brand">' + p.brand + "</span>" +
          '<h1 class="pd-name">' + p.name + "</h1>" +
          '<span class="' + (avail > 0 ? "stockpill in" : "stockpill out") + '">' +
            (avail > 0 ? "มีของพร้อมส่ง · เหลือ " + avail + " ชิ้น" : "สินค้าหมดชั่วคราว") + " · " + S.categoryLabel(p.category) + "</span>" +
          '<p class="pd-desc">' + p.desc + "</p>" +
          '<div class="pd-prices">' +
            (p.forSale ? '<div class="pd-price-box"><div class="k">ราคาขาย</div><div class="v">' + S.money(p.price) + "</div></div>" : "") +
            (p.forRent ? '<div class="pd-price-box" data-rent-only><div class="k">ค่าเช่า / วัน</div><div class="v rent">' + S.money(p.rentPerDay) + "</div></div>" : "") +
          "</div><div class=\"buybox\" data-buybox></div>" +
          "<table class=specs><tbody><tr><th>รหัสสินค้า (SKU)</th><td>" + p.sku + "</td></tr>" +
            "<tr><th>การรับประกัน</th><td>" + (p.warrantyYears ? "ศูนย์ " + p.warrantyYears + " ปี" : "ตามเงื่อนไขร้าน") + "</td></tr>" +
            (p.motorType && p.motorType !== "—" ? "<tr><th>ระบบมอเตอร์</th><td>" + p.motorType + "</td></tr>" : "") +
            (p.shipSize ? "<tr><th>ขนาด/น้ำหนักสำหรับจัดส่ง</th><td>" + p.shipSize + "</td></tr>" : "") +
            p.specs.map(function (s) { return "<tr><th>" + s[0] + "</th><td>" + s[1] + "</td></tr>"; }).join("") +
          "</tbody></table></div></div>";

    wireGallery(root);

    var bb = root.querySelector("[data-buybox]");
    function drawBuybox() {
      var unit = mode === "rent" ? p.rentPerDay : p.price;
      var total = mode === "rent" ? unit * qty * days : unit * qty;
      bb.innerHTML =
        '<div class="mode-toggle">' +
          '<button data-mode="buy" class="' + (mode === "buy" ? "on" : "") + '"' + (p.forSale ? "" : " disabled") + ">ซื้อสินค้า</button>" +
          '<button data-mode="rent" data-rent-only class="' + (mode === "rent" ? "on" : "") + '"' + (p.forRent ? "" : " disabled") + ">เช่าสินค้า</button>" +
        "</div>" +
        '<div class="buybox-line"><span>จำนวน</span><div class="qty"><button data-q="-1">−</button><input data-qty value="' + qty + '" inputmode="numeric"><button data-q="1">+</button></div></div>' +
        (mode === "rent"
          ? '<div class="buybox-line"><span>จำนวนวันเช่า</span><div class="qty"><button data-d="-1">−</button><input data-days value="' + days + '" inputmode="numeric"><button data-d="1">+</button></div></div>' +
            '<div class="buybox-line"><span>เงินมัดจำ (คืนเมื่อส่งคืน)</span><span>' + S.money(p.price * qty) + "</span></div>"
          : "") +
        '<div class="buybox-total"><span>' + (mode === "rent" ? "รวมค่าเช่า" : "รวม") + '</span><span class="v">' + S.money(total) + "</span></div>" +
        '<button class="me-btn me-btn-block" data-add ' + (avail > 0 ? "" : "disabled") + ">" + (avail > 0 ? (mode === "rent" ? "เช่าเลย — ใส่ตะกร้า" : "ซื้อเลย — ใส่ตะกร้า") : "สินค้าหมด") + "</button>" +
        '<button class="me-btn me-btn-ghost me-btn-block" data-buynow ' + (avail > 0 ? "" : "disabled") + ">สั่งทันที (ไปชำระเงิน)</button>";

      bb.querySelectorAll("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { if (b.hasAttribute("disabled")) return; mode = b.getAttribute("data-mode"); drawBuybox(); }); });
      bb.querySelector("[data-q='-1']").addEventListener("click", function () { qty = Math.max(1, qty - 1); drawBuybox(); });
      bb.querySelector("[data-q='1']").addEventListener("click", function () { qty = Math.min(avail || 1, qty + 1); drawBuybox(); });
      bb.querySelector("[data-qty]").addEventListener("change", function (e) { qty = clampInt(e.target.value, 1, avail || 1); drawBuybox(); });
      if (mode === "rent") {
        bb.querySelector("[data-d='-1']").addEventListener("click", function () { days = Math.max(1, days - 1); drawBuybox(); });
        bb.querySelector("[data-d='1']").addEventListener("click", function () { days = days + 1; drawBuybox(); });
        bb.querySelector("[data-days]").addEventListener("change", function (e) { days = clampInt(e.target.value, 1, 365); drawBuybox(); });
      }
      bb.querySelector("[data-add]").addEventListener("click", function () { S.addToCart(p.id, qty, mode, days); U.toast("เพิ่ม <b>" + p.name + "</b> ลงตะกร้าแล้ว", "ok"); });
      bb.querySelector("[data-buynow]").addEventListener("click", function () { S.addToCart(p.id, qty, mode, days); window.location.href = "cart.html"; });
    }
    drawBuybox();
  }

  /* ===================== CART + CHECKOUT ===================== */
  function initCart() {
    var root = document.querySelector("[data-cart]");
    // checkout state lives here so re-rendering item rows doesn't reset the form
    var co = { name: "", phone: "", fulfillment: "", province: "", district: "", subdistrict: "", zip: "", detail: "" };

    function renderItems() {
      var t = S.cartTotals();
      var items = root.querySelector("[data-items]");
      items.innerHTML = t.lines.map(function (l) {
        return (
          '<div class="cart-item">' + U.productTile(l.product) +
          '<div class="ci-info"><span class="ci-mode ' + l.mode + '">' + (l.mode === "rent" ? "เช่าสินค้า " + l.days + " วัน" : "ซื้อสินค้า") + "</span>" +
            '<a class="ci-name" href="product.html?id=' + l.product.id + '">' + l.product.name + "</a>" +
            '<span class="card-cat">' + S.money(l.unit) + (l.mode === "rent" ? " /วัน" : "") + " × " + l.qty + (l.mode === "rent" ? " × " + l.days + " วัน" : "") + "</span></div>" +
          '<div class="ci-controls"><div class="qty"><button data-dec="' + l.index + '">−</button>' +
            '<input value="' + l.qty + '" data-qi="' + l.index + '" inputmode="numeric"><button data-inc="' + l.index + '">+</button></div>' +
            '<span class="ci-total">' + S.money(l.lineTotal) + "</span>" +
            '<button class="linkbtn" data-rm="' + l.index + '">ลบออก</button></div></div>'
        );
      }).join("");
      items.querySelectorAll("[data-dec]").forEach(function (b) { b.onclick = function () { changeQty(+b.dataset.dec, -1); }; });
      items.querySelectorAll("[data-inc]").forEach(function (b) { b.onclick = function () { changeQty(+b.dataset.inc, 1); }; });
      items.querySelectorAll("[data-qi]").forEach(function (i) { i.onchange = function () { S.updateCartItem(+i.dataset.qi, { qty: clampInt(i.value, 1, 999) }); fullRender(); }; });
      items.querySelectorAll("[data-rm]").forEach(function (b) { b.onclick = function () { S.removeCartItem(+b.dataset.rm); fullRender(); }; });
    }

    function changeQty(idx, delta) { var line = S.cartLines()[idx]; if (!line) return; S.updateCartItem(idx, { qty: Math.max(1, line.qty + delta) }); fullRender(); }

    // shipping is computed from province but NEVER shown to the customer — it is
    // silently bundled into the single payable total.
    function shippingNow() { return (co.fulfillment === "delivery" && co.province) ? S.getShippingFee(co.province) : 0; }
    function updateSummary() {
      var t = S.cartTotals();
      var ship = shippingNow();
      var total = t.subtotal + t.deposit + ship;
      var note = root.querySelector("[data-ship-note]");
      if (note) note.hidden = !(co.fulfillment === "delivery" && co.province);
      var tt = root.querySelector("[data-total]"); if (tt) tt.textContent = S.money(total);
      var btn = root.querySelector("[data-checkout]"); if (btn) btn.textContent = "ยืนยันสั่งซื้อ · " + S.money(total);
    }

    function fullRender() {
      var t = S.cartTotals();
      if (!t.lines.length) {
        root.innerHTML =
          '<div class="empty"><div class="empty-ic"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></div>' +
          "<h3>ตะกร้ายังว่างอยู่</h3><p>เลือกเครื่องมือที่อยากซื้อหรือเช่าได้เลย</p><a class=\"me-btn\" href=\"shop.html\">เลือกซื้อสินค้า</a></div>";
        return;
      }
      root.innerHTML =
        '<div class="cart-grid"><div class="cart-items" data-items></div>' +
        '<div style="display:flex;flex-direction:column;gap:18px">' +
          '<div class="summary"><h3>สรุปคำสั่งซื้อ</h3>' +
            '<div class="summary-line"><span>ยอดสินค้า/ค่าเช่า</span><span>' + S.money(t.subtotal) + "</span></div>" +
            (t.deposit ? '<div class="summary-line"><span>เงินมัดจำ (คืนภายหลัง)</span><span>' + S.money(t.deposit) + "</span></div>" : "") +
            '<div class="summary-line" data-ship-note hidden><span>* รวมค่าจัดส่งแล้ว</span><span></span></div>' +
            '<div class="summary-total"><span>ยอดชำระวันนี้</span><span class="v" data-total>' + S.money(t.subtotal + t.deposit) + "</span></div>" +
            (t.deposit ? '<p class="note">* เงินมัดจำคืนเต็มจำนวนเมื่อนำเครื่องมือมาส่งคืนในสภาพปกติ</p>' : "") +
          "</div>" +
          '<div class="panel"><h3>ข้อมูลผู้ติดต่อ</h3>' +
            '<div class="field"><label>ชื่อ-นามสกุล *</label><input data-name placeholder="เช่น สมชาย ใจดี" value="' + esc(co.name) + '"></div>' +
            '<div class="field"><label>เบอร์โทร *</label><input data-phone type="tel" placeholder="08X-XXX-XXXX" value="' + esc(co.phone) + '"></div>' +
            '<div class="field"><label>วิธีรับสินค้า *</label><div class="ful-toggle">' +
              '<button type="button" class="ful-opt" data-ful="delivery"><span class="t">บริการจัดส่ง</span><span class="d">ส่งถึงที่อยู่ (มีค่าจัดส่ง)</span></button>' +
              '<button type="button" class="ful-opt" data-ful="pickup"><span class="t">รับเองที่ร้าน</span><span class="d">รับที่ร้านท่ารั้ว (ฟรี)</span></button>' +
            "</div></div>" +
            '<div class="addr-cascade" data-addr hidden>' +
              '<div class="field"><label>จังหวัด *</label><select data-province></select></div>' +
              '<div class="field"><label>อำเภอ/เขต *</label><select data-district disabled></select></div>' +
              '<div class="field"><label>ตำบล/แขวง *</label><select data-subdistrict disabled></select></div>' +
              '<div class="field"><label>รหัสไปรษณีย์ *</label><select data-zip disabled></select></div>' +
              '<div class="field full"><label>บ้านเลขที่ / หมู่ / ถนน *</label><textarea data-detail placeholder="เช่น 99/1 หมู่ 5 ถ.เชียงใหม่-ดอยสะเก็ด">' + esc(co.detail) + "</textarea></div>" +
            "</div>" +
            '<button class="me-btn me-btn-block" data-checkout>ยืนยันสั่งซื้อ</button>' +
            '<a class="me-btn me-btn-ghost me-btn-block" href="shop.html">เลือกซื้อเพิ่ม</a>' +
          "</div></div></div>";

      renderItems();
      wireCheckout();
      updateSummary();
    }

    function wireCheckout() {
      var nameI = root.querySelector("[data-name]");
      var phoneI = root.querySelector("[data-phone]");
      var detailI = root.querySelector("[data-detail]");
      nameI.addEventListener("input", function () { co.name = nameI.value; });
      phoneI.addEventListener("input", function () { co.phone = phoneI.value; });
      detailI.addEventListener("input", function () { co.detail = detailI.value; });

      var addr = root.querySelector("[data-addr]");
      root.querySelectorAll("[data-ful]").forEach(function (b) {
        if (co.fulfillment === b.dataset.ful) b.classList.add("on");
        b.addEventListener("click", function () {
          co.fulfillment = b.dataset.ful;
          root.querySelectorAll("[data-ful]").forEach(function (x) { x.classList.toggle("on", x === b); });
          addr.hidden = co.fulfillment !== "delivery";
          updateSummary();
        });
      });

      var provSel = root.querySelector("[data-province]");
      var distSel = root.querySelector("[data-district]");
      var subSel = root.querySelector("[data-subdistrict]");
      var zipSel = root.querySelector("[data-zip]");
      provSel.innerHTML = '<option value="">เลือกจังหวัด</option>' + S.provinces().map(function (p) { return '<option' + (co.province === p ? " selected" : "") + ">" + p + "</option>"; }).join("");

      function fillDistricts() {
        distSel.innerHTML = '<option value="">เลือกอำเภอ/เขต</option>' + S.districtsOf(co.province).map(function (d) { return "<option>" + d + "</option>"; }).join("");
        distSel.disabled = !co.province;
      }
      function fillSubs() {
        subSel.innerHTML = '<option value="">เลือกตำบล/แขวง</option>' + S.subdistrictsOf(co.province, co.district).map(function (s) { return "<option>" + s + "</option>"; }).join("");
        subSel.disabled = !co.district;
      }
      function fillZips() {
        zipSel.innerHTML = '<option value="">เลือกรหัสไปรษณีย์</option>' + S.zipsOf(co.province, co.district, co.subdistrict).map(function (z) { return "<option>" + z + "</option>"; }).join("");
        zipSel.disabled = !co.subdistrict;
      }
      // restore prior selections (in case of re-render)
      if (co.province) { fillDistricts(); if (co.district) { distSel.value = co.district; fillSubs(); if (co.subdistrict) { subSel.value = co.subdistrict; fillZips(); if (co.zip) zipSel.value = co.zip; } } }
      else { fillDistricts(); }

      provSel.addEventListener("change", function () { co.province = provSel.value; co.district = ""; co.subdistrict = ""; co.zip = ""; fillDistricts(); fillSubs(); fillZips(); updateSummary(); });
      distSel.addEventListener("change", function () { co.district = distSel.value; co.subdistrict = ""; co.zip = ""; fillSubs(); fillZips(); });
      subSel.addEventListener("change", function () { co.subdistrict = subSel.value; co.zip = ""; fillZips(); });
      zipSel.addEventListener("change", function () { co.zip = zipSel.value; });

      root.querySelector("[data-checkout]").addEventListener("click", confirmOrder);
    }

    function confirmOrder() {
      var sess = S.session();
      if (!sess) { U.toast("กรุณาเข้าสู่ระบบ/สมัครสมาชิกก่อนสั่งซื้อ", "err"); setTimeout(function () { location.href = "login.html?next=" + encodeURIComponent("cart.html"); }, 900); return; }
      co.name = (co.name || "").trim(); co.phone = (co.phone || "").trim();
      if (!co.name) { U.toast("กรุณากรอกชื่อ-นามสกุล", "err"); return; }
      var digits = co.phone.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 10) { U.toast("กรุณากรอกเบอร์โทรให้ครบ (9–10 หลัก)", "err"); return; }
      if (!co.fulfillment) { U.toast("กรุณาเลือกวิธีรับสินค้า", "err"); return; }
      var address = null, shipping = 0;
      if (co.fulfillment === "delivery") {
        if (!co.province || !co.district || !co.subdistrict || !co.zip || !(co.detail || "").trim()) {
          U.toast("กรุณากรอกที่อยู่จัดส่งให้ครบทุกช่อง", "err"); return;
        }
        shipping = S.getShippingFee(co.province);
        address = {
          province: co.province, district: co.district, subdistrict: co.subdistrict, zip: co.zip, detail: co.detail.trim(),
          text: co.detail.trim() + " ต." + co.subdistrict + " อ." + co.district + " จ." + co.province + " " + co.zip,
        };
      }
      var t = S.cartTotals();
      var payable = t.subtotal + t.deposit + shipping;
      showPayment(payable, t, shipping, { name: co.name, phone: co.phone, fulfillment: co.fulfillment, address: address, shipping: shipping });
    }

    function showPayment(amount, totals, shipping, checkout) {
      var st = S.getSettings();
      var qrVisual = st.qrImage
        ? '<img class="qr-img" src="' + st.qrImage + '" alt="QR ชำระเงิน">'
        : genQR("METOOLS|" + amount + "|" + Date.now());
      var bg = document.createElement("div");
      bg.className = "me-modal-bg";
      bg.innerHTML =
        '<div class="me-modal"><div class="me-modal-head"><h3>ชำระเงิน</h3><button class="me-modal-x">×</button></div>' +
        '<div class="me-modal-body"><div class="qr-pp"><b>PromptPay</b> · ' + esc(st.bankInfo || st.company || "M.E.Tools") + "</div>" +
          '<div class="qr-card" data-qrcard>' + qrVisual + '<div class="qr-amount">' + S.money(amount) + '</div><div class="qr-cap">สแกน QR เพื่อชำระเงิน · หมดอายุใน <b data-qrtimer>10:00</b></div></div>' +
          '<div class="pay-rows">' +
            '<div class="r"><span>ยอดสินค้า/ค่าเช่า</span><span>' + S.money(totals.subtotal) + "</span></div>" +
            (totals.deposit ? '<div class="r"><span>เงินมัดจำ</span><span>' + S.money(totals.deposit) + "</span></div>" : "") +
            (shipping ? '<div class="r"><span>ค่าจัดส่ง (' + checkout.address.province + ")</span><span>" + S.money(shipping) + "</span></div>" : '<div class="r"><span>รับเองที่ร้าน</span><span>ฟรี</span></div>') +
            '<div class="r total"><span>รวมชำระ</span><span>' + S.money(amount) + "</span></div>" +
          "</div>" +
          '<div class="qr-status checking" data-paystatus>⏳ ระบบกำลังตรวจสอบยอดเงินเข้าจากธนาคารอัตโนมัติ…</div>' +
        "</div>" +
        '<div class="me-modal-foot"><button class="me-btn me-btn-block" data-paid disabled>ยืนยันการชำระเงิน</button>' +
          '<button class="me-btn me-btn-ghost me-btn-block" data-cancel>ยกเลิก</button></div></div>';
      document.body.appendChild(bg);
      var detected = false, left = 600, poll, timer, elapsed = 0;
      function cleanup() { clearInterval(poll); clearInterval(timer); }
      function close() { cleanup(); bg.remove(); }
      bg.querySelector(".me-modal-x").onclick = close;
      bg.querySelector("[data-cancel]").onclick = close;
      bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
      var statusEl = bg.querySelector("[data-paystatus]"), paidBtn = bg.querySelector("[data-paid]"), timerEl = bg.querySelector("[data-qrtimer]");
      // 10-minute QR countdown
      timer = setInterval(function () {
        left--; var m = Math.floor(left / 60), s = left % 60; timerEl.textContent = m + ":" + (s < 10 ? "0" + s : s);
        if (left <= 0) { cleanup(); bg.querySelector("[data-qrcard]").innerHTML = '<div class="qr-expired">QR หมดอายุแล้ว<br>กรุณาเริ่มสั่งซื้อใหม่</div>'; statusEl.className = "qr-status"; statusEl.textContent = "หมดเวลาชำระเงิน"; }
      }, 1000);
      // auto bank check — SIMULATED (real needs a payment gateway / bank API + backend)
      poll = setInterval(function () {
        elapsed++;
        if (!detected && elapsed >= 7) {
          detected = true; clearInterval(poll);
          statusEl.className = "qr-status ok"; statusEl.textContent = "ธนาคารยืนยันได้รับการชำระเงินแล้ว ✓";
          paidBtn.removeAttribute("disabled");
        }
      }, 1000);
      paidBtn.onclick = function () {
        if (!detected) { U.toast("ระบบยังตรวจไม่พบการชำระเงิน", "err"); return; }
        var created = S.placeOrder(checkout);
        close();
        if (created && created.length) {
          var ids = created.map(function (o) { return o.id; }).join(",");
          window.location.href = "orders.html?new=" + encodeURIComponent(ids);
        }
      };
    }

    fullRender();
    // load the full Thailand address dataset (all provinces/อำเภอ/ตำบล/zip); re-render once ready
    if (window.MEGeoLoad) {
      MEGeoLoad().then(function (n) { if (n) { S.setGeoData(n); fullRender(); } });
    }
  }

  /* ===================== ORDERS (track) ===================== */
  function initOrders() {
    var root = document.querySelector("[data-orders]");
    var newIds = (U.qp("new") || "").split(",").filter(Boolean);
    var pageState = { cloudOrders: [] };

    if (newIds.length) {
      var banner = document.querySelector("[data-confirm]");
      if (banner) { banner.hidden = false; banner.querySelector("[data-ids]").textContent = newIds.join(", "); }
    }

    // Phase E: ลูกค้าที่ login Firebase Auth (มี uid) → subscribe คำสั่งซื้อตัวเองจาก Firestore
    // ทำให้เห็นออเดอร์ที่สั่งจากอุปกรณ์อื่นได้ + เห็นการเปลี่ยนสถานะที่แอดมินอัปเดต
    var sess0 = S.session();
    if (sess0 && sess0.uid && S.loadFirebaseAuthAndDb) {
      S.loadFirebaseAuthAndDb().then(function (m) {
        var fs = m.fsMod;
        var q = fs.query(
          fs.collection(m.db, "orders"),
          fs.where("userId", "==", sess0.uid)
        );
        fs.onSnapshot(q, function (snap) {
          pageState.cloudOrders = snap.docs.map(function (d) {
            var data = d.data() || {};
            if (data.createdAtTs && data.createdAtTs.toDate) data.createdAt = data.createdAtTs.toDate().getTime();
            return data;
          });
          render();
        }, function (err) { console.warn("[customer orders listener]", err && err.message); });
      }).catch(function () {});
    }

    function render() {
      var sess = S.session();
      if (!sess) {
        root.innerHTML = '<div class="empty"><h3>กรุณาเข้าสู่ระบบ</h3><p>เข้าสู่ระบบเพื่อดูคำสั่งซื้อของคุณ</p><a class="me-btn" href="login.html?next=' + encodeURIComponent("orders.html") + '">เข้าสู่ระบบ</a></div>';
        return;
      }
      var myEmail = (sess.email || "").toLowerCase();
      // รวม local + cloud — cloud ชนะถ้า id ตรงกัน (cloud คือ source of truth)
      var byId = {};
      S.getOrders().forEach(function (o) {
        if (((o.userEmail || (o.customer && o.customer.email) || "").toLowerCase()) === myEmail) byId[o.id] = o;
      });
      pageState.cloudOrders.forEach(function (o) { byId[o.id] = o; });
      var orders = Object.values(byId).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
      if (!orders.length) {
        root.innerHTML = '<div class="empty"><h3>ยังไม่มีคำสั่งซื้อ</h3><p>เมื่อคุณสั่งซื้อหรือเช่า รายการจะแสดงที่นี่</p><a class="me-btn" href="shop.html">เริ่มเลือกซื้อ</a></div>';
        return;
      }
      root.innerHTML = orders.map(function (o) {
        var isNew = newIds.indexOf(o.id) >= 0;
        var canCancel = o.status === "paid";
        return (
          '<div class="order-card"' + (isNew ? ' style="outline:4px solid var(--dw-yellow);outline-offset:-2px"' : "") + ">" +
          '<div class="order-top"><div><span class="order-id">' + o.id + '</span> <span class="chip ' + o.type + '">' + S.typeLabel(o.type) + "</span> " +
            '<span class="chip ' + (o.fulfillment === "delivery" ? "rent" : "new") + '">' + S.fulfillmentLabel(o.fulfillment) + "</span> " + statusBadges(o) +
            '<div class="order-meta">' + S.fmtDate(o.createdAt) + " · " + o.customer.name + " · " + o.customer.phone +
              (o.type === "rent" ? " · เช่า " + o.days + " วัน (" + o.rentStart + " ถึง " + o.rentEnd + ")" : "") +
              (o.fulfillment === "delivery" && o.address ? "<br>จัดส่ง: " + o.address.text : "") + "</div></div>" +
            '<div style="text-align:right"><div class="order-meta">ยอดชำระ</div><div class="ci-total">' + S.money(o.total) + "</div></div></div>" +
          o.items.map(function (it) { return '<div class="order-line"><span>' + it.name + " × " + it.qty + (it.days ? " (" + it.days + " วัน)" : "") + "</span><span>" + S.money(it.unitPrice * it.qty * (it.days || 1)) + "</span></div>"; }).join("") +
          (o.deposit ? '<div class="order-line" style="color:var(--fg-2)"><span>เงินมัดจำ (คืนเมื่อส่งคืน)</span><span>' + S.money(o.deposit) + "</span></div>" : "") +
          (o.staffMessage ? '<div class="order-msg">📩 ข้อความจากร้าน: ' + esc(o.staffMessage) + "</div>" : "") +
          (o.status === "cancelled" ? '<div class="order-cancelled">ยกเลิกแล้ว · คืนเงิน ' + S.money(o.total) + " เรียบร้อย" + (o.cancelReason ? " · เหตุผล: " + esc(o.cancelReason) : "") + "</div>" : "") +
          (canCancel ? '<div class="order-actions"><button class="linkbtn" data-cancel-order="' + o.id + '">ยกเลิกคำสั่งซื้อ & ขอคืนเงิน</button></div>' : "") +
          "</div>"
        );
      }).join("");
      root.querySelectorAll("[data-cancel-order]").forEach(function (b) {
        b.addEventListener("click", function () { openCancelModal(b.getAttribute("data-cancel-order"), render); });
      });
    }
    render();
  }

  function openCancelModal(orderId, onDone) {
    var reasons = ["เปลี่ยนใจ ไม่ต้องการแล้ว", "สั่งผิดรายการ/ผิดจำนวน", "พบราคาที่ถูกกว่า", "ส่งช้าเกินไป", "อื่น ๆ"];
    var bg = document.createElement("div");
    bg.className = "me-modal-bg";
    bg.innerHTML =
      '<div class="me-modal"><div class="me-modal-head"><h3>ยกเลิกคำสั่งซื้อ</h3><button class="me-modal-x">×</button></div>' +
      '<div class="me-modal-body" style="align-items:stretch;text-align:left">' +
        "<p style=\"font-family:var(--font-body);margin:0\">ช่วยบอกเหตุผลที่ต้องการยกเลิกคำสั่งซื้อ <b>" + orderId + "</b></p>" +
        '<div class="field"><label>เหตุผล</label><select data-reason>' + reasons.map(function (r) { return "<option>" + r + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label>รายละเอียดเพิ่มเติม (ถ้ามี)</label><textarea data-reason-note rows="2" placeholder="พิมพ์เพิ่มเติม…"></textarea></div>' +
        '<div class="qr-status" data-refundstatus hidden></div>' +
      "</div>" +
      '<div class="me-modal-foot"><button class="me-btn me-btn-block" data-do-cancel>ยืนยันการยกเลิก</button>' +
        '<button class="me-btn me-btn-ghost me-btn-block" data-cancel>ไม่ยกเลิก</button></div></div>';
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.querySelector(".me-modal-x").onclick = close;
    bg.querySelector("[data-cancel]").onclick = close;
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    bg.querySelector("[data-do-cancel]").onclick = function () {
      var reason = bg.querySelector("[data-reason]").value;
      var note = bg.querySelector("[data-reason-note]").value.trim();
      var full = note ? reason + " — " + note : reason;
      var st = bg.querySelector("[data-refundstatus]");
      var btn = bg.querySelector("[data-do-cancel]");
      btn.disabled = true;
      st.hidden = false; st.className = "qr-status checking"; st.textContent = "กำลังประมวลผลการยกเลิกและโอนเงินคืน…";
      setTimeout(function () {
        S.setOrderStatus(orderId, "cancelled", { reason: full });
        st.className = "qr-status ok"; st.textContent = "ยกเลิกสำเร็จ · โอนเงินคืนเข้าบัญชีเรียบร้อยแล้ว ✓";
        U.toast("ยกเลิกคำสั่งซื้อและคืนเงินแล้ว", "ok");
        setTimeout(function () { close(); if (onDone) onDone(); }, 1100);
      }, 1600);
    };
  }

  // status badges shown to the customer
  function statusBadges(o) {
    if (o.status === "cancelled") return '<span class="chip cancelled">ยกเลิก</span>';
    if (o.status === "returned") return '<span class="chip returned">คืนแล้ว</span>';
    if (o.status === "received") return '<span class="chip fulfilled">ได้รับสินค้าแล้ว</span>';
    // paid + waiting to receive
    return '<span class="chip paid">ชำระแล้ว</span> <span class="chip new">รอรับสินค้า</span>';
  }

  /* ===================== shared bits ===================== */
  function cardHtml(p) {
    var avail = S.available(p);
    var low = avail > 0 && avail <= 3;
    return (
      '<div class="card"><a class="tilelink" href="product.html?id=' + p.id + '">' + U.productTile(p) + "</a>" +
      '<div class="card-body"><span class="card-cat">' + S.categoryLabel(p.category) + " · " + p.brand + "</span>" +
        '<a class="card-name" href="product.html?id=' + p.id + '">' + p.name + "</a>" +
        '<div class="card-price">' +
          (p.forSale ? '<span class="price-buy">' + S.money(p.price) + "</span>" : "") +
          (p.forRent ? '<span class="price-rent" data-rent-only>เช่า ' + S.money(p.rentPerDay) + "/วัน</span>" : "") + "</div>" +
        '<span class="card-stock ' + (avail <= 0 || low ? "low" : "") + '">' + (avail <= 0 ? "สินค้าหมด" : "มีสินค้าพร้อมส่ง · เหลือ " + avail + " ชิ้น") + "</span></div>" +
      '<div class="card-actions"><a class="me-btn me-btn-sm me-btn-ghost" href="product.html?id=' + p.id + '">รายละเอียด</a>' +
        (avail > 0 ? '<button class="me-btn me-btn-sm" data-quickadd="' + p.id + '" data-mode="' + (p.forSale ? "buy" : "rent") + '">' + (p.forSale ? "ใส่ตะกร้า" : "เช่าสินค้า") + "</button>" : '<button class="me-btn me-btn-sm" disabled>หมด</button>') +
      "</div></div>"
    );
  }
  function productGallery(p) {
    var imgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    if (!imgs.length) return "<div>" + U.productTile(p, { lg: true }) + "</div>";
    return '<div class="pd-gallery"><div class="pd-main" data-pd-main style="background-image:url(' + JSON.stringify(imgs[0]) + ')"></div>' +
      (imgs.length > 1 ? '<div class="pd-thumbs">' + imgs.map(function (im, i) { return '<button type="button" class="pd-thumb' + (i === 0 ? " on" : "") + '" data-pd-thumb="' + i + '" style="background-image:url(' + JSON.stringify(im) + ')"></button>'; }).join("") + "</div>" : "") +
      "</div>";
  }
  function wireGallery(scope) {
    var main = scope.querySelector("[data-pd-main]");
    if (!main) return;
    scope.querySelectorAll("[data-pd-thumb]").forEach(function (b) {
      b.addEventListener("click", function () {
        main.style.backgroundImage = b.style.backgroundImage;
        scope.querySelectorAll("[data-pd-thumb]").forEach(function (x) { x.classList.toggle("on", x === b); });
      });
    });
  }
  function wireCards(scope) {
    scope.querySelectorAll("[data-quickadd]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.getProduct(b.getAttribute("data-quickadd"));
        S.addToCart(p.id, 1, b.getAttribute("data-mode"), 1);
        U.toast("เพิ่ม <b>" + p.name + "</b> ลงตะกร้าแล้ว", "ok");
      });
    });
  }

  // deterministic decorative QR (demo) — looks like a PromptPay QR, offline
  function genQR(text) {
    var N = 25, q = 2, dim = (N + q * 2) * 8, px = 8;
    var seed = 0; for (var i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var g = []; for (var r = 0; r < N; r++) { g[r] = []; for (var c = 0; c < N; c++) g[r][c] = rnd() > 0.52 ? 1 : 0; }
    function finder(or, oc) {
      for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
        var rr = or + r, cc = oc + c; if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        g[rr][cc] = on ? 1 : 0;
      }
    }
    finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
    var rects = "";
    for (var r2 = 0; r2 < N; r2++) for (var c2 = 0; c2 < N; c2++) if (g[r2][c2]) rects += '<rect x="' + ((c2 + q) * px) + '" y="' + ((r2 + q) * px) + '" width="' + px + '" height="' + px + '"/>';
    return '<svg width="200" height="200" viewBox="0 0 ' + dim + " " + dim + '" xmlns="http://www.w3.org/2000/svg"><rect width="' + dim + '" height="' + dim + '" fill="#fff"/><g fill="#0B0B0B">' + rects + "</g></svg>";
  }

  /* ----- home: brands / promo / flash sale ----- */
  function renderBrandsTagline(tag) {
    var el = document.querySelector("[data-brands-tagline]"); if (!el) return;
    var parts = String(tag || "").split("|");
    if (parts.length > 1) el.innerHTML = '<span class="me-hl-text">' + esc(parts[0]) + '</span> <span class="me-hl">' + esc(parts.slice(1).join("|")) + "</span>";
    else el.innerHTML = '<span class="me-hl">' + esc(tag || "") + "</span>";
  }
  function renderBrands(brands) {
    var box = document.querySelector("[data-brands]"); if (!box) return;
    box.innerHTML = (brands || []).map(function (b) {
      return '<a class="me-brand-card' + (b.primary ? " is-primary" : "") + '" href="shop.html?brand=' + encodeURIComponent(b.name) + '">' +
        '<div class="me-brand-name">' + esc(b.name) + '</div><div class="me-brand-tag">' + esc(b.tag || "") + "</div>" +
        (b.primary ? '<div class="me-brand-stamp">ศูนย์แท้</div>' : "") + "</a>";
    }).join("");
  }
  function renderPromo(promo) {
    var box = document.querySelector("[data-promo]"); if (!box) return;
    if (!promo || !promo.enabled) { box.innerHTML = ""; return; }
    box.innerHTML = '<section class="me-promo"><div class="wrap"><div class="me-promo-card">' +
      (promo.image ? '<div class="me-promo-img" style="background-image:url(' + JSON.stringify(promo.image) + ')"></div>' : "") +
      '<div class="me-promo-body"><div class="me-promo-tag">โปรโมชั่นพิเศษ</div>' +
      '<h2 class="me-promo-title">' + esc(promo.title || "") + "</h2>" +
      '<p class="me-promo-text">' + esc(promo.text || "") + "</p>" +
      '<a class="me-btn" href="shop.html">ดูสินค้า ▸</a></div></div></div></section>';
  }
  function renderFlash(fs) {
    var box = document.querySelector("[data-flash]"); if (!box) return;
    var items = (fs && fs.items) ? fs.items.filter(function (it) { return S.getProduct(it.productId); }) : [];
    if (!fs || !fs.enabled || !items.length) { box.innerHTML = ""; return; }
    var cards = items.map(function (it) { return flashCardHtml(S.getProduct(it.productId), it.salePrice, it.wasPrice); }).join("");
    box.innerHTML = '<section class="me-flash"><div class="wrap">' +
      '<div class="me-flash-head"><div><div class="me-overline" style="color:var(--dw-yellow)"><span class="me-overline-bar"></span>ลดพิเศษ มีจำนวนจำกัด</div>' +
      '<h2 class="me-section-h" style="color:#fff;margin-top:8px">' + esc(fs.title || "ลดพิเศษสุดคุ้ม") + "</h2></div>" +
      '<div class="me-countdown" data-countdown></div></div>' +
      '<div class="cards me-flash-cards">' + cards + "</div></div></section>";
    startCountdown(box.querySelector("[data-countdown]"), fs.endTime);
  }
  function flashCardHtml(p, sale, was) {
    var avail = S.available(p);
    var off = (was && sale && was > sale) ? Math.round((1 - sale / was) * 100) : 0;
    return '<div class="card flash">' + (off ? '<span class="flash-badge">-' + off + "%</span>" : "") +
      '<a class="tilelink" href="product.html?id=' + p.id + '">' + U.productTile(p) + "</a>" +
      '<div class="card-body"><span class="card-cat">' + S.categoryLabel(p.category) + " · " + p.brand + "</span>" +
      '<a class="card-name" href="product.html?id=' + p.id + '">' + p.name + "</a>" +
      '<div class="card-price"><span class="price-buy">' + S.money(sale) + "</span>" + (was ? '<span class="price-was">' + S.money(was) + "</span>" : "") + "</div>" +
      '<span class="card-stock ' + (avail <= 0 ? "low" : "") + '">' + (avail <= 0 ? "สินค้าหมด" : "คงเหลือ " + avail + " ชิ้น") + "</span></div>" +
      '<div class="card-actions"><a class="me-btn me-btn-sm me-btn-block" href="product.html?id=' + p.id + '">ดูรายละเอียด</a></div></div>';
  }
  function startCountdown(el, endTime) {
    if (!el) return;
    function box(n, l) { return '<div class="cd-box"><span class="cd-n">' + (n < 10 ? "0" + n : n) + '</span><span class="cd-l">' + l + "</span></div>"; }
    function tick() {
      var diff = (endTime || 0) - Date.now();
      if (diff <= 0) { el.innerHTML = '<span class="cd-end">หมดเวลาโปรโมชั่นแล้ว</span>'; clearInterval(t); return; }
      var d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24, m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;
      el.innerHTML = box(d, "วัน") + box(h, "ชม.") + box(m, "นาที") + box(s, "วินาที");
    }
    tick(); var t = setInterval(tick, 1000);
  }

  function iconForCat(key) { return { drill: "drill", saw: "saw", grinder: "grinder", battery: "battery", measure: "measure", hand: "wrench", power: "compressor" }[key] || "tool"; }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }
  function checkedValues(scope, f) { return Array.prototype.slice.call(scope.querySelectorAll("[data-f=" + f + "]:checked")).map(function (c) { return c.value; }); }
  function clampInt(v, min, max) { v = parseInt(v, 10); if (isNaN(v)) v = min; return Math.max(min, Math.min(max, v)); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function setText(sel, txt) { var el = document.querySelector(sel); if (el) el.textContent = txt || ""; }
  function typewriter(el, phrases) {
    var pi = 0, ci = 0, deleting = false;
    function tick() {
      var word = phrases[pi] || "";
      if (!deleting) {
        ci++; el.textContent = word.slice(0, ci);
        if (ci >= word.length) { deleting = true; return setTimeout(tick, 1500); }
      } else {
        ci--; el.textContent = word.slice(0, ci);
        if (ci <= 0) { deleting = false; pi = (pi + 1) % phrases.length; return setTimeout(tick, 350); }
      }
      setTimeout(tick, deleting ? 45 : 95);
    }
    tick();
  }
})();
