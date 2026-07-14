// ---------------------------------------------------------------------------
// ECPay (綠界) "全方位金流" AIO integration helper.
//
// This implements ECPay's documented CheckMacValue algorithm:
//   1. Sort all params (excluding CheckMacValue) by key, ascending
//   2. Build "HashKey=...&k1=v1&k2=v2...&HashIV=..."
//   3. URL-encode the whole string the way .NET's UrlEncode does
//   4. Lowercase it
//   5. SHA256 it
//   6. Uppercase the hex digest
//
// IMPORTANT: before going live, test this against ECPay's official sandbox
// (they provide test MerchantID / HashKey / HashIV) and confirm a real
// CheckMacValue matches what their test tool produces. Payment signature
// bugs fail silently as "invalid signature" with no useful error, so verify
// this in the sandbox first: https://developers.ecpay.com.tw/
// ---------------------------------------------------------------------------
const crypto = require('crypto');

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const AIO_URL = process.env.ECPAY_AIO_URL || 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
// ^ default is ECPay's STAGE (sandbox) endpoint. Production is:
//   https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5

if (process.env.DEBUG_ECPAY === 'true') {
  // Never prints the actual secret values - just enough to catch the #1
  // cause of "CheckMacValue Error": invisible leading/trailing whitespace
  // or a newline that snuck in when the value was pasted into Render.
  const describe = (name, val) => {
    if (!val) return console.log(`[ecpay debug] ${name} is NOT SET`);
    const hasWhitespace = val !== val.trim();
    console.log(`[ecpay debug] ${name}: length=${val.length}, has_leading_or_trailing_whitespace=${hasWhitespace}, first_char="${val[0]}", last_char="${val[val.length - 1]}"`);
  };
  describe('ECPAY_MERCHANT_ID', MERCHANT_ID);
  describe('ECPAY_HASH_KEY', HASH_KEY);
  describe('ECPAY_HASH_IV', HASH_IV);
  console.log('[ecpay debug] ECPAY_AIO_URL:', JSON.stringify(AIO_URL));
}

function dotNetUrlEncode(str) {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/%21/g, '!')
    .replace(/%2A/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%27/g, "'");
}

function buildCheckMacValue(params) {
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  const raw = `HashKey=${HASH_KEY}&${query}&HashIV=${HASH_IV}`;
  const encoded = dotNetUrlEncode(raw).toLowerCase();
  const mac = crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();

  if (process.env.DEBUG_ECPAY === 'true') {
    // Deliberately mask the key/iv themselves so this is safe to leave on
    // briefly even with real credentials - only the *structure* is useful.
    const masked = encoded
      .replaceAll(HASH_KEY.toLowerCase(), '***HASHKEY***')
      .replaceAll(HASH_IV.toLowerCase(), '***HASHIV***');
    console.log('[ecpay debug] params (sorted, before hashing):', query);
    console.log('[ecpay debug] final string fed into SHA256:', masked);
    console.log('[ecpay debug] resulting CheckMacValue:', mac);
  }

  return mac;
}

/**
 * Build the field set + CheckMacValue for an ECPay AIO checkout.
 * Returns everything you need to render an auto-submitting HTML form.
 */
function buildCheckoutFields({ orderId, amountTwd, itemName, returnUrl, clientBackUrl }) {
  if (!MERCHANT_ID || !HASH_KEY || !HASH_IV) {
    throw new Error('ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV missing from .env');
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const merchantTradeDate = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const fields = {
    MerchantID: MERCHANT_ID,
    // orderId is generated as alphanumeric-only in routes/checkout.js specifically
    // so this always matches the id we store in our own DB - do NOT sanitize it
    // here, or the webhook's DB lookup by MerchantTradeNo will fail to match.
    MerchantTradeNo: orderId,
    MerchantTradeDate: merchantTradeDate,
    PaymentType: 'aio',
    TotalAmount: String(Math.round(amountTwd)),
    TradeDesc: 'eSIM data plan',
    ItemName: itemName,
    ReturnURL: returnUrl,        // server-to-server webhook, ECPay POSTs the result here
    ClientBackURL: clientBackUrl, // where the customer's browser goes back to
    ChoosePayment: 'Credit',
    EncryptType: '1',
  };
  fields.CheckMacValue = buildCheckMacValue(fields);
  return fields;
}

/** Render the auto-submitting form ECPay expects the customer's browser to POST. */
function renderCheckoutForm(fields) {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('\n');
  return `<!DOCTYPE html>
<html><body onload="document.forms[0].submit()">
  <form method="POST" action="${AIO_URL}">
    ${inputs}
  </form>
  <p>正在前往付款頁面...</p>
</body></html>`;
}

/** Verify a webhook payload's CheckMacValue before trusting it. */
function verifyCallback(body) {
  const { CheckMacValue, ...rest } = body;
  const expected = buildCheckMacValue(rest);
  return expected === CheckMacValue;
}

module.exports = { buildCheckoutFields, renderCheckoutForm, verifyCallback };
