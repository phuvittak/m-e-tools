/**
 * ระบบลงทะเบียนทริป Hula Hula — Google Apps Script Web App
 * ------------------------------------------------------------------
 * สายข้อมูล (data pipeline):
 *   1) Excel (.xlsx)  ──importExcel()──▶  Google Sheets (ชีตทำงาน)
 *   2) Google Sheets  ──getMemberData()─▶  เว็บ (หน้า Index.html)
 *   3) เว็บ            ──exportMemberExcel()/exportMemberPdf()──▶  Excel/PDF เฉพาะของสมาชิกคนนั้น
 *
 * โครงสร้างชีต (สร้างอัตโนมัติด้วย seedSampleData()):
 *   - "Members"        : RegCode | Name | IDCard | Phone | Bank
 *   - "Investments"    : RegCode | Date | Time | Amount
 *   - "Registrations"  : ผลลัพธ์จากฟอร์มลงทะเบียนทริป (เว็บเขียนกลับเข้าชีต)
 */

// ====== ค่าคงที่ ======
var SHEET_MEMBERS = 'Members';
var SHEET_INVEST = 'Investments';
var SHEET_REG = 'Registrations';

// ยอดลงทุนรวมขั้นต่ำที่เปิดให้ตรวจสอบ/ลงทะเบียนได้ (บาท)
var MIN_INVEST = 1000;

// ตัวเลือกประเภทอาหาร (ใช้ตรวจสอบฝั่งเซิร์ฟเวอร์)
var FOOD_OPTIONS = ['ปกติ', 'อาหารเจ', 'อาหารมังสวิรัติ', 'อาหารมุสลิม'];

// ตารางสิทธิ์แพ็กเกจทริป (เรียงจากยอดสูง→ต่ำ) ประเมินจากยอดรวมลงทุน
var TIERS = [
  { min: 30000, room: 'Presidential suite', followers: 6 },
  { min: 20000, room: 'Family suite (Premium)', followers: 5 },
  { min: 15000, room: 'Family suite', followers: 4 },
  { min: 10000, room: 'Deluxe room', followers: 3 },
  { min: 5000,  room: 'Superior room', followers: 2 },
  { min: 3000,  room: 'Standard room', followers: 1 },
  { min: 1000,  room: 'Standard room', followers: 0 }
];

var THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ====== Web app entry ======
function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.initialCode = (e && e.parameter && e.parameter.code) ? String(e.parameter.code) : '';
  return t.evaluate()
    .setTitle('ระบบลงทะเบียนทริป Hula Hula')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://ssl.gstatic.com/docs/script/images/favicon.png');
}

/** ใช้ฝัง partial HTML (เผื่อไว้) */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// ====== Spreadsheet helpers ======
/** คืนสเปรดชีตทำงาน — ใช้ Script Property "HULA_SPREADSHEET_ID" ถ้าตั้งไว้, ไม่งั้นใช้ชีตที่ผูกกับสคริปต์ */
function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('HULA_SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('ยังไม่ได้ตั้งค่า HULA_SPREADSHEET_ID และไม่มีสเปรดชีตที่ผูกกับสคริปต์');
}

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/** อ่านชีตเป็น array ของ object โดยใช้แถวแรกเป็นหัวคอลัมน์ */
function readObjects_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    var o = {};
    for (var c = 0; c < head.length; c++) o[head[c]] = row[c];
    rows.push(o);
  }
  return rows;
}

function normCode_(code) {
  return String(code == null ? '' : code).replace(/\s+/g, '').trim();
}

function thaiDate_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return String(d || '');
  return d.getDate() + ' ' + THAI_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

function thaiTime_(t) {
  if (t instanceof Date && !isNaN(t.getTime())) {
    return Utilities.formatDate(t, 'Asia/Bangkok', 'HH:mm') + ' น.';
  }
  return String(t || '');
}

