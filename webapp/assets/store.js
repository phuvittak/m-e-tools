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
    deletedOrders: "me_deleted_orders", // tombstones: order ids ที่ลบแล้ว (กัน cloud snapshot ดูดกลับ)
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
    heroOverline: "DEWALT BY M.E.TOOLS · แยกท่ารั้ว เชียงใหม่",
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
    qrImage: "",
    bankInfo: "พร้อมเพย์ M.E.Tools",
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
    promo: { enabled: false, title: "", text: "", image: "" },
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
    { key: "inventory_delete", label: "ลบสินค้าออกจากคลัง", group: "danger" },
    { key: "orders_delete", label: "ลบคำสั่งซื้อ", group: "danger" },
  ];
  var PERM_KEYS = PERM_DEFS.map(function (d) { return d.key; });
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
    if (size() > 950000 && clean.images && clean.images.length > 1) clean.images = [clean.images[0]];
    if (size() > 950000) { clean.images = []; clean.image = ""; } // รูปใหญ่เกิน — เก็บแค่ข้อความ
    clean.available = available(p);
    clean.updatedAt = new Date().toISOString();
    return clean;
  }
  // เอกสารรวมสำหรับบอท LINE (ตัดรูป/มีเดียออก ให้เล็ก)
  function buildCatalogItems() {
    var items = getLocalProducts().filter(function (p) { return !p.hidden; }).map(function (p) {
      var clean = {}, skip = { images: 1, image: 1, frames360: 1, parts: 1, partsBase: 1, model3d: 1, parts3d: 1 };
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && !skip[k]) clean[k] = p[k];
      clean.available = available(p);
      if (Array.isArray(clean.specs)) clean.specs = clean.specs.map(specToObj);
      return clean;
    });
    return JSON.parse(JSON.stringify(items));
  }
  // push สินค้า 1 ตัวขึ้น cloud (fire-and-forget)
  function cloudPushProduct(p) {
    if (!p || !p.id) return;
    loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.setDoc(fs.doc(m.db, "products", String(p.id)), cleanProductDoc(p));
    }).catch(function (err) { console.warn("[cloud product push]", p.id, err && err.message); });
  }
  function cloudDeleteProductDoc(id) {
    if (!id) return;
    loadFirebaseAuthAndDb("admin").then(ensureCloudAuth).then(function (m) {
      var fs = m.fsMod;
      return fs.deleteDoc(fs.doc(m.db, "products", String(id)));
    }).catch(function (err) { console.warn("[cloud product del]", id, err && err.message); });
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
  // โหลดแคตตาล็อกจาก cloud → เก็บใน key แยก (ไม่ทับ me_products ของเจ้าของ)
  // ใช้ REST (public read) — ลูกค้าไม่ต้อง auth. ข้าม doc "catalog" (อันนั้นของบอท)
  function cloudLoadProducts() {
    var cfg = parseFbConfig(firebaseCfg());
    if (!cfg || !cfg.projectId) return Promise.resolve(false);
    var base = "https://firestore.googleapis.com/v1/projects/" + cfg.projectId + "/databases/default/documents/products";
    var out = [];
    function page(token) {
      var url = base + "?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : "");
      return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
        if (!data) return;
        (data.documents || []).forEach(function (doc) {
          var id = (doc.name || "").split("/").pop();
          if (id === "catalog") return;
          var obj = {}, f = doc.fields || {};
          for (var k in f) obj[k] = unwrapFs(f[k]);
          if (!obj.id) obj.id = id;
          out.push(obj);
        });
        if (data.nextPageToken) return page(data.nextPageToken);
      });
    }
    // สำรอง: ถ้า list สินค้าทีละ doc ไม่ได้ (เช่น Firestore rules ยังไม่อนุญาต list)
    // → อ่านเอกสารรวม products/catalog (get เดี่ยว เปิดสาธารณะ) เอา "รายชื่อ id" มา
    //   แล้วอ่าน per-product doc ทีละชิ้นด้วย GET (กฎ allow get ใช้ได้แม้ list ถูกปิด) เพื่อ "ดึงรูป"
    //   ถ้าชิ้นไหนยังไม่มี doc (ยังไม่ซิงค์) ใช้ข้อมูลจากเอกสารรวมแทน (ไม่มีรูป)
    function fallbackCatalog() {
      if (out.length) return Promise.resolve();
      return fetch(base + "/catalog").then(function (r) { return r.ok ? r.json() : null; }).then(function (doc) {
        if (!doc || !doc.fields) return;
        var items = unwrapFs(doc.fields.items) || [];
        var results = new Array(items.length);
        return Promise.all(items.map(function (o, idx) {
          if (!o || !o.id) { return Promise.resolve(); }
          return fetch(base + "/" + encodeURIComponent(o.id)).then(function (r) {
            return r.ok ? r.json() : null;
          }).then(function (pdoc) {
            if (pdoc && pdoc.fields) {
              var full = {}; for (var k in pdoc.fields) full[k] = unwrapFs(pdoc.fields[k]);
              if (!full.id) full.id = o.id;
              results[idx] = full;        // มีรูปครบจาก per-product doc
            } else {
              results[idx] = o;           // ยังไม่มี doc → ใช้ข้อมูลรวม (ไม่มีรูป)
            }
          }).catch(function () { results[idx] = o; });
        })).then(function () {
          results.forEach(function (r) { if (r && r.id) out.push(r); });
        });
      }).catch(function () {});
    }
    return page(null).then(fallbackCatalog).then(function () {
      try { localStorage.setItem(KEY.cloudProducts, JSON.stringify(out)); } catch (e) {}
      dispatch();
      try { global.dispatchEvent(new CustomEvent("me-products-loaded")); } catch (e) {}
      return out.length;
    }).catch(function (err) { console.warn("[cloud products load]", err && err.message); return false; });
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
  function getCategories() {
    var st = getSettings();
    if (st && st.categories && st.categories.length) {
      return st.categories.map(function (c) {
        return { key: c.key, label: c.label, icon: c.icon || defaultCatIcon(c.key), image: c.image || "", hidden: !!c.hidden };
      });
    }
    return CATEGORIES.map(function (c) { return { key: c.key, label: c.label, icon: defaultCatIcon(c.key), image: "", hidden: false }; });
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
  function getProducts() {
    var local = read(KEY.products, []);
    if (!isOwner()) {
      var cloud = read(KEY.cloudProducts, null);
      if (cloud && cloud.length) return cloud;
      return local;
    }
    // เจ้าของ = master ในเครื่อง (เห็นการแก้ล่าสุดทันที) — แต่ถ้าเครื่องนี้ยังว่าง
    // (เพิ่งล็อกอินบนอุปกรณ์ใหม่ ของจริงอยู่ใน cloud) ให้ดึงแคตตาล็อก cloud มาแสดงแทน ไม่ให้เห็นร้านว่าง
    if (local.length) return local;
    var ownerCloud = read(KEY.cloudProducts, null);
    if (ownerCloud && ownerCloud.length) return ownerCloud;
    return local;
  }
  // เฉพาะข้อมูลในเครื่องเจ้าของ (ไม่สน cloud) — ใช้ตอนซิงค์ขึ้น cloud
  function getLocalProducts() { return read(KEY.products, []); }
  function getProduct(id) {
    return getProducts().filter(function (p) { return p.id === id; })[0] || null;
  }
  function available(p) { return Math.max(0, (p.stock || 0) - (p.rented || 0)); }

  function saveProduct(p) {
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
    if (hasPerm("inventory")) { cloudDeleteProductDoc(id); scheduleCatalogSync(); }
    return true;
  }
  // adjust physical stock by delta (+ receive, - shrink/sell off the books)
  function adjustStock(id, delta) {
    var p = getProduct(id);
    if (!p) return;
    p.stock = Math.max(0, (p.stock || 0) + delta);
    saveProduct(p);
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
      var order = {
        id: genId("ORD"), createdAt: Date.now(), type: mode,
        customer: customer, userEmail: userEmail, fulfillment: fulfillment,
        address: fulfillment === "delivery" ? checkout.address : null,
        items: items, days: days,
        subtotal: subtotal, deposit: deposit, shipping: thisShip,
        total: subtotal + deposit + thisShip,
        revenue: subtotal, cost: cost,
        paid: true, received: false, status: "paid",
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
  // Firebase config used by the chat: per-browser override (back office) wins,
  // else the committed FIREBASE_CONFIG (shared by every visitor → real online chat).
  function firebaseCfg() {
    var s = (getSettings().firebaseConfig || "").trim();
    if (s) return s;
    return FIREBASE_CONFIG ? JSON.stringify(FIREBASE_CONFIG) : "";
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
  function hasPerm(key) { var s = session(); if (!s) return false; if (s.role === "owner") return true; return !!(s.perms && s.perms[key]); }
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
    typeLabel: typeLabel, statusLabel: statusLabel, fulfillmentLabel: fulfillmentLabel,
    money: money, fmtDate: fmtDate, dateStr: dateStr, genId: genId,
    getProducts: getProducts, getProduct: getProduct, available: available, getLocalProducts: getLocalProducts,
    saveProduct: saveProduct, deleteProduct: deleteProduct, adjustStock: adjustStock,
    cloudLoadProducts: cloudLoadProducts, cloudSyncAllProducts: cloudSyncAllProducts, cloudPushProduct: cloudPushProduct,
    getCart: getCart, addToCart: addToCart, updateCartItem: updateCartItem,
    removeCartItem: removeCartItem, clearCart: clearCart,
    cartCount: cartCount, cartLines: cartLines, cartTotals: cartTotals,
    getOrders: getOrders, placeOrder: placeOrder, setOrderStatus: setOrderStatus, saveOrderMessage: saveOrderMessage,
    getMetrics: getMetrics, revenueByDay: revenueByDay,
    provinces: provinces, districtsOf: districtsOf, subdistrictsOf: subdistrictsOf, zipsOf: zipsOf,
    setGeoData: setGeoData,
    getShipRates: getShipRates, getShippingFee: getShippingFee, setShipRate: setShipRate,
    getSettings: getSettings, saveSettings: saveSettings, isOpenNow: isOpenNow, firebaseCfg: firebaseCfg,
    getUsers: getUsers, registerUser: registerUser, loginUser: loginUser, socialUpsert: socialUpsert,
    registerUserCloud: registerUserCloud, loginUserCloud: loginUserCloud, loginGoogleCloud: loginGoogleCloud, loadFirebaseAuthAndDb: loadFirebaseAuthAndDb,
    cloudLoadAdminData: cloudLoadAdminData, cloudPushAdminData: cloudPushAdminData,
    cloudLoadPublicSettings: cloudLoadPublicSettings,
    getStaff: getStaff, saveStaffMember: saveStaffMember, deleteStaff: deleteStaff,
    session: session, isStaff: isStaff, isOwner: isOwner, hasPerm: hasPerm, PERM_KEYS: PERM_KEYS, PERM_DEFS: PERM_DEFS,
    logout: logout, requirePerm: requirePerm, checkPin: checkPin,
    ensureAdminRegistered: ensureAdminRegistered, absorbCloudOrders: absorbCloudOrders,
    deleteOrder: deleteOrder, deletePurchase: deletePurchase,
    getLedger: getLedger, saveLedgerEntry: saveLedgerEntry, deleteLedgerEntry: deleteLedgerEntry,
    getSuppliers: getSuppliers, saveSupplier: saveSupplier, deleteSupplier: deleteSupplier,
    getPurchases: getPurchases, receivePurchase: receivePurchase, getPnL: getPnL,
    chatPushUser: chatPushUser, chatPushBot: chatPushBot, chatReplyShop: chatReplyShop,
    chatCurrent: chatCurrent, chatGetConv: chatGetConv, chatConvId: chatConvId, chatList: chatList, chatDelete: chatDelete,
    resetAll: resetAll, onChange: onChange,
  };
})(window);
