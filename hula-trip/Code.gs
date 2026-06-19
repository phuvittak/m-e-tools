/**
 * ระบบลงทะเบียนทริป Hula Hula — ฝั่งเซิร์ฟเวอร์ (Google Apps Script Web App)
 * ------------------------------------------------------------------
 * อ่านข้อมูลตรงจาก Google Sheets (แปลงมาจาก Excel ครั้งเดียว) แล้วกรองเฉพาะรหัสที่กรอก
 * ผลการลงทะเบียนบันทึกในสเปรดชีตของผู้ deploy เอง (สร้างให้อัตโนมัติ)
 */

// ===== แหล่งข้อมูล: ลิงก์ Google Sheets (เนทีฟ) ที่แปลงจาก Excel แล้ว =====
var SOURCE_URL = 'วางลิงก์ Google Sheets ตรงนี้';
var MIN_INVEST = 1000;
var FOOD_OPTIONS = ['ปกติ', 'อาหารเจ', 'อาหารมังสวิรัติ', 'อาหารมุสลิม'];
var THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var TIERS = [
  { min:30000, room:'Presidential suite', followers:6 },
  { min:20000, room:'Family suite (Premium)', followers:5 },
  { min:15000, room:'Family suite', followers:4 },
  { min:10000, room:'Deluxe room', followers:3 },
  { min:5000,  room:'Superior room', followers:2 },
  { min:3000,  room:'Standard room', followers:1 },
  { min:1000,  room:'Standard room', followers:0 }
];

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('ระบบลงทะเบียนทริป Hula Hula')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://ssl.gstatic.com/docs/script/images/favicon.png');
}

// ===== helpers =====
function normCode_(v){ return String(v==null?'':v).replace(/\s+/g,'').trim(); }
function isCode_(v){ v=String(v||'').trim(); return /^[A-Za-z0-9]{6,8}$/.test(v) && /[A-Za-z]/.test(v) && /[0-9]/.test(v); }
function isId_(v){ return /^\d-\d{4}-\d{5}-\d{2}-\d$/.test(String(v||'').trim()); }
function parseAmount_(v){ return Number(String(v==null?'':v).replace(/[^0-9.]/g,'')) || 0; }
function money_(n){ var x=Number(n)||0; return x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function thaiDisp_(d, raw){ return d ? (d.getDate()+' '+THAI_MONTHS[d.getMonth()]+' '+(d.getFullYear()+543)) : String(raw||''); }
function food_(v){ return FOOD_OPTIONS.indexOf(v)>=0 ? v : FOOD_OPTIONS[0]; }

function parseThaiDate_(v){
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v||'').trim();
  var m = s.match(/^(\d{1,2})\s+(\S+)\s+(\d{2,4})$/);
  if (m){
    var day=+m[1], mon=THAI_MONTHS.indexOf(m[2]), yr=+m[3];
    if (mon<0) return null;
    if (yr<100) yr += 2500;
    return new Date(yr-543, mon, day);
  }
  var d=new Date(s); return isNaN(d.getTime()) ? null : d;
}

// ===== อ่านข้อมูลตรงจาก Google Sheets ต้นทาง =====
function sourceSS_(){
  var m = String(SOURCE_URL||'').match(/[-\w]{25,}/);
  if (!m) throw new Error('ยังไม่ได้ตั้งค่า SOURCE_URL (วางลิงก์ Google Sheets)');
  return SpreadsheetApp.openById(m[0]);
}

/** หาแท็บฐานข้อมูลสมาชิก: แท็บที่มี "รหัส" และอีก 3 ช่องเป็น "เลขบัตรประชาชน" */
function findMaster_(){
  var sheets = sourceSS_().getSheets();
  for (var s=0; s<sheets.length; s++){
    var vals = sheets[s].getDataRange().getValues();
    for (var r=0; r<Math.min(vals.length,12); r++){
      var row = vals[r];
      for (var j=0; j+3<row.length; j++){
        if (isCode_(row[j]) && isId_(row[j+3])) return { values:vals, ci:j };
      }
    }
  }
  return null;
}