function money_(n) {
  var x = Number(n) || 0;
  return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ====== อ่านข้อมูลสมาชิก (Google Sheets → เว็บ) ======
function getMemberData(code) {
  var c = normCode_(code);
  if (!c) return { found: false, message: 'กรุณากรอกเลขทะเบียน' };

  var members = readObjects_(SHEET_MEMBERS);
  var member = null;
  for (var i = 0; i < members.length; i++) {
    if (normCode_(members[i].RegCode) === c) { member = members[i]; break; }
  }
  if (!member) return { found: false, message: 'ไม่พบเลขทะเบียนนี้ในระบบ' };

  // รวมรายการลงทุนของสมาชิกคนนี้
  var invest = readObjects_(SHEET_INVEST).filter(function (r) {
    return normCode_(r.RegCode) === c;
  });

  var total = 0;
  var transfers = invest.map(function (r) {
    var amt = Number(r.Amount) || 0;
    total += amt;
    var dt = (r.Date instanceof Date) ? r.Date : new Date(r.Date);
    return {
      date: thaiDate_(dt),
      time: thaiTime_(r.Time),
      amount: money_(amt),
      _raw: amt,
      _sortKey: (dt instanceof Date && !isNaN(dt.getTime())) ? dt.getTime() : 0
    };
  }).sort(function (a, b) { return a._sortKey - b._sortKey; });

  var eligible = total >= MIN_INVEST;

  return {
    found: true,
    eligible: eligible,
    minInvest: money_(MIN_INVEST),
    code: c,
    name: String(member.Name || ''),
    idCard: String(member.IDCard || ''),
    phone: String(member.Phone || ''),
    bank: String(member.Bank || ''),
    updatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HH:mm:ss') + ' น.',
    count: transfers.length,
    total: money_(total),
    tier: computeTier_(total),
    transfers: transfers,
    foodOptions: FOOD_OPTIONS
  };
}

function computeTier_(total) {
  for (var i = 0; i < TIERS.length; i++) {
    if (total >= TIERS[i].min) {
      var t = TIERS[i];
      return {
        room: t.room,
        followers: t.followers,
        note: 'ได้เข้าพักห้อง ' + t.room +
              (t.followers > 0 ? ' ผู้ติดตาม ' + t.followers + ' ท่าน' : ' (ไม่มีสิทธิ์พาผู้ติดตาม)')
      };
    }
  }
  return { room: '-', followers: 0, note: 'ยอดลงทุนยังไม่ถึงเกณฑ์รับสิทธิ์ทริป' };
}

// ====== บันทึกการลงทะเบียนทริป (เว็บ → Google Sheets) ======
function submitRegistration(payload) {
  payload = payload || {};
  var data = getMemberData(payload.code);
  if (!data.found) return { ok: false, message: 'ไม่พบเลขทะเบียน' };
  if (!data.eligible) {
    return { ok: false, message: 'ยอดลงทุนรวมต้องตั้งแต่ ' + data.minInvest + ' บาทขึ้นไปจึงจะลงทะเบียนได้' };
  }

  var maxF = data.tier.followers;
  var followers = (payload.followers || []).slice(0, maxF);

  // ตรวจประเภทอาหารให้อยู่ในตัวเลือกที่กำหนด
  function food(v) { return FOOD_OPTIONS.indexOf(v) >= 0 ? v : FOOD_OPTIONS[0]; }

  var sh = sheet_(SHEET_REG);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp', 'RegCode', 'OwnerName', 'OwnerFood', 'PhonePrize',
      'F1Name', 'F1Food', 'F2Name', 'F2Food', 'F3Name', 'F3Food', 'F4Name', 'F4Food']);
  }

  var f = [];
  for (var i = 0; i < 4; i++) {
    var item = followers[i] || {};
    f.push(item.name || '');
    f.push(item.name ? food(item.food) : '');
  }

  sh.appendRow([
    new Date(), data.code, data.name, food(payload.ownerFood),
    payload.phonePrize || '',
    f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7]
  ]);

  return { ok: true, message: 'บันทึกการลงทะเบียนทริปเรียบร้อยแล้ว ✓', room: data.tier.room };
}

// ====== Excel → Google Sheets (นำเข้า) ======
/**
 * นำเข้าไฟล์ Excel (.xlsx) แล้วแทนที่ข้อมูลในชีต Members/Investments
 * @param {string} base64  เนื้อไฟล์ Excel เข้ารหัส base64
 * @param {string} filename ชื่อไฟล์
 */
function importExcel(base64, filename) {
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename || 'upload.xlsx');

  // แปลง Excel เป็น Google Spreadsheet ชั่วคราว
  var file = Drive.Files.insert(
    { title: 'hula-import-temp', mimeType: MimeType.GOOGLE_SHEETS },
    blob, { convert: true });

  try {
    var src = SpreadsheetApp.openById(file.id);
    var imported = {};
    [SHEET_MEMBERS, SHEET_INVEST].forEach(function (name) {
      var s = src.getSheetByName(name);
      if (!s) return;
      var values = s.getDataRange().getValues();
      var dst = sheet_(name);
      dst.clearContents();
      if (values.length) {
        dst.getRange(1, 1, values.length, values[0].length).setValues(values);
      }
      imported[name] = Math.max(0, values.length - 1);
    });
    return {
      ok: true,
      message: 'นำเข้าจาก Excel สำเร็จ',
      members: imported[SHEET_MEMBERS] || 0,
      investments: imported[SHEET_INVEST] || 0
    };
  } finally {
    Drive.Files.remove(file.id); // ลบไฟล์ชั่วคราว
  }
}

