/* =====================================================================
   M.E.Tools — ตรวจสลิปโอนเงินอัตโนมัติ + กันโกง (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ลูกค้าโอน PromptPay แล้วอัปสลิป → ตรวจผ่าน slip2go (connect.slip2go.com)
   ส่งรูปสลิปแบบ Base64 ไปที่ /api/verify-slip/qr-base64/info แล้วอุดช่องโหว่:
     ✓ เป็นสลิปจริง (slip2go ตรวจ QR กับธนาคารให้ — code 200404/200500 = ปลอม)
     ✓ กันสลิปซ้ำ (checkDuplicate:true → code 200501; + backup ใน Firestore slip_refs)
     ✓ ยอดเงินตรง (paid >= ยอดที่ต้องชำระ — เช็กจาก data.amount)
     ✓ ผู้รับตรงร้าน (เทียบกับ SLIP_RECEIVER ถ้าตั้งไว้ — เช็กจาก data.receiver)
     ✓ สลิปไม่เก่าเกินไป (ภายใน SLIP_MAX_AGE_HOURS, ค่าเริ่ม 48 ชม.)

   ENV:
     SLIP2GO_TOKEN       = Secret Key จาก slip2go.com (จำเป็น) — แปะเป็น Bearer token
     SLIP2GO_BASE_URL    = โฮสต์ API (ไม่บังคับ, ค่าเริ่ม https://connect.slip2go.com)
     SLIP_RECEIVER       = ชื่อ/เลขบัญชี/พร็อกซีของร้าน (บางส่วน) ไว้เช็กผู้รับ (แนะนำตั้ง)
     SLIP_MAX_AGE_HOURS  = อายุสลิปสูงสุด (ชม.) ไม่บังคับ
   ไม่ตั้ง SLIP2GO_TOKEN → configured:false (หน้าเว็บ fallback "ส่งให้ร้านตรวจเอง")

   ผลลัพธ์ (contract เดิม ไม่ต้องแก้หน้าเว็บ):
     { verified, configured, amount, receiver, ref, message }
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';
const SLIP2GO_BASE = (process.env.SLIP2GO_BASE_URL || 'https://connect.slip2go.com').replace(/\/+$/, '');

// กันสลิปซ้ำ (backup): สร้าง doc slip_refs/{ref} แบบ create-only — ถ้ามีอยู่แล้ว = เคยใช้
async function claimSlipRef(ref) {
  const safe = String(ref).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200);
  if (!safe) return { ok: true }; // ไม่มี ref ให้กัน — ปล่อยผ่าน (พึ่ง checkDuplicate ของ slip2go)
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIRESTORE_DB}/documents/slip_refs?documentId=${encodeURIComponent(safe)}`;
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { at: { timestampValue: new Date().toISOString() } } }),
    });
    if (r.status === 409) return { ok: false, dup: true };      // ALREADY_EXISTS = ใช้ซ้ำ
    return { ok: r.ok };
  } catch { return { ok: true }; } // เน็ตล่ม — อย่าบล็อกการขาย
}

// รวบข้อความผู้รับจากหลาย field เพื่อเทียบกับ SLIP_RECEIVER (ชื่อ/เลขบัญชี/พร็อกซี)
function receiverHaystack(rcv) {
  const acc = (rcv && rcv.account) || {};
  return [
    acc.name,
    acc.bank && acc.bank.account,
    acc.proxy && acc.proxy.account,
    rcv && rcv.bank && rcv.bank.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const token = process.env.SLIP2GO_TOKEN || process.env.EASYSLIP_TOKEN; // EASYSLIP_TOKEN: เผื่อชื่อเดิมที่เคยตั้งไว้
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const amount = Number(body.amount) || 0;
  const image = String(body.image || '').trim();

  if (!token) { res.status(200).json({ verified: false, configured: false, message: 'ร้านยังไม่ได้เปิดตรวจสลิปอัตโนมัติ' }); return; }
  if (!image) { res.status(400).json({ verified: false, configured: true, message: 'ไม่พบรูปสลิป' }); return; }

  // slip2go รับ imageBase64 พร้อม prefix "data:image/...;base64," ได้เลย
  const imageBase64 = /^data:image\/[\w.+-]+;base64,/.test(image) ? image : ('data:image/jpeg;base64,' + image);

  try {
    const r = await fetch(`${SLIP2GO_BASE}/api/verify-slip/qr-base64/info`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { imageBase64, checkCondition: { checkDuplicate: true } } }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    const code = String((j && j.code) || '');
    const d = (j && j.data) || null;

    // จัดการรหัสสถานะ slip2go ที่ "ไม่ผ่าน" ก่อน
    const REJECT = {
      '200401': 'บัญชีผู้รับในสลิปไม่ตรงกับร้าน',
      '200402': 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
      '200403': 'วันที่โอนไม่อยู่ในเงื่อนไข',
      '200404': 'ไม่พบสลิปนี้ในระบบธนาคาร (อาจเป็นสลิปปลอม)',
      '200500': 'สลิปนี้ถูกตัดต่อ/ปลอมแปลง',
      '200501': 'สลิปนี้ถูกใช้ยืนยันไปแล้ว (ใช้ซ้ำไม่ได้)',
      '200502': 'ระบบธนาคารขัดข้อง กรุณาลองใหม่อีกครั้ง',
    };
    if (REJECT[code]) { res.status(200).json({ verified: false, configured: true, message: REJECT[code] }); return; }

    // สำเร็จ = อ่านสลิปจริงได้ (200000 Slip Found / 200200 Slip is Valid)
    const okCode = code === '200000' || code === '200200';
    if (!r.ok || !okCode || !d) {
      const msg = (j && j.message) || 'อ่านสลิปไม่ได้';
      res.status(200).json({ verified: false, configured: true, message: 'สลิปไม่ถูกต้องหรืออ่านไม่ได้ (' + msg + ')' });
      return;
    }

    const paid = Number(d.amount) || 0;
    const rcv = d.receiver || {};
    const receiver = (rcv.account && rcv.account.name) || (rcv.bank && rcv.bank.name) || '';
    const ref = d.transRef || d.referenceId || '';
    const when = d.dateTime ? new Date(d.dateTime).getTime() : 0;

    // 1) ยอดเงิน — สลิปต้องโอนไม่น้อยกว่ายอดที่ต้องชำระ
    if (amount > 0 && paid + 0.01 < amount) {
      res.status(200).json({ verified: false, configured: true, amount: paid, message: 'ยอดในสลิป (' + paid + ') น้อยกว่ายอดที่ต้องชำระ (' + amount + ')' });
      return;
    }
    // 2) ผู้รับตรงร้าน
    const expect = (process.env.SLIP_RECEIVER || '').trim();
    if (expect && receiverHaystack(rcv).indexOf(expect.toLowerCase()) < 0) {
      res.status(200).json({ verified: false, configured: true, amount: paid, receiver, message: 'บัญชีผู้รับในสลิปไม่ตรงกับร้าน' });
      return;
    }
    // 3) อายุสลิป
    const maxAgeH = Number(process.env.SLIP_MAX_AGE_HOURS) || 48;
    if (when && Date.now() - when > maxAgeH * 3600 * 1000) {
      res.status(200).json({ verified: false, configured: true, amount: paid, ref, message: 'สลิปเก่าเกินไป (เกิน ' + maxAgeH + ' ชม.) — ใช้สลิปการโอนครั้งล่าสุด' });
      return;
    }
    // 4) กันสลิปซ้ำ (backup เสริมจาก checkDuplicate ของ slip2go)
    const claim = await claimSlipRef(ref);
    if (claim.dup) {
      res.status(200).json({ verified: false, configured: true, amount: paid, ref, message: 'สลิปนี้ถูกใช้ยืนยันไปแล้ว (ใช้ซ้ำไม่ได้)' });
      return;
    }

    res.status(200).json({ verified: true, configured: true, amount: paid, receiver, ref, message: 'ยืนยันสลิปสำเร็จ' });
  } catch (e) {
    res.status(200).json({ verified: false, configured: true, message: 'ตรวจสลิปไม่สำเร็จ: ' + (e && e.message) });
  }
}
