// ---------------------------------------------------------------------------
// Transactional email via Resend (https://resend.com).
//
// Why this exists: the order-status page URL is the ONLY way a customer can
// get back to their QR code. If they close the tab without bookmarking it,
// they have no way to recover it. Emailing them the link the moment payment
// succeeds fixes that - the email itself becomes their "retrieval point".
//
// Setup:
//   1. Sign up at https://resend.com (free tier: 100 emails/day / 3000/mo)
//   2. Verify a sending domain (or use their shared onboarding domain for
//      testing: onboarding@resend.dev - fine for test sends, NOT for
//      production, since it can only send to your own verified account
//      email while unverified)
//   3. Create an API key, put it in .env as RESEND_API_KEY
//   4. Set EMAIL_FROM to something like "eSIM 商店 <orders@yourdomain.com>"
//
// If RESEND_API_KEY is not set, every function here silently no-ops (logs a
// warning once) - the rest of the app works fine without email configured,
// this is a pure enhancement, never a hard dependency.
// ---------------------------------------------------------------------------
const fetch = require('node-fetch');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const SHOP_NAME = process.env.SHOP_NAME || 'eSIM 商店';

let warnedOnce = false;

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    if (!warnedOnce) {
      console.warn('[email] RESEND_API_KEY not set - skipping order emails. Set it in .env to enable.');
      warnedOnce = true;
    }
    return { skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[email] Resend API error:', data);
      return { error: data };
    }
    console.log(`[email] sent "${subject}" to ${to}`);
    return { id: data.id };
  } catch (err) {
    // Email failures must never break the payment/order flow - log and move on.
    console.error('[email] send failed:', err.message);
    return { error: err.message };
  }
}

/** Sent as soon as payment is confirmed, before the eSIM is issued. */
async function sendOrderReceivedEmail({ to, orderId, planName, amountTwd, statusUrl }) {
  return sendEmail({
    to,
    subject: `訂單確認｜${planName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#16233F;">
        <h2 style="margin-bottom:4px;">付款成功，正在準備你的 eSIM</h2>
        <p style="color:#5B6785;font-size:14px;line-height:1.6;">
          訂單編號：<code>${orderId}</code><br>
          方案：${planName}<br>
          金額：NT$${amountTwd}
        </p>
        <p style="font-size:14px;line-height:1.6;">
          eSIM 通常在幾秒到一分鐘內準備完成。準備好後，QR Code 會顯示在這個頁面，
          <strong>請收藏這封信</strong>，之後隨時都可以回來查看：
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${statusUrl}" style="background:#16233F;color:#F7F5EF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">
            查看訂單 / 安裝 eSIM
          </a>
        </p>
        <p style="color:#98A2BC;font-size:12px;">${SHOP_NAME}</p>
      </div>`,
  });
}

/** Sent once the eSIM is actually issued and ready to install. */
async function sendEsimReadyEmail({ to, orderId, planName, statusUrl }) {
  return sendEmail({
    to,
    subject: `你的 eSIM 已經可以安裝了｜${planName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#16233F;">
        <h2 style="margin-bottom:4px;">eSIM 已開通</h2>
        <p style="color:#5B6785;font-size:14px;line-height:1.6;">
          訂單編號：<code>${orderId}</code><br>方案：${planName}
        </p>
        <p style="font-size:14px;line-height:1.6;">
          點下方按鈕查看 QR Code 並安裝，頁面上也有 iPhone / Android 安裝步驟：
        </p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${statusUrl}" style="background:#16233F;color:#F7F5EF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;">
            前往安裝 eSIM
          </a>
        </p>
        <p style="color:#98A2BC;font-size:12px;">請妥善保存此信，之後可隨時透過上方連結回來查看 QR Code。${SHOP_NAME}</p>
      </div>`,
  });
}

module.exports = { sendOrderReceivedEmail, sendEsimReadyEmail };
