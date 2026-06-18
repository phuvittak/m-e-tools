/* =================================================================
   M.E.Tools — Shared data layer (localStorage "database")
   Powers BOTH the public storefront and the employee back office.
   No server required: data persists in the browser.
   ================================================================= */
(function (global) {
  "use strict";

  var KEY = {
    products: "me_products",
    orders: "me_orders",
    cart: "me_cart",
    session: "me_session",
    ship: "me_ship_rates",
    settings: "me_settings",
    users: "me_users",
    staff: "me_staff",
    ledger: "me_ledger",
    suppliers: "me_suppliers",
    purchases: "me_purchases",
    chats: "me_chats",
    seeded: "me_seeded_v2",
    cloudProducts: "me_cloud_products", // catalog pulled from Firestore (customers only)
    catalogVer: "me_catalog_ver",       // updatedAt ของ products/catalog ที่ดึงล่าสุด (กันอ่านซ้ำ = ประหยัด quota)
    deletedOrders: "me_deleted_orders", // tombstones: order ids ที่ลบแล้ว (กัน cloud snapshot ดูดกลับ)
    deletedProducts: "me_deleted_products", // tombstones: product ids ที่ลบแล้ว (กัน merge cloud ดูดกลับ)
    myWarranties: "me_my_warranties",   // เลขอ้างอิงใบประกันที่ลงจากเครื่องนี้ (ไว้ตรวจสอบสถานะ)
    myQuotes: "me_my_quotes",           // เลขอ้างอิงใบขอเสนอราคาที่ส่งจากเครื่องนี้
    stockApplied: "me_stock_applied",   // order ids ที่ตัดสต๊อกแล้ว (กันตัดซ้ำตอนรับออเดอร์จาก cloud)
    ratings: "me_ratings",              // ดาวที่เบราว์เซอร์นี้ให้ไว้ { productId: stars }
  };

  // ===== Firebase web config for REAL online chat (shared by ALL visitors) =====
  // Paste the config object from Firebase Console here, then redeploy.
  // (Firebase web config is meant to be public; security is enforced by Firestore rules.)
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDAuAE8rfpEAbn_T6T-7i_xX36PW6uVC8k",
    authDomain: "metools-724dc.firebaseapp.com",
    projectId: "metools-724dc",
    storageBucket: "metools-724dc.firebasestorage.app",
    messagingSenderId: "591880000748",
    appId: "1:591880000748:web:c0f087ce2805c5b41f81c9",
    measurementId: "G-6XYGTML9GZ"
  };

  /* ---------- Seed catalog ---------------------------------------- */
  // icon = category key used to draw an inline SVG tile (see iconFor).
  var SEED_PRODUCTS = [
    {
      id: "dcd805", sku: "DW-DCD805", name: 'สว่านกระแทกไร้สาย 20V MAX XR', brand: "DEWALT",
      category: "drill", icon: "drill",
      desc: "สว่านกระแทก 3 สปีด มอเตอร์ไร้แปรงถ่าน แรงบิดสูง เหมาะงานเจาะปูน ไม้ เหล็ก ครบจบในตัวเดียว",
      specs: [["แรงดัน", "20V MAX"], ["แรงบิด", "95 Nm"], ["หัวจับ", "13 มม."], ["มอเตอร์", "Brushless"]],
      cost: 4200, price: 6490, rentPerDay: 250, forSale: true, forRent: true,
      stock: 12, rented: 1, location: "โซน A-1 · ชั้น 2",
    },
    {
      id: "dcf809", sku: "DW-DCF809", name: "ไขควงกระแทกไร้สาย 20V MAX ATOMIC", brand: "DEWALT",
      category: "drill", icon: "driver",
      desc: "ไขควงกระแทกขนาดกะทัดรัด น้ำหนักเบา แรงบิด 170 Nm เข้าซอกแคบได้ดี เหมาะงานประกอบ",
      specs: [["แรงดัน", "20V MAX"], ["แรงบิด", "170 Nm"], ["หัวจับ", '1/4" Hex'], ["น้ำหนัก", "1.1 กก."]],
      cost: 3100, price: 4990, rentPerDay: 200, forSale: true, forRent: true,
      stock: 9, rented: 0, location: "โซน A-1 · ชั้น 2",
    },
    {
      id: "dcs391", sku: "DW-DCS391", name: "เลื่อยวงเดือนไร้สาย 20V MAX 184มม.", brand: "DEWALT",
      category: "saw", icon: "saw",
      desc: "เลื่อยวงเดือนใบ 7-1/4 นิ้ว ตัดลึก 65 มม. ปรับองศาได้ 0-50° เหมาะงานไม้และแผ่นพื้น",
      specs: [["แรงดัน", "20V MAX"], ["ใบเลื่อย", "184 มม."], ["รอบ", "5,150 รอบ/นาที"], ["ตัดลึก", "65 มม."]],
      cost: 4800, price: 7290, rentPerDay: 320, forSale: true, forRent: true,
      stock: 6, rented: 2, location: "โซน B-3 · ชั้นล่าง",
    },
    {
      id: "dwe402", sku: "DW-DWE402", name: "เครื่องเจียร 4 นิ้ว 1010 วัตต์", brand: "DEWALT",
      category: "grinder", icon: "grinder",
      desc: "เครื่องเจียรไฟฟ้า 100 มม. มอเตอร์ทนงานหนัก ระบบกันฝุ่น เหมาะงานตัด-เจียรเหล็กทั่วไป",
      specs: [["กำลังไฟ", "1010 วัตต์"], ["ใบ", "100 มม."], ["รอบ", "11,800 รอบ/นาที"], ["น้ำหนัก", "2.2 กก."]],
      cost: 1650, price: 2590, rentPerDay: 150, forSale: true, forRent: true,
      stock: 18, rented: 3, location: "โซน B-1 · ชั้น 1",
    },
    {
      id: "dch263", sku: "DW-DCH263", name: "สว่านโรตารี่ไร้สาย SDS-Plus 20V", brand: "DEWALT",
      category: "drill", icon: "rotary",
      desc: "สว่านโรตารี่งานหนัก เจาะปูน-คอนกรีตได้ลึก 26 มม. ระบบลดแรงสะเทือน สำหรับงานโครงสร้าง",
      specs: [["แรงดัน", "20V MAX"], ["ระบบ", "SDS-Plus"], ["แรงตอก", "2.6 J"], ["เจาะปูน", "26 มม."]],
      cost: 6900, price: 9990, rentPerDay: 450, forSale: true, forRent: true,
      stock: 5, rented: 1, location: "โซน A-2 · ชั้น 2",
    },
    {
      id: "dcb204", sku: "DW-DCB204", name: "แบตเตอรี่ 20V MAX XR 4.0Ah", brand: "DEWALT",
      category: "battery", icon: "battery",
      desc: "แบตเตอรี่ลิเธียมความจุ 4.0Ah มีไฟแสดงระดับพลังงาน ใช้ได้กับเครื่องมือ 20V MAX ทุกรุ่น",
      specs: [["แรงดัน", "20V MAX"], ["ความจุ", "4.0 Ah"], ["ชนิด", "Li-Ion"], ["มีไฟบอกระดับ", "ใช่"]],
      cost: 1800, price: 2890, rentPerDay: 0, forSale: true, forRent: false,
      stock: 25, rented: 0, location: "โซน C-1 · ตู้ล็อก",
    },
    {
      id: "dcb115", sku: "DW-DCB115", name: "แท่นชาร์จเร็ว 20V MAX", brand: "DEWALT",
      category: "battery", icon: "charger",
      desc: "แท่นชาร์จเร็ว ชาร์จเต็มภายใน 60 นาที พร้อมระบบป้องกันความร้อนเกิน",
      specs: [["รองรับ", "12V/20V MAX"], ["เวลาชาร์จ", "~60 นาที"], ["พัดลมระบายความร้อน", "มี"]],
      cost: 950, price: 1590, rentPerDay: 0, forSale: true, forRent: false,
      stock: 20, rented: 0, location: "โซน C-1 · ตู้ล็อก",
    },
    {
      id: "mak-hr2470", sku: "MK-HR2470", name: "สว่านโรตารี่ 780 วัตต์ (มีสาย)", brand: "MAKITA",
      category: "drill", icon: "rotary",
      desc: "สว่านโรตารี่ใช้ไฟบ้าน 3 ระบบ เจาะ/กระแทก/สกัด เหมาะร้านที่ต้องการกำลังสม่ำเสมอ",
      specs: [["กำลังไฟ", "780 วัตต์"], ["ระบบ", "SDS-Plus"], ["เจาะปูน", "24 มม."], ["3 โหมด", "เจาะ/ตอก/สกัด"]],
      cost: 3200, price: 4690, rentPerDay: 220, forSale: true, forRent: true,
      stock: 7, rented: 0, location: "โซน A-2 · ชั้น 1",
    },
    {
      id: "mak-dga504", sku: "MK-DGA504", name: "เครื่องเจียรไร้สาย 18V 100มม.", brand: "MAKITA",
      category: "grinder", icon: "grinder",
      desc: "เครื่องเจียรไร้สายมอเตอร์ Brushless ระบบเบรกไฟฟ้าหยุดใบเร็ว ปลอดภัยสูง",
      specs: [["แรงดัน", "18V LXT"], ["ใบ", "100 มม."], ["มอเตอร์", "Brushless"], ["เบรกไฟฟ้า", "มี"]],
      cost: 3600, price: 5290, rentPerDay: 240, forSale: true, forRent: true,
      stock: 8, rented: 1, location: "โซน B-1 · ชั้น 1",
    },
    {
      id: "bosch-gsb", sku: "BS-GSB18V", name: "สว่านกระแทกไร้สาย 18V (BOSCH Pro)", brand: "BOSCH",
      category: "drill", icon: "drill",
      desc: "สว่านกระแทกงานหนักสำหรับมืออาชีพ แรงบิดสูง ทนทาน รับประกันศูนย์",
      specs: [["แรงดัน", "18V"], ["แรงบิด", "85 Nm"], ["หัวจับ", "13 มม."], ["มอเตอร์", "Brushless"]],
      cost: 4000, price: 5990, rentPerDay: 230, forSale: true, forRent: true,
      stock: 6, rented: 0, location: "โซน A-1 · ชั้น 3",
    },
    {
      id: "osuka-drill", sku: "OS-ID13", name: "สว่านไฟฟ้า 13มม. 650 วัตต์ (งบประหยัด)", brand: "OSUKA",
      category: "drill", icon: "drill",
      desc: "สว่านไฟฟ้าราคาประหยัด คุ้มค่าสำหรับงานทั่วไปที่บ้าน ปรับรอบได้",
      specs: [["กำลังไฟ", "650 วัตต์"], ["หัวจับ", "13 มม."], ["ปรับรอบ", "มี"], ["รับประกัน", "6 เดือน"]],
      cost: 520, price: 890, rentPerDay: 80, forSale: true, forRent: true,
      stock: 30, rented: 0, location: "โซน D-2 · ชั้นล่าง",
    },
    {
      id: "stanley-tape", sku: "ST-TAPE5M", name: "ตลับเมตร 5 เมตร ตัวล็อกอัตโนมัติ", brand: "STANLEY",
      category: "hand", icon: "measure",
      desc: "ตลับเมตรเหล็กเคลือบ ทนต่อการขีดข่วน อ่านค่าง่าย มีตัวล็อกและคลิปหนีบ",
      specs: [["ความยาว", "5 เมตร"], ["หน้ากว้าง", "19 มม."], ["ตัวล็อก", "อัตโนมัติ"]],
      cost: 95, price: 195, rentPerDay: 0, forSale: true, forRent: false,
      stock: 60, rented: 0, location: "โซน D-1 · ชั้นวางหน้า",
    },
    {
      id: "stanley-wrench", sku: "ST-WR12", name: "ชุดประแจแหวนข้างปากตาย 12 ชิ้น", brand: "STANLEY",
      category: "hand", icon: "wrench",
      desc: "ชุดประแจเหล็กโครเมียมวานาเดียม 8-19 มม. แข็งแรง ทนสนิม พร้อมกล่องจัดเก็บ",
      specs: [["จำนวน", "12 ชิ้น"], ["ขนาด", "8-19 มม."], ["วัสดุ", "Cr-V"], ["กล่องเก็บ", "มี"]],
      cost: 640, price: 1090, rentPerDay: 0, forSale: true, forRent: false,
      stock: 22, rented: 0, location: "โซน D-1 · ชั้นวางหน้า",
    },
    {
      id: "ingco-laser", sku: "IG-LL15", name: "ระดับน้ำเลเซอร์ 2 เส้น (ตั้งระดับเอง)", brand: "INGCO",
      category: "measure", icon: "laser",
      desc: "เลเซอร์ปรับระดับอัตโนมัติ เส้นแนวตั้ง-แนวนอน เหมาะงานปูกระเบื้อง ติดตั้งงานภายใน",
      specs: [["เส้นเลเซอร์", "2 เส้น"], ["ระยะ", "15 เมตร"], ["ตั้งระดับเอง", "มี"], ["ขาตั้ง", "แถม"]],
      cost: 1100, price: 1890, rentPerDay: 180, forSale: true, forRent: true,
      stock: 10, rented: 2, location: "โซน C-2 · ตู้ล็อก",
    },
    {
      id: "ingco-compressor", sku: "IG-AC24", name: "ปั๊มลม 24 ลิตร 2 แรงม้า", brand: "INGCO",
      category: "power", icon: "compressor",
      desc: "ปั๊มลมถัง 24 ลิตร เหมาะงานพ่นสี เป่าลม เติมลมยาง ใช้ในร้านและงานก่อสร้างเล็ก",
      specs: [["ถัง", "24 ลิตร"], ["กำลัง", "2 HP"], ["แรงดัน", "8 บาร์"], ["มีล้อ", "มี"]],
      cost: 2900, price: 4290, rentPerDay: 300, forSale: true, forRent: true,
      stock: 4, rented: 1, location: "โซน E-1 · ลานหลังร้าน",
    },
    {
      id: "dewalt-toolbox", sku: "DW-TSTAK", name: "กล่องเครื่องมือล้อลาก TSTAK ต่อชั้นได้", brand: "DEWALT",
      category: "hand", icon: "box",
      desc: "กล่องเก็บเครื่องมือระบบต่อชั้น มีล้อลาก แข็งแรง กันน้ำ จัดระเบียบเครื่องมือได้ดี",
      specs: [["ระบบ", "ต่อชั้นได้"], ["ล้อลาก", "มี"], ["กันน้ำ", "IP54"], ["รับน้ำหนัก", "30 กก."]],
      cost: 1900, price: 2990, rentPerDay: 0, forSale: true, forRent: false,
      stock: 14, rented: 0, location: "โซน D-3 · ชั้นบน",
    },
  ];

  /* ---------- Editable site content (back office) ----------------- */
  var DEFAULT_SETTINGS = {
    heroOverline: "DEWALT BY M.E.TOOLS · ท่ารั้ว เชียงใหม่",
    heroTitle: "PRO TOOLS",
    heroPhrases: ["เช่าก็ได้ ซื้อก็ดี"],
    heroSub: "ศูนย์รวมเครื่องมือช่าง DEWALT ของแท้ + แบรนด์โปร เช่ารายวัน หรือ ซื้อขาด จองง่ายในไม่กี่คลิก รับเองที่ร้านหรือส่งถึงงาน",
    brandsTagline: "ครบเครื่อง|ทุกระดับ",
    company: "บริษัท เอ็ม.อี.ทูลส์ จำกัด",
    address: "แยกท่ารั้ว ต.ท่าวังตาล อ.สารภี จ.เชียงใหม่ 50140",
    phone: "053-XXX-XXXX",
    line: "@metools",
    facebook: "https://facebook.com/metools.tharua",
    instagram: "https://instagram.com/metools.cm",
    tiktok: "https://tiktok.com/@metools.cm",
    hoursWeek: "จันทร์ – เสาร์ 8:00 – 17:00 น.",
    hoursSun: "อาทิตย์ 8:00 – 15:00 น.",
    // structured hours for the live open/closed status (24h "HH:MM")
    hoursWeekOpen: "08:00", hoursWeekClose: "17:00",
    openSun: true, hoursSunOpen: "08:00", hoursSunClose: "15:00",
    specialDays: [], // [{date:"YYYY-MM-DD", open:false, note:"หยุดสงกรานต์"}]
    authLoginTitle: "เข้าสู่ระบบ", authLoginSub: "เข้าสู่ระบบเพื่อสั่งซื้อ/เช่า ติดตามคำสั่งซื้อ หรือเข้าสู่ระบบหลังร้าน (พนักงาน)",
    authRegTitle: "สมัครสมาชิก", authRegSub: "สมัครสมาชิกร้าน M.E.Tools เพื่อสั่งซื้อ/เช่าเครื่องมือและติดตามคำสั่งซื้อได้ง่ายขึ้น",
    deletePin: "1234",
    googleClientId: "", facebookAppId: "",
    firebaseConfig: "", // paste Firebase web config JSON to enable real online chat
    sheetWebAppUrl: "", // Google Apps Script web-app URL — ซิงค์สต๊อกสองทางกับ Google Sheet
    qrImage: "",
    bankInfo: "พร้อมเพย์ M.E.Tools",
    // ภาษีมูลค่าเพิ่ม (ร้านจดทะเบียน VAT) — คิด VAT กับการขายทุกช่องทาง
    // vatMode: "add" = ราคายังไม่รวม VAT แล้วบวกเพิ่ม · "include" = ราคารวม VAT แล้ว (แสดงแยกส่วน)
    vatEnabled: true, vatPct: 7, vatMode: "add",
    // ส่งฟรีเมื่อยอดสินค้าถึงเกณฑ์ (บาท) · 0 = ปิด
    freeShipOver: 0,
    // รับบัตรเครดิต/ผ่อน (ผ่านเกตเวย์) — โผล่เมื่อยอด ≥ cardThreshold · ต้องเชื่อมเกตเวย์ก่อนถึงใช้ได้จริง
    cardPayOn: false, cardThreshold: 45000,
    chatGreeting: "สวัสดีครับ M.E.Tools ยินดีให้บริการ พิมพ์คำถามได้เลยครับ 😊",
    chatFallback: "ขอบคุณสำหรับข้อความครับ เดี๋ยวทีมงานติดต่อกลับ หรือโทร 053-XXX-XXXX / LINE @metools",
    chatRules: [
      { keywords: "เวลา, เปิด, ปิด, กี่โมง", answer: "ร้านเปิด จันทร์–เสาร์ 8:00–17:00 น. และอาทิตย์ 8:00–15:00 น. ครับ" },
      { keywords: "ที่อยู่, แผนที่, ไปยังไง, สาขา, อยู่ไหน", answer: "ร้านอยู่แยกท่ารั้ว ต.ท่าวังตาล อ.สารภี จ.เชียงใหม่ 50140 ครับ" },
      { keywords: "เช่า, ค่าเช่า, มัดจำ", answer: "เช่าได้ตั้งแต่ 1 วัน มีมัดจำเท่าราคาสินค้า คืนเต็มจำนวนเมื่อนำมาคืนในสภาพปกติครับ" },
      { keywords: "ส่ง, จัดส่ง, ขนส่ง, ค่าส่ง", answer: "มีบริการจัดส่งทั่วประเทศครับ ค่าส่งคิดตามจังหวัดปลายทาง หรือรับเองที่ร้านฟรี" },
      { keywords: "ประกัน, รับประกัน, วารันตี", answer: "สินค้าของแท้มีใบรับประกันศูนย์ ส่วนใหญ่ 1 ปีครับ" },
      { keywords: "ชำระ, จ่าย, โอน, พร้อมเพย์, qr", answer: "ชำระผ่าน QR PromptPay ได้เลยครับ ระบบจะยืนยันให้เมื่อชำระเรียบร้อย" },
    ],
    brands: [
      { name: "DEWALT", tag: "พรีเมียม · ศูนย์แท้", primary: true },
      { name: "MAKITA", tag: "มืออาชีพ", primary: false },
      { name: "BOSCH", tag: "งานหนัก", primary: false },
      { name: "OSUKA", tag: "ราคาประหยัด", primary: false },
      { name: "STANLEY", tag: "อุปกรณ์มือ", primary: false },
      { name: "INGCO", tag: "ครบเครื่อง", primary: false },
    ],
    // tool categories (editable in admin → settings). icon = preset key, image = uploaded data URL (overrides icon)
    categories: [
      { key: "drill", label: "สว่าน / ไขควง", icon: "drill", image: "" },
      { key: "saw", label: "เลื่อย", icon: "saw", image: "" },
      { key: "grinder", label: "เครื่องเจียร", icon: "grinder", image: "" },
      { key: "battery", label: "แบต / ที่ชาร์จ", icon: "battery", image: "" },
      { key: "measure", label: "เครื่องมือวัด", icon: "measure", image: "" },
      { key: "hand", label: "เครื่องมือช่างมือ", icon: "wrench", image: "" },
      { key: "power", label: "เครื่องมือไฟฟ้าอื่นๆ", icon: "compressor", image: "" },
    ],
    // hero promo banner (below hero). enabled=false → hidden
    // startDate/endDate = "YYYY-MM-DD" (ว่าง = ไม่จำกัด). โชว์เฉพาะช่วงวันที่กำหนด เช่น โปร 6.6
    // autoBroadcast=true → ส่งโปรหาเพื่อนทุกคน (LINE) อัตโนมัติเมื่อถึงวันเริ่ม
    // links = [{label,url}] ลิงก์ร้านหลายช่อง (Shopee/Lazada/TikTok ฯลฯ) แสดงในข้อความ broadcast + แบนเนอร์
    // dateText = ช่วงวันที่โปร (เช่น "5 มิ.ย (2 ทุ่ม) – 8 มิ.ย 69"), conditions = หมายเหตุเงื่อนไข
    // anchorDate = วันที่โปรซ้ำ (วัน=เดือน เช่น 2026-06-06) · beforeDays/afterDays = เริ่มก่อน/จบหลังกี่วัน (เริ่ม 1/2)
    // recurring = ทำซ้ำเองทุกเดือน (1.1, 2.2, …, 12.12) · โปรเริ่ม 2 ทุ่มของวันเริ่ม · dateText ว่าง = สร้างช่วงวันอัตโนมัติ
    promo: { enabled: false, title: "", text: "", image: "", images: [], startDate: "", endDate: "", autoBroadcast: false,
             links: [], dateText: "", conditions: "", anchorDate: "", beforeDays: 1, afterDays: 2, recurring: false },
    // flash sale (below brands). endTime = epoch ms; items reference products
    flashSale: { enabled: false, title: "ลดพิเศษสุดคุ้ม", endTime: 0, items: [] },
    faq: [
      { q: "เช่าอุปกรณ์ช่างต้องวางมัดจำไหม?", a: "ต้องวางเงินมัดจำเท่าราคาสินค้า และคืนเต็มจำนวนเมื่อนำเครื่องมือมาส่งคืนในสภาพปกติครับ" },
      { q: "ซื้ออุปกรณ์ช่างมีรับประกันไหม?", a: "สินค้าของแท้ทุกชิ้นมีใบรับประกันศูนย์ (ส่วนใหญ่ 1 ปี) ส่งซ่อมศูนย์ได้โดยตรง" },
      { q: "มีบริการจัดส่งหรือไม่ ค่าส่งเท่าไหร่?", a: "มีครับ ค่าจัดส่งคิดตามจังหวัดปลายทาง ระบบจะคำนวณให้อัตโนมัติ หรือมารับเองที่ร้านท่ารั้วได้ฟรี" },
      { q: "ชำระเงินอย่างไร?", a: "สแกน QR PromptPay ชำระเต็มจำนวนก่อนรับสินค้า เมื่อชำระเรียบร้อยระบบจะยืนยันคำสั่งซื้อให้" },
      { q: "เช่าได้นานสุดกี่วัน ต่อเวลาได้ไหม?", a: "เช่าได้ตั้งแต่ 1 วันขึ้นไป หากต้องการต่อเวลาแจ้งทางร้านล่วงหน้าได้เลยครับ" },
      { q: "ถ้าเครื่องมือชำรุดระหว่างเช่าทำอย่างไร?", a: "แจ้งร้านทันที หากชำรุดจากการใช้งานปกติไม่มีค่าปรับ แต่หากเสียหายจากการใช้ผิดวิธีจะคิดตามจริง" },
    ],
  };

  // Staff accounts. The OWNER manages employees + permissions. Customers register themselves.
  // สิทธิ์การใช้งานหลังร้าน เจ้าของร้านตั้งให้พนักงานทีละคนได้
  //   group "access" = เข้าถึง/ใช้งานหน้านั้น ๆ
  //   group "danger" = การลบข้อมูลถาวร (ค่าเริ่มต้นปิด — เปิดเฉพาะคนที่ไว้ใจ)
  var PERM_DEFS = [
    { key: "dashboard", label: "แดชบอร์ด", group: "access" },
    { key: "inventory", label: "คลัง/สต็อก", group: "access" },
    { key: "orders", label: "คำสั่งซื้อ", group: "access" },
    { key: "erp", label: "ERP/บัญชี", group: "access" },
    { key: "settings", label: "ตั้งค่าเว็บไซต์", group: "access" },
    { key: "botinbox", label: "กล่องข้อความออนไลน์", group: "access" },
    { key: "warranty", label: "ลงทะเบียนประกัน", group: "access" },
    { key: "quotes", label: "ใบเสนอราคา", group: "access" },
    { key: "customers", label: "สรุปลูกค้า", group: "access" },
    { key: "inventory_delete", label: "ลบสินค้าออกจากคลัง", group: "danger" },
    { key: "orders_delete", label: "ลบคำสั่งซื้อ", group: "danger" },
  ];
  var PERM_KEYS = PERM_DEFS.map(function (d) { return d.key; });
  // หน้าที่เพิ่งเพิ่มทีหลัง — พนักงานเดิมที่ยังไม่มีคีย์นี้ในสิทธิ์ ให้ "เปิด" ไว้ก่อน
  // จนกว่าแอดมินจะกดปิดเอง (กันพนักงานหลุดสิทธิ์กะทันหันตอนอัปเดตระบบ)
  var SOFT_PERMS = { botinbox: 1, warranty: 1, quotes: 1, customers: 1 };
  var DEFAULT_STAFF = [
    { id: "owner", name: "เจ้าของร้าน", email: "owner@metools.co.th", password: "owner123", role: "owner",
      perms: { dashboard: true, inventory: true, orders: true, erp: true, settings: true } },
    { id: "emp1", name: "พนักงาน M.E.Tools", email: "staff@metools.co.th", password: "metools123", role: "employee",
      perms: { dashboard: true, inventory: true, orders: true, erp: false, settings: false } },
  ];

  /* ---------- Low-level storage helpers --------------------------- */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  // คีย์ที่ admin แก้แล้วควรซิงค์ขึ้น cloud — เห็นเหมือนกันทุกอุปกรณ์
  // ไม่รวม: products (มีรูป base64 ใหญ่ — ใช้ปุ่ม sync แยก), orders (ซิงค์ผ่าน Phase E),
  //          users (Firebase Auth Phase D), cart/session/seeded (per-device)
  var ADMIN_CLOUD_KEYS = [
    KEY.settings, KEY.staff, KEY.ship, KEY.ledger, KEY.suppliers, KEY.purchases
  ];
  function write(key, val, opts) {
    localStorage.setItem(key, JSON.stringify(val));
    if (!opts || !opts.skipCloud) {
      if (ADMIN_CLOUD_KEYS.indexOf(key) >= 0) cloudPushAdminData(key, val);
    }
  }

  /* ---------- Cloud sync: admin data ↔ Firestore admin_data/{key} ---- */
  // เขียน — fire-and-forget ทุกครั้งที่ admin save ข้อมูล
  // settings ตัด deletePin ออกก่อน push (ไม่ให้ลูกค้าเห็นได้เพราะ settings public read)
  function cloudPushAdminData(key, val) {
    var toSave = val;
    if (key === KEY.settings && val && typeof val === "object") {
      toSave = Object.assign({}, val);
      delete toSave.deletePin;
    }
    loadFirebaseAuthAndDb("admin").then(function (m) {
      var fs = m.fsMod;
      fs.setDoc(fs.doc(m.db, "admin_data", key), {
        value: toSave,
        updatedAt: fs.serverTimestamp(),
      }).catch(function (err) { console.warn("[cloud push]", key, err && err.message); });
    }).catch(function () {});
  }

  // โหลด settings + ship_rates จาก cloud (public read) — ใช้ในหน้าลูกค้า/หน้าร้าน
  // ไม่ต้องมี auth, ไม่ touch admin_data อันอื่น
  // ผสานกับค่า local — preserve deletePin ที่อาจมีอยู่ใน localStorage (ไม่ทับด้วย undefined)
  function cloudLoadPublicSettings() {
    var cfg = parseFbConfig(firebaseCfg());
    if (!cfg || !cfg.projectId) return Promise.resolve(false);
    var urls = [
      "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/default/documents/admin_data/" + KEY.settings,
      "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/default/documents/admin_data/" + KEY.ship,
    ];
    return Promise.all(urls.map(function (u) {
      return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    })).then(function (results) {
      results.forEach(function (doc, i) {
        if (!doc || !doc.fields) return;
        var key = i === 0 ? KEY.settings : KEY.ship;
        var valField = doc.fields.value;
        var val = valField ? unwrapFs(valField) : null;
        if (val !== null) {
          if (key === KEY.settings) {
            // merge เพื่อเก็บ deletePin ที่ local อาจมี
            var existing = read(KEY.settings, {});
            var merged = Object.assign({}, val);
            if (existing.deletePin) merged.deletePin = existing.deletePin;
            write(key, merged, { skipCloud: true });
          } else {
            write(key, val, { skipCloud: true });
          }
        }
      });
      dispatch();
      return true;
    });
  }

  // unwrap Firestore REST typed value (subset, สำหรับ object/array/primitive)
  function unwrapFs(v) {
    if (!v || typeof v !== "object") return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue" in v) return null;
    if ("mapValue" in v) {
      var out = {}, f = v.mapValue.fields || {};
      for (var k in f) out[k] = unwrapFs(f[k]);
      return out;
    }
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(unwrapFs);
    return null;
  }
  // โหลด — อ่าน Firestore แล้วเขียน localStorage (ใช้ตอนเปิดหน้า admin)
  // skipCloud=true เพื่อไม่ให้ write() วน push กลับขึ้น cloud อีกรอบ
  // returns Promise → callers re-render after data arrives
  function cloudLoadAdminData() {
    return loadFirebaseAuthAndDb("admin").then(function (m) {
      var fs = m.fsMod;
      var promises = ADMIN_CLOUD_KEYS.map(function (key) {
        return fs.getDoc(fs.doc(m.db, "admin_data", key)).then(function (snap) {
          if (snap && snap.exists && snap.exists()) {
            var data = snap.data();
            if (data && data.value !== undefined) {
              write(key, data.value, { skipCloud: true });
            }
          }
        }).catch(function (err) { console.warn("[cloud load]", key, err && err.message); });
      });
      return Promise.all(promises).then(function () {
        dispatch(); // re-render หน้าที่ฟัง onChange
        return true;
      });
    }).catch(function (err) {
      console.warn("[cloud load init]", err && err.message);
      return false;
    });
  }

  /* ---------- Realtime: admin data + product catalog (หลังร้าน) ------ */
  // ฟังการเปลี่ยนแปลงจาก cloud แบบเรียลไทม์ → อัปเดต local + dispatch ให้หน้า re-render
  //   admin_data/{key}: onSnapshot ทีละ doc (get เดี่ยวได้แม้ list ปิด) → settings/staff/ฯลฯ สด
  //   products/catalog: เปลี่ยน updatedAt ทุกครั้งที่บันทึกสินค้า → re-pull รายตัว (ได้รูปครบ)
  // เรียกครั้งเดียวตอนเปิดหน้าหลังร้าน; ปลอดภัยถ้าเรียกซ้ำ (กันด้วย flag)
  var _adminRtStarted = false;
  function startAdminRealtime() {
    if (_adminRtStarted) return;
    _adminRtStarted = true;
    loadFirebaseAuthAndDb("admin").then(function (m) {
      var fs = m.fsMod;
      ADMIN_CLOUD_KEYS.forEach(function (key) {
        fs.onSnapshot(fs.doc(m.db, "admin_data", key), function (snap) {
          if (!snap || !snap.exists || !snap.exists()) return;
          var data = snap.data();
          if (!data || data.value === undefined) return;
          if (key === KEY.settings && data.value && typeof data.value === "object") {
            var existing = read(KEY.settings, {});
            var merged = Object.assign({}, data.value);
            if (existing.deletePin) merged.deletePin = existing.deletePin; // เก็บ PIN local ไว้
            write(key, merged, { skipCloud: true });
          } else {
            write(key, data.value, { skipCloud: true });
          }
          dispatch();
        }, function (err) { console.warn("[rt admin]", key, err && err.message); });
      });
      // products/catalog เปลี่ยน → ดึงสินค้าใหม่ทั้งหมด (ข้าม snapshot แรกเพราะ init โหลดอยู่แล้ว)
      var firstCat = true;
      fs.onSnapshot(fs.doc(m.db, "products", "catalog"), function () {
        if (firstCat) { firstCat = false; return; }
        cloudLoadProducts();
      }, function (err) { console.warn("[rt catalog]", err && err.message); });
    }).catch(function () {});
  }

  /* ---------- Cloud sync: PRODUCT CATALOG ↔ Firestore -------------- */
  // โครงสร้าง:
  //   products/{id}  — 1 doc ต่อสินค้า 1 ตัว (รวมรูป base64) → หน้าร้านลูกค้าอ่าน
  //   products/catalog — เอกสารรวม (ตัดรูปออก) → บอท LINE อ่าน (api/line-webhook.js)
  // เขียน: เฉพาะเครื่องเจ้าของ (auto-sync ตอน save + ปุ่ม "ซิงค์สินค้า")
  // อ่าน:  หน้าร้านลูกค้าใช้ REST (public read ตาม firestore.rules) ไม่ต้อง auth

  // ให้แน่ใจว่ามี anonymous auth ก่อนเขียน (rule products ต้องการ request.auth != null)
  function ensureCloudAuth(m) {
    if (m.auth && m.auth.currentUser) return Promise.resolve(m);
    return m.authMod.signInAnonymously(m.auth).then(function () { return m; }).catch(function () { return m; });
  }
  // ---- ตัวกันชนลิมิต Firebase ----
  // ถ้าเจอ 429 (โควต้าหมด) หรือ 403 (สิทธิ์ไม่พอ) → "พัก" การเขียนขึ้น cloud ชั่วคราว
  // กันยิงซ้ำ ๆ จนโควต้าหมดเร็วขึ้น/สแปม error — งานในเครื่อง (localStorage) ยังทำงานปกติ
  var _cloudPausedUntil = 0;
  function cloudWritesPaused() { return Date.now() < _cloudPausedUntil; }
  function noteCloudError(e) {
    var s = String((e && (e.code || e.status)) || (e && e.message) || e || "").toLowerCase();
    if (/resource-exhausted|quota|429|permission-denied|insufficient|403/.test(s)) {
      _cloudPausedUntil = Date.now() + 10 * 60000; // พัก 10 นาที แล้วค่อยลองใหม่เอง
      console.warn("[cloud] writes paused 10m —", s);
    }
  }
  // specs ภายในเก็บเป็น [["ป้าย","ค่า"], ...] (array ซ้อน array) ซึ่ง Firestore "เขียนไม่ได้"
  // จึงต้องแปลงเป็น [{label,value}, ...] ก่อนทุกครั้งที่เขียนขึ้น cloud (per-product doc + อันรวม)
  function specToObj(s) {
    if (Array.isArray(s)) return { label: String(s[0] || ""), value: String(s[1] || "") };
    if (s && typeof s === "object") return { label: String(s.label || s.k || ""), value: String(s.value || s.v || "") };
    return { label: "", value: String(s || "") };
  }
  // เตรียม doc สินค้า 1 ตัว — ตัด undefined + แปลง specs ให้ Firestore รับได้ + กันขนาดเกินลิมิต (~1MB)
  function cleanProductDoc(p) {
    var clean = JSON.parse(JSON.stringify(p)); // ตัด undefined/ฟังก์ชัน
    if (Array.isArray(clean.specs)) clean.specs = clean.specs.map(specToObj); // กัน nested array ที่ทำให้ setDoc ล้มเงียบ ๆ
    function size() { try { return JSON.stringify(clean).length; } catch (e) { return 0; } }
    // เฟรมหมุน 360° มักใหญ่สุด — ถ้าเกินลิมิต ลดจำนวนลงครึ่งหนึ่งไปเรื่อย ๆ (ยังหมุนได้ด้วยเฟรมน้อยลง)
    while (size() > 950000 && Array.isArray(clean.frames360) && clean.frames360.length > 8) {
      clean.frames360 = clean.frames360.filter(function (_, i) { return i % 2 === 0; });
    }
    if (size() > 950000 && clean.images && clean.images.length > 1) clean.images = [clean.images[0]];
    if (size() > 950000) { clean.images = []; clean.image = ""; } // รูปใหญ่เกิน — เก็บแค่ข้อความ
    clean.available = available(p);
    // เก็บ updatedAt เดิมของสินค้าให้ตรงกับเอกสารรวม (catalog) — ใช้เทียบว่า "เปลี่ยนไหม" ตอนดึงเฉพาะตัวที่เปลี่ยน
    clean.updatedAt = p.updatedAt || new Date().toISOString();
    return clean;
  }
  // เอกสารรวมสำหรับบอท LINE (ตัดรูป/มีเดียออก ให้เล็ก)
  function buildCatalogItems() {
    var items = getLocalProducts().filter(function (p) { return !p.hidden; }).map(function (p) {
      var clean = {}, skip = { images: 1, image: 1, frames360: 1, parts: 1, partsBase: 1, model3d: 1 };
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && !skip[k]) clean[k] = p[k];
      clean.available = available(p);
      if (Array.isArray(clean.specs)) clean.specs = clean.specs.map(specToObj);
      return clean;
    });
    return JSON.parse(JSON.stringify(items));
  }
  // push สินค้า 1 ตัวขึ้น cloud (fire-and-forget)
  function cloudPushProduct(p) {
    if (!p || !p.id || cloudWritesPaused()) return;
    loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.setDoc(fs.doc(m.db, "products", String(p.id)), cleanProductDoc(p));
    }).catch(function (err) { noteCloudError(err); console.warn("[cloud product push]", p.id, err && err.message); });
  }
  function cloudDeleteProductDoc(id) {
    if (!id || cloudWritesPaused()) return;
    loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.deleteDoc(fs.doc(m.db, "products", String(id)));
    }).catch(function (err) { noteCloudError(err); console.warn("[cloud product del]", id, err && err.message); });
  }

  /* ---------- Phase F: ย้ายรูปสินค้าขึ้น Firebase Storage (ลด Firestore reads) ----
     เดิมเก็บรูปเป็น base64 ในเอกสาร → ลูกค้าใหม่โหลดหนัก/กิน read มาก
     ย้ายขึ้น Storage เก็บแค่ลิงก์ → หน้าร้านโหลดเบา รูปมาจาก CDN (ไม่กิน read quota) */
  var FB_SDK_BASE = "https://www.gstatic.com/firebasejs/10.12.2/";
  function loadStorageMod() { return import(FB_SDK_BASE + "firebase-storage.js"); }
  function isDataUrl(s) { return typeof s === "string" && s.indexOf("data:") === 0; }
  function storagePath(id, idx) { return "products/" + String(id).replace(/[^a-zA-Z0-9_-]/g, "_") + "/" + idx + "_" + Date.now() + ".jpg"; }
  function uploadDataUrl(sm, storage, path, dataUrl) {
    var ref = sm.ref(storage, path);
    return sm.uploadString(ref, dataUrl, "data_url").then(function () { return sm.getDownloadURL(ref); });
  }
  // ย้ายรูป base64 ของสินค้าทุกตัวขึ้น Storage → แทนด้วยลิงก์ → เซฟ local + ดันขึ้น cloud
  // ถ้าอัปรูปไหนไม่สำเร็จ จะคงรูปเดิม (base64) ไว้ ไม่ทำให้รูปหาย
  // progressCb(done, total) · คืน Promise<{ products, images }>
  function migrateImagesToStorage(progressCb) {
    return Promise.all([loadFirebaseAuthAndDb("admin").then(ensureCloudAuth), loadStorageMod()]).then(function (arr) {
      var m = arr[0], sm = arr[1], storage = sm.getStorage(m.app);
      // ใช้รายการที่รวม local+cloud แล้ว (กันกรณีสินค้าอยู่ใน cloud cache ไม่ใช่ me_products)
      var all = getProducts();
      // กันพลาด: ถ้าโหลดสินค้าไม่ได้/ว่าง → "ห้าม" ซิงค์ (ไม่งั้นจะเขียน catalog ว่างทับ = สินค้าหายหมด)
      if (!all.length) { throw new Error("ยังโหลดสินค้าไม่ได้ (อาจ Firebase เกินลิมิต) — ยกเลิกการย้ายรูปเพื่อกันข้อมูลหาย"); }
      var i = 0, nProd = 0, nImg = 0;
      function next() {
        if (i >= all.length) {
          write(KEY.products, all, { skipCloud: true });          // เซฟ local (images เป็นลิงก์แล้ว)
          return cloudSyncAllProducts().then(function () { return { products: nProd, images: nImg }; });
        }
        var p = all[i++];
        if (progressCb) { try { progressCb(i, all.length); } catch (e) {} }
        var imgs = (p.images && p.images.length) ? p.images.slice() : (p.image ? [p.image] : []);
        var idxs = []; imgs.forEach(function (im, k) { if (isDataUrl(im)) idxs.push(k); });
        if (!idxs.length) return next();
        var j = 0;
        function up() {
          if (j >= idxs.length) { p.images = imgs; p.image = imgs[0] || ""; nProd++; return next(); }
          var k = idxs[j++];
          return uploadDataUrl(sm, storage, storagePath(p.id, k), imgs[k])
            .then(function (url) { imgs[k] = url; nImg++; return up(); },
                  function (e) { console.warn("[migrate img]", p.id, e && e.message); return up(); });
        }
        return up();
      }
      return next();
    });
  }

  // rebuild เอกสารรวมสำหรับบอท — debounce กันยิงถี่ตอน import หลายตัว
  var _catalogTimer = null;
  function scheduleCatalogSync() {
    if (_catalogTimer) clearTimeout(_catalogTimer);
    _catalogTimer = setTimeout(function () { _catalogTimer = null; cloudSyncCatalogAggregate(); }, 1500);
  }
  function cloudSyncCatalogAggregate() {
    loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod, items = buildCatalogItems();
      return fs.setDoc(fs.doc(m.db, "products", "catalog"), { items: items, count: items.length, updatedAt: fs.serverTimestamp() });
    }).catch(function (err) { console.warn("[cloud catalog]", err && err.message); });
  }
  // ซิงค์ทั้งหมด (ปุ่มในหน้าคลังสินค้า) — เขียนทุก doc สินค้า + เอกสารรวมสำหรับบอท
  // progressCb(done, total) เผื่ออัปเดตสถานะปุ่ม. คืน Promise<count>
  function cloudSyncAllProducts(progressCb) {
    var all = getLocalProducts();
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod, i = 0;
      function next() {
        if (i >= all.length) return Promise.resolve();
        var p = all[i++];
        if (progressCb) { try { progressCb(i, all.length); } catch (e) {} }
        return fs.setDoc(fs.doc(m.db, "products", String(p.id)), cleanProductDoc(p)).then(next, next);
      }
      return next().then(function () {
        var items = buildCatalogItems();
        return fs.setDoc(fs.doc(m.db, "products", "catalog"), { items: items, count: items.length, updatedAt: fs.serverTimestamp() });
      }).then(function () { return all.length; });
    });
  }
  // ซิงค์อัตโนมัติแบบ "เฉพาะที่ยังไม่ขึ้น/ใหม่กว่า cloud" (incremental) — ไม่อัปซ้ำทั้งหมด
  // เรียกเองตอนเปิดหลังร้าน + วนทุก 30 วิ → ดันตัวที่ค้างขึ้นเองจนครบ (ไม่ต้องกดปุ่ม)
  var _autoSyncing = false;
  // หลัง push สินค้าขึ้น cloud สำเร็จ → อัปเดต cache cloudProducts ในเครื่องให้ตรง
  // เพื่อให้รอบถัดไปของ autoCatchUpSync เห็นว่า "ซิงค์แล้ว" จะได้ไม่ดันซ้ำทุก 30 วิ (เปลือง quota เขียน)
  function markSynced(list) {
    if (!list || !list.length) return;
    var cloud = read(KEY.cloudProducts, []) || [];
    var byId = {}; cloud.forEach(function (c) { if (c && c.id) byId[c.id] = c; });
    list.forEach(function (p) { if (p && p.id) byId[p.id] = p; }); // เก็บข้อมูลเต็ม (ตรงกับที่ cloudLoadProducts เก็บ) กันรายการขาดฟิลด์
    var merged = Object.keys(byId).map(function (k) { return byId[k]; });
    try { localStorage.setItem(KEY.cloudProducts, JSON.stringify(merged)); } catch (e) {}
  }
  function autoCatchUpSync(progressCb) {
    if (!hasPerm("inventory")) return Promise.resolve(0);
    if (_autoSyncing || cloudWritesPaused()) return Promise.resolve(0); // กันรันซ้อน + พักถ้าชนลิมิต
    var cloud = read(KEY.cloudProducts, []) || [];
    var cloudById = {}; cloud.forEach(function (c) { if (c && c.id) cloudById[c.id] = c; });
    var pending = getLocalProducts().filter(function (p) {
      if (!p || !p.id) return false;
      var c = cloudById[p.id];
      if (!c) return true;                                  // ยังไม่มีบน cloud → ต้องดันขึ้น
      var tl = Date.parse(p.updatedAt) || 0, tc = Date.parse(c.updatedAt) || 0;
      return tl > tc;                                       // local ใหม่กว่า → อัปเดต
    });
    if (!pending.length) return Promise.resolve(0);
    _autoSyncing = true;
    var pushed = [];
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod, i = 0;
      function next() {
        if (i >= pending.length) return Promise.resolve();
        var p = pending[i++];
        if (progressCb) { try { progressCb(i, pending.length); } catch (e) {} }
        return fs.setDoc(fs.doc(m.db, "products", String(p.id)), cleanProductDoc(p))
          .then(function () { pushed.push(p); }, function () {}).then(next);
      }
      return next().then(function () {
        var items = buildCatalogItems();
        return fs.setDoc(fs.doc(m.db, "products", "catalog"), { items: items, count: items.length, updatedAt: fs.serverTimestamp() });
      }).then(function () { _autoSyncing = false; markSynced(pushed); return pending.length; });
    }).catch(function (e) { _autoSyncing = false; markSynced(pushed); noteCloudError(e); console.warn("[autosync]", e && e.message); return 0; });
  }
  // โหลดแคตตาล็อกจาก cloud → เก็บใน key แยก (ไม่ทับ me_products ของเจ้าของ)
  // ใช้ REST (public read) — ลูกค้าไม่ต้อง auth. ข้าม doc "catalog" (อันนั้นของบอท)
  // โหลดสินค้าจาก cloud แบบ "ประหยัด quota":
  //   1) อ่านเอกสารรวม products/catalog เพียง 1 ครั้ง (1 read) → ได้ version (updatedAt) + รายการ id+updatedAt
  //   2) ถ้า version เท่าเดิม + มี cache อยู่แล้ว → ใช้ cache เลย ไม่ต้องอ่าน doc สินค้าซ้ำ (0 read เพิ่ม)
  //   3) ถ้า version เปลี่ยน → ดึง "เฉพาะตัวที่ใหม่/เปลี่ยน" ทีละ doc (ได้รูปครบ) ตัวที่เดิมใช้ cache
  // เดิมทีระบบ list สินค้าทุก doc ทุกครั้ง (≈ จำนวนสินค้า reads ต่อการเปิด 1 หน้า) → quota หมดเร็วมาก
  // force=true เพื่อบังคับดึงใหม่ทั้งหมด (เช่น ปุ่มกู้คืน)
  function cloudLoadProducts(force) {
    var cfg = parseFbConfig(firebaseCfg());
    if (!cfg || !cfg.projectId) return Promise.resolve(false);
    var base = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/default/documents/products";

    function finish(out, ver) {
      try { localStorage.setItem(KEY.cloudProducts, JSON.stringify(out)); } catch (e) {}
      try { if (ver) localStorage.setItem(KEY.catalogVer, ver); } catch (e) {}
      dispatch();
      try { global.dispatchEvent(new CustomEvent("me-products-loaded")); } catch (e) {}
      return out.length;
    }
    function useCache() {
      dispatch();
      try { global.dispatchEvent(new CustomEvent("me-products-loaded")); } catch (e) {}
      return (read(KEY.cloudProducts, []) || []).length;
    }

    // สำรองสุดท้าย: ถ้าไม่มีเอกสารรวมเลย → list สินค้าทุก doc (วิธีเดิม) ให้ยังทำงานได้
    function fullList() {
      var out = [];
      function page(token) {
        var url = base + "?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : "");
        return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
          if (!data) return;
          (data.documents || []).forEach(function (doc) {
            var id = (doc.name || "").split("/").pop();
            if (id === "catalog" || /_reviews$/.test(id) || /^chatimg-/.test(id)) return;
            var obj = {}, f = doc.fields || {};
            for (var k in f) obj[k] = unwrapFs(f[k]);
            if (!obj.id) obj.id = id;
            out.push(obj);
          });
          if (data.nextPageToken) return page(data.nextPageToken);
        });
      }
      return page(null).then(function () { return finish(out, ""); });
    }

    return fetch(base + "/catalog").then(function (r) { return r.ok ? r.json() : null; }).then(function (catDoc) {
      if (!catDoc || !catDoc.fields) return fullList(); // ไม่มีเอกสารรวม → วิธีเดิม
      var ver = unwrapFs(catDoc.fields.updatedAt) || "";
      var items = unwrapFs(catDoc.fields.items) || [];
      var cached = read(KEY.cloudProducts, null) || [];
      var prevVer = ""; try { prevVer = localStorage.getItem(KEY.catalogVer) || ""; } catch (e) {}

      // version เท่าเดิม + เคยโหลดแล้ว → ไม่ต้องอ่านอะไรเพิ่ม
      if (!force && ver && prevVer && ver === prevVer && cached.length) return useCache();
      if (!items.length) {
        // เอกสารรวมว่าง (ยังไม่ซิงค์) → ลอง list ทุก doc เผื่อมี per-product doc อยู่
        return fullList();
      }

      // version เปลี่ยน → ดึงเฉพาะตัวที่ใหม่/เปลี่ยน ทีละ doc (ได้รูป) ที่เหลือใช้ cache เดิม
      var cachedById = {}; cached.forEach(function (c) { if (c && c.id) cachedById[c.id] = c; });
      var out = new Array(items.length);
      return Promise.all(items.map(function (it, idx) {
        if (!it || !it.id) return Promise.resolve();
        var c = cachedById[it.id];
        var tNew = Date.parse(it.updatedAt) || 0, tOld = c ? (Date.parse(c.updatedAt) || 0) : 0;
        if (!force && c && tOld >= tNew) { out[idx] = c; return Promise.resolve(); } // ไม่เปลี่ยน → ใช้ cache (0 read)
        return fetch(base + "/" + encodeURIComponent(it.id)).then(function (r) {
          return r.ok ? r.json() : null;
        }).then(function (pdoc) {
          if (pdoc && pdoc.fields) {
            var full = {}; for (var k in pdoc.fields) full[k] = unwrapFs(pdoc.fields[k]);
            if (!full.id) full.id = it.id;
            out[idx] = full;     // มีรูปครบจาก per-product doc
          } else {
            out[idx] = c || it;  // ยังไม่มี doc → ใช้ cache เดิม หรือข้อมูลรวม (ไม่มีรูป)
          }
        }).catch(function () { out[idx] = c || it; });
      })).then(function () {
        var list = out.filter(function (r) { return r && r.id; });
        return finish(list, ver);
      });
    }).catch(function (err) { noteCloudError(err); console.warn("[cloud products load]", err && err.message); return false; });
  }
  // กู้คืน: ดึงสินค้าทั้งหมดจาก cloud (per-product docs) รวมเข้าคลังในเครื่องนี้ โดย "ไม่ลบ" ของเดิม
  // ใช้กรณีสินค้าหาย/ย้ายเครื่อง/ล็อกอินใหม่ — เขียนลง local อย่างเดียว (ไม่ดันกลับ cloud)
  function restoreProductsFromCloud() {
    return cloudLoadProducts(true).then(function () {
      var cloud = read(KEY.cloudProducts, null) || [];
      var local = read(KEY.products, []);
      var byId = {};
      local.forEach(function (p) { if (p && p.id) byId[p.id] = p; });
      cloud.forEach(function (c) {
        if (!c || !c.id) return;
        var ex = byId[c.id];
        if (!ex) { byId[c.id] = c; return; }
        var tl = Date.parse(ex.updatedAt) || 0, tc = Date.parse(c.updatedAt) || 0;
        if (tc > tl) byId[c.id] = c;
      });
      var list = Object.keys(byId).map(function (k) { return byId[k]; });
      write(KEY.products, list, { skipCloud: true });
      write(KEY.deletedProducts, [], { skipCloud: true }); // ล้าง tombstone ที่อาจบล็อกการแสดง
      dispatch();
      try { global.dispatchEvent(new CustomEvent("me-products-loaded")); } catch (e) {}
      return list.length;
    });
  }

  // add warranty / motor / shipping-size defaults to a seed product
  function enrichSeed(p) {
    var noMotor = p.icon === "battery" || p.icon === "charger" || p.category === "hand" || p.category === "measure";
    p.motorType = noMotor ? "—" : (/brushless|ไร้แปรงถ่าน/i.test(p.desc || "") ? "ไร้แปรงถ่าน (Brushless)" : "มีแปรงถ่าน (Brushed)");
    p.warrantyYears = (p.category === "hand" || p.category === "measure") ? 0 : 1;
    var ship = { drill: "32 × 9 × 24 ซม. · ~2.0 กก.", driver: "25 × 8 × 20 ซม. · ~1.4 กก.", saw: "35 × 25 × 25 ซม. · ~3.5 กก.", grinder: "38 × 12 × 14 ซม. · ~2.4 กก.", rotary: "40 × 12 × 30 ซม. · ~3.0 กก.", battery: "12 × 8 × 8 ซม. · ~0.7 กก.", charger: "18 × 12 × 10 ซม. · ~0.6 กก.", measure: "20 × 8 × 6 ซม. · ~0.4 กก.", wrench: "30 × 18 × 6 ซม. · ~1.5 กก.", laser: "18 × 14 × 10 ซม. · ~0.9 กก.", compressor: "60 × 30 × 60 ซม. · ~18 กก.", box: "55 × 35 × 30 ซม. · ~6 กก." };
    p.shipSize = ship[p.icon] || "30 × 20 × 15 ซม. · ~2 กก.";
    p.images = p.images || [];
    return p;
  }

  function seed() {
    // Fresh install → start as a newly-opened shop: NO sample products, NO sample
    // orders. The dashboard begins empty and fills up as real sales come in.
    if (!localStorage.getItem(KEY.seeded) || !localStorage.getItem(KEY.products)) {
      write(KEY.products, []);
      write(KEY.orders, []);
      localStorage.setItem(KEY.seeded, "1");
    }
    clearDemoData();   // strip leftover sample data from earlier (demo-seeded) installs
    seedShip();
    seedSettings();
    seedStaff();
  }

  // One-time migration: older versions seeded demo products + demo orders. Remove
  // exactly those (matched by their fixed seed IDs) so the shop reads as freshly
  // opened — WITHOUT touching the owner's own imported/created products.
  var DEMO_CLEARED_KEY = "me_demo_cleared_v1";
  function clearDemoData() {
    if (localStorage.getItem(DEMO_CLEARED_KEY)) return;
    try {
      var demoOrderIds = {};
      demoOrders().forEach(function (o) { demoOrderIds[o.id] = 1; });
      var orders = read(KEY.orders, []);
      var keptOrders = orders.filter(function (o) { return !demoOrderIds[o.id]; });
      if (keptOrders.length !== orders.length) write(KEY.orders, keptOrders);

      var seedIds = {};
      SEED_PRODUCTS.forEach(function (p) { seedIds[p.id] = 1; });
      var prods = read(KEY.products, []);
      var keptProds = prods.filter(function (p) { return !seedIds[p.id]; });
      if (keptProds.length !== prods.length) write(KEY.products, keptProds);
    } catch (e) { /* never block startup on cleanup */ }
    localStorage.setItem(DEMO_CLEARED_KEY, "1");
  }

  // a couple of demo orders so the dashboard isn't empty on first run
  function demoOrders() {
    var now = Date.now();
    var day = 86400000;
    return [
      {
        id: "ORD-1001", createdAt: now - day * 5, type: "buy",
        customer: { name: "ช่างสมชาย ก่อสร้าง", phone: "081-234-5678" },
        fulfillment: "delivery",
        address: { province: "เชียงใหม่", district: "สันกำแพง", subdistrict: "สันกำแพง", zip: "50130", detail: "99/1 หมู่ 3", text: "99/1 หมู่ 3 ต.สันกำแพง อ.สันกำแพง จ.เชียงใหม่ 50130" },
        items: [
          { productId: "dcd805", name: "สว่านกระแทกไร้สาย 20V MAX XR", qty: 1, unitPrice: 6490, unitCost: 4200 },
          { productId: "dcb204", name: "แบตเตอรี่ 20V MAX XR 4.0Ah", qty: 2, unitPrice: 2890, unitCost: 1800 },
        ],
        days: 0, subtotal: 12270, deposit: 0, shipping: 40, total: 12310, revenue: 12270, cost: 7800,
        paid: true, received: true, status: "received",
      },
      {
        id: "ORD-1002", createdAt: now - day * 2, type: "rent",
        customer: { name: "ร้านรับเหมา ป.รุ่งเรือง", phone: "089-888-1122" },
        fulfillment: "pickup", address: null,
        items: [
          { productId: "dch263", name: "สว่านโรตารี่ไร้สาย SDS-Plus 20V", qty: 1, unitPrice: 450, unitCost: 0, days: 3 },
        ],
        days: 3, rentStart: dateStr(now - day * 2), rentEnd: dateStr(now + day),
        subtotal: 1350, deposit: 9990, shipping: 0, total: 11340, revenue: 1350, cost: 0,
        paid: true, received: false, status: "paid",
      },
      {
        id: "ORD-1003", createdAt: now - day, type: "buy",
        customer: { name: "คุณวิภา (เจ้าของบ้าน)", phone: "062-555-7788" },
        fulfillment: "pickup", address: null,
        items: [
          { productId: "stanley-wrench", name: "ชุดประแจแหวนข้างปากตาย 12 ชิ้น", qty: 1, unitPrice: 1090, unitCost: 640 },
          { productId: "stanley-tape", name: "ตลับเมตร 5 เมตร ตัวล็อกอัตโนมัติ", qty: 1, unitPrice: 195, unitCost: 95 },
        ],
        days: 0, subtotal: 1285, deposit: 0, shipping: 0, total: 1285, revenue: 1285, cost: 735,
        paid: true, received: false, status: "paid",
      },
    ];
  }

  /* ---------- Utilities ------------------------------------------- */
  function money(n) {
    n = Math.round(Number(n) || 0);
    return "฿" + n.toLocaleString("th-TH");
  }
  function dateStr(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDate(ms) {
    var d = new Date(ms);
    var months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return d.getDate() + " " + months[d.getMonth()] + " " + (d.getFullYear() + 543).toString().slice(2) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function genId(prefix) {
    return prefix + "-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 90 + 10);
  }

  var CATEGORIES = [
    { key: "drill", label: "สว่าน / ไขควง" },
    { key: "saw", label: "เลื่อย" },
    { key: "grinder", label: "เครื่องเจียร" },
    { key: "battery", label: "แบต / ที่ชาร์จ" },
    { key: "measure", label: "เครื่องมือวัด" },
    { key: "hand", label: "เครื่องมือช่างมือ" },
    { key: "power", label: "เครื่องมือไฟฟ้าอื่นๆ" },
  ];
  function defaultCatIcon(key) {
    return { drill: "drill", saw: "saw", grinder: "grinder", battery: "battery", measure: "measure", hand: "wrench", power: "compressor" }[key] || "tool";
  }
  // editable categories from settings; falls back to hardcoded defaults
  // parent = key ของหมวดแม่ ("" = หมวดบนสุด) → รองรับหมวดซ้อนหลายชั้น
  function getCategories() {
    var st = getSettings();
    if (st && st.categories && st.categories.length) {
      return st.categories.map(function (c) {
        return { key: c.key, label: c.label, icon: c.icon || defaultCatIcon(c.key), image: c.image || "", hidden: !!c.hidden, parent: c.parent || "" };
      });
    }
    return CATEGORIES.map(function (c) { return { key: c.key, label: c.label, icon: defaultCatIcon(c.key), image: "", hidden: false, parent: "" }; });
  }
  function getCategory(key) { var cats = getCategories(); for (var i = 0; i < cats.length; i++) if (cats[i].key === key) return cats[i]; return null; }
  // ลูกหมวดตรงของ parentKey ("" = หมวดบนสุด). includeHidden=true เพื่อใช้ในหลังร้าน
  function getSubcategories(parentKey, includeHidden) {
    parentKey = parentKey || "";
    return getCategories().filter(function (c) { return (c.parent || "") === parentKey && (includeHidden || !c.hidden); });
  }
  function categoryHasChildren(key) { return getCategories().some(function (c) { return (c.parent || "") === key && !c.hidden; }); }
  // เซ็ตของ key = ตัวมันเอง + ลูกหลานทุกชั้น (ไว้กรองสินค้าในซับทรี)
  function catDescendants(key) {
    var all = getCategories(), out = {}, queue = [key]; out[key] = 1;
    var guard = 0;
    while (queue.length && guard++ < 999) {
      var k = queue.shift();
      all.forEach(function (c) { if ((c.parent || "") === k && !out[c.key]) { out[c.key] = 1; queue.push(c.key); } });
    }
    return out;
  }
  // เส้นทาง breadcrumb [หมวดบนสุด, ..., หมวดปัจจุบัน]
  function categoryPath(key) {
    var path = [], guard = 0, c = getCategory(key);
    while (c && guard++ < 30) { path.unshift(c); c = c.parent ? getCategory(c.parent) : null; }
    return path;
  }
  // นับสินค้าในหมวด (รวมหมวดย่อยทุกชั้น)
  function productCountInCat(key) {
    var set = catDescendants(key);
    return getProducts().filter(function (p) { return !p.hidden && set[p.category]; }).length;
  }
  function categoryLabel(key) {
    var cats = getCategories();
    for (var i = 0; i < cats.length; i++) if (cats[i].key === key) return cats[i].label;
    return key;
  }
  function typeLabel(type) { return type === "rent" ? "เช่าสินค้า" : "ซื้อสินค้า"; }
  function statusLabel(s) {
    return { paid: "ชำระแล้ว", waiting: "รอรับสินค้า", pickup: "รับสินค้าหน้าร้าน",
      received: "ได้รับสินค้าแล้ว", returned: "คืนแล้ว", cancelled: "ยกเลิก" }[s] || s;
  }
  function fulfillmentLabel(f) { return f === "delivery" ? "บริการจัดส่ง" : "รับสินค้าหน้าร้าน"; }

  /* ---------- Products -------------------------------------------- */
  // เจ้าของร้าน (owner) = แหล่งข้อมูลจริง ใช้ me_products ใน localStorage เสมอ
  // ลูกค้า/คนทั่วไป = อ่านแคตตาล็อกที่ดึงมาจาก cloud (me_cloud_products) ถ้ามี
  //   ถ้ายังไม่มา (เปิดครั้งแรก/ออฟไลน์) ใช้ local เป็น fallback แล้ว re-render เมื่อ cloud มา
  // เหตุผล: ห้ามให้ cloud มาทับ me_products ของเจ้าของ (อาจมีของที่ยังไม่ได้ซิงค์)
  // ส่งข้อมูลไป Google Sheet (ผ่าน Apps Script Web App) — ฝั่งเว็บ → ชีต
  // ใช้ text/plain เพื่อเลี่ยง CORS preflight (Apps Script รับใน e.postData.contents)
  function _sheetPost(payload) {
    try {
      var url = (getSettings().sheetWebAppUrl || "").trim();
      if (!url) return;
      fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }).catch(function () {});
    } catch (e) {}
  }
  function pushProductToSheet(p) {
    if (!p) return;
    _sheetPost({ action: "upsert", product: {
      id: p.id || "", sku: p.sku || "", name: p.name || "", brand: p.brand || "", category: p.category || "",
      motorType: p.motorType || "", batteryPlatform: p.batteryPlatform || "", warrantyYears: (p.warrantyYears || 0),
      cost: (p.cost || 0), price: (p.price || 0), rentPerDay: (p.rentPerDay || 0), stock: (p.stock || 0), location: p.location || "",
    } });
  }
  function pushSheetDelete(id) { if (id) _sheetPost({ action: "delete", id: String(id) }); }
  function getProducts() {
    var local = read(KEY.products, []);
    var tomb = read(KEY.deletedProducts, []) || [];
    var cloud = read(KEY.cloudProducts, null) || [];
    if (!isOwner()) {
      if (cloud.length) return cloud.filter(function (p) { return p && p.id && tomb.indexOf(p.id) < 0; });
      return local;
    }
    // เจ้าของ: รวมสินค้าจากเครื่องนี้ (local) + เครื่องอื่น (cloud) → ตัวที่ updatedAt ใหม่กว่าชนะ
    // ทำให้เพิ่ม/แก้สต๊อกจากคอมร้านขึ้นบนมือถือ (และทุกอุปกรณ์ของเจ้าของ) แบบเรียลไทม์
    if (!cloud.length) return local.filter(function (p) { return tomb.indexOf(p.id) < 0; });
    var byId = {};
    local.forEach(function (p) { if (p && p.id) byId[p.id] = p; });
    cloud.forEach(function (c) {
      if (!c || !c.id) return;
      var ex = byId[c.id];
      if (!ex) { byId[c.id] = c; return; }
      var tl = Date.parse(ex.updatedAt) || 0, tc = Date.parse(c.updatedAt) || 0;
      if (tc > tl) byId[c.id] = c; // cloud ใหม่กว่า → ใช้ของ cloud (เครื่องอื่นแก้ล่าสุด)
    });
    return Object.keys(byId).filter(function (k) { return tomb.indexOf(k) < 0; }).map(function (k) { return byId[k]; });
  }
  // เฉพาะข้อมูลในเครื่องเจ้าของ (ไม่สน cloud) — ใช้ตอนซิงค์ขึ้น cloud
  function getLocalProducts() { return read(KEY.products, []); }
  function getProduct(id) {
    return getProducts().filter(function (p) { return p.id === id; })[0] || null;
  }
  function available(p) { return Math.max(0, (p.stock || 0) - (p.rented || 0)); }

  /* ---------- Ratings (ดาวรีวิวสินค้า) ----------------------------- */
  // เก็บคะแนนรวมไว้ที่ doc สินค้าเอง (ratingSum, ratingCount) → เฉลี่ย = sum/count
  // กันโหวตซ้ำต่อเบราว์เซอร์ด้วย me_ratings (ให้ดาวใหม่ = ปรับคะแนนเดิม ไม่เพิ่ม count)
  function getMyRating(productId) { return (read(KEY.ratings, {}) || {})[productId] || 0; }
  function productRating(p) { var c = (p && p.ratingCount) || 0; return { avg: c ? ((p.ratingSum || 0) / c) : 0, count: c }; }
  function rateProduct(productId, stars) {
    stars = Math.max(1, Math.min(5, Math.round(stars || 0)));
    if (!productId) return 0;
    var mine = read(KEY.ratings, {}) || {};
    var prev = mine[productId] || 0;
    if (prev === stars) return stars;
    mine[productId] = stars; write(KEY.ratings, mine, { skipCloud: true });
    var deltaSum = stars - prev, deltaCount = prev ? 0 : 1;
    applyRatingLocal(productId, deltaSum, deltaCount);  // อัปเดตสำเนาในเครื่องให้เห็นทันที
    cloudRateProduct(productId, deltaSum, deltaCount);   // เพิ่มแบบ atomic บน cloud
    dispatch();
    return stars;
  }
  function applyRatingLocal(productId, deltaSum, deltaCount) {
    [KEY.products, KEY.cloudProducts].forEach(function (key) {
      var list = read(key, null); if (!list || !list.length) return;
      var changed = false;
      list.forEach(function (p) { if (p.id === productId) { p.ratingSum = (p.ratingSum || 0) + deltaSum; p.ratingCount = (p.ratingCount || 0) + deltaCount; changed = true; } });
      if (changed) write(key, list, { skipCloud: true });
    });
  }
  function cloudRateProduct(productId, deltaSum, deltaCount) {
    if (cloudWritesPaused()) return;
    loadFirebaseAuthAndDb().then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.setDoc(fs.doc(m.db, "products", String(productId)), {
        ratingSum: fs.increment(deltaSum), ratingCount: fs.increment(deltaCount),
      }, { merge: true });
    }).catch(function (err) { noteCloudError(err); console.warn("[rate]", productId, err && err.message); });
  }
  // นับยอดดูสินค้าจริง (เก็บ products/{id}.views) — เขียนด้วย anonymous auth เหมือนเรตติ้ง
  function cloudBumpView(productId) {
    if (cloudWritesPaused()) return;
    loadFirebaseAuthAndDb().then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.setDoc(fs.doc(m.db, "products", String(productId)), { views: fs.increment(1) }, { merge: true });
    }).catch(function (err) { noteCloudError(err); console.warn("[view]", productId, err && err.message); });
  }
  // เรียนรู้ "ซื้อคู่กัน" จากออเดอร์จริง → products/{aId}.coBought[bId] += 1 (ไม่เก็บว่าใครซื้อ)
  function cloudBumpAffinity(aId, bId) {
    if (!aId || !bId || aId === bId || cloudWritesPaused()) return;
    loadFirebaseAuthAndDb().then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      var inner = {}; inner[String(bId)] = fs.increment(1);
      return fs.setDoc(fs.doc(m.db, "products", String(aId)), { coBought: inner }, { merge: true });
    }).catch(function (err) { noteCloudError(err); console.warn("[affinity]", err && err.message); });
  }

  /* ---------- Reviews (ดาว + ความเห็น + รูป) ----------------------- */
  // เก็บที่ doc products/{id}_reviews (กฎเดิมรองรับ: read public, write ต้อง auth)
  // ใช้ arrayUnion ต่อท้ายแบบ atomic → รีวิวพร้อมกันไม่หาย
  function loadReviews(productId) {
    var cfg = parseFbConfig(firebaseCfg());
    if (!cfg || !cfg.projectId || !productId) return Promise.resolve([]);
    var url = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId +
      "/databases/default/documents/products/" + encodeURIComponent(productId + "_reviews");
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (doc) {
      if (!doc || !doc.fields) return [];
      var items = unwrapFs(doc.fields.items) || [];
      // เก็บรีวิวล่าสุดต่อ 1 ผู้ใช้ (uid) แล้วเรียงใหม่→เก่า
      var byUid = {};
      items.forEach(function (rv) { if (!rv) return; var k = rv.uid || ("x" + Math.random()); if (!byUid[k] || (rv.at || 0) > (byUid[k].at || 0)) byUid[k] = rv; });
      return Object.keys(byUid).map(function (k) { return byUid[k]; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    }).catch(function () { return []; });
  }
  // ส่งรีวิว: อัปเดตคะแนนเฉลี่ย (rateProduct) + ต่อท้ายรีวิวใน _reviews doc
  function submitReview(productId, data) {
    data = data || {};
    var stars = Math.max(1, Math.min(5, Math.round(data.stars || 0)));
    if (!productId || !stars) return Promise.reject(new Error("กรุณาเลือกดาว"));
    rateProduct(productId, stars); // ค่าเฉลี่ย (กันนับซ้ำด้วย me_ratings)
    return loadFirebaseAuthAndDb().then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      var uid = (m.auth && m.auth.currentUser && m.auth.currentUser.uid) || ("anon" + Date.now());
      var review = {
        uid: uid, name: String(data.name || "ลูกค้า").slice(0, 40), stars: stars,
        comment: String(data.comment || "").slice(0, 1000),
        images: (data.images || []).slice(0, 3), at: Date.now(),
      };
      return fs.setDoc(fs.doc(m.db, "products", String(productId) + "_reviews"),
        { productId: String(productId), items: fs.arrayUnion(review), updatedAt: new Date().toISOString() },
        { merge: true });
    });
  }

  // สิทธิ์ลด/ลบสต๊อก: เจ้าของ หรือพนักงานที่ได้สิทธิ์ "ลบ" เท่านั้น (พนักงานทั่วไป = เพิ่มได้อย่างเดียว)
  function canReduceInventory() { return isOwner() || hasPerm("inventory_delete"); }
  function saveProduct(p) {
    // พนักงานเพิ่มได้อย่างเดียว — ห้าม "ลด" สต๊อกของสินค้าที่มีอยู่ (return null = ถูกบล็อก)
    if (p && p.id && typeof p.stock === "number" && !canReduceInventory()) {
      var exP = getLocalProducts().filter(function (x) { return x.id === p.id; })[0]
        || (read(KEY.cloudProducts, []) || []).filter(function (x) { return x.id === p.id; })[0];
      if (exP && p.stock < (exP.stock || 0)) return null;
    }
    var list = getLocalProducts();
    var saved = p;
    if (!p.id) {
      p.id = genId("p").toLowerCase();
      list.push(p);
      saved = p;
    } else {
      var found = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === p.id) { list[i] = Object.assign(list[i], p); saved = list[i]; found = true; break; }
      }
      if (!found) { list.push(p); saved = p; }
    }
    saved.updatedAt = new Date().toISOString(); // เครื่องนี้แก้ล่าสุด → ใช้เทียบกับ cloud (merge ชนะ)
    write(KEY.products, list);
    // auto-sync ขึ้น cloud — ใครก็ตามที่มีสิทธิ์ "คลัง/สต็อก" (เจ้าของ + พนักงานที่ได้รับสิทธิ์)
    // ลูกค้า/คนไม่มีสิทธิ์ไม่เข้าเงื่อนไขนี้ จึงไม่เขียนทับแคตตาล็อกบน cloud
    if (hasPerm("inventory")) { cloudPushProduct(saved); scheduleCatalogSync(); }
    return saved;
  }
  function deleteProduct(id) {
    // กันลบโดยไม่มีสิทธิ์ — ป้องกันเชิงลึกเผื่อปุ่มบน UI หลุด (เจ้าของผ่านเสมอ)
    if (!hasPerm("inventory_delete")) return false;
    write(KEY.products, getLocalProducts().filter(function (p) { return p.id !== id; }));
    // tombstone: กัน merge cloud ดูดสินค้าที่เพิ่งลบกลับมา (ระหว่างรอ cloud ลบเสร็จ)
    var tomb = read(KEY.deletedProducts, []) || []; if (tomb.indexOf(id) < 0) { tomb.push(id); write(KEY.deletedProducts, tomb, { skipCloud: true }); }
    if (hasPerm("inventory")) { cloudDeleteProductDoc(id); scheduleCatalogSync(); }
    return true;
  }
  // adjust physical stock by delta (+ receive, - shrink/sell off the books)
  // หักออก (delta < 0) = เฉพาะเจ้าของ/ผู้มีสิทธิ์ลบ · พนักงานทั่วไปเพิ่มได้อย่างเดียว
  function adjustStock(id, delta) {
    if (delta < 0 && !canReduceInventory()) return false;
    var p = getProduct(id);
    if (!p) return false;
    p.stock = Math.max(0, (p.stock || 0) + delta);
    return !!saveProduct(p);
  }

  /* ---------- Cart ------------------------------------------------ */
  // item: { productId, qty, mode: 'buy'|'rent', days }
  function getCart() { return read(KEY.cart, []); }
  function setCart(c) { write(KEY.cart, c); dispatch(); }
  function addToCart(productId, qty, mode, days) {
    qty = Math.max(1, qty || 1);
    mode = mode === "rent" ? "rent" : "buy";
    days = mode === "rent" ? Math.max(1, days || 1) : 0;
    var cart = getCart();
    var hit = cart.filter(function (i) { return i.productId === productId && i.mode === mode; })[0];
    if (hit) { hit.qty += qty; if (mode === "rent") hit.days = days; }
    else cart.push({ productId: productId, qty: qty, mode: mode, days: days });
    setCart(cart);
  }
  function updateCartItem(index, patch) {
    var cart = getCart();
    if (cart[index]) { cart[index] = Object.assign(cart[index], patch); setCart(cart); }
  }
  function removeCartItem(index) {
    var cart = getCart();
    cart.splice(index, 1);
    setCart(cart);
  }
  function clearCart() { setCart([]); }
  function cartCount() {
    return getCart().reduce(function (s, i) { return s + i.qty; }, 0);
  }
  function cartLines() {
    return getCart().map(function (i, idx) {
      var p = getProduct(i.productId) || {};
      var unit = i.mode === "rent" ? (p.rentPerDay || 0) : (p.price || 0);
      var lineTotal = i.mode === "rent" ? unit * i.qty * (i.days || 1) : unit * i.qty;
      return {
        index: idx, product: p, qty: i.qty, mode: i.mode, days: i.days || 1,
        unit: unit, lineTotal: lineTotal,
        deposit: i.mode === "rent" ? (p.price || 0) * i.qty : 0,
      };
    });
  }
  function cartTotals() {
    var lines = cartLines();
    var subtotal = lines.reduce(function (s, l) { return s + l.lineTotal; }, 0);
    var deposit = lines.reduce(function (s, l) { return s + l.deposit; }, 0);
    return { subtotal: subtotal, deposit: deposit, total: subtotal + deposit, lines: lines };
  }
  // คำนวณ VAT จากฐานราคา (เช่น ยอดสินค้า/ค่าเช่า) ตามตั้งค่าร้าน
  //   add     → gross = base + VAT (ราคายังไม่รวม VAT)
  //   include → vat แยกจาก base (ราคารวม VAT แล้ว, gross = base)
  function vatInfo(base) {
    base = +base || 0;
    var s = getSettings(), pct = +s.vatPct || 0;
    if (!s.vatEnabled || pct <= 0) return { enabled: false, pct: 0, vat: 0, net: base, gross: base, mode: "" };
    if (s.vatMode === "include") { var v = base * pct / (100 + pct); return { enabled: true, pct: pct, mode: "include", vat: v, net: base - v, gross: base }; }
    var va = base * pct / 100;
    return { enabled: true, pct: pct, mode: "add", vat: va, net: base, gross: base + va };
  }
  // หมวดนี้คิด VAT ไหม (ค่าเริ่ม = คิด) — เจ้าของเลือกได้รายหมวดในตั้งค่า
  function categoryHasVat(key) {
    var cats = getSettings().categories || [];
    for (var i = 0; i < cats.length; i++) if (cats[i].key === key) return cats[i].vat !== false;
    return true;
  }
  // คำนวณ VAT จากรายการในตะกร้า โดยคิดเฉพาะหมวดที่ตั้งให้มี VAT
  //   net = ราคาสินค้าก่อน VAT · vat = ภาษี · gross = รวมที่ลูกค้าจ่าย (ส่วนสินค้า)
  function lineVat(lines) {
    lines = lines || [];
    var s = getSettings(), pct = +s.vatPct || 0;
    var subtotal = lines.reduce(function (a, l) { return a + (l.lineTotal || 0); }, 0);
    if (!s.vatEnabled || pct <= 0) return { enabled: false, pct: 0, mode: "", vat: 0, net: subtotal, gross: subtotal, subtotal: subtotal };
    var vatable = lines.reduce(function (a, l) { return a + (categoryHasVat(l.product && l.product.category) ? (l.lineTotal || 0) : 0); }, 0);
    if (s.vatMode === "include") { var v = vatable * pct / (100 + pct); return { enabled: true, pct: pct, mode: "include", vat: v, net: subtotal - v, gross: subtotal, subtotal: subtotal }; }
    var va = vatable * pct / 100;
    return { enabled: true, pct: pct, mode: "add", vat: va, net: subtotal, gross: subtotal + va, subtotal: subtotal };
  }

  /* ---------- Orders ---------------------------------------------- */
  function getOrders() {
    return read(KEY.orders, []).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }
  // checkout = { name, phone, fulfillment:'pickup'|'delivery', address:{...}|null, shipping:number }
  // Orders are created ONLY after payment, so they enter the back office as "paid".
  function placeOrder(checkout) {
    var lines = cartLines();
    if (!lines.length) return null;
    var sess = session();
    var userEmail = (sess && sess.email) || checkout.email || "";
    var customer = { name: checkout.name, phone: checkout.phone, email: userEmail };
    var fulfillment = checkout.fulfillment === "delivery" ? "delivery" : "pickup";
    var shipping = fulfillment === "delivery" ? (checkout.shipping || 0) : 0;

    var byMode = { buy: [], rent: [] };
    lines.forEach(function (l) { byMode[l.mode].push(l); });

    var orders = read(KEY.orders, []);
    var created = [];
    var shippingApplied = false;

    ["buy", "rent"].forEach(function (mode) {
      var ls = byMode[mode];
      if (!ls.length) return;
      var items = ls.map(function (l) {
        return {
          productId: l.product.id, name: l.product.name, qty: l.qty,
          unitPrice: l.unit, unitCost: mode === "buy" ? (l.product.cost || 0) : 0,
          days: mode === "rent" ? l.days : 0,
        };
      });
      var subtotal = ls.reduce(function (s, l) { return s + l.lineTotal; }, 0);
      var deposit = ls.reduce(function (s, l) { return s + l.deposit; }, 0);
      var cost = items.reduce(function (s, it) { return s + it.unitCost * it.qty; }, 0);
      var days = mode === "rent" ? (ls[0].days || 1) : 0;
      var thisShip = shippingApplied ? 0 : shipping;
      shippingApplied = true;
      var vinfo = lineVat(ls); // VAT คิดต่อรายการ (เฉพาะหมวดที่ตั้งให้มี VAT)
      var order = {
        id: genId("ORD"), createdAt: Date.now(), type: mode,
        customer: customer, userEmail: userEmail, fulfillment: fulfillment,
        address: fulfillment === "delivery" ? checkout.address : null,
        taxInvoice: checkout.taxInvoice || null,
        items: items, days: days,
        subtotal: subtotal, deposit: deposit, shipping: thisShip,
        vat: vinfo.enabled ? Math.round(vinfo.vat * 100) / 100 : 0, vatPct: vinfo.pct, vatMode: vinfo.mode,
        total: vinfo.gross + deposit + thisShip,
        revenue: vinfo.net, cost: cost,
        paid: true, received: false, status: "paid",
        // การชำระเงิน: payStatus = verified (ตรวจสลิปผ่าน) | pending (รอแอดมินตรวจสลิป)
        payMethod: checkout.payMethod || "promptpay",
        payStatus: checkout.payStatus || "verified",
        slip: checkout.slip || "", slipRef: checkout.slipRef || "", payAmount: checkout.payAmount || 0,
        // stockApplied=true เฉพาะตอนผู้สั่งมีสิทธิ์คลัง (ตัดสต๊อก cloud แล้วผ่าน saveProduct)
        // ลูกค้าหน้าร้านไม่มีสิทธิ์ → false → ฝั่งหลังร้านจะตัดสต๊อกให้ตอนรับออเดอร์เข้า
        stockApplied: hasPerm("inventory"),
      };
      if (mode === "rent") {
        order.rentStart = dateStr(Date.now());
        order.rentEnd = dateStr(Date.now() + days * 86400000);
      }
      items.forEach(function (it) {
        var p = getProduct(it.productId);
        if (!p) return;
        if (mode === "buy") p.stock = Math.max(0, (p.stock || 0) - it.qty);
        else p.rented = (p.rented || 0) + it.qty;
        saveProduct(p);
      });
      orders.push(order);
      created.push(order);
    });

    write(KEY.orders, orders);
    clearCart();
    // เรียนรู้ "ซื้อคู่กัน": ทุกคู่สินค้าในตะกร้านี้ → เพิ่มคะแนนความสัมพันธ์ทั้งสองทาง
    try {
      var pids = lines.map(function (l) { return l.product.id; });
      for (var a = 0; a < pids.length; a++) for (var b = 0; b < pids.length; b++) if (a !== b) cloudBumpAffinity(pids[a], pids[b]);
    } catch (e) {}
    // Phase E: sync ขึ้น Firestore — fire-and-forget เพื่อไม่บล็อก UI
    // ซิงค์ "ทุก" ออเดอร์ (รวมลูกค้าที่ไม่ได้ล็อกอิน — ใช้ anonymous auth) เพื่อให้
    // เจ้าของเห็นออเดอร์ครบทุกเครื่อง ไม่ใช่แค่เครื่องที่กดสั่ง
    syncOrdersToCloud(created, sess || {});
    return created;
  }

  // เขียน orders/{id} ใน Firestore — owner admin/orders.html จะ subscribe แล้วเห็นแบบเรียลไทม์
  // ถ้าลูกค้าไม่ได้ล็อกอิน Firebase จะ sign-in anonymous ให้ก่อน (rule create ต้องการ userId == auth.uid)
  function syncOrdersToCloud(orders, sess) {
    if (!orders || !orders.length) return;
    loadFirebaseAuthAndDb().then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      var uid = (m.auth && m.auth.currentUser && m.auth.currentUser.uid) || (sess && sess.uid);
      if (!uid) return; // ไม่มี auth จริง ๆ (เช่น Firebase ใช้ไม่ได้) — เก็บแค่ local
      // ติด userId กลับไปที่ออเดอร์ใน local ด้วย เพื่อให้ setOrderStatus ซิงค์การเปลี่ยนสถานะได้ภายหลัง
      var local = read(KEY.orders, []), changed = false;
      orders.forEach(function (o) {
        o.userId = uid;
        for (var i = 0; i < local.length; i++) if (local[i].id === o.id && !local[i].userId) { local[i].userId = uid; changed = true; }
        var payload = Object.assign({}, o, {
          userId: uid,
          userEmail: (sess && sess.email) || o.userEmail || "",
          createdAtTs: fs.serverTimestamp(),
          updatedAtTs: fs.serverTimestamp(),
        });
        fs.setDoc(fs.doc(m.db, "orders", o.id), payload)
          .catch(function (err) { console.error("[order sync]", o.id, err && err.message); });
      });
      if (changed) write(KEY.orders, local, { skipCloud: true });
    }).catch(function (err) { console.warn("[order sync init]", err && err.message); });
  }

  function setOrderStatus(orderId, status, extra) {
    extra = extra || {};
    var orders = read(KEY.orders, []);
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].id !== orderId) continue;
      var o = orders[i];
      var prev = o.status;
      if (extra.reason) o.cancelReason = extra.reason;
      if (status === "cancelled") o.refunded = true;
      // returning a rental puts units back as available
      if (o.type === "rent" && status === "returned" && prev !== "returned") {
        o.items.forEach(function (it) {
          var p = getProduct(it.productId);
          if (p) { p.rented = Math.max(0, (p.rented || 0) - it.qty); saveProduct(p); }
        });
      }
      // cancelling restocks (and frees rented units)
      if (status === "cancelled" && prev !== "cancelled" && prev !== "returned") {
        o.items.forEach(function (it) {
          var p = getProduct(it.productId);
          if (!p) return;
          if (o.type === "buy") p.stock = (p.stock || 0) + it.qty;
          else p.rented = Math.max(0, (p.rented || 0) - it.qty);
          saveProduct(p);
        });
      }
      o.received = status === "received" || status === "returned";
      o.status = status;
      // sync ขึ้น cloud — admin คนอื่นเห็นเปลี่ยนทันที + ลูกค้าใน orders.html เห็นด้วย
      syncOrderStatusToCloud(o);
      break;
    }
    write(KEY.orders, orders);
  }

  // แอดมินยืนยันรับเงิน (กรณีสลิปรอตรวจเอง) → payStatus = verified + ซิงค์ cloud
  function confirmOrderPayment(orderId) {
    var orders = read(KEY.orders, []);
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].id !== orderId) continue;
      orders[i].payStatus = "verified";
      var o = orders[i];
      if (o.userId) {
        loadFirebaseAuthAndDb(isStaff() ? "admin" : undefined).then(ensureCloudAuth).then(function (m) {
          return m.fsMod.setDoc(m.fsMod.doc(m.db, "orders", o.id), { payStatus: "verified", updatedAtTs: m.fsMod.serverTimestamp() }, { merge: true });
        }).catch(function (err) { console.warn("[confirm pay]", err && err.message); });
      }
      break;
    }
    write(KEY.orders, orders);
    dispatch();
  }

  function syncOrderStatusToCloud(o) {
    if (!o || !o.userId) return; // order ที่ไม่มี userId = local-only (ก่อน Phase E)
    // เจ้าของ/พนักงานอัปเดตในฐานะ admin (แอป "admin" ที่ลงทะเบียนไว้) — rule update ผ่านด้วย isAdmin()
    // ลูกค้ายกเลิกออเดอร์ของตัวเอง อัปเดตในฐานะเจ้าของ userId (แอป "customer")
    var appName = isStaff() ? "admin" : undefined;
    loadFirebaseAuthAndDb(appName).then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      fs.setDoc(fs.doc(m.db, "orders", o.id), {
        status: o.status,
        received: !!o.received,
        refunded: !!o.refunded,
        cancelReason: o.cancelReason || "",
        staffMessage: o.staffMessage || "",
        staffMessageAt: o.staffMessageAt || null,
        updatedAtTs: fs.serverTimestamp(),
      }, { merge: true })
        .catch(function (err) { console.error("[order status sync]", o.id, err && err.message); });
    }).catch(function () {});
  }
  // owner/staff message to the customer about an order (e.g. delivery ETA)
  function saveOrderMessage(orderId, msg) {
    var orders = read(KEY.orders, []);
    for (var i = 0; i < orders.length; i++) if (orders[i].id === orderId) { orders[i].staffMessage = msg; orders[i].staffMessageAt = Date.now(); break; }
    write(KEY.orders, orders); dispatch();
  }
  // ลงทะเบียนเครื่องหลังร้านเครื่องนี้เป็น admin (เขียน admins/{uid}) เพื่อให้ "อ่านออเดอร์ทั้งหมด"
  // จาก Firestore ได้ (rule list ต้องการ isAdmin()). ใช้แอป "admin" → uid คงที่ข้ามหน้าหลังร้าน
  // idempotent: เช็คก่อน ถ้ามีแล้วไม่เขียนซ้ำ. คืน Promise<uid|null>
  var _adminRegPromise = null;
  function ensureAdminRegistered() {
    if (!isStaff()) return Promise.resolve(null); // เฉพาะเครื่องที่ล็อกอินหลังร้าน
    if (_adminRegPromise) return _adminRegPromise;
    _adminRegPromise = loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod, uid = m.auth && m.auth.currentUser && m.auth.currentUser.uid;
      if (!uid) return null;
      var ref = fs.doc(m.db, "admins", uid);
      return fs.getDoc(ref).then(function (snap) {
        if (snap && snap.exists && snap.exists()) return uid;
        return fs.setDoc(ref, { addedAt: fs.serverTimestamp(), via: "back-office-auto" }).then(function () { return uid; });
      });
    }).catch(function (err) { _adminRegPromise = null; console.warn("[admin register]", err && err.message); return null; });
    return _adminRegPromise;
  }
  // คืน Firebase ID token ของแอดมิน (ไว้แนบเรียก API หลังร้าน เช่น broadcast-promo)
  function adminIdToken() {
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var u = m.auth && m.auth.currentUser;
      return u ? u.getIdToken() : "";
    }).catch(function () { return ""; });
  }
  // รวมออเดอร์จาก cloud ลง local me_orders (cloud ชนะถ้า id ตรงกัน) เพื่อให้ทุกหน้าหลังร้าน
  // (แดชบอร์ด/ERP/คำสั่งซื้อ) เห็นออเดอร์ครบเหมือนกัน ผ่าน getOrders() ปกติ
  function absorbCloudOrders(cloudList) {
    if (!cloudList || !cloudList.length) return;
    var tomb = read(KEY.deletedOrders, []);
    var local = read(KEY.orders, []), byId = {}, order = [];
    local.forEach(function (o) { byId[o.id] = o; order.push(o.id); });
    var changed = false;
    cloudList.forEach(function (c) {
      if (!c || !c.id) return;
      if (tomb.indexOf(c.id) >= 0) return; // เคยลบไปแล้ว — อย่าดูดกลับ
      var cur = byId[c.id];
      var merged = Object.assign({}, cur, c);
      if (cur && !c.staffMessage && cur.staffMessage) merged.staffMessage = cur.staffMessage; // กันข้อความ admin ใน local หาย
      if (JSON.stringify(cur) !== JSON.stringify(merged)) { byId[c.id] = merged; changed = true; if (!cur) order.push(c.id); }
    });
    if (changed) {
      write(KEY.orders, order.map(function (id) { return byId[id]; }), { skipCloud: true });
      dispatch();
    }
    // ตัดสต๊อกอัตโนมัติเมื่อรับออเดอร์ใหม่จาก cloud (ลูกค้าสั่งออนไลน์ → สต๊อกหลังร้านลดเอง)
    // ทำเฉพาะเครื่องหลังร้าน (มีสิทธิ์คลัง) และตัดครั้งเดียวต่อออเดอร์
    if (isStaff() && hasPerm("inventory")) {
      var appliedSet = read(KEY.stockApplied, []);
      cloudList.forEach(function (c) {
        if (!c || !c.id) return;
        if (tomb.indexOf(c.id) >= 0) return;
        if (c.stockApplied) return;                  // ผู้สั่งตัดสต๊อก cloud ไปแล้ว
        if (appliedSet.indexOf(c.id) >= 0) return;   // เครื่องนี้ตัดไปแล้ว
        if (c.status === "cancelled") return;        // ออเดอร์ยกเลิก ไม่ตัด
        applyOrderStock(c);                          // ลดสต๊อก/เพิ่มยอดเช่า + ดันขึ้น cloud
        appliedSet.push(c.id);
        write(KEY.stockApplied, appliedSet, { skipCloud: true });
        cloudMarkStockApplied(c.id);                 // ติดธงบน cloud กันเครื่องหลังร้านอื่นตัดซ้ำ
      });
    }
  }
  // ลดสต๊อก (ซื้อ) / เพิ่มยอดเช่า (เช่า) ตามรายการในออเดอร์ — saveProduct ดันขึ้น cloud ให้เอง
  function applyOrderStock(o) {
    if (!o || !o.items) return;
    o.items.forEach(function (it) {
      var p = getProduct(it.productId); if (!p) return;
      if (o.type === "rent") p.rented = (p.rented || 0) + it.qty;
      else p.stock = Math.max(0, (p.stock || 0) - it.qty);
      saveProduct(p);
    });
  }
  // setDoc merge เฉพาะ field stockApplied (ไม่แตะ timestamp อื่น) ในฐานะ admin
  function cloudMarkStockApplied(id) {
    loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      return m.fsMod.setDoc(m.fsMod.doc(m.db, "orders", String(id)), { stockApplied: true }, { merge: true });
    }).catch(function (err) { console.warn("[stock flag]", id, err && err.message); });
  }
  function deleteOrder(id) {
    if (!hasPerm("orders_delete")) return false;
    // tombstone: จำ id ที่ลบไว้ เพื่อไม่ให้ snapshot จาก cloud ดูดกลับเข้ามาระหว่างรอ cloud ลบเสร็จ
    var tomb = read(KEY.deletedOrders, []);
    if (tomb.indexOf(id) < 0) { tomb.push(id); write(KEY.deletedOrders, tomb, { skipCloud: true }); }
    write(KEY.orders, read(KEY.orders, []).filter(function (o) { return o.id !== id; }));
    cloudDeleteOrder(id); // ลบ doc บน Firestore (rule: admin เท่านั้น) → เครื่องอื่นจะหายตามเมื่อ refresh
    dispatch();
    return true;
  }
  // ลบ orders/{id} บน Firestore ในฐานะ admin (แอป "admin" ที่ลงทะเบียนไว้)
  function cloudDeleteOrder(id) {
    if (!id) return;
    loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      return m.fsMod.deleteDoc(m.fsMod.doc(m.db, "orders", String(id)));
    }).catch(function (err) { console.warn("[order delete]", id, err && err.message); });
  }
  function deletePurchase(id) { write(KEY.purchases, read(KEY.purchases, []).filter(function (p) { return p.id !== id; })); dispatch(); }
  function checkPin(pin) { return String(pin) === String(getSettings().deletePin || "1234"); }

  /* ---------- Warranty registration (ลงทะเบียนประกันสินค้า) -------- */
  // ลูกค้า/พนักงานกรอกฟอร์มหน้าร้าน → เก็บใน Firestore warranties/{id} (ต้องมี anon auth)
  // หลังร้านอ่านได้ทั้งหมด (rule: read if isAdmin) + ค้น/กรองตามผู้ลงทะเบียน
  // เลขอ้างอิงสุ่มยาว (เดาไม่ได้) — ใช้เป็น capability token ให้ลูกค้าเปิดดูสถานะของตัวเองได้
  function warrantyToken() {
    var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    try {
      var a = new Uint8Array(16); (global.crypto || window.crypto).getRandomValues(a);
      for (var i = 0; i < a.length; i++) s += c[a[i] % c.length];
    } catch (e) { for (var j = 0; j < 16; j++) s += c[Math.floor(Math.random() * c.length)]; }
    return "WR-" + s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8, 12) + "-" + s.slice(12, 16);
  }
  function submitWarranty(data) {
    return loadFirebaseAuthAndDb().then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      var uid = (m.auth && m.auth.currentUser && m.auth.currentUser.uid) || "";
      var id = warrantyToken();
      var payload = Object.assign({}, data, {
        id: id, userId: uid, status: "pending",
        registrant: data.registrant === "staff" ? "staff" : "customer",
        createdAtTs: fs.serverTimestamp(),
      });
      return fs.setDoc(fs.doc(m.db, "warranties", id), payload).then(function () {
        // จำเลขอ้างอิงไว้ในเครื่องนี้ → หน้าตรวจสอบโชว์ "ใบประกันของฉัน" ได้โดยไม่ต้องพิมพ์
        try {
          var mine = read(KEY.myWarranties, []);
          mine.unshift({ id: id, name: ((data.firstName || "") + " " + (data.lastName || "")).trim(), brand: data.brand || "", model: data.model || "", serial: data.serial || "", category: data.category || "", at: Date.now() });
          write(KEY.myWarranties, mine.slice(0, 50), { skipCloud: true });
        } catch (e) {}
        return id;
      });
    });
  }
  // ดึงใบประกัน 1 ใบด้วยเลขอ้างอิง (REST get เปิดสาธารณะ — รู้เลข = เจ้าของ)
  function getWarrantyById(id) {
    id = String(id || "").trim();
    if (!id) return Promise.resolve(null);
    var cfg = parseFbConfig(firebaseCfg());
    if (!cfg || !cfg.projectId) return Promise.resolve(null);
    var url = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/default/documents/warranties/" + encodeURIComponent(id);
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (doc) {
      if (!doc || !doc.fields) return null;
      var out = {}; for (var k in doc.fields) out[k] = unwrapFs(doc.fields[k]);
      if (!out.id) out.id = id;
      return out;
    }).catch(function () { return null; });
  }
  function getMyWarranties() { return read(KEY.myWarranties, []); }
  // หลังร้าน: ฟังรายการประกันแบบเรียลไทม์
  function subscribeWarranties(cb) {
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.onSnapshot(fs.collection(m.db, "warranties"), function (snap) {
        var list = snap.docs.map(function (d) {
          var x = d.data() || {};
          if (x.createdAtTs && x.createdAtTs.toDate) x.createdAt = x.createdAtTs.toDate().getTime();
          delete x.createdAtTs;
          return x;
        }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        cb(list);
      }, function (err) { console.warn("[warranty sub]", err && err.message); });
    }).catch(function (err) { console.warn("[warranty sub init]", err && err.message); return null; });
  }
  function deleteWarranty(id) {
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      return m.fsMod.deleteDoc(m.fsMod.doc(m.db, "warranties", String(id)));
    });
  }

  /* ---------- ขอใบเสนอราคา (Request a Quote) — สำหรับ B2B/ซื้อจำนวนมาก ---------- */
  function quoteToken() {
    var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    try { var a = new Uint8Array(12); (global.crypto || window.crypto).getRandomValues(a); for (var i = 0; i < a.length; i++) s += c[a[i] % c.length]; }
    catch (e) { for (var j = 0; j < 12; j++) s += c[Math.floor(Math.random() * c.length)]; }
    return "QT-" + s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8, 12);
  }
  function submitQuote(data) {
    return loadFirebaseAuthAndDb().then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      var uid = (m.auth && m.auth.currentUser && m.auth.currentUser.uid) || "";
      var id = quoteToken();
      var payload = Object.assign({}, data, { id: id, userId: uid, status: "new", createdAtTs: fs.serverTimestamp() });
      return fs.setDoc(fs.doc(m.db, "quotes", id), payload).then(function () {
        try { var mine = read(KEY.myQuotes, []); mine.unshift({ id: id, company: data.company || "", at: Date.now() }); write(KEY.myQuotes, mine.slice(0, 30), { skipCloud: true }); } catch (e) {}
        return id;
      });
    });
  }
  function subscribeQuotes(cb) {
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.onSnapshot(fs.collection(m.db, "quotes"), function (snap) {
        var list = snap.docs.map(function (d) { var x = d.data() || {}; if (x.createdAtTs && x.createdAtTs.toDate) x.createdAt = x.createdAtTs.toDate().getTime(); delete x.createdAtTs; return x; })
          .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        cb(list);
      }, function (err) { console.warn("[quotes sub]", err && err.message); });
    }).catch(function (err) { console.warn("[quotes sub init]", err && err.message); return null; });
  }
  function setQuoteStatus(id, status) {
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      return m.fsMod.setDoc(m.fsMod.doc(m.db, "quotes", String(id)), { status: status }, { merge: true });
    });
  }
  function deleteQuote(id) {
    return loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      return m.fsMod.deleteDoc(m.fsMod.doc(m.db, "quotes", String(id)));
    });
  }

  /* ---------- Chat (customer ↔ shop, LINE-OA style) -------------- */
  function getChats() { return read(KEY.chats, {}); }
  function saveChats(c) { write(KEY.chats, c); dispatch(); }
  function chatConvId() {
    var s = session();
    if (s && s.role === "customer") return "u:" + (s.email || "").toLowerCase();
    var gid = localStorage.getItem("me_chat_gid");
    if (!gid) { gid = "g-" + Date.now().toString(36) + Math.floor(Math.random() * 1000); localStorage.setItem("me_chat_gid", gid); }
    return gid;
  }
  function chatEnsure(id) {
    var chats = getChats();
    if (!chats[id]) {
      var s = session();
      chats[id] = { id: id, name: (s && s.name) || (id.indexOf("u:") === 0 ? id.slice(2) : "ผู้เยี่ยมชม"), email: (s && s.email) || "", messages: [], needsShop: false, updatedAt: Date.now() };
      write(KEY.chats, chats);
    }
    return getChats()[id];
  }
  function chatPushUser(text, escalated) {
    var id = chatConvId(); chatEnsure(id);
    var chats = getChats(), c = chats[id];
    c.messages.push({ from: "user", text: text, at: Date.now() });
    if (escalated) c.needsShop = true;
    var s = session(); if (s) { c.name = s.name; c.email = s.email; }
    c.updatedAt = Date.now(); saveChats(chats); return id;
  }
  function chatPushBot(text) {
    var id = chatConvId(); chatEnsure(id);
    var chats = getChats(); chats[id].messages.push({ from: "bot", text: text, at: Date.now() }); chats[id].updatedAt = Date.now(); saveChats(chats);
  }
  function chatReplyShop(id, text) {
    var chats = getChats(); if (!chats[id]) return;
    chats[id].messages.push({ from: "shop", text: text, at: Date.now() }); chats[id].needsShop = false; chats[id].updatedAt = Date.now(); saveChats(chats);
  }
  function chatGetConv(id) { return getChats()[id] || null; }
  function chatCurrent() { return chatGetConv(chatConvId()); }
  function chatList() { var c = getChats(); return Object.keys(c).map(function (k) { return c[k]; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }); }
  function chatDelete(id) { var c = getChats(); delete c[id]; saveChats(c); }
  // ลบข้อความแชทที่เก่าเกิน N วัน (ค่าเริ่ม 7) ออกจากเครื่อง — กันเก็บข้อมูลนาน + ประหยัดพื้นที่
  // ห้องไหนไม่เหลือข้อความ + เงียบเกิน 7 วัน → ลบทั้งห้อง
  function purgeOldChats(days) {
    days = days || 7;
    var cutoff = Date.now() - days * 86400000;
    var chats = getChats(), changed = false;
    Object.keys(chats).forEach(function (id) {
      var c = chats[id]; if (!c) return;
      var before = (c.messages || []).length;
      c.messages = (c.messages || []).filter(function (m) { return (m.at || 0) >= cutoff; });
      if (c.messages.length !== before) changed = true;
      if (!c.messages.length && (c.updatedAt || 0) < cutoff) { delete chats[id]; changed = true; }
    });
    if (changed) { write(KEY.chats, chats, { skipCloud: true }); dispatch(); }
    return changed;
  }
  // รายงานการใช้พื้นที่ในเครื่อง (localStorage) แยกตามหมวด — ใช้ในหน้า "ล้างข้อมูล"
  // คืน [{ kind, label, bytes, note, removable }] เรียงจากใหญ่ไปเล็ก
  function storageReport() {
    function bytesOf(v) { try { return (typeof v === "string" ? v : JSON.stringify(v || "")).length * 2; } catch (e) { return 0; } }
    function lsBytes(key) { try { var s = localStorage.getItem(key); return s ? s.length * 2 : 0; } catch (e) { return 0; } }
    // แยกขนาด "รูป/มีเดีย" ออกจากตัวสินค้า (รูปคือก้อนใหญ่สุดมักไม่ค่อยใช้พื้นที่คุ้ม)
    var prods = read(KEY.products, []) || [];
    var imgB = 0, spinB = 0;
    prods.forEach(function (p) {
      imgB += bytesOf(p.image) + bytesOf(p.images);
      spinB += bytesOf(p.frames360);
    });
    var rep = [
      { kind: "spin360", label: "รูปหมุน 360° ของสินค้า", bytes: spinB, note: "รูปสินค้า — เก็บไว้ (ไม่ลบ)", removable: false },
      { kind: "prodimg", label: "รูปสินค้า", bytes: imgB, note: "รูปสินค้า — เก็บไว้ (ไม่ลบ)", removable: false },
      { kind: "cloudcache", label: "แคชสินค้าจาก cloud", bytes: lsBytes(KEY.cloudProducts), note: "ปลอดภัย — ลบแล้วโหลดใหม่อัตโนมัติ", removable: true },
      { kind: "orders", label: "คำสั่งซื้อ/เช่า", bytes: lsBytes(KEY.orders), note: "⚠️ เป็นประวัติการขาย ไม่แนะนำให้ลบ", removable: false },
    ];
    rep.sort(function (a, b) { return b.bytes - a.bytes; });
    return rep;
  }
  // ลบข้อมูลตามหมวดที่เลือกในหน้า "ล้างข้อมูล"
  function clearStorageKind(kind) {
    if (kind === "cloudcache") { try { localStorage.removeItem(KEY.cloudProducts); localStorage.removeItem(KEY.catalogVer); } catch (e) {} dispatch(); return true; }
    if (kind === "chats") { write(KEY.chats, {}, { skipCloud: true }); dispatch(); return true; }
    if (kind === "spin360" || kind === "prodimg") {
      var list = read(KEY.products, []) || [];
      list.forEach(function (p) {
        if (kind === "spin360") p.frames360 = [];
        else { p.images = []; p.image = ""; }
        p.updatedAt = new Date().toISOString();
      });
      write(KEY.products, list, { skipCloud: true }); dispatch();
      return true;
    }
    return false;
  }

  /* ---------- Metrics (for the employee dashboard) ---------------- */
  function getMetrics() {
    var orders = getOrders().filter(function (o) { return o.status !== "cancelled"; });
    var revenue = 0, cost = 0;
    orders.forEach(function (o) { revenue += o.revenue || 0; cost += o.cost || 0; });
    var products = getProducts();
    var invValue = 0, invCost = 0, units = 0, lowStock = 0, rentedOut = 0;
    products.forEach(function (p) {
      invValue += (p.price || 0) * available(p);
      invCost += (p.cost || 0) * available(p);
      units += available(p);
      rentedOut += p.rented || 0;
      if (available(p) <= 3) lowStock++;
    });
    return {
      revenue: revenue, cost: cost, profit: revenue - cost,
      margin: revenue ? (revenue - cost) / revenue : 0,
      orderCount: orders.length,
      inventoryRetailValue: invValue, inventoryCostValue: invCost,
      unitsInStock: units, rentedOut: rentedOut,
      lowStockCount: lowStock, productCount: products.length,
    };
  }
  // revenue grouped by day for the last N days
  function revenueByDay(n) {
    n = n || 7;
    var out = [];
    var orders = getOrders().filter(function (o) { return o.status !== "cancelled"; });
    for (var i = n - 1; i >= 0; i--) {
      var dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart = dayStart.getTime() - i * 86400000;
      var dayEnd = dayStart + 86400000;
      var rev = 0, prof = 0;
      orders.forEach(function (o) {
        if (o.createdAt >= dayStart && o.createdAt < dayEnd) {
          rev += o.revenue || 0; prof += (o.revenue || 0) - (o.cost || 0);
        }
      });
      out.push({ date: dayStart, revenue: rev, profit: prof });
    }
    return out;
  }

  /* ---------- Shipping rates + Thai geo --------------------------- */
  // GEO_DATA holds the full Thailand dataset once loaded from CDN; until then
  // we use the bundled sample (global.THAI_GEO) so the cascade always works offline.
  var GEO_DATA = null;
  function setGeoData(nested) { if (nested && nested.length) { GEO_DATA = nested; dispatch(); } }
  function geo() { return GEO_DATA || global.THAI_GEO || []; }
  function provinces() { return geo().map(function (p) { return p.name; }); }
  function findProvince(name) { return geo().filter(function (p) { return p.name === name; })[0] || null; }
  function districtsOf(prov) { var p = findProvince(prov); return p ? p.districts.map(function (d) { return d.name; }) : []; }
  function findDistrict(prov, dist) { var p = findProvince(prov); return p ? (p.districts.filter(function (d) { return d.name === dist; })[0] || null) : null; }
  function subdistrictsOf(prov, dist) { var d = findDistrict(prov, dist); return d ? d.subs.map(function (s) { return s.name; }) : []; }
  function zipsOf(prov, dist, sub) {
    var d = findDistrict(prov, dist); if (!d) return [];
    return d.subs.filter(function (s) { return s.name === sub; }).map(function (s) { return s.zip; });
  }

  function seedShip() {
    if (localStorage.getItem(KEY.ship)) return;
    var rates = {};
    geo().forEach(function (p) { rates[p.name] = p.ship; });
    write(KEY.ship, rates);
  }
  function getShipRates() {
    var r = read(KEY.ship, null);
    if (!r) { seedShip(); r = read(KEY.ship, {}); }
    return r;
  }
  function defaultShipFor(province) {
    var sample = (global.THAI_GEO || []).filter(function (p) { return p.name === province; })[0];
    if (sample && sample.ship != null) return sample.ship;
    return 90; // default for provinces not in the sample (owner can edit)
  }
  function getShippingFee(province) {
    var rates = getShipRates();
    if (rates[province] != null) return rates[province];
    return defaultShipFor(province);
  }
  function setShipRate(province, fee) {
    var r = getShipRates();
    r[province] = Math.max(0, Math.round(Number(fee) || 0));
    write(KEY.ship, r);
  }

  /* ---------- Site settings (editable content) -------------------- */
  function seedSettings() { if (!localStorage.getItem(KEY.settings)) write(KEY.settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS))); }
  function getSettings() {
    var s = read(KEY.settings, null);
    if (!s) { seedSettings(); s = read(KEY.settings, {}); }
    return Object.assign({}, DEFAULT_SETTINGS, s);
  }
  function saveSettings(patch) {
    var s = getSettings();
    write(KEY.settings, Object.assign(s, patch));
    dispatch();
  }
  /* ---------- Promo: double-date + title tokens ------------------- */
  // โปรวันที่ซ้ำ (เช่น 6.6, 8.8):
  //   recurring=true → ทำซ้ำเองทุกเดือน (1.1, 2.2, …, 12.12) ไม่ต้องตั้ง anchor
  //   ไม่งั้น เจ้าของตั้ง "วันที่โปรซ้ำ" (anchorDate, วัน=เดือน) ครั้งเดียว
  //   ทั้งคู่: เริ่มก่อน beforeDays วัน (เริ่ม 2 ทุ่มของวันนั้น), จบหลัง afterDays วัน (ค่าเริ่ม 1/2)
  //   {dd}   = เลขโปรซ้ำ เช่น 6.6 / 8.8 / 11.11   ·   {date} = วันที่ไทยสั้น เช่น "6 มิ.ย."
  var THAI_MON_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  var PROMO_START_HOUR = 20; // โปรเริ่ม 2 ทุ่ม (20:00) ของวันเริ่ม
  function isYmd(s) { return s && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function localToday() { var n = new Date(); return n.getFullYear() + "-" + pad2(n.getMonth() + 1) + "-" + pad2(n.getDate()); }
  // บวก/ลบวันจากสตริง YYYY-MM-DD (UTC-safe) → คืน YYYY-MM-DD
  function addDaysStr(ymd, n) {
    var p = ymd.split("-"), dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
  }
  // Date (เวลาท้องถิ่น) จาก YYYY-MM-DD + ชั่วโมง
  function dateAt(ymd, h, mi, se) { var p = ymd.split("-"); return new Date(+p[0], +p[1] - 1, +p[2], h || 0, mi || 0, se || 0); }
  function promoBefore(promo) { return (promo && promo.beforeDays != null && promo.beforeDays !== "") ? +promo.beforeDays : 1; }
  function promoAfter(promo) { return (promo && promo.afterDays != null && promo.afterDays !== "") ? +promo.afterDays : 2; }
  // โหมดทำซ้ำ: หา double-date (วัน=เดือน) ที่ "วันนี้อยู่ในช่วง"; ถ้าไม่มี คืนอันถัดไปที่จะมาถึง
  // ครอบ 3 ปี (ก่อน/นี้/หน้า) เผื่อช่วงคาบเกี่ยวปลายปี–ต้นปี
  function activeDouble(promo, today) {
    today = today || localToday();
    var before = promoBefore(promo), after = promoAfter(promo), ty = +today.slice(0, 4), anchors = [], y, m;
    for (y = ty - 1; y <= ty + 1; y++) for (m = 1; m <= 12; m++) anchors.push(y + "-" + pad2(m) + "-" + pad2(m));
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i], s = addDaysStr(a, -before), e = addDaysStr(a, after);
      if (today >= s && today <= e) return { anchor: a, start: s, end: e, active: true };
    }
    var up = anchors.filter(function (a) { return a >= today; }).sort()[0] || anchors[anchors.length - 1];
    return { anchor: up, start: addDaysStr(up, -before), end: addDaysStr(up, after), active: false };
  }
  // วันฐานสำหรับ token = วันที่ซ้ำของรอบที่ active/ถัดไป (recurring) → anchor → วันเริ่ม → วันนี้
  function promoBaseDate(promo) {
    var s = (promo && promo.recurring) ? activeDouble(promo).anchor
          : ((promo && promo.anchorDate) || (promo && promo.startDate));
    if (isYmd(s)) { var p = s.split("-"); return { y: +p[0], m: +p[1], d: +p[2] }; }
    var n = new Date(); return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }
  // ช่วงโปรที่ใช้จริง (วันที่): recurring → ช่วง double-date รอบปัจจุบัน/ถัดไป;
  //   anchorDate → [anchor-before, anchor+after]; ไม่งั้นใช้ start/end ที่ตั้งมือ
  //   anchored=true ถ้ามาจากโหมดวันที่ซ้ำ (ใช้เวลาเริ่ม 2 ทุ่ม)
  function promoWindow(promo) {
    if (promo && promo.recurring) { var d = activeDouble(promo); return { start: d.start, end: d.end, anchored: true }; }
    if (promo && isYmd(promo.anchorDate)) {
      return { start: addDaysStr(promo.anchorDate, -promoBefore(promo)), end: addDaysStr(promo.anchorDate, promoAfter(promo)), anchored: true };
    }
    return { start: (promo && promo.startDate) || "", end: (promo && promo.endDate) || "", anchored: false };
  }
  // โปรกำลังแสดงอยู่ไหม ณ ตอนนี้ — เคารพเวลาเริ่ม 2 ทุ่มของวันเริ่ม (โหมดวันที่ซ้ำ)
  function promoActiveNow(promo, now) {
    now = now || new Date();
    var w = promoWindow(promo);
    if (!w.start && !w.end) return true; // ไม่กำหนดช่วง = แสดงตลอด
    var startM = w.start ? dateAt(w.start, w.anchored ? PROMO_START_HOUR : 0) : null;
    var endM = w.end ? dateAt(w.end, 23, 59, 59) : null;
    if (startM && now < startM) return false;
    if (endM && now > endM) return false;
    return true;
  }
  function fillPromoTokens(str, promo) {
    if (!str) return str || "";
    var b = promoBaseDate(promo);
    return String(str)
      .replace(/\{dd\}/g, b.m + "." + b.d)
      .replace(/\{date\}/g, b.d + " " + THAI_MON_ABBR[b.m - 1]);
  }
  // ช่วงวันที่โปร (สำหรับโชว์ในข้อความ 👉) — ถ้าเจ้าของพิมพ์เองใช้ของเขา, ไม่งั้นสร้างอัตโนมัติ
  //   รูปแบบ: "5 มิ.ย (2 ทุ่ม) – 8 มิ.ย 69" (ปี พ.ศ. 2 หลัก, ใส่ '(2 ทุ่ม)' เฉพาะวันเริ่มโหมดวันที่ซ้ำ)
  function promoDateText(promo) {
    if (promo && promo.dateText) return fillPromoTokens(promo.dateText, promo);
    var w = promoWindow(promo);
    if (!w.start || !w.end) return "";
    var sp = w.start.split("-"), ep = w.end.split("-");
    var beYY = pad2((+ep[0] + 543) % 100);
    var startTxt = (+sp[2]) + " " + THAI_MON_ABBR[+sp[1] - 1] + (w.anchored ? " (2 ทุ่ม)" : "");
    var endTxt = (+ep[2]) + " " + THAI_MON_ABBR[+ep[1] - 1] + " " + beYY;
    return startTxt + " – " + endTxt;
  }
  // Firebase config used by the chat: per-browser override (back office) wins,
  // else the committed FIREBASE_CONFIG (shared by every visitor → real online chat).
  function firebaseCfg() {
    // ใช้การเชื่อมต่อที่ "ฝังมาในแอป" เสมอ → ทุกเครื่อง (คอม/มือถือ/ลูกค้า) ต่อ cloud เดียวกัน
    // อัตโนมัติ ไม่ต้องตั้งค่า Firebase ต่อเครื่อง · สิทธิ์ดูจากบัญชีที่ล็อกอินเท่านั้น
    if (FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) return JSON.stringify(FIREBASE_CONFIG);
    return (getSettings().firebaseConfig || "").trim(); // สำรอง: เผื่อไม่มีค่าฝัง
  }
  // live open/closed based on current time + opening hours + special days
  function isOpenNow() {
    var st = getSettings(), now = new Date();
    function toMin(s) { var p = String(s || "0:0").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
    var ymd = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    var sp = (st.specialDays || []).filter(function (d) { return d.date === ymd; })[0];
    var open, close;
    if (sp) { if (!sp.open) return { open: false, reason: sp.note || "วันหยุดพิเศษ" }; open = st.hoursWeekOpen; close = st.hoursWeekClose; }
    else if (now.getDay() === 0) { if (!st.openSun) return { open: false, reason: "วันอาทิตย์ปิดทำการ" }; open = st.hoursSunOpen; close = st.hoursSunClose; }
    else { open = st.hoursWeekOpen; close = st.hoursWeekClose; }
    var cur = now.getHours() * 60 + now.getMinutes();
    return { open: cur >= toMin(open) && cur < toMin(close) };
  }

  /* ---------- Staff (owner + employees) --------------------------- */
  function seedStaff() { if (!localStorage.getItem(KEY.staff)) write(KEY.staff, JSON.parse(JSON.stringify(DEFAULT_STAFF))); }
  function getStaff() { var s = read(KEY.staff, null); if (!s) { seedStaff(); s = read(KEY.staff, []); } return s; }
  function saveStaffMember(m) {
    var list = getStaff();
    var email = (m.email || "").trim().toLowerCase();
    if (m.id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === m.id) { list[i] = Object.assign(list[i], m, { email: email || list[i].email }); break; }
    } else {
      m.id = genId("stf").toLowerCase(); m.role = "employee"; m.email = email;
      m.perms = m.perms || { dashboard: true, inventory: false, orders: false, erp: false, settings: false };
      list.push(m);
    }
    write(KEY.staff, list);
    dispatch();
    return m;
  }
  function deleteStaff(id) {
    var list = getStaff().filter(function (s) { return !(s.id === id && s.role !== "owner"); });
    write(KEY.staff, list); dispatch();
  }

  /* ---------- Accounts + auth ------------------------------------- */
  function getUsers() { return read(KEY.users, []); }
  function setSession(s) { s.at = Date.now(); write(KEY.session, s); dispatch(); }
  function session() {
    var s = read(KEY.session, null);
    // refresh staff name/perms in case the owner changed them
    if (s && (s.role === "owner" || s.role === "employee")) {
      var live = getStaff().filter(function (m) { return m.id === s.id; })[0];
      if (live) { s.name = live.name; s.perms = live.perms; s.role = live.role; }
    }
    return s;
  }
  function isStaff() { var s = session(); return !!(s && (s.role === "owner" || s.role === "employee")); }
  function isOwner() { var s = session(); return !!(s && s.role === "owner"); }
  function hasPerm(key) {
    var s = session(); if (!s) return false;
    if (s.role === "owner") return true;
    if (s.perms && Object.prototype.hasOwnProperty.call(s.perms, key)) return !!s.perms[key];
    return !!SOFT_PERMS[key]; // หน้าใหม่: ค่าเดิม = เปิด จนแอดมินตั้งค่าเอง
  }
  function logout() { localStorage.removeItem(KEY.session); dispatch(); }

  function registerUser(u) {
    var email = (u.email || "").trim().toLowerCase();
    if (!u.name || !email || !u.password) return { ok: false, error: "กรุณากรอกชื่อ อีเมล และรหัสผ่าน" };
    if (getStaff().some(function (e) { return e.email === email; })) return { ok: false, error: "อีเมลนี้ถูกใช้แล้ว" };
    var users = getUsers();
    if (users.some(function (x) { return x.email === email; })) return { ok: false, error: "อีเมลนี้สมัครสมาชิกแล้ว" };
    users.push({ name: u.name, email: email, phone: u.phone || "", password: u.password, createdAt: Date.now() });
    write(KEY.users, users);
    setSession({ email: email, name: u.name, role: "customer" });
    return { ok: true, role: "customer" };
  }
  // create/login a customer from a social provider (Google/Facebook) profile
  function socialUpsert(email, name, provider) {
    email = (email || "").trim().toLowerCase();
    if (!email) return { ok: false, error: "ไม่ได้รับอีเมลจากผู้ให้บริการ" };
    var users = getUsers();
    var u = users.filter(function (x) { return x.email === email; })[0];
    if (!u) { u = { name: name || email, email: email, phone: "", password: "__social__", social: provider || "social", createdAt: Date.now() }; users.push(u); write(KEY.users, users); }
    setSession({ email: email, name: u.name, role: "customer" });
    return { ok: true, role: "customer" };
  }
  function loginUser(email, password) {
    email = (email || "").trim().toLowerCase();
    var st = getStaff().filter(function (e) { return e.email === email && e.password === password; })[0];
    if (st) { setSession({ id: st.id, email: st.email, name: st.name, role: st.role, perms: st.perms }); return { ok: true, role: st.role }; }
    var u = getUsers().filter(function (x) { return x.email === email && x.password === password; })[0];
    if (u) { setSession({ email: u.email, name: u.name, role: "customer" }); return { ok: true, role: "customer" }; }
    return { ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  /* ---------- Phase D: Firebase Auth สำหรับลูกค้า (cross-device) ---------- */
  // โหลด Firebase modular SDK lazily — เปลือก iife ของไฟล์นี้ใช้ dynamic import ได้
  // สมัคร: createUserWithEmailAndPassword + setDoc users/{uid} (profile)
  // เข้าระบบ: signInWithEmailAndPassword → load users/{uid} → setSession ด้วย uid
  // appName: "customer" (default) สำหรับลูกค้า, "admin" สำหรับหลังร้าน
  // — แยกกันเพื่อให้ admin/customer ไม่ใช้ uid เดียวกัน
  // — แต่ admin pages ทั้งหมดควรใช้ "admin" เพื่อให้ uid ตรงกันข้ามหน้า
  function loadFirebaseAuthAndDb(appName) {
    var name = appName || "customer";
    var cfg = parseFbConfig(firebaseCfg());
    if (!cfg) return Promise.reject(new Error("ยังไม่ได้ตั้ง Firebase Config"));
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    return Promise.all([
      import(base + "firebase-app.js"),
      import(base + "firebase-auth.js"),
      import(base + "firebase-firestore.js"),
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1], fsMod = mods[2];
      var app;
      try { app = appMod.getApp(name); }
      catch (e) { app = appMod.initializeApp(cfg, name); }
      return {
        app: app,
        auth: authMod.getAuth(app),
        db: fsMod.getFirestore(app, "default"),
        authMod: authMod,
        fsMod: fsMod,
      };
    });
  }

  // สมัครลูกค้า: เขียนทั้ง Firebase Auth + Firestore users/{uid} + localStorage (legacy)
  function registerUserCloud(u) {
    var email = (u.email || "").trim().toLowerCase();
    if (!u.name || !email || !u.password) return Promise.reject(new Error("กรุณากรอกชื่อ อีเมล และรหัสผ่าน"));
    return loadFirebaseAuthAndDb().then(function (m) {
      return m.authMod.createUserWithEmailAndPassword(m.auth, email, u.password).then(function (cred) {
        var uid = cred.user.uid;
        return m.fsMod.setDoc(m.fsMod.doc(m.db, "users", uid), {
          uid: uid,
          email: email,
          name: u.name,
          phone: u.phone || "",
          createdAt: m.fsMod.serverTimestamp(),
        }).then(function () {
          // อัปเดต localStorage เผื่อ offline / fallback (ไม่เก็บ password ใน plain ที่ cloud)
          var users = getUsers();
          if (!users.some(function (x) { return x.email === email; })) {
            users.push({ uid: uid, name: u.name, email: email, phone: u.phone || "", createdAt: Date.now(), cloud: true });
            write(KEY.users, users);
          }
          setSession({ uid: uid, email: email, name: u.name, role: "customer" });
          return { ok: true, uid: uid, role: "customer" };
        });
      });
    });
  }

  // เข้าระบบลูกค้าผ่าน Firebase Auth (cross-device) — โหลด profile กลับมาตั้ง session
  function loginUserCloud(email, password) {
    email = (email || "").trim().toLowerCase();
    if (!email || !password) return Promise.reject(new Error("กรุณากรอกอีเมลและรหัสผ่าน"));
    return loadFirebaseAuthAndDb().then(function (m) {
      return m.authMod.signInWithEmailAndPassword(m.auth, email, password).then(function (cred) {
        var uid = cred.user.uid;
        return m.fsMod.getDoc(m.fsMod.doc(m.db, "users", uid)).then(function (snap) {
          var data = (snap && snap.exists && snap.exists()) ? (snap.data() || {}) : {};
          var name = data.name || cred.user.displayName || email.split("@")[0];
          setSession({ uid: uid, email: email, name: name, role: "customer" });
          return { ok: true, uid: uid, role: "customer" };
        });
      });
    });
  }

  // เข้าระบบ/สมัครด้วย Google ผ่าน Firebase Auth (popup) — รวม register + login ในรอบเดียว
  // ต้อง enable Google provider ใน Firebase Console → Authentication ก่อน
  function loginGoogleCloud() {
    return loadFirebaseAuthAndDb().then(function (m) {
      var provider = new m.authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return m.authMod.signInWithPopup(m.auth, provider).then(function (cred) {
        var uid = cred.user.uid;
        var email = (cred.user.email || "").toLowerCase();
        var name = cred.user.displayName || email.split("@")[0];
        var phone = cred.user.phoneNumber || "";
        // สร้าง/อัปเดต users/{uid} doc — merge เพื่อไม่ทับถ้าเคยตั้งไว้แล้ว
        return m.fsMod.setDoc(m.fsMod.doc(m.db, "users", uid), {
          uid: uid, email: email, name: name, phone: phone,
          provider: "google",
          updatedAt: m.fsMod.serverTimestamp(),
        }, { merge: true }).then(function () {
          // sync local user list
          var users = getUsers();
          if (!users.some(function (x) { return x.email === email; })) {
            users.push({ uid: uid, name: name, email: email, phone: phone, createdAt: Date.now(), social: "google", cloud: true });
            write(KEY.users, users);
          }
          setSession({ uid: uid, email: email, name: name, role: "customer" });
          return { ok: true, uid: uid, role: "customer" };
        });
      });
    });
  }
  // gate an admin page by a permission key (employees) — owner always allowed
  function requirePerm(key, redirect) {
    if (!isStaff()) { window.location.href = redirect || "../login.html"; return false; }
    if (key && !hasPerm(key)) { window.location.href = "dashboard.html"; return false; }
    return true;
  }

  /* ---------- ERP: ledger / suppliers / purchases ---------------- */
  function getLedger() { return read(KEY.ledger, []).sort(function (a, b) { return b.date - a.date; }); }
  function saveLedgerEntry(e) {
    var list = read(KEY.ledger, []);
    if (!e.id) { e.id = genId("LG"); e.date = e.date || Date.now(); list.push(e); }
    else { for (var i = 0; i < list.length; i++) if (list[i].id === e.id) { list[i] = Object.assign(list[i], e); break; } }
    write(KEY.ledger, list); dispatch(); return e;
  }
  function deleteLedgerEntry(id) { write(KEY.ledger, read(KEY.ledger, []).filter(function (e) { return e.id !== id; })); dispatch(); }

  function getSuppliers() { return read(KEY.suppliers, []); }
  function saveSupplier(s) {
    var list = getSuppliers();
    if (!s.id) { s.id = genId("SUP").toLowerCase(); list.push(s); }
    else { for (var i = 0; i < list.length; i++) if (list[i].id === s.id) { list[i] = Object.assign(list[i], s); break; } }
    write(KEY.suppliers, list); dispatch(); return s;
  }
  function deleteSupplier(id) { write(KEY.suppliers, getSuppliers().filter(function (s) { return s.id !== id; })); dispatch(); }

  function getPurchases() { return read(KEY.purchases, []).sort(function (a, b) { return b.date - a.date; }); }
  // receiving a purchase order: add stock to each product + record an expense
  function receivePurchase(po) {
    po.id = genId("PO"); po.date = po.date || Date.now();
    po.total = (po.items || []).reduce(function (s, it) { return s + it.unitCost * it.qty; }, 0);
    (po.items || []).forEach(function (it) { adjustStock(it.productId, it.qty); });
    var list = read(KEY.purchases, []); list.push(po); write(KEY.purchases, list);
    saveLedgerEntry({ type: "expense", category: "ซื้อสินค้าเข้า", note: "รับสินค้าเข้า " + po.id + (po.supplierName ? " · " + po.supplierName : ""), amount: po.total, date: po.date, ref: po.id });
    dispatch(); return po;
  }
  // combined P&L: order revenue/COGS + manual ledger
  function getPnL() {
    var m = getMetrics();
    var ledger = getLedger();
    var income = 0, expense = 0;
    ledger.forEach(function (e) { if (e.type === "income") income += e.amount || 0; else expense += e.amount || 0; });
    var grossProfit = m.revenue - m.cost;
    var net = grossProfit + income - expense;
    return { salesRevenue: m.revenue, cogs: m.cost, grossProfit: grossProfit, otherIncome: income, expenses: expense, netProfit: net };
  }

  /* ---------- danger zone: reset demo data ------------------------ */
  function resetAll() {
    [KEY.products, KEY.orders, KEY.cart, KEY.ship, KEY.settings, KEY.staff, KEY.ledger, KEY.suppliers, KEY.purchases, KEY.seeded, KEY.deletedOrders]
      .forEach(function (k) { localStorage.removeItem(k); });
    seed();
  }

  /* ---------- change events (keep cart badge in sync) ------------- */
  function dispatch() {
    try { global.dispatchEvent(new CustomEvent("me-store-change")); } catch (e) {}
  }
  function onChange(fn) { global.addEventListener("me-store-change", fn); }

  // seed on load
  seed();

  global.MEStore = {
    KEY: KEY,
    CATEGORIES: CATEGORIES, categoryLabel: categoryLabel, getCategories: getCategories,
    getCategory: getCategory, getSubcategories: getSubcategories, categoryHasChildren: categoryHasChildren,
    catDescendants: catDescendants, categoryPath: categoryPath, productCountInCat: productCountInCat,
    getMyRating: getMyRating, productRating: productRating, rateProduct: rateProduct,
    cloudBumpView: cloudBumpView, cloudBumpAffinity: cloudBumpAffinity,
    loadReviews: loadReviews, submitReview: submitReview,
    typeLabel: typeLabel, statusLabel: statusLabel, fulfillmentLabel: fulfillmentLabel,
    money: money, fmtDate: fmtDate, dateStr: dateStr, genId: genId,
    getProducts: getProducts, getProduct: getProduct, available: available, getLocalProducts: getLocalProducts,
    saveProduct: saveProduct, deleteProduct: deleteProduct, adjustStock: adjustStock,
    cloudLoadProducts: cloudLoadProducts, cloudSyncAllProducts: cloudSyncAllProducts, autoCatchUpSync: autoCatchUpSync, cloudPushProduct: cloudPushProduct, restoreProductsFromCloud: restoreProductsFromCloud, pushProductToSheet: pushProductToSheet, pushSheetDelete: pushSheetDelete, migrateImagesToStorage: migrateImagesToStorage,
    startAdminRealtime: startAdminRealtime,
    getCart: getCart, addToCart: addToCart, updateCartItem: updateCartItem,
    removeCartItem: removeCartItem, clearCart: clearCart,
    cartCount: cartCount, cartLines: cartLines, cartTotals: cartTotals, vatInfo: vatInfo, lineVat: lineVat, categoryHasVat: categoryHasVat,
    getOrders: getOrders, placeOrder: placeOrder, setOrderStatus: setOrderStatus, saveOrderMessage: saveOrderMessage, confirmOrderPayment: confirmOrderPayment,
    submitWarranty: submitWarranty, subscribeWarranties: subscribeWarranties, deleteWarranty: deleteWarranty,
    getWarrantyById: getWarrantyById, getMyWarranties: getMyWarranties,
    submitQuote: submitQuote, subscribeQuotes: subscribeQuotes, setQuoteStatus: setQuoteStatus, deleteQuote: deleteQuote,
    getMetrics: getMetrics, revenueByDay: revenueByDay,
    provinces: provinces, districtsOf: districtsOf, subdistrictsOf: subdistrictsOf, zipsOf: zipsOf,
    setGeoData: setGeoData,
    getShipRates: getShipRates, getShippingFee: getShippingFee, setShipRate: setShipRate,
    getSettings: getSettings, saveSettings: saveSettings, fillPromoTokens: fillPromoTokens, promoWindow: promoWindow, promoActiveNow: promoActiveNow, promoDateText: promoDateText, isOpenNow: isOpenNow, firebaseCfg: firebaseCfg,
    getUsers: getUsers, registerUser: registerUser, loginUser: loginUser, socialUpsert: socialUpsert,
    registerUserCloud: registerUserCloud, loginUserCloud: loginUserCloud, loginGoogleCloud: loginGoogleCloud, loadFirebaseAuthAndDb: loadFirebaseAuthAndDb,
    cloudLoadAdminData: cloudLoadAdminData, cloudPushAdminData: cloudPushAdminData,
    cloudLoadPublicSettings: cloudLoadPublicSettings,
    getStaff: getStaff, saveStaffMember: saveStaffMember, deleteStaff: deleteStaff,
    session: session, isStaff: isStaff, isOwner: isOwner, hasPerm: hasPerm, canReduceInventory: canReduceInventory, PERM_KEYS: PERM_KEYS, PERM_DEFS: PERM_DEFS,
    logout: logout, requirePerm: requirePerm, checkPin: checkPin,
    ensureAdminRegistered: ensureAdminRegistered, adminIdToken: adminIdToken, absorbCloudOrders: absorbCloudOrders,
    deleteOrder: deleteOrder, deletePurchase: deletePurchase,
    getLedger: getLedger, saveLedgerEntry: saveLedgerEntry, deleteLedgerEntry: deleteLedgerEntry,
    getSuppliers: getSuppliers, saveSupplier: saveSupplier, deleteSupplier: deleteSupplier,
    getPurchases: getPurchases, receivePurchase: receivePurchase, getPnL: getPnL,
    chatPushUser: chatPushUser, chatPushBot: chatPushBot, chatReplyShop: chatReplyShop,
    chatCurrent: chatCurrent, chatGetConv: chatGetConv, chatConvId: chatConvId, chatList: chatList, chatDelete: chatDelete,
    purgeOldChats: purgeOldChats, storageReport: storageReport, clearStorageKind: clearStorageKind,
    resetAll: resetAll, onChange: onChange,
  };
})(window);
