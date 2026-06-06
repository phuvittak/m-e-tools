/* =====================================================================
   M.E.Tools — Broadcast promo to ALL friends (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ส่งแบนเนอร์โปรโมชั่นหา "เพื่อนทุกคน" อัตโนมัติ
   ปัจจุบันเชื่อมต่อช่องทาง LINE (broadcast หาเพื่อนทั้งหมดของ OA)
   — Messenger / IG ยังไม่ได้เชื่อมบอท จึงยังส่งไม่ได้ (โครงสร้างรองรับเพิ่มภายหลัง)

   2 โหมด:
   1) อัตโนมัติ (cron):  GET — Vercel cron เรียกทุกวัน ถ้าวันนี้ = วันเริ่มโปร
        และเปิด "ส่งอัตโนมัติ" ไว้ → broadcast ครั้งเดียว (กันซ้ำด้วยเงื่อนไขวันที่)
   2) ส่งเอง (ปุ่มในหลังร้าน):  POST + Authorization: Bearer <Firebase ID token ของแอดมิน>
        → broadcast ทันที

   ENV ที่ใช้:  LINE_CHANNEL_ACCESS_TOKEN (จำเป็น), CRON_SECRET (ไม่บังคับ — ถ้าตั้ง
   จะบังคับให้ cron ส่ง header Authorization: Bearer <CRON_SECRET>)
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const SITE = 'https://metoolsshop.vercel.app';

/* ---------- auth (มิเรอร์จาก admin-reply.js) ---------- */
function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1] || '';
    const padded = part + '='.repeat((4 - part.length % 4) % 4);
    return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch { return null; }
}
async function isAdminUid(uid) {
  if (!uid) return false;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/admins/${encodeURIComponent(uid)}`;
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}
async function isAdminReq(req) {
  const hdr = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = hdr.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || payload.aud !== FIREBASE_PROJECT) return false;
  if (payload.exp && payload.exp < Date.now() / 1000) return false;
  return isAdminUid(payload.user_id || payload.sub || '');
}

/* ---------- helpers ---------- */
// วันที่วันนี้ "YYYY-MM-DD" ตามเวลาไทย (UTC+7) — ให้ตรงกับวันที่ที่เจ้าของตั้งในหลังร้าน
function thaiToday() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
// อ่าน promo จาก admin_data/me_settings (public read)
async function getPromo() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/admin_data/me_settings`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const doc = await r.json();
    const value = doc && doc.fields && doc.fields.value;
    const pf = value && value.mapValue && value.mapValue.fields && value.mapValue.fields.promo;
    const f = pf && pf.mapValue && pf.mapValue.fields;
    if (!f) return null;
    // links = array ของ {label,url}
    const links = [];
    const lf = f.links && f.links.arrayValue && f.links.arrayValue.values;
    if (Array.isArray(lf)) {
      lf.forEach((it) => {
        const m = it && it.mapValue && it.mapValue.fields;
        if (!m) return;
        const label = (m.label && m.label.stringValue) || '';
        const u = (m.url && m.url.stringValue) || '';
        if (u) links.push({ label, url: u });
      });
    }
    return {
      enabled: !!(f.enabled && f.enabled.booleanValue),
      autoBroadcast: !!(f.autoBroadcast && f.autoBroadcast.booleanValue),
      title: (f.title && f.title.stringValue) || '',
      text: (f.text && f.text.stringValue) || '',
      image: (f.image && f.image.stringValue) || '',
      startDate: (f.startDate && f.startDate.stringValue) || '',
      endDate: (f.endDate && f.endDate.stringValue) || '',
      links,
      dateText: (f.dateText && f.dateText.stringValue) || '',
      conditions: (f.conditions && f.conditions.stringValue) || '',
      anchorDate: (f.anchorDate && f.anchorDate.stringValue) || '',
      spanDays: (f.spanDays && (f.spanDays.integerValue != null ? +f.spanDays.integerValue : (f.spanDays.doubleValue != null ? +f.spanDays.doubleValue : null))),
    };
  } catch { return null; }
}
// เติม token หัวข้อ/รายละเอียดตามวันที่โปรซ้ำ (ให้ตรงกับ store.js fillPromoTokens)
//   {dd} = เลขโปรซ้ำ เช่น 6.6 / 8.8 / 11.11   ·   {date} = วันที่ไทยสั้น เช่น "6 มิ.ย."
const THAI_MON_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const isYmd = (s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s);
function addDaysStr(ymd, n) {
  const p = ymd.split('-'), dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
}
// ช่วงโปรที่ใช้จริง: anchorDate → [anchor-span, anchor+span]; ไม่งั้น start/end ที่ตั้งมือ
function promoWindow(promo) {
  const span = (promo && promo.spanDays != null && promo.spanDays !== '') ? +promo.spanDays : 3;
  if (promo && isYmd(promo.anchorDate)) {
    return { start: addDaysStr(promo.anchorDate, -span), end: addDaysStr(promo.anchorDate, span) };
  }
  return { start: (promo && promo.startDate) || '', end: (promo && promo.endDate) || '' };
}
function fillPromoTokens(str, promo) {
  if (!str) return str || '';
  let m, d;
  const s = (promo && promo.anchorDate) || (promo && promo.startDate);
  if (isYmd(s)) { const p = s.split('-'); m = +p[1]; d = +p[2]; }
  else { const n = new Date(Date.now() + 7 * 3600 * 1000); m = n.getUTCMonth() + 1; d = n.getUTCDate(); }
  return String(str).replace(/\{dd\}/g, m + '.' + d).replace(/\{date\}/g, d + ' ' + THAI_MON_ABBR[m - 1]);
}
// แปลง promo → LINE messages (รูปแบนเนอร์ + ข้อความหลายช่องทาง) — เลย์เอาต์ตามตัวอย่างที่เจ้าของต้องการ
//   {title}
//
//   📌 {label} : {url}    (ทีละบรรทัด ตาม links)
//
//   👉 {dateText}
//   *{conditions}
function buildMessages(promo) {
  const messages = [];
  if (promo.image) {
    const u = `${SITE}/api/promo-image`;
    messages.push({ type: 'image', originalContentUrl: u, previewImageUrl: u });
  }
  const lines = [];
  if (promo.title) lines.push(fillPromoTokens(promo.title, promo));
  if (promo.text) lines.push(fillPromoTokens(promo.text, promo));
  const linkLines = (promo.links || []).map((l) => '📌 ' + (l.label ? l.label + ' : ' : '') + l.url);
  if (linkLines.length) { lines.push(''); linkLines.forEach((l) => lines.push(l)); }
  if (promo.dateText) { lines.push(''); lines.push('👉 ' + fillPromoTokens(promo.dateText, promo)); }
  if (promo.conditions) lines.push('*' + promo.conditions);
  // สำรอง: ถ้าไม่ได้ใส่ลิงก์ร้านเลย ใส่ลิงก์หน้าร้านให้
  if (!linkLines.length) { lines.push(''); lines.push('🛒 ดูสินค้า/โปรทั้งหมด: ' + SITE + '/shop.html'); }
  messages.push({ type: 'text', text: lines.join('\n').trim().slice(0, 4900) });
  return messages;
}
// ยิง broadcast เข้า LINE — ส่งหาเพื่อนทุกคนของ OA
async function lineBroadcast(messages) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 0, body: 'no-line-token' };
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ messages }),
    });
    const body = r.ok ? '' : (await r.text().catch(() => '')).slice(0, 200);
    return { ok: r.ok, status: r.status, body };
  } catch (e) { return { ok: false, status: 0, body: e && e.message }; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const promo = await getPromo();

  /* ----- โหมดส่งเอง: ปุ่มในหลังร้าน (POST + admin token) ----- */
  if (req.method === 'POST') {
    if (!(await isAdminReq(req))) { res.status(403).json({ error: 'not-admin' }); return; }
    if (!promo || !promo.enabled) { res.status(400).json({ error: 'promo-disabled', hint: 'เปิดใช้งานแบนเนอร์โปรก่อนส่ง' }); return; }
    const result = await lineBroadcast(buildMessages(promo));
    if (!result.ok) { res.status(502).json({ error: 'line-broadcast-failed', status: result.status, body: result.body }); return; }
    res.status(200).json({ ok: true, channel: 'line', mode: 'manual' });
    return;
  }

  /* ----- โหมดอัตโนมัติ: cron รายวัน (GET) ----- */
  if (req.method === 'GET') {
    // ถ้าตั้ง CRON_SECRET ไว้ ให้ตรวจ header กันคนนอกยิง
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const hdr = (req.headers['authorization'] || req.headers['Authorization'] || '').replace(/^Bearer\s+/i, '').trim();
      if (hdr !== secret) { res.status(401).json({ error: 'bad-cron-secret' }); return; }
    }
    if (!promo) { res.status(200).json({ ok: true, skipped: 'no-promo' }); return; }
    if (!promo.enabled || !promo.autoBroadcast) { res.status(200).json({ ok: true, skipped: 'auto-off' }); return; }
    // วันเริ่มจริง: ถ้าใช้โปรวันที่ซ้ำ = anchor-span, ไม่งั้น = วันเริ่มที่ตั้งมือ
    const effStart = promoWindow(promo).start;
    if (!effStart) { res.status(200).json({ ok: true, skipped: 'no-start-date' }); return; }
    // ส่งเฉพาะ "วันเริ่มโปร" เท่านั้น — cron ทำงานวันละครั้ง จึงส่งครั้งเดียวตามธรรมชาติ
    if (thaiToday() !== effStart) { res.status(200).json({ ok: true, skipped: 'not-start-day', today: thaiToday(), startDate: effStart }); return; }
    const result = await lineBroadcast(buildMessages(promo));
    if (!result.ok) { res.status(502).json({ error: 'line-broadcast-failed', status: result.status, body: result.body }); return; }
    res.status(200).json({ ok: true, channel: 'line', mode: 'auto', date: thaiToday() });
    return;
  }

  res.status(405).json({ error: 'method-not-allowed' });
}