function getMemberData(code){
  var c = normCode_(code);
  if (!c) return { found:false, message:'กรุณากรอกรหัสสมาชิก' };
  var m = findMaster_();
  if (!m) return { found:false, message:'อ่านฐานข้อมูลไม่สำเร็จ (ตรวจลิงก์/สิทธิ์ชีต)' };

  var ci = m.ci, info = null, transfers = [], total = 0;
  for (var r=0; r<m.values.length; r++){
    var row = m.values[r];
    if (normCode_(row[ci]) !== c) continue;
    if (!info){
      info = { title:String(row[ci+1]||'').trim(), name:String(row[ci+2]||'').trim(),
        idcard:String(row[ci+3]||'').trim(), account:String(row[ci+4]||'').trim(),
        bank:String(row[ci+5]||'').trim(), branch:String(row[ci+6]||'').trim(), phone:String(row[ci+7]||'').trim() };
    }
    var amt = parseAmount_(row[ci+10]); total += amt;
    var d = parseThaiDate_(row[ci+8]);
    transfers.push({ date:thaiDisp_(d,row[ci+8]), time:String(row[ci+9]||'').trim(), amount:money_(amt), _k:(d?d.getTime():0) });
  }
  if (!info) return { found:false, message:'ไม่พบรหัสสมาชิกนี้ในระบบ' };

  transfers.sort(function(a,b){ return a._k-b._k; });
  var fullName = (info.title + (info.name ? (info.title?' ':'')+info.name : '')).trim();
  var bankLine = info.bank + (info.branch?(' ('+info.branch+')'):'') + (info.account?(' เลขที่: '+info.account):'');
  return {
    found:true, eligible: total>=MIN_INVEST, minInvest: money_(MIN_INVEST), code:c,
    name: fullName, idCard: info.idcard, phone: info.phone, bank: bankLine,
    updatedAt: Utilities.formatDate(new Date(),'Asia/Bangkok','HH:mm:ss')+' น.',
    count: transfers.length, total: money_(total), tier: computeTier_(total),
    transfers: transfers, foodOptions: FOOD_OPTIONS
  };
}

function computeTier_(total){
  for (var i=0;i<TIERS.length;i++){
    if (total>=TIERS[i].min){ var t=TIERS[i];
      return { room:t.room, followers:t.followers,
        note:'ได้เข้าพักห้อง '+t.room+(t.followers>0?' ผู้ติดตาม '+t.followers+' ท่าน':' (ไม่มีสิทธิ์พาผู้ติดตาม)') }; }
  }
  return { room:'-', followers:0, note:'ยอดลงทุนยังไม่ถึงเกณฑ์รับสิทธิ์ทริป' };
}

function pingServer(){
  var m = findMaster_();
  if (!m) return { ok:false };
  var ci=m.ci, set={};
  for (var r=0;r<m.values.length;r++){ var v=m.values[r][ci]; if (isCode_(v)) set[normCode_(v)]=1; }
  return { ok:true, members:Object.keys(set).length };
}

// ===== บันทึกการลงทะเบียนทริป (สเปรดชีตของผู้ deploy เอง) =====
function regSheet_(){
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('HULA_REG_ID'), ss = null;
  if (id){ try { ss = SpreadsheetApp.openById(id); } catch(e){ ss = null; } }
  if (!ss){ ss = SpreadsheetApp.create('Hula Hula - การลงทะเบียนทริป'); props.setProperty('HULA_REG_ID', ss.getId()); }
  var sh = ss.getSheets()[0];
  if (sh.getLastRow()===0){
    sh.appendRow(['เวลาบันทึก','รหัสสมาชิก','ชื่อ-นามสกุล','อาหาร(สมาชิก)','ของรางวัลที่เลือก','ผู้ติดตาม (ชื่อ+อาหาร)','จำนวนผู้ติดตาม']);
  }
  return sh;
}
function getRegSheetUrl(){ return regSheet_().getParent().getUrl(); }

function submitRegistration(p){
  p = p || {};
  var d = getMemberData(p.code);
  if (!d.found)    return { ok:false, message:'ไม่พบรหัสสมาชิก' };
  if (!d.eligible) return { ok:false, message:'ยอดลงทุนรวมต้องตั้งแต่ '+d.minInvest+' บาทขึ้นไปจึงลงทะเบียนได้' };
  var maxF = d.tier.followers;
  var fol = (p.followers||[]).slice(0,maxF).filter(function(x){ return x && String(x.name||'').trim(); });
  var folStr = fol.map(function(x,i){ return (i+1)+'. '+String(x.name).trim()+' ('+food_(x.food)+')'; }).join(' | ');
  regSheet_().appendRow([ new Date(), d.code, d.name, food_(p.ownerFood), p.phonePrize||'', folStr, fol.length ]);
  return { ok:true, message:'บันทึกการลงทะเบียนทริปเรียบร้อยแล้ว ✓', room:d.tier.room };
}
