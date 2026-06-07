/* =====================================================================
   M.E.Tools — ตรวจสลิปโอนเงินอัตโนมัติ + กันโกง (Vercel Node.js Function)
   ---------------------------------------------------------------------
   ลูกค้าโอน PromptPay แล้วอัปสลิป → ตรวจผ่าน EasySlip + อุดช่องโหว่:
     ✓ เป็นสลิปจริง (ตรวจ QR กับธนาคารผ่าน EasySlip)
     ✓ ยอดเงินตรง (paid >= ยอดที่ต้องชำระ)
     ✓ ผู้รับตรงร้าน (เทียบกับ SLIP_RECEIVER ถ้าตั้งไว้)
     ✓ สลิปไม่เก่าเกินไป (ภายใน SLIP_MAX_AGE_HOURS, ค่าเริ่ม 48 ชม.)
     ✓ กันสลิปซ้ำ (จำ transRef ใน Firestore slip_refs/{ref} — ใช้แล้วใช้อีกไม่ได้)

   ENV:
     EASYSLIP_TOKEN      = Bearer token จาก easyslip.com (จำเป็น)
     SLIP_RECEIVER       = ชื่อ/เลขบัญชี PromptPay ของร้าน (บางส่วน) ไว้เช็กผู้รับ (แนะนำตั้ง)
     SLIP_MAX_AGE_HOURS  = อายุสลิปสูงสุด (ชม.) ไม่บังคับ
   ไม่ตั้ง EASYSLIP_TOKEN → configured:false (หน้าเว็บ fallback "ส่งให้ร้านตรวจเอง")
   ===================================================================== */

const FIREBASE_PROJECT = 'metools-724dc';
const FIRESTORE_DB = 'default';

// กันสลิปซ้ำ: สร้าง doc slip_refs/{ref} แบบ create-only — ถ้ามีอยู่แล้ว = เคยใช้
async function claimSlipRef(ref) {
  const safe = String(ref).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200);
  if (!safe) return { ok: true }; // ไม่มี ref ให้กัน — ปล่อยผ่าน (พึ่งการเช็กอื่น)
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method-not-allowed' }); return; }

  const token = process.env.EASYSLIP_TOKEN;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const amount = Number(body.amount) || 0;
  const b64 = String(body.image || '').replace(/^data:image\/[\w.+-]+;base64,/, '').trim();

  if (!token) { res.status(200).json({ verified: false, configured: false, message: 'ร้านยังไม่ได้เปิดตรวจสลิปอัตโนมัติ' }); return; }
  if (!b64) { res.status(400).json({ verified: false, configured: true, message: 'ไม่พบรูปสลิป' }); return; }

  try {
    const r = await fetch('https://developer.easyslip.com/api/v1/verify', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64 }),
    });
    const j = await r.json().catch(() => ({}));
    const d = j && j.data;
    if (!r.ok || !d) {
      const msg = (j && (j.message || j.status)) || 'อ่านสลิปไม่ได้';
      res.status(200).json({ verified: false, configured: true, message: 'สลิปไม่ถูกต้องหรืออ่านไม่ได้ (' + msg + ')' });
      return;
    }
    const paid = Number(d.amount && (d.amount.amount != null ? d.amount.amount : d.amount)) || 0;
    const rcv = (d.receiver && d.receiver.account) || {};
    const receiver = (rcv.name && (rcv.name.th || rcv.name.en)) || rcv.value || '';
    const ref = d.transRef || d.ref || '';
    const when = d.date ? new Date(d.date).getTime() : 0;

    // 1) ยอดเงิน
    if (amount > 0 && paid + 0.01 < amount) {
      res.status(200).json({ verified: false, configured: true, amount: paid, message: 'ยอดในสลิป (' + paid + ') น้อยกว่ายอดที่ต้องชำระ (' + amount + ')' });
      return;
    }
    // 2) ผู้รับตรงร้าน
    const expect = (process.env.SLIP_RECEIVER || '').trim();
    if (expect && JSON.stringify(d.receiver || '').toLowerCase().indexOf(expect.toLowerCase()) < 0) {
      res.status(200).json({ verified: false, configured: true, amount: paid, receiver, message: 'บัญชีผู้รับในสลิปไม่ตรงกับร้าน' });
      return;
    }
    // 3) อายุสลิป
    const maxAgeH = Number(process.env.SLIP_MAX_AGE_HOURS) || 48;
    if (when && Date.now() - when > maxAgeH * 3600 * 1000) {
      res.status(200).json({ verified: false, configured: true, amount: paid, ref, message: 'สลิปเก่าเกินไป (เกิน ' + maxAgeH + ' ชม.) — ใช้สลิปการโอนครั้งล่าสุด' });
      return;
    }
    // 4) กันสลิปซ้ำ
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
