/* =================================================================
   M.E.Tools — public storefront page logic
   ================================================================= */
(function () {
  "use strict";
  var S = window.MEStore, U = window.MEUI;
  var page = document.body.getAttribute("data-page");

  // ฝัง URL/รูป (รวม base64) ใน inline style ของ HTML อย่างปลอดภัย — ใช้ single quote
  // (ถ้าใช้ JSON.stringify จะได้ double quote ซึ่งไปปิด attribute style="..." ก่อนเวลา → รูปไม่ขึ้น)
  function cssBg(u) { return "background-image:url('" + String(u || "").replace(/'/g, "%27") + "')"; }

  // specs อาจเป็น ["ป้าย","ค่า"] (เครื่องเจ้าของ) หรือ {label,value} (โหลดจาก cloud) — รองรับทั้งคู่
  function specKV(s) {
    if (Array.isArray(s)) return [s[0] || "", s[1] || ""];
    if (s && typeof s === "object") return [s.label || s.k || "", s.value || s.v || ""];
    return ["", s || ""];
  }

  // จัดรายละเอียดสินค้าให้อ่านง่าย: บรรทัด "• ..." → บูลเล็ต, บรรทัดลงท้าย ":" → หัวข้อ, อื่น ๆ → ย่อหน้า
  function descToHtml(text) {
    var raw = String(text || "").trim();
    if (!raw) return "";
    // ดึงบูลเล็ตที่ติดกันในบรรทัดเดียว (• …• …) ให้ขึ้นบรรทัดใหม่ ช่วยสินค้าเก่าที่ยังไม่ได้แยกใหม่
    raw = raw.replace(/\s*[•●·]\s*/g, "\n• ").trim();
    var lines = raw.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var html = "", inUl = false;
    function closeUl() { if (inUl) { html += "</ul>"; inUl = false; } }
    lines.forEach(function (l) {
      if (/^[•\-*·●]\s*/.test(l)) {
        if (!inUl) { html += '<ul class="pd-desc-list">'; inUl = true; }
        html += "<li>" + esc(l.replace(/^[•\-*·●]\s*/, "")) + "</li>";
      } else if (/[:：]$/.test(l)) {
        closeUl(); html += '<p class="pd-desc-h">' + esc(l) + "</p>";
      } else {
        closeUl(); html += "<p>" + esc(l) + "</p>";
      }
    });
    closeUl();
    return html;
  }

  /* ---------- ดาวรีวิวสินค้า (rating) ---------- */
  // โชว์คะแนนเฉลี่ย (อ่านอย่างเดียว)
  function starsDisplay(p) {
    var r = S.productRating(p);
    if (!r.count) return '<span class="me-rate-none">ยังไม่มีรีวิว</span>';
    var full = Math.round(r.avg), s = "";
    for (var i = 1; i <= 5; i++) s += '<span class="me-star' + (i <= full ? " on" : "") + '">★</span>';
    return '<span class="me-stars" title="' + r.avg.toFixed(1) + ' จาก 5">' + s + "</span>" +
      '<span class="me-rate-count">' + r.avg.toFixed(1) + " (" + r.count + ")</span>";
  }
  // วิดเจ็ตกดให้ดาว (โต้ตอบได้)
  function ratingWidget(productId) {
    var mine = S.getMyRating(productId), s = "";
    for (var i = 1; i <= 5; i++) s += '<button type="button" class="me-star-btn' + (i <= mine ? " on" : "") + '" data-rate="' + i + '" aria-label="' + i + ' ดาว">★</button>';
    return '<div class="me-rate-widget" data-rate-widget="' + esc(String(productId)) + '">' + s +
      '<span class="me-rate-hint">' + (mine ? "คุณให้ " + mine + " ดาว ✓" : "แตะดาวเพื่อให้คะแนน") + "</span></div>";
  }
  function wireRating(scope) {
    (scope || document).querySelectorAll("[data-rate-widget]").forEach(function (w) {
      if (w._wired) return; w._wired = true;
      var pid = w.getAttribute("data-rate-widget");
      w.querySelectorAll("[data-rate]").forEach(function (b) {
        b.addEventListener("click", function () {
          var n = +b.dataset.rate; S.rateProduct(pid, n);
          w.querySelectorAll("[data-rate]").forEach(function (x) { x.classList.toggle("on", +x.dataset.rate <= n); });
          var h = w.querySelector(".me-rate-hint"); if (h) h.textContent = "คุณให้ " + n + " ดาว ✓";
          if (U.toast) U.toast("ขอบคุณสำหรับ " + n + " ดาว!", "ok");
        });
        b.addEventListener("mouseenter", function () { var n = +b.dataset.rate; w.querySelectorAll("[data-rate]").forEach(function (x) { x.classList.toggle("hover", +x.dataset.rate <= n); }); });
      });
      w.addEventListener("mouseleave", function () { w.querySelectorAll("[data-rate]").forEach(function (x) { x.classList.remove("hover"); }); });
    });
  }

  /* ---------- รีวิว (ดาว + ความเห็น + รูป) ---------- */
  function compressImage(file, cb) {
    var max = 1000, fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        try { c.getContext("2d").drawImage(img, 0, 0, w, h); cb(c.toDataURL("image/jpeg", 0.7)); } catch (e) { cb(fr.result); }
      };
      img.onerror = function () { cb(fr.result); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function reviewStars(n) { var s = ""; for (var i = 1; i <= 5; i++) s += '<span class="me-star' + (i <= n ? " on" : "") + '">★</span>'; return s; }
  function reviewsHtml(list) {
    if (!list || !list.length) return '<div class="rv-empty">ยังไม่มีรีวิว — เป็นคนแรกที่รีวิวสินค้านี้!</div>';
    return list.map(function (rv) {
      var imgs = (rv.images || []).map(function (im) { return '<img class="rv-img" src="' + esc(im) + '" alt="รูปรีวิว" loading="lazy">'; }).join("");
      return '<div class="rv-item"><div class="rv-head"><span class="rv-name">' + esc(rv.name || "ลูกค้า") + "</span>" +
        '<span class="me-stars">' + reviewStars(rv.stars || 0) + "</span></div>" +
        (rv.comment ? '<div class="rv-comment">' + esc(rv.comment) + "</div>" : "") +
        (imgs ? '<div class="rv-imgs">' + imgs + "</div>" : "") +
        '<div class="rv-date">' + (rv.at ? new Date(rv.at).toLocaleDateString("th-TH") : "") + "</div></div>";
    }).join("");
  }
  function reviewFormHtml() {
    return '<form class="rv-form" data-rv-form>' +
      '<div class="rv-form-title">เขียนรีวิวสินค้านี้</div>' +
      '<div class="rv-pick" data-rv-pick>' +
        [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" class="me-star-btn" data-rv-star="' + i + '">★</button>'; }).join("") +
        '<span class="rv-pick-hint" data-rv-pick-hint>แตะเลือกดาว</span></div>' +
      '<input class="rv-input" data-rv-name maxlength="40" placeholder="ชื่อของคุณ (เช่น ช่างโอ๋)">' +
      '<textarea class="rv-input" data-rv-comment maxlength="1000" rows="3" placeholder="เล่าประสบการณ์ใช้งาน คุณภาพ ความคุ้มค่า…"></textarea>' +
      '<div class="rv-photos"><label class="me-btn me-btn-sm me-btn-ghost">📷 เพิ่มรูป (สูงสุด 3)<input type="file" accept="image/*" multiple data-rv-img hidden></label>' +
        '<div class="rv-preview" data-rv-preview></div></div>' +
      '<button type="submit" class="me-btn" data-rv-submit>ส่งรีวิว</button></form>';
  }
  function wireReviewForm(scope, productId, onDone) {
    var form = scope.querySelector("[data-rv-form]"); if (!form) return;
    var picked = 0, photos = [];
    var hint = form.querySelector("[data-rv-pick-hint]");
    form.querySelectorAll("[data-rv-star]").forEach(function (b) {
      b.addEventListener("click", function () { picked = +b.dataset.rvStar; form.querySelectorAll("[data-rv-star]").forEach(function (x) { x.classList.toggle("on", +x.dataset.rvStar <= picked); }); if (hint) hint.textContent = picked + " ดาว"; });
      b.addEventListener("mouseenter", function () { var n = +b.dataset.rvStar; form.querySelectorAll("[data-rv-star]").forEach(function (x) { x.classList.toggle("hover", +x.dataset.rvStar <= n); }); });
    });
    var pick = form.querySelector("[data-rv-pick]");
    pick.addEventListener("mouseleave", function () { form.querySelectorAll("[data-rv-star]").forEach(function (x) { x.classList.remove("hover"); }); });
    var preview = form.querySelector("[data-rv-preview]");
    form.querySelector("[data-rv-img]").addEventListener("change", function (e) {
      Array.prototype.slice.call(e.target.files || []).forEach(function (f) {
        compressImage(f, function (d) { if (photos.length >= 3) return; photos.push(d); preview.insertAdjacentHTML("beforeend", '<img class="rv-img" src="' + d + '">'); });
      });
      e.target.value = "";
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!picked) { U.toast("กรุณาเลือกจำนวนดาว", "err"); return; }
      var btn = form.querySelector("[data-rv-submit]"); btn.disabled = true; btn.textContent = "กำลังส่ง…";
      S.submitReview(productId, { stars: picked, name: form.querySelector("[data-rv-name]").value.trim(), comment: form.querySelector("[data-rv-comment]").value.trim(), images: photos })
        .then(function () { U.toast("ขอบคุณสำหรับรีวิว! 🙏", "ok"); if (onDone) onDone(); })
        .catch(function (err) { U.toast("ส่งรีวิวไม่สำเร็จ: " + (err && err.message || err), "err"); btn.disabled = false; btn.textContent = "ส่งรีวิว"; });
    });
  }

  U.mountChrome(page === "home" ? "home" : page === "categories" ? "categories" : page === "shop" || page === "product" ? "shop" : page === "orders" ? "orders" : page === "catalog" ? "catalog" : "");

  // เมื่อแคตตาล็อกจาก cloud มาถึง (ลูกค้า) → วาดส่วนที่ขึ้นกับสินค้าใหม่
  // ต้องประกาศ + ผูก listener "ก่อน" เรียก route เพราะ route จะตั้งค่า pageRefresh เอง
  var pageRefresh = null;
  window.addEventListener("me-products-loaded", function () { if (pageRefresh) try { pageRefresh(); } catch (e) {} });

  var routes = { home: initHome, categories: initCategories, shop: initShop, product: initProduct, cart: initCart, orders: initOrders, login: initLogin, register: initRegister, catalog: initCatalog };

  // หน้า "หมวดหมู่" — กริดช่องหมวดแบบซ้อนหลายชั้น (เหมือน iToolmart)
  //   ?cat=<key> = ดูหมวดย่อยภายใต้หมวดนั้น. กดหมวดที่มีลูก → ลงลึกต่อ, กดหมวดที่ไม่มีลูก → ดูสินค้า
  function initCategories() {
    var box = document.querySelector("[data-cats]");
    if (!box) return;
    function paint() {
      var curKey = U.qp("cat") || "";
      var cur = curKey ? S.getCategory(curKey) : null;
      var children = S.getSubcategories(curKey, false);

      // breadcrumb
      var crumbBox = document.querySelector("[data-cat-crumb]");
      if (crumbBox) {
        var crumbs = ['<a href="categories.html">หมวดหมู่</a>'];
        if (cur) S.categoryPath(curKey).forEach(function (c, i, arr) {
          crumbs.push(i === arr.length - 1
            ? '<span class="crumb-cur">' + esc(c.label) + "</span>"
            : '<a href="categories.html?cat=' + encodeURIComponent(c.key) + '">' + esc(c.label) + "</a>");
        });
        crumbBox.innerHTML = crumbs.join(' <span class="crumb-sep">›</span> ');
      }
      var titleBox = document.querySelector("[data-cat-title]");
      if (titleBox) titleBox.innerHTML = cur ? esc(cur.label) : 'หมวด<span class="me-hl">สินค้า</span>';

      // ช่องหมวดย่อย (กดเพื่อแคบลง — อยู่ในหน้าหมวดเดิม จะเห็นสินค้าของหมวดนั้นต่อ)
      box.innerHTML = children.map(function (c) {
        var hasKids = S.categoryHasChildren(c.key);
        var n = S.productCountInCat(c.key);
        var visual = c.image
          ? '<span class="me-cat-ic"><img src="' + esc(c.image) + '" alt="" class="me-cat-img"></span>'
          : '<span class="me-cat-ic">' + U.iconSvg(c.icon || iconForCat(c.key), 48) + "</span>";
        return '<a class="me-cat" href="categories.html?cat=' + encodeURIComponent(c.key) + '">' + visual +
          '<span class="me-cat-name">' + esc(c.label) + "</span>" +
          '<span class="me-cat-count">' + n + " รายการ" + (hasKids ? " ›" : "") + "</span></a>";
      }).join("");

      // สินค้าในหมวดนี้ (รวมหมวดย่อยทุกชั้น) — ทุกหมวดมีสินค้าโชว์ แค่แคบลงเมื่อลงลึก
      var prods = S.getProducts().filter(function (p) { return !p.hidden; });
      if (curKey) { var set = S.catDescendants(curKey); prods = prods.filter(function (p) { return set[p.category]; }); }
      var prodBox = document.querySelector("[data-cat-products]");
      var prodHead = document.querySelector("[data-cat-prodhead]");
      if (prodHead) prodHead.hidden = !prods.length;
      if (prodBox) { prodBox.innerHTML = prods.length ? prods.map(cardHtml).join("") : ""; wireCards(prodBox); }
      var empty = document.querySelector("[data-cats-empty]");
      if (empty) empty.hidden = children.length > 0 || prods.length > 0;
    }
    paint();
    pageRefresh = paint; // วาดใหม่เมื่อแคตตาล็อก/หมวดจาก cloud มาถึง
  }
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

    function paintHomeProducts() {
      var box = document.querySelector("[data-cats]");
      if (box) {
        // หน้าแรกแสดงเฉพาะ "หมวดบนสุด" — กดเข้าไปจะไล่หมวดย่อยต่อ
        box.innerHTML = S.getSubcategories("", false).map(function (c) {
          var hasKids = S.categoryHasChildren(c.key);
          var n = S.productCountInCat(c.key);
          var visual = c.image
            ? '<span class="me-cat-ic"><img src="' + esc(c.image) + '" alt="" class="me-cat-img"></span>'
            : '<span class="me-cat-ic">' + U.iconSvg(c.icon || iconForCat(c.key), 40) + "</span>";
          return (
            '<a class="me-cat" href="shop.html?cat=' + encodeURIComponent(c.key) + '">' +
            visual +
            '<span class="me-cat-name">' + esc(c.label) + "</span>" +
            '<span class="me-cat-count">' + n + " รายการ" + (hasKids ? " ›" : "") + "</span></a>"
          );
        }).join("");
      }
      var feat = document.querySelector("[data-featured]");
      if (feat) {
        feat.innerHTML = S.getProducts().filter(function (p) { return !p.hidden; }).slice(0, 6).map(cardHtml).join("");
        wireCards(feat);
      }
    }
    paintHomeProducts();
    pageRefresh = paintHomeProducts; // วาดใหม่เมื่อแคตตาล็อก cloud มาถึง
    // FAQ accordion (editable in back office)
    var faqBox = document.querySelector("[data-faq]");
    if (faqBox) {
      faqBox.innerHTML = (st.faq || []).filter(function (f) { return !f.hidden; }).map(function (f, i) {
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

    var fbox = document.querySelector("[data-filters]");
    var sinput = document.querySelector("[data-q]");
    var sortSel = document.querySelector("[data-sort]");

    // ปุ่มเปิด/ปิดตัวกรอง — บนมือถือซ่อนไว้ก่อน (ลูกค้าหลายคนไม่ได้ใช้ตัวกรอง)
    var grid = document.querySelector(".shop-grid");
    var toggle = document.querySelector("[data-filter-toggle]");
    if (toggle && grid) {
      if (window.innerWidth < 860) grid.classList.add("filters-collapsed");
      function syncToggle() { var open = !grid.classList.contains("filters-collapsed"); toggle.setAttribute("aria-expanded", open ? "true" : "false"); toggle.classList.toggle("on", open); }
      syncToggle();
      toggle.addEventListener("click", function () { grid.classList.toggle("filters-collapsed"); syncToggle(); });
    }
    // breadcrumb + หัวเรื่อง + แถวหมวด (รวมหมวด+สินค้าไว้หน้าเดียว แบบ iToolmart)
    function renderCrumbTitle() {
      var crumb = document.querySelector("[data-shop-crumb]"), title = document.querySelector("[data-shop-title]");
      var curKey = state.cats.length === 1 ? state.cats[0] : "";
      var cur = curKey ? S.getCategory(curKey) : null;
      if (crumb) {
        var parts = ['<a href="index.html">หน้าแรก</a>', '<a href="shop.html">สินค้าทั้งหมด</a>'];
        if (cur) S.categoryPath(curKey).forEach(function (c, i, arr) {
          parts.push(i === arr.length - 1 ? '<span class="crumb-cur">' + esc(c.label) + "</span>"
            : '<a href="shop.html?cat=' + encodeURIComponent(c.key) + '">' + esc(c.label) + "</a>");
        });
        crumb.innerHTML = parts.join(' <span class="crumb-sep">›</span> ');
      }
      if (title) title.innerHTML = cur ? esc(cur.label) : 'สินค้า<span class="me-hl">ทั้งหมด</span>';
      // แถวช่องหมวด (หมวดย่อยของหมวดปัจจุบัน / หมวดบนสุดถ้ายังไม่เลือก) — กดเพื่อแคบลง
      var catBox = document.querySelector("[data-shop-cats]");
      if (catBox) {
        var children = S.getSubcategories(curKey, false);
        catBox.innerHTML = children.map(function (c) {
          var hasKids = S.categoryHasChildren(c.key);
          var visual = c.image
            ? '<span class="me-cat-ic"><img src="' + esc(c.image) + '" alt="" class="me-cat-img"></span>'
            : '<span class="me-cat-ic">' + U.iconSvg(c.icon || iconForCat(c.key), 40) + "</span>";
          return '<a class="me-cat" href="shop.html?cat=' + encodeURIComponent(c.key) + '">' + visual +
            '<span class="me-cat-name">' + esc(c.label) + "</span>" +
            '<span class="me-cat-count">' + S.productCountInCat(c.key) + " รายการ" + (hasKids ? " ›" : "") + "</span></a>";
        }).join("");
        catBox.style.display = children.length ? "" : "none";
      }
    }

    // สร้าง/วาดแถบตัวกรองใหม่จากสินค้าปัจจุบัน (เรียกซ้ำได้เมื่อ cloud มาถึง)
    function buildSidebar() {
      var products = S.getProducts().filter(function (p) { return !p.hidden; });
      var productBrands = uniq(products.map(function (p) { return p.brand; }).filter(Boolean));
      var settingBrands = S.getSettings().brands || [];
      var hiddenBrands = settingBrands.filter(function (b) { return b.hidden; }).map(function (b) { return b.name; });
      var brandOrder = settingBrands.map(function (b) { return b.name; });
      var allBrands = brandOrder.filter(function (b) { return productBrands.indexOf(b) >= 0; })
        .concat(productBrands.filter(function (b) { return brandOrder.indexOf(b) < 0; }))
        .filter(function (b) { return hiddenBrands.indexOf(b) < 0; });
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
        '<label class="check"><input type="checkbox" data-f="instock"' + (state.inStock ? " checked" : "") + '> เฉพาะมีสต็อก</label></div>' +
        '<div class="filter-group"><span class="lbl">ประเภทสินค้า</span>' +
        S.getCategories().filter(function (c) { return !c.hidden; }).map(function (c) {
          var n = S.productCountInCat(c.key); // รวมหมวดย่อย
          var depth = S.categoryPath(c.key).length - 1;
          return '<label class="check" style="padding-left:' + (depth * 16) + 'px">' + (depth ? '<span class="cat-sub-mark">└</span>' : "") + '<input type="checkbox" data-f="cat" value="' + c.key + '"' + (state.cats.indexOf(c.key) >= 0 ? " checked" : "") + "> " + esc(c.label) + ' <span class="filter-count">(' + n + ')</span></label>';
        }).join("") + "</div>" +
        '<div class="filter-group"><span class="lbl">แบรนด์</span>' +
        allBrands.map(function (b) { return '<label class="check"><input type="checkbox" data-f="brand" value="' + b + '"' + (state.brands.indexOf(b) >= 0 ? " checked" : "") + '> ' + b + '</label>'; }).join("") + "</div>" +
        '<div class="filter-group"><span class="lbl">รูปแบบ</span>' +
        '<label class="check"><input type="radio" name="mode" data-f="mode" value="all"' + (state.mode === "all" ? " checked" : "") + '> ทั้งหมด</label>' +
        '<label class="check"><input type="radio" name="mode" data-f="mode" value="buy"' + (state.mode === "buy" ? " checked" : "") + '> ซื้อสินค้า</label>' +
        '<label class="check" data-rent-only><input type="radio" name="mode" data-f="mode" value="rent"' + (state.mode === "rent" ? " checked" : "") + '> เช่าสินค้า</label></div>' +
        '<button class="me-btn me-btn-ghost me-btn-sm" data-clear>ล้างตัวกรอง</button>';

      var pminEl = fbox.querySelector("[data-pmin]");
      var pmaxEl = fbox.querySelector("[data-pmax]");
      if (state.priceMin) pminEl.value = state.priceMin;
      if (state.priceMax) pmaxEl.value = state.priceMax;
      pminEl.addEventListener("input", function () { state.priceMin = parseInt(pminEl.value, 10) || 0; render(); });
      pmaxEl.addEventListener("input", function () { state.priceMax = parseInt(pmaxEl.value, 10) || 0; render(); });
      fbox.querySelector("[data-clear]").addEventListener("click", function () {
        state.q = ""; state.cats = []; state.brands = []; state.mode = "all"; state.sort = "default"; state.priceMin = 0; state.priceMax = 0; state.inStock = false;
        if (sinput) sinput.value = "";
        if (sortSel) sortSel.value = "default";
        buildSidebar(); render();
      });
    }

    if (sinput) { sinput.value = state.q; sinput.addEventListener("input", function () { state.q = sinput.value.trim(); render(); }); }
    if (sortSel) sortSel.addEventListener("change", function () { state.sort = sortSel.value; render(); });

    // delegation บน fbox (อยู่ถาวร) — ทำงานแม้แถบตัวกรองถูกวาดใหม่
    fbox.addEventListener("change", function (e) {
      var f = e.target.getAttribute("data-f");
      if (f === "cat") state.cats = checkedValues(fbox, "cat");
      else if (f === "brand") state.brands = checkedValues(fbox, "brand");
      else if (f === "mode") state.mode = e.target.value;
      else if (f === "instock") state.inStock = e.target.checked;
      render();
    });

    function render() {
      renderCrumbTitle();
      // หมวดที่กรอง = หมวดที่เลือก + หมวดย่อยทุกชั้นใต้มัน (กดหมวดแม่เห็นสินค้าทั้งซับทรี)
      var acceptCats = null;
      if (state.cats.length) { acceptCats = {}; state.cats.forEach(function (k) { var d = S.catDescendants(k); for (var x in d) acceptCats[x] = 1; }); }
      var list = S.getProducts().filter(function (p) {
        if (p.hidden) return false;
        if (state.q) { var hay = (p.name + " " + p.brand + " " + p.sku + " " + S.categoryLabel(p.category)).toLowerCase(); if (hay.indexOf(state.q.toLowerCase()) < 0) return false; }
        if (acceptCats && !acceptCats[p.category]) return false;
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
    buildSidebar(); render();
    pageRefresh = function () { buildSidebar(); render(); };
  }

  /* ===================== PRODUCT ===================== */
  function initProduct() {
    pageRefresh = initProduct; // re-วาดเมื่อสินค้าจาก cloud มาถึง (กรณียังไม่พบตอนแรก)
    var id = U.qp("id");
    var p = S.getProduct(id);
    var root = document.querySelector("[data-product]");
    if (!p || p.hidden) { root.innerHTML = '<div class="empty"><h3>ไม่พบสินค้านี้</h3><a class="me-btn" href="shop.html">กลับไปหน้าสินค้า</a></div>'; return; }

    document.title = p.name + " — M.E.Tools";
    var avail = S.available(p);
    var mode = p.forSale ? "buy" : "rent";
    var qty = 1, days = 1;

    root.innerHTML =
      '<div class="crumbs"><a href="index.html">หน้าแรก</a> / <a href="shop.html">สินค้า</a> / ' +
        '<a href="shop.html?cat=' + p.category + '">' + S.categoryLabel(p.category) + "</a> / " + p.name + "</div>" +
      '<div class="pd-grid"><div>' + productViewer(p) + "</div>" +
        '<div class="pd-info"><span class="pd-brand">' + p.brand + "</span>" +
          '<h1 class="pd-name">' + p.name + "</h1>" +
          '<div class="pd-rate">' + starsDisplay(p) + "</div>" +
          '<span class="' + (avail > 0 ? "stockpill in" : "stockpill out") + '">' +
            (avail > 0 ? "มีของพร้อมส่ง · เหลือ " + avail + " ชิ้น" : "สินค้าหมดชั่วคราว") + " · " + S.categoryLabel(p.category) + "</span>" +
          '<div class="pd-desc">' + descToHtml(p.desc) + "</div>" +
          '<div class="pd-prices">' +
            (p.forSale ? '<div class="pd-price-box"><div class="k">ราคาขาย</div><div class="v">' + S.money(p.price) + "</div></div>" : "") +
            (p.forRent ? '<div class="pd-price-box" data-rent-only><div class="k">ค่าเช่า / วัน</div><div class="v rent">' + S.money(p.rentPerDay) + "</div></div>" : "") +
          "</div><div class=\"buybox\" data-buybox></div>" +
          '<div class="pd-rate-give"><span class="pd-rate-give-label">⭐ ให้คะแนนสินค้านี้</span>' + ratingWidget(p.id) + "</div>" +
          "<table class=specs><tbody><tr><th>รหัสสินค้า (SKU)</th><td>" + p.sku + "</td></tr>" +
            "<tr><th>การรับประกัน</th><td>" + (p.warrantyYears ? "ศูนย์ " + p.warrantyYears + " ปี" : "ตามเงื่อนไขร้าน") + "</td></tr>" +
            (p.motorType && p.motorType !== "—" ? "<tr><th>ระบบมอเตอร์</th><td>" + p.motorType + "</td></tr>" : "") +
            (p.shipSize ? "<tr><th>ขนาด/น้ำหนักสำหรับจัดส่ง</th><td>" + p.shipSize + "</td></tr>" : "") +
            (p.specs || []).map(function (s) { var kv = specKV(s); return "<tr><th>" + kv[0] + "</th><td>" + kv[1] + "</td></tr>"; }).join("") +
          "</tbody></table></div></div>" +
      '<section class="pd-reviews" id="reviews"><h2 class="me-section-h">รีวิว<span class="me-hl">จากลูกค้า</span></h2>' +
        '<div class="pd-rev-summary" data-rev-summary></div>' +
        '<div class="pd-rev-list" data-rev-list><div class="rv-empty">กำลังโหลดรีวิว…</div></div>' +
        reviewFormHtml() + "</section>";

    wireViewer(root, p);
    wireRating(root);
    function loadAndRenderReviews() {
      S.loadReviews(p.id).then(function (list) {
        var listBox = root.querySelector("[data-rev-list]"); if (listBox) listBox.innerHTML = reviewsHtml(list);
        var sum = root.querySelector("[data-rev-summary]");
        if (sum) {
          var fresh = S.getProduct(p.id) || p, r = S.productRating(fresh);
          sum.innerHTML = r.count
            ? '<span class="pd-rev-avg">' + r.avg.toFixed(1) + '</span><span class="me-stars">' + reviewStars(Math.round(r.avg)) + "</span><span class=\"pd-rev-cnt\">จาก " + r.count + " รีวิว</span>"
            : "";
        }
      });
    }
    wireReviewForm(root, p.id, loadAndRenderReviews);
    loadAndRenderReviews();

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
          o.items.map(function (it) { return '<div class="order-line"><span>' + it.name + " × " + it.qty + (it.days ? " (" + it.days + " วัน)" : "") + "</span><span>" + S.money(it.unitPrice * it.qty * (it.days || 1)) + "</span></div>" + (it.productId ? '<div class="order-rate"><span class="order-rate-label">ให้คะแนนสินค้านี้:</span>' + ratingWidget(it.productId) + "</div>" : ""); }).join("") +
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
      wireRating(root);
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
  /* ===================== CATALOG ===================== */
  /* ---------- catalog: real in-house flipbook ---------- */
  function catCoverHtml(st) {
    var company = (st && st.company) || "M.E.Tools";
    return '<div class="cat-page cat-cover">' +
      '<div class="cat-cover-mark">M.E.TOOLS</div>' +
      "<h2>แคตตาล็อกสินค้า</h2>" +
      "<p>" + esc(company) + "</p>" +
      "<p>เครื่องมือช่างคุณภาพ · ท่ารั้ว เชียงใหม่</p>" +
      '<div class="cat-cover-hint">แตะหน้า หรือใช้ปุ่ม ‹ › เพื่อเปิดดู</div>' +
      "</div>";
  }
  function catCardHtml(p, brand) {
    var imgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    var main = imgs[0] || "";
    var img = main
      ? '<div class="osk-photo" style="' + cssBg(main) + '"></div>'
      : '<div class="osk-photo osk-photo-ph">' + U.iconSvg(p.icon || "tool", 52) + "</div>";
    var chip = brand ? '<span class="osk-chip">' + esc(brand) + "</span>" : "";
    var inbox = imgs.slice(1, 6);
    var inboxHtml = inbox.length
      ? '<div class="osk-mini-label">สินค้าภายในกล่อง</div><div class="osk-inbox">' +
        inbox.map(function (im) { return '<span style="' + cssBg(im) + '"></span>'; }).join("") + "</div>"
      : "";
    var specs = (p.specs || []).map(specKV).filter(function (kv) { return kv[0] || kv[1]; }).slice(0, 6);
    var specsHtml = specs.length
      ? '<div class="osk-mini-label">รายละเอียดสินค้า</div><ul class="osk-bul">' +
        specs.map(function (kv) { return "<li>" + esc(kv[0]) + (kv[1] ? " : " + esc(kv[1]) : "") + "</li>"; }).join("") + "</ul>"
      : "";
    var hl = (p.highlights || []).filter(Boolean).slice(0, 3);
    var hlHtml = hl.length
      ? '<div class="osk-mini-label">จุดเด่น</div><ul class="osk-bul osk-bul-hl">' +
        hl.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>"
      : "";
    var qty = p.qtyPerBox > 0;
    var head = '<tr><th class="c-code">รหัสสินค้า</th><th class="c-srp">SRP</th><th class="c-ctrl">ราคาคุม</th>' +
      (qty ? '<th class="c-qty">จำนวน</th>' : "") + "</tr>";
    var body = "<tr><td>" + esc(p.sku || "-") + "</td>" +
      "<td>" + S.money(p.price || 0) + "</td>" +
      '<td class="c-ctrl">' + (p.priceCtrl ? S.money(p.priceCtrl) : "—") + "</td>" +
      (qty ? "<td>" + esc(String(p.qtyPerBox)) + " ตัว</td>" : "") + "</tr>";
    return '<div class="osk-card">' +
      '<div class="osk-name">' + esc(p.name || "") + "</div>" +
      '<div class="osk-img">' + chip + img + "</div>" +
      inboxHtml + specsHtml + hlHtml +
      '<table class="osk-price">' + head + body + "</table>" +
    "</div>";
  }
  // DEWALT = แบรนด์เน้นขาย → หน้าแคตตาล็อกแบบละเอียด 1 สินค้า/หน้า (เหมือนแคตตาล็อกจริง)
  function isDewalt(brand) { return /dewalt/i.test(brand || "") || /ดีว/.test(brand || ""); }
  function catDewaltPageHtml(p) {
    var imgs = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    var main = imgs[0] || "";
    var photo = main
      ? '<div class="cat-card-photo" style="' + cssBg(main) + '"></div>'
      : '<div class="cat-card-photo cat-card-photo-ph">' + U.iconSvg(p.icon || "tool", 90) + "</div>";
    var inbox = imgs.slice(1, 8);
    var inboxHtml = inbox.length
      ? '<div class="cat-inbox-label">สินค้าภายในกล่อง</div><div class="cat-inbox">' +
        inbox.map(function (im) { return '<span style="' + cssBg(im) + '"></span>'; }).join("") + "</div>"
      : "";
    var specs = (p.specs || []).map(specKV).filter(function (kv) { return kv[0] || kv[1]; }).slice(0, 8);
    var specsHtml = specs.length
      ? '<div class="cat-sec-label">รายละเอียดสินค้า</div><ul class="cat-specs">' +
        specs.map(function (kv) { return "<li>" + esc(kv[0]) + (kv[1] ? " : " + esc(kv[1]) : "") + "</li>"; }).join("") + "</ul>"
      : "";
    var hl = (p.highlights || []).filter(Boolean).slice(0, 4);
    var hlHtml = hl.length
      ? '<div class="cat-sec-label">จุดเด่น</div><ul class="cat-highlights">' +
        hl.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>"
      : "";
    var qty = p.qtyPerBox > 0;
    var head = "<tr><th>รหัสสินค้า</th><th>SRP</th><th>ราคาคุม</th>" + (qty ? "<th>จำนวน/กล่อง</th>" : "") + "</tr>";
    var body = "<tr><td>" + esc(p.sku || "-") + "</td><td>" + S.money(p.price || 0) + '</td><td class="ctrl">' +
      (p.priceCtrl ? S.money(p.priceCtrl) : "—") + "</td>" + (qty ? "<td>" + esc(String(p.qtyPerBox)) + " ตัว</td>" : "") + "</tr>";
    return '<div class="cat-page">' +
      '<div class="cat-brandbar">DEWALT · ' + esc(p.brand || "DEWALT") + "</div>" +
      '<div class="cat-page-body"><div class="cat-card">' +
        '<div class="cat-card-head">' + esc(p.name || "") + "</div>" +
        '<div class="cat-card-main">' + photo +
          '<div class="cat-card-side">' + inboxHtml + specsHtml + hlHtml + "</div>" +
        "</div>" +
        '<table class="cat-price">' + head + body + "</table>" +
      "</div></div>" +
    "</div>";
  }
  function catProductPageHtml(items, brand) {
    var cards = items.map(function (p) { return catCardHtml(p, brand); });
    while (cards.length < 4) cards.push('<div class="osk-card osk-card-empty"></div>');
    return '<div class="cat-page osk-page">' +
      '<div class="osk-masthead"><span class="osk-mark">M.E.TOOLS</span>' +
        '<span class="osk-page-brand">' + esc(brand || "") + "</span></div>" +
      '<div class="osk-grid">' + cards.join("") + "</div>" +
    "</div>";
  }
  function initCatalog() {
    var box = document.querySelector("[data-book]");
    if (!box) return;
    pageRefresh = initCatalog; // re-วาดเมื่อแคตตาล็อกจาก cloud มาถึง
    var st = S.getSettings();
    var products = S.getProducts().filter(function (p) { return !p.hidden; });

    var brandOrder = (st.brands || []).filter(function (b) { return !b.hidden; }).map(function (b) { return b.name; });
    var present = uniq(products.map(function (p) { return p.brand; }).filter(Boolean));
    var brands = brandOrder.filter(function (b) { return present.indexOf(b) >= 0; })
      .concat(present.filter(function (b) { return brandOrder.indexOf(b) < 0; }));

    var groups = [];
    brands.forEach(function (b) {
      var list = products.filter(function (p) { return p.brand === b; });
      if (list.length) groups.push({ brand: b, list: list });
    });
    var noBrand = products.filter(function (p) { return !p.brand || brands.indexOf(p.brand) < 0; });
    if (noBrand.length) groups.push({ brand: "อื่นๆ", list: noBrand });
    // DEWALT มาก่อน (แบรนด์ที่เน้นขาย)
    groups.sort(function (a, b) { return (isDewalt(b.brand) ? 1 : 0) - (isDewalt(a.brand) ? 1 : 0); });

    if (!groups.length) { box.innerHTML = '<div class="catalog-empty">ยังไม่มีสินค้าในแคตตาล็อก</div>'; return; }

    var BLANK = '<div class="cat-page cat-blank"></div>';
    var pages = [catCoverHtml(st)];
    groups.forEach(function (g) {
      if (isDewalt(g.brand)) {
        // DEWALT: 1 สินค้า/หน้า แบบละเอียด (เน้นขาย)
        g.list.forEach(function (p) { pages.push(catDewaltPageHtml(p)); });
      } else {
        // แบรนด์อื่น: แบบ OSUKA 4 ช่อง/หน้า (เหมือนเดิม)
        for (var i = 0; i < g.list.length; i += 4) pages.push(catProductPageHtml(g.list.slice(i, i + 4), g.brand));
      }
    });
    if (pages.length % 2 !== 0) pages.push(BLANK);

    box.innerHTML =
      '<div class="book"><div class="book-spread" data-spread>' +
        '<div class="book-page book-left"><div class="book-page-inner" data-pleft></div></div>' +
        '<div class="book-page book-right"><div class="book-page-inner" data-pright></div></div>' +
      "</div></div>" +
      '<div class="book-nav"><button type="button" data-prev aria-label="ก่อนหน้า">‹</button>' +
        '<span class="book-pageno" data-pageno></span>' +
        '<button type="button" data-next aria-label="ถัดไป">›</button></div>';

    var spread = box.querySelector("[data-spread]");
    var pleft = box.querySelector("[data-pleft]");
    var pright = box.querySelector("[data-pright]");
    var prevBtn = box.querySelector("[data-prev]");
    var nextBtn = box.querySelector("[data-next]");
    var pageno = box.querySelector("[data-pageno]");
    var pos = 0, animating = false;

    function perSpread() { return window.matchMedia("(max-width:760px)").matches ? 1 : 2; }
    function renderStatic() {
      if (perSpread() === 1) { pright.innerHTML = pages[pos] || BLANK; pleft.innerHTML = ""; }
      else { pleft.innerHTML = pages[pos] || BLANK; pright.innerHTML = pages[pos + 1] || BLANK; }
    }
    function updateNav() {
      var step = perSpread() === 1 ? 1 : 2;
      prevBtn.disabled = pos <= 0;
      nextBtn.disabled = pos + step >= pages.length;
      if (perSpread() === 1) pageno.textContent = "หน้า " + (pos + 1) + " / " + pages.length;
      else pageno.textContent = "หน้า " + (pos + 1) + "–" + Math.min(pos + 2, pages.length) + " / " + pages.length;
    }
    function makeLeaf(frontHtml, backHtml, left, width, origin) {
      var leaf = document.createElement("div");
      leaf.className = "book-leaf";
      leaf.style.left = left; leaf.style.width = width; leaf.style.transformOrigin = origin;
      var f = document.createElement("div"); f.className = "book-leaf-face"; f.innerHTML = frontHtml + '<div class="book-leaf-shade"></div>';
      var bk = document.createElement("div"); bk.className = "book-leaf-face book-leaf-back"; bk.innerHTML = backHtml + '<div class="book-leaf-shade"></div>';
      leaf.appendChild(f); leaf.appendChild(bk);
      return leaf;
    }
    function onFlipEnd(leaf, cb) {
      var done = false;
      function fin() { if (done) return; done = true; leaf.removeEventListener("transitionend", fin); cb(); }
      leaf.addEventListener("transitionend", fin);
      setTimeout(fin, 950);
    }
    function runFlip(leaf, fromDeg, toDeg, after) {
      leaf.style.transform = "rotateY(" + fromDeg + "deg)";
      spread.appendChild(leaf);
      leaf.getBoundingClientRect();
      requestAnimationFrame(function () { requestAnimationFrame(function () { leaf.style.transform = "rotateY(" + toDeg + "deg)"; }); });
      onFlipEnd(leaf, function () { if (leaf.parentNode) leaf.parentNode.removeChild(leaf); after(); });
    }
    function flipNext() {
      if (animating) return;
      var single = perSpread() === 1, step = single ? 1 : 2;
      if (pos + step >= pages.length) return;
      animating = true;
      var leaf;
      if (single) {
        leaf = makeLeaf(pages[pos] || BLANK, pages[pos + 1] || BLANK, "0", "100%", "left center");
        pright.innerHTML = pages[pos + 1] || BLANK;
      } else {
        leaf = makeLeaf(pages[pos + 1] || BLANK, pages[pos + 2] || BLANK, "50%", "50%", "left center");
        pright.innerHTML = pages[pos + 3] || BLANK;
      }
      runFlip(leaf, 0, -180, function () { pos += step; renderStatic(); updateNav(); animating = false; });
    }
    function flipPrev() {
      if (animating) return;
      var single = perSpread() === 1, step = single ? 1 : 2;
      if (pos - step < 0) return;
      animating = true;
      var leaf;
      if (single) {
        leaf = makeLeaf(pages[pos - 1] || BLANK, pages[pos] || BLANK, "0", "100%", "left center");
        runFlip(leaf, -180, 0, function () { pos -= step; renderStatic(); updateNav(); animating = false; });
      } else {
        leaf = makeLeaf(pages[pos] || BLANK, pages[pos - 1] || BLANK, "0", "50%", "right center");
        pleft.innerHTML = pages[pos - 2] || BLANK;
        pright.innerHTML = pages[pos - 1] || BLANK;
        runFlip(leaf, 0, 180, function () { pos -= step; renderStatic(); updateNav(); animating = false; });
      }
    }

    prevBtn.addEventListener("click", flipPrev);
    nextBtn.addEventListener("click", flipNext);
    spread.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) return;
      var r = spread.getBoundingClientRect();
      if ((e.clientX - r.left) > r.width / 2) flipNext(); else flipPrev();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") flipNext();
      else if (e.key === "ArrowLeft") flipPrev();
    });
    var tx = 0;
    spread.addEventListener("touchstart", function (e) { tx = e.changedTouches[0].clientX; }, { passive: true });
    spread.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - tx;
      if (dx < -40) flipNext(); else if (dx > 40) flipPrev();
    }, { passive: true });
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (perSpread() === 2 && pos % 2 === 1) pos -= 1;
        renderStatic(); updateNav();
      }, 150);
    });

    renderStatic(); updateNav();
  }

  function cardHtml(p) {
    var avail = S.available(p);
    var low = avail > 0 && avail <= 3;
    return (
      '<div class="card"><a class="tilelink" href="product.html?id=' + p.id + '">' + U.productTile(p) + "</a>" +
      '<div class="card-body"><span class="card-cat">' + S.categoryLabel(p.category) + " · " + p.brand + "</span>" +
        '<a class="card-name" href="product.html?id=' + p.id + '">' + p.name + "</a>" +
        '<div class="card-rate">' + starsDisplay(p) + "</div>" +
        '<div class="card-price">' +
          (p.forSale ? '<span class="price-buy">' + S.money(p.price) + "</span>" : "") +
          (p.forRent ? '<span class="price-rent" data-rent-only>เช่า ' + S.money(p.rentPerDay) + "/วัน</span>" : "") + "</div>" +
        '<span class="card-stock ' + (avail <= 0 || low ? "low" : "") + '">' + (avail <= 0 ? "สินค้าหมด" : "มีสินค้าพร้อมส่ง · เหลือ " + avail + " ชิ้น") + "</span></div>" +
      '<div class="card-actions"><a class="me-btn me-btn-sm me-btn-ghost" href="product.html?id=' + p.id + '">รายละเอียด</a>' +
        (avail > 0 ? '<button class="me-btn me-btn-sm" data-quickadd="' + p.id + '" data-mode="' + (p.forSale ? "buy" : "rent") + '">' + (p.forSale ? "ใส่ตะกร้า" : "เช่าสินค้า") + "</button>" : '<button class="me-btn me-btn-sm" disabled>หมด</button>') +
      "</div></div>"
    );
  }
  /* ===================== PRODUCT MEDIA VIEWER =====================
     Rich, optional media per product. Every field is optional — a viewer tab
     only appears when its data exists, so products with none behave exactly
     like the old simple gallery. The photos / 360° frames / part images are
     shot & generated with Claude later, then dropped into these fields:

       p.images    : ["url", ...]   ภาพสินค้าหลายรูป (แกลเลอรี + กดเพื่อซูม)
       p.frames360 : ["url", ...]   เฟรมรูปเรียงรอบวัตถุ → ลากเพื่อหมุนดู 360°
       p.partsBase : "url"          ภาพตัวเครื่องสำหรับโหมดแยกอะไหล่ (ไม่ใส่ = ใช้ images[0])
       p.parts     : [{ x, y, label, sku, image, note }, ...]
                     จุดอะไหล่ — x,y เป็น % (0–100) วางทับรูป
                     ดับเบิลคลิกจุด → แยกชิ้นส่วน/อะไหล่จุดนั้นออกมาดูทีละจุด
  */
  function productImages(p) { return (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []); }
  function clampPct(v) { v = parseFloat(v); if (isNaN(v)) return 50; return Math.max(0, Math.min(100, v)); }

  /* 3D model — supports a Sketchfab link/embed OR a direct .glb/.gltf URL.
     Returns null when no usable model is set, else { type, embed|src }. */
  function model3dInfo(p) {
    var url = String((p && p.model3d) || "").trim();
    if (!url) return null;
    // Sketchfab share link (…/3d-models/name-UID) or embed link (…/models/UID/embed)
    var sk = url.match(/sketchfab\.com\/(?:3d-models\/[^\/?#]*-|models\/)([0-9a-f]{12,})/i);
    if (sk) {
      return { type: "sketchfab", embed: "https://sketchfab.com/models/" + sk[1] +
        "/embed?autospin=0.3&autostart=1&preload=1&ui_theme=dark&ui_infos=0&ui_watermark=0&ui_hint=2" };
    }
    if (/sketchfab\.com\//i.test(url) && /\/embed/i.test(url)) return { type: "sketchfab", embed: url };
    // direct 3D file → render with <model-viewer>
    if (/\.(glb|gltf)(\?|#|$)/i.test(url)) return { type: "glb", src: url };
    return null;
  }

  // lazy-load Google's <model-viewer> web component, once, only when a .glb is opened
  var _mvPromise = null;
  function loadModelViewer() {
    if (window.customElements && customElements.get("model-viewer")) return Promise.resolve();
    if (_mvPromise) return _mvPromise;
    _mvPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.type = "module";
      s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
      s.onload = function () { customElements.whenDefined("model-viewer").then(resolve, resolve); };
      s.onerror = function () { _mvPromise = null; reject(new Error("model-viewer load failed")); };
      document.head.appendChild(s);
    });
    return _mvPromise;
  }

  function productViewer(p) {
    var imgs = productImages(p);
    var frames = (p.frames360 && p.frames360.length >= 2) ? p.frames360 : [];
    var parts = (p.parts && p.parts.length) ? p.parts : [];
    var m3d = model3dInfo(p);
    if (!imgs.length && !frames.length && !parts.length && !m3d) return "<div>" + U.productTile(p, { lg: true }) + "</div>";

    var tabs = [];
    if (imgs.length) tabs.push(["photos", "🖼 รูปภาพ"]);
    if (m3d) tabs.push(["model3d", "🧊 ดู 3 มิติ"]);
    if (frames.length) tabs.push(["spin", "🔄 หมุน 360°"]);
    if (parts.length) tabs.push(["parts", "🧩 อะไหล่ / แยกชิ้น"]);
    var first = tabs[0][0];

    var tabBar = tabs.length > 1
      ? '<div class="pdv-tabs" role="tablist">' + tabs.map(function (t) {
          return '<button type="button" class="pdv-tab' + (t[0] === first ? " on" : "") + '" data-pdv-tab="' + t[0] + '">' + t[1] + "</button>";
        }).join("") + "</div>"
      : "";

    // photos
    var photosPanel = imgs.length
      ? '<div class="pdv-panel" data-pdv-panel="photos"' + (first === "photos" ? "" : " hidden") + '>' +
        '<div class="pd-gallery"><div class="pd-main" data-pd-main role="button" tabindex="0" title="กดเพื่อขยายดูรูป" style="' + cssBg(imgs[0]) + '"><span class="pd-zoom-hint">🔍 กดเพื่อขยาย</span></div>' +
        (imgs.length > 1 ? '<div class="pd-thumbs">' + imgs.map(function (im, i) { return '<button type="button" class="pd-thumb' + (i === 0 ? " on" : "") + '" data-pd-thumb="' + i + '" style="' + cssBg(im) + '"></button>'; }).join("") + "</div>" : "") +
        "</div></div>"
      : "";

    // 3D model (Sketchfab embed or .glb via <model-viewer>) — mounted lazily in wireViewer
    var model3dPanel = m3d
      ? '<div class="pdv-panel" data-pdv-panel="model3d"' + (first === "model3d" ? "" : " hidden") + '>' +
        '<div class="pd-3d"><div class="pd-3d-stage" data-pd-3d>' +
          '<span class="pd-3d-badge">3D</span>' +
          '<div class="pd-3d-loading"><span class="pd-3d-spinner"></span>กำลังโหลดโมเดล 3 มิติ…</div></div>' +
          '<div class="pd-3d-cap">🖱️ ลากเพื่อหมุน · สกอลล์/หนีบนิ้วเพื่อซูม · ดูสินค้าจริงรอบทิศ 360°</div>' +
        "</div></div>"
      : "";

    // 360 spin
    var spinPanel = frames.length
      ? '<div class="pdv-panel" data-pdv-panel="spin"' + (first === "spin" ? "" : " hidden") + '>' +
        '<div class="pd-spin" data-pd-spin>' +
          '<div class="pd-spin-stage" data-spin-stage style="' + cssBg(frames[0]) + '">' +
            '<span class="pd-spin-badge">360°</span><span class="pd-spin-grab">↔ ลากเพื่อหมุน</span></div>' +
          '<div class="pd-spin-bar">' +
            '<button type="button" class="pd-spin-play" data-spin-play>▶ หมุนอัตโนมัติ</button>' +
            '<input type="range" class="pd-spin-range" data-spin-range min="0" max="' + (frames.length - 1) + '" value="0" aria-label="เลื่อนเพื่อหมุน"></div>' +
        "</div></div>"
      : "";

    // exploded parts
    var baseImg = p.partsBase || imgs[0] || "";
    var partsPanel = parts.length
      ? '<div class="pdv-panel" data-pdv-panel="parts"' + (first === "parts" ? "" : " hidden") + '>' +
        '<div class="pd-parts" data-pd-parts>' +
          '<div class="pd-parts-stage" data-parts-stage' + (baseImg ? ' style="' + cssBg(baseImg) + '"' : ' data-noimg="1"') + '>' +
            parts.map(function (pt, i) {
              return '<button type="button" class="pd-hot" data-hot="' + i + '" style="left:' + clampPct(pt.x) + '%;top:' + clampPct(pt.y) + '%" title="' + esc(pt.label || ("อะไหล่ #" + (i + 1))) + '"><span class="pd-hot-num">' + (i + 1) + "</span></button>";
            }).join("") +
          "</div>" +
          '<div class="pd-parts-cap">💡 <b>ดับเบิลคลิก</b>ที่จุดหมายเลข เพื่อแยกชิ้นส่วน/อะไหล่จุดนั้นออกมาดูทีละจุด</div>' +
        "</div></div>"
      : "";

    return '<div class="pd-viewer" data-pd-viewer>' + tabBar +
      '<div class="pdv-panels">' + photosPanel + model3dPanel + spinPanel + partsPanel + "</div></div>";
  }

  function wireViewer(scope, p) {
    // tab switching
    scope.querySelectorAll("[data-pdv-tab]").forEach(function (t) {
      t.addEventListener("click", function () {
        var key = t.getAttribute("data-pdv-tab");
        scope.querySelectorAll("[data-pdv-tab]").forEach(function (x) { x.classList.toggle("on", x === t); });
        scope.querySelectorAll("[data-pdv-panel]").forEach(function (pan) { pan.hidden = pan.getAttribute("data-pdv-panel") !== key; });
      });
    });

    // photo gallery + lightbox
    var imgs = productImages(p);
    var main = scope.querySelector("[data-pd-main]");
    if (main) {
      scope.querySelectorAll("[data-pd-thumb]").forEach(function (b) {
        b.addEventListener("click", function () {
          main.style.backgroundImage = b.style.backgroundImage;
          scope.querySelectorAll("[data-pd-thumb]").forEach(function (x) { x.classList.toggle("on", x === b); });
        });
      });
      function curIdx() { var on = scope.querySelector("[data-pd-thumb].on"); return on ? +on.getAttribute("data-pd-thumb") : 0; }
      main.addEventListener("click", function () { openLightbox(imgs, curIdx()); });
      main.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(imgs, curIdx()); } });
    }

    // 3D model — mount only when its tab is first shown (don't load 3D until needed)
    var el3d = scope.querySelector("[data-pd-3d]");
    if (el3d) {
      var info = model3dInfo(p), mounted = false;
      function mount3d() {
        if (mounted || !info) return; mounted = true;
        if (info.type === "sketchfab") {
          var f = document.createElement("iframe");
          f.className = "pd-3d-frame";
          f.title = (p.name || "สินค้า") + " — โมเดล 3 มิติ";
          f.setAttribute("allow", "autoplay; fullscreen; xr-spatial-tracking");
          f.setAttribute("allowfullscreen", "");
          f.setAttribute("loading", "lazy");
          f.src = info.embed;
          el3d.appendChild(f);
        } else {
          loadModelViewer().then(function () {
            var mv = document.createElement("model-viewer");
            mv.className = "pd-3d-mv";
            mv.setAttribute("src", info.src);
            mv.setAttribute("alt", p.name || "โมเดล 3 มิติของสินค้า");
            mv.setAttribute("camera-controls", "");
            mv.setAttribute("auto-rotate", "");
            mv.setAttribute("rotation-per-second", "20deg");
            mv.setAttribute("ar", "");
            mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
            mv.setAttribute("shadow-intensity", "1");
            mv.setAttribute("exposure", "1.1");
            mv.setAttribute("touch-action", "pan-y");
            el3d.appendChild(mv);
          }).catch(function () {
            el3d.innerHTML = '<div class="pd-3d-loading">โหลดโมเดล 3 มิติไม่สำเร็จ — ลองรีเฟรชหน้าอีกครั้ง</div>';
          });
        }
      }
      var panel3d = scope.querySelector('[data-pdv-panel="model3d"]');
      if (panel3d && !panel3d.hidden) mount3d(); // it's the default tab → mount now
      scope.querySelectorAll('[data-pdv-tab="model3d"]').forEach(function (t) { t.addEventListener("click", mount3d); });
    }

    // 360 spin
    var spin = scope.querySelector("[data-pd-spin]");
    if (spin) wireSpin(spin, p.frames360 || []);

    // exploded parts
    var partsEl = scope.querySelector("[data-pd-parts]");
    if (partsEl) wireParts(partsEl, p.parts || []);
  }

  // drag / scrub / autoplay through an ordered set of frames
  function wireSpin(root, frames) {
    if (frames.length < 2) return;
    var stage = root.querySelector("[data-spin-stage]");
    var range = root.querySelector("[data-spin-range]");
    var playBtn = root.querySelector("[data-spin-play]");
    var idx = 0, timer = null;
    function show(i) {
      idx = ((i % frames.length) + frames.length) % frames.length;
      stage.style.backgroundImage = "url(" + JSON.stringify(frames[idx]) + ")";
      if (range) range.value = idx;
    }
    function start() { if (timer) return; timer = setInterval(function () { show(idx + 1); }, 120); playBtn.classList.add("on"); playBtn.textContent = "⏸ หยุดหมุน"; }
    function stop() { if (!timer) return; clearInterval(timer); timer = null; playBtn.classList.remove("on"); playBtn.textContent = "▶ หมุนอัตโนมัติ"; }
    if (playBtn) playBtn.addEventListener("click", function () { timer ? stop() : start(); });
    if (range) range.addEventListener("input", function () { stop(); show(+range.value); });

    var dragging = false, startX = 0, startIdx = 0;
    function step() { return Math.max(6, stage.clientWidth / frames.length); }
    function down(x) { dragging = true; startX = x; startIdx = idx; stop(); stage.classList.add("grabbing"); }
    function move(x) { if (!dragging) return; show(startIdx - Math.round((x - startX) / step())); }
    function up() { dragging = false; stage.classList.remove("grabbing"); }
    stage.addEventListener("mousedown", function (e) { e.preventDefault(); down(e.clientX); });
    window.addEventListener("mousemove", function (e) { move(e.clientX); });
    window.addEventListener("mouseup", up);
    stage.addEventListener("touchstart", function (e) { down(e.touches[0].clientX); }, { passive: true });
    stage.addEventListener("touchmove", function (e) { move(e.touches[0].clientX); }, { passive: true });
    stage.addEventListener("touchend", up);
    show(0);
  }

  // double-click a hotspot to "explode" that part out into a callout
  function wireParts(root, parts) {
    var stage = root.querySelector("[data-parts-stage]");
    var open = {};
    function close(i) {
      open[i] = false;
      var hot = stage.querySelector('[data-hot="' + i + '"]'); if (hot) hot.classList.remove("open");
      var call = stage.querySelector('[data-call="' + i + '"]'); if (call) call.parentNode.removeChild(call);
    }
    function toggle(i) {
      if (open[i]) { close(i); return; }
      open[i] = true;
      var hot = stage.querySelector('[data-hot="' + i + '"]'); if (hot) hot.classList.add("open");
      var pt = parts[i] || {};
      var call = document.createElement("div");
      call.className = "pd-part-callout";
      call.setAttribute("data-call", i);
      call.style.left = clampPct(pt.x) + "%";
      call.style.top = clampPct(pt.y) + "%";
      if (clampPct(pt.x) > 60) call.classList.add("flip");
      call.innerHTML =
        (pt.image ? '<div class="pd-part-img" style="' + cssBg(pt.image) + '"></div>' : '<div class="pd-part-img pd-part-img--ph">อะไหล่</div>') +
        '<div class="pd-part-meta"><div class="pd-part-label">' + esc(pt.label || ("อะไหล่ #" + (i + 1))) + "</div>" +
        (pt.sku ? '<div class="pd-part-sku">รหัส: ' + esc(pt.sku) + "</div>" : "") +
        (pt.note ? '<div class="pd-part-note">' + esc(pt.note) + "</div>" : "") +
        '<button type="button" class="pd-part-close" data-close="' + i + '">ปิด ✕</button></div>';
      stage.appendChild(call);
      requestAnimationFrame(function () { call.classList.add("show"); });
      call.querySelector("[data-close]").addEventListener("click", function (e) { e.stopPropagation(); close(i); });
    }
    parts.forEach(function (pt, i) {
      var hot = stage.querySelector('[data-hot="' + i + '"]');
      if (!hot) return;
      hot.addEventListener("dblclick", function (e) { e.preventDefault(); toggle(i); });
      var lastTap = 0; // double-tap fallback for touch
      hot.addEventListener("touchend", function (e) {
        var now = Date.now();
        if (now - lastTap < 320) { e.preventDefault(); toggle(i); lastTap = 0; } else { lastTap = now; }
      });
    });
  }

  // full-screen image lightbox with prev/next + keyboard
  function openLightbox(imgs, start) {
    if (!imgs || !imgs.length) return;
    var i = start || 0;
    var lb = document.createElement("div");
    lb.className = "pd-lightbox";
    lb.innerHTML =
      '<button class="pd-lb-close" aria-label="ปิด">✕</button>' +
      (imgs.length > 1 ? '<button class="pd-lb-nav prev" aria-label="ก่อนหน้า">‹</button>' : "") +
      '<div class="pd-lb-img" data-lb-img></div>' +
      (imgs.length > 1 ? '<button class="pd-lb-nav next" aria-label="ถัดไป">›</button>' : "") +
      (imgs.length > 1 ? '<div class="pd-lb-count" data-lb-count></div>' : "");
    document.body.appendChild(lb);
    document.body.style.overflow = "hidden";
    var imgEl = lb.querySelector("[data-lb-img]");
    var countEl = lb.querySelector("[data-lb-count]");
    function show() { i = ((i % imgs.length) + imgs.length) % imgs.length; imgEl.style.backgroundImage = "url(" + JSON.stringify(imgs[i]) + ")"; if (countEl) countEl.textContent = (i + 1) + " / " + imgs.length; }
    function close() { document.body.style.overflow = ""; lb.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); else if (e.key === "ArrowRight") { i++; show(); } else if (e.key === "ArrowLeft") { i--; show(); } }
    lb.querySelector(".pd-lb-close").addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    var prev = lb.querySelector(".pd-lb-nav.prev"); if (prev) prev.addEventListener("click", function () { i--; show(); });
    var next = lb.querySelector(".pd-lb-nav.next"); if (next) next.addEventListener("click", function () { i++; show(); });
    document.addEventListener("keydown", onKey);
    show();
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
    var list = (brands || []).filter(function (b) { return !b.hidden; });
    function card(b) {
      return '<a class="me-brand-card' + (b.primary ? " is-primary" : "") + '" href="shop.html?brand=' + encodeURIComponent(b.name) + '">' +
        '<div class="me-brand-name">' + esc(b.name) + '</div><div class="me-brand-tag">' + esc(b.tag || "") + "</div>" +
        (b.primary ? '<div class="me-brand-stamp">ศูนย์แท้</div>' : "") + "</a>";
    }
    var one = list.map(card).join("");
    // วน 3 ชุด เพื่อเลื่อนวนไม่รู้จบ (เลยขวาสุดต่ออันแรกเอง / ปัดซ้ายก็วน) — ไม่ตันปลายทาง
    box.innerHTML = list.length ? (one + one + one) : "";
    setupBrandsAutoScroll(box, list.length);
  }
  // แบรนด์เรียงแนวยาว เลื่อนหาได้ + เลื่อนเองอัตโนมัติช้าๆ (หยุดเมื่อผู้ใช้แตะ/เลื่อนเอง วนกลับเมื่อสุด)
  function setupBrandsAutoScroll(box, n) {
    if (box._brandTimer) { clearInterval(box._brandTimer); box._brandTimer = null; }
    if (!n) return;
    var paused = false, resumeT = null;
    function pause() { paused = true; if (resumeT) { clearTimeout(resumeT); resumeT = null; } }
    function resumeSoon() { if (resumeT) clearTimeout(resumeT); resumeT = setTimeout(function () { paused = false; }, 1500); }
    box.addEventListener("mouseenter", pause);
    box.addEventListener("mouseleave", function () { paused = false; });
    box.addEventListener("touchstart", pause, { passive: true });
    box.addEventListener("touchend", resumeSoon, { passive: true });
    box.addEventListener("wheel", function () { pause(); resumeSoon(); }, { passive: true });
    function third() { return box.scrollWidth / 3; }
    // เริ่มที่ชุดกลาง เพื่อให้ปัดได้ทั้งซ้าย-ขวาแบบไม่มีขอบ
    (function init() { var t = third(); if (t > 0) box.scrollLeft = t; else requestAnimationFrame(init); })();
    box._brandTimer = setInterval(function () {
      var t = third();
      if (t <= 0) return;
      if (!paused) box.scrollLeft += 0.6;                  // เลื่อนเองช้าๆ
      if (box.scrollLeft >= 2 * t) box.scrollLeft -= t;    // เลยชุดที่ 2 → วาร์ปถอย 1 ชุด (เนียน)
      else if (box.scrollLeft <= 0) box.scrollLeft += t;   // ปัดซ้ายเลยต้น → วาร์ปไป 1 ชุด
    }, 16);
  }
  // วันนี้ในรูปแบบ YYYY-MM-DD (เวลาท้องถิ่น) — เทียบกับช่วงวันที่ของโปร
  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function promoInWindow(promo) {
    // เคารพเวลาเริ่ม 2 ทุ่ม + ช่วงก่อน/หลังที่คำนวณ (โหมดวันที่ซ้ำ)
    if (S.promoActiveNow) return S.promoActiveNow(promo);
    var t = todayStr();
    var w = S.promoWindow ? S.promoWindow(promo) : { start: promo.startDate, end: promo.endDate };
    if (w.start && t < w.start) return false;
    if (w.end && t > w.end) return false;
    return true;
  }
  function renderPromo(promo) {
    var box = document.querySelector("[data-promo]"); if (!box) return;
    if (!promo || !promo.enabled || !promoInWindow(promo)) { box.innerHTML = ""; return; }
    // หัวข้อ/รายละเอียด: เติม token {dd}/{date} จากวันเริ่มโปรให้เอง (เจ้าของไม่ต้องแก้เอง)
    var fill = S.fillPromoTokens ? function (s) { return S.fillPromoTokens(s, promo); } : function (s) { return s || ""; };
    var title = fill(promo.title || "");
    var ptext = fill(promo.text || "");
    // ช่วงวันที่: ใช้ของเจ้าของถ้าพิมพ์ไว้ ไม่งั้นสร้างอัตโนมัติจากช่วงโปร
    var pdate = S.promoDateText ? S.promoDateText(promo) : fill(promo.dateText || "");
    // ลิงก์ร้านหลายช่อง (Shopee/Lazada/TikTok ฯลฯ) — ปุ่มเรียงกัน, เปิดแท็บใหม่
    var links = (promo.links || []).filter(function (l) { return l && l.url; });
    var linksHtml = links.length
      ? '<div class="me-promo-links">' + links.map(function (l) {
          return '<a class="me-btn me-btn-sm" href="' + esc(l.url) + '" target="_blank" rel="noopener">📌 ' + esc(l.label || "เปิดลิงก์") + " ▸</a>";
        }).join("") + "</div>"
      : '<a class="me-btn" href="shop.html">ดูสินค้า ▸</a>';
    var dateHtml = pdate ? '<p class="me-promo-date">👉 ' + esc(pdate) + "</p>" : "";
    var condHtml = promo.conditions ? '<p class="me-promo-cond">*' + esc(promo.conditions) + "</p>" : "";
    // รูป: หลายรูป → สไลด์เลื่อนซ้าย-ขวา (scroll-snap); รูปเดียว → ภาพนิ่ง
    var imgs = (promo.images && promo.images.length) ? promo.images : (promo.image ? [promo.image] : []);
    var imgHtml = "";
    if (imgs.length > 1) {
      imgHtml = '<div class="me-promo-slider">' + imgs.map(function (src) {
        return '<div class="me-promo-slide" style="' + cssBg(src) + '"></div>';
      }).join("") + "</div>";
    } else if (imgs.length === 1) {
      imgHtml = '<div class="me-promo-img" style="' + cssBg(imgs[0]) + '"></div>';
    }
    box.innerHTML = '<section class="me-promo"><div class="wrap"><div class="me-promo-card' + (imgs.length > 1 ? " has-slider" : "") + '">' +
      imgHtml +
      '<div class="me-promo-body"><div class="me-promo-tag">โปรโมชั่นพิเศษ</div>' +
      '<h2 class="me-promo-title">' + esc(title) + "</h2>" +
      (ptext ? '<p class="me-promo-text">' + esc(ptext) + "</p>" : "") +
      dateHtml + linksHtml + condHtml +
      "</div></div></div></section>";
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
