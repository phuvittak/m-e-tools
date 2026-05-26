/* =====================================================================
   LINE Messaging API — Webhook (Vercel Edge Function)
   ---------------------------------------------------------------------
   รับข้อความจาก LINE Official Account แล้วตอบกลับอัตโนมัติ
   ตั้งค่า env vars ที่ Vercel:
     - LINE_CHANNEL_SECRET         (จาก LINE Developers Console)
     - LINE_CHANNEL_ACCESS_TOKEN   (จาก LINE Developers Console)
   ตั้ง Webhook URL ใน LINE Console เป็น:
     https://<your-vercel-domain>/api/line-webhook
   ===================================================================== */

export const config = { runtime: 'edge' };

// ----- ข้อมูลร้าน (ต้องตรงกับ DEFAULT_SETTINGS ใน webapp/assets/store.js) -----
const SHOP = {
  company: 'บริษัท เอ็ม.อี.ทูลส์ จำกัด',
  address: 'แยกท่ารั้ว ต.ท่าวังตาล อ.สารภี จ.เชียงใหม่ 50140',
  phone: '053-XXX-XXXX',
  hoursWeek: 'จันทร์ – เสาร์ 8:00 – 17:00 น.',
  hoursSun: 'อาทิตย์ 8:00 – 15:00 น.',
  line: '@metools',
  website: 'https://m-e-tools.vercel.app',
};

const HELP_TEXT =
  'พิมพ์คำถามได้เลยครับ เช่น\n' +
  '• "เวลาเปิด" — ดูเวลาทำการ\n' +
  '• "ที่อยู่" — แผนที่ร้าน\n' +
  '• "เบอร์โทร" — ติดต่อร้าน\n' +
  '• "สินค้า" — ดูแคตตาล็อกสว่าน/เลื่อย/เครื่องเจียร\n' +
  '• "พนักงาน" — คุยกับแอดมิน';

// ----- ตัวจัดการคำตอบ ----------------------------------------------------
function buildReply(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return null;

  if (/^(สวัสดี|หวัดดี|สวัด|hello|hi|hey)/i.test(t)) {
    return `สวัสดีครับ! ${SHOP.company} ยินดีให้บริการ 🛠️\n\n${HELP_TEXT}`;
  }
  if (/(เวลา|เปิด|ปิด|กี่โมง|hours?|open)/i.test(t)) {
    return `🕐 เวลาทำการ\n${SHOP.hoursWeek}\n${SHOP.hoursSun}`;
  }
  if (/(ที่อยู่|ที่ตั้ง|address|location|แผนที่|map|ไป.*ร้าน)/i.test(t)) {
    return `📍 ที่อยู่ร้าน\n${SHOP.address}\n\nLINE: ${SHOP.line}\nเว็บไซต์: ${SHOP.website}`;
  }
  if (/(เบอร์|โทร|tel|phone|ติดต่อ|call)/i.test(t)) {
    return `📞 ติดต่อร้าน\nโทร: ${SHOP.phone}\nLINE: ${SHOP.line}`;
  }
  if (/(สินค้า|ราคา|เช่า|ซื้อ|product|catalog|drill|saw|สว่าน|เลื่อย|เจียร)/i.test(t)) {
    return `🧰 ดูสินค้าทั้งหมดที่เว็บไซต์\n${SHOP.website}/shop.html\n\n(เร็ว ๆ นี้: ถามราคา/สเป็กใน LINE ได้เลย)`;
  }
  if (/(พนักงาน|แอดมิน|admin|staff|คุย.*คน)/i.test(t)) {
    return `กำลังแจ้งแอดมินให้ครับ 🙏\nระหว่างนี้ลองดูเว็บไซต์ที่ ${SHOP.website} ได้เลย`;
  }
  if (/^(help|ช่วย|menu|เมนู|\?)$/i.test(t)) {
    return HELP_TEXT;
  }
  // ไม่ตรงคำสำคัญ — ตอบช่วยเหลือสั้น ๆ
  return `ขอบคุณสำหรับข้อความครับ 🙏\n\n${HELP_TEXT}`;
}

// ----- LINE API client (ผ่าน fetch) -------------------------------------
async function replyMessage(replyToken, text, token) {
  console.log('[reply] calling LINE reply API, token len:', token?.length, 'token tail:', token?.slice(-6));
  const startedAt = Date.now();
  // safety timeout — abort fetch if LINE doesn't answer in 8s
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
      signal: ctrl.signal,
    });
    const body = await res.text().catch(() => '');
    const ms = Date.now() - startedAt;
    if (res.ok) {
      console.log('[reply] LINE reply OK', res.status, 'in', ms, 'ms');
    } else {
      console.error('[reply] LINE reply FAILED', res.status, 'in', ms, 'ms — body:', body);
    }
  } catch (err) {
    const ms = Date.now() - startedAt;
    console.error('[reply] LINE reply THREW after', ms, 'ms —', err?.name, err?.message);
  } finally {
    clearTimeout(timer);
  }
}

// ----- ตรวจลายเซ็น HMAC-SHA256 ของ LINE ---------------------------------
async function verifySignature(secret, body, signature) {
  if (!signature || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const bytes = new Uint8Array(sigBuf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const expected = btoa(bin);
  // constant-time compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ----- Handler ----------------------------------------------------------
export default async function handler(req) {
  if (req.method === 'GET') {
    return new Response('LINE webhook is live ✅', { status: 200 });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  console.log('[webhook] POST received — secret set:', !!secret, 'len:', secret?.length,
    '| token set:', !!token, 'len:', token?.length);
  if (!secret || !token) {
    console.error('[webhook] Missing LINE env vars');
    return new Response('Server not configured', { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature');
  console.log('[webhook] body len:', rawBody.length, '| sig present:', !!signature);

  const ok = await verifySignature(secret, rawBody, signature);
  console.log('[webhook] signature valid:', ok);
  if (!ok) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  console.log('[webhook] events count:', events.length, '| types:', events.map(e => e.type).join(','));

  await Promise.all(
    events.map(async (event) => {
      try {
        if (event.type === 'follow') {
          console.log('[event] follow — sending welcome');
          await replyMessage(
            event.replyToken,
            `สวัสดีครับ! ขอบคุณที่เพิ่มเพื่อน ${SHOP.company} 🛠️\n\n${HELP_TEXT}`,
            token
          );
          return;
        }
        if (event.type === 'message' && event.message?.type === 'text') {
          const userText = event.message.text;
          const reply = buildReply(userText);
          console.log('[event] text:', JSON.stringify(userText), '| reply chars:', reply?.length);
          if (reply) await replyMessage(event.replyToken, reply, token);
        }
      } catch (err) {
        console.error('[event] handler error:', err?.name, err?.message);
      }
    })
  );
  console.log('[webhook] done');

  return new Response('OK', { status: 200 });
}