// ====== Google Sheets → Excel / PDF (ส่งออกเฉพาะสมาชิก) ======
/** สร้างสเปรดชีตชั่วคราวที่บรรจุข้อมูลของสมาชิกคนเดียว แล้วคืน id */
function buildMemberWorkbook_(data) {
  var ss = SpreadsheetApp.create('Hula-' + data.code);
  var info = ss.getActiveSheet().setName('ข้อมูลสมาชิก');
  info.getRange('A1').setValue('ระบบลงทะเบียนทริป Hula Hula').setFontWeight('bold').setFontSize(14);
  info.getRange('A3:B8').setValues([
    ['เลขทะเบียน', data.code],
    ['ชื่อ-นามสกุล', data.name],
    ['เลขบัตรประชาชน', data.idCard],
    ['เบอร์โทรศัพท์', data.phone],
    ['ข้อมูลบัญชี', data.bank],
    ['สิทธิ์แพ็กเกจทริป', data.tier.note]
  ]);
  info.getRange('A3:A8').setFontWeight('bold');

  info.getRange('A10').setValue('จำนวนการลงทุน').setFontWeight('bold');
  info.getRange('B10').setValue(data.count + ' ครั้ง');
  info.getRange('A11').setValue('ยอดรวมลงทุนทั้งหมด').setFontWeight('bold');
  info.getRange('B11').setValue(data.total + ' บาท');

  var hist = ss.insertSheet('ประวัติการลงทุน');
  hist.appendRow(['วันที่โอน', 'เวลาโอน', 'ยอดเงิน (บาท)']);
  hist.getRange('A1:C1').setFontWeight('bold');
  data.transfers.forEach(function (t) { hist.appendRow([t.date, t.time, t.amount]); });

  info.autoResizeColumns(1, 2);
  hist.autoResizeColumns(1, 3);
  SpreadsheetApp.flush();
  return ss.getId();
}

function exportMemberExcel(code) {
  var data = getMemberData(code);
  if (!data.found) return { ok: false, message: 'ไม่พบเลขทะเบียน' };
  var id = buildMemberWorkbook_(data);
  try {
    var url = 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx';
    var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
    return {
      ok: true,
      filename: 'Hula-' + data.code + '.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Utilities.base64Encode(resp.getBlob().getBytes())
    };
  } finally {
    DriveApp.getFileById(id).setTrashed(true);
  }
}

function exportMemberPdf(code) {
  var data = getMemberData(code);
  if (!data.found) return { ok: false, message: 'ไม่พบเลขทะเบียน' };
  var id = buildMemberWorkbook_(data);
  try {
    var url = 'https://docs.google.com/spreadsheets/d/' + id +
      '/export?format=pdf&size=A4&portrait=true&fitw=true&gridlines=false';
    var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
    return {
      ok: true,
      filename: 'Hula-' + data.code + '.pdf',
      mime: 'application/pdf',
      base64: Utilities.base64Encode(resp.getBlob().getBytes())
    };
  } finally {
    DriveApp.getFileById(id).setTrashed(true);
  }
}

function getSpreadsheetUrl() {
  return ss_().getUrl();
}

// ====== ข้อมูลตัวอย่าง (รันครั้งเดียวเพื่อทดสอบ) ======
function seedSampleData() {
  var ss = ss_();

  var m = ss.getSheetByName(SHEET_MEMBERS) || ss.insertSheet(SHEET_MEMBERS);
  m.clearContents();
  m.getRange(1, 1, 2, 5).setValues([
    ['RegCode', 'Name', 'IDCard', 'Phone', 'Bank'],
    ['1001', 'นางสาวกนกทิพย์ ปฐมกนกพงศ์', '3-7301-00471-39-9', '098-592-4564',
      'ไทยพาณิชย์ (ไทรน้อย จันทบุรี) เลขที่: 854-2-46671-0']
  ]);

  var inv = ss.getSheetByName(SHEET_INVEST) || ss.insertSheet(SHEET_INVEST);
  inv.clearContents();
  var rows = [['RegCode', 'Date', 'Time', 'Amount']];
  var samples = [
    ['2026-05-10', '11:39', 1000],
    ['2026-05-10', '17:21', 1000],
    ['2026-05-11', '10:02', 2000],
    ['2026-05-11', '18:39', 1000],
    ['2026-05-11', '11:36', 1000],
    ['2026-05-12', '09:15', 1000],
    ['2026-05-12', '14:02', 1000],
    ['2026-05-13', '10:48', 2000],
    ['2026-05-14', '16:20', 1000],
    ['2026-05-15', '08:55', 1000],
    ['2026-05-16', '19:30', 1000],
    ['2026-05-17', '12:10', 1000],
    ['2026-05-18', '13:45', 1000],
    ['2026-05-19', '20:05', 2000],
    ['2026-05-20', '09:40', 1000]
  ];
  samples.forEach(function (s) { rows.push(['1001', new Date(s[0]), s[1], s[2]]); });
  inv.getRange(1, 1, rows.length, 4).setValues(rows);

  var reg = ss.getSheetByName(SHEET_REG) || ss.insertSheet(SHEET_REG);
  if (reg.getLastRow() === 0) {
    reg.appendRow(['Timestamp', 'RegCode', 'OwnerName', 'OwnerFood', 'PhonePrize',
      'F1Name', 'F1Food', 'F2Name', 'F2Food', 'F3Name', 'F3Food', 'F4Name', 'F4Food']);
  }

  return 'สร้างข้อมูลตัวอย่างเรียบร้อย — ทดสอบเข้าระบบด้วยเลขทะเบียน 1001';
}
