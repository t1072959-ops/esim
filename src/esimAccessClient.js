// ---------------------------------------------------------------------------
// eSIM Access wholesale API client.
//
// Confirmed from eSIM Access's own documentation:
//   - Base host:        https://api.esimaccess.com
//   - Base path prefix: /api/v1/open
//   - Auth header:      RT-AccessCode: <your access code>
//   - Optional extra security: HMAC-SHA256 request signing with a secret key
//   - Query endpoint:   /esim/query   (confirmed working path)
//   - Rate limit:       8 requests/second
//
// The exact paths for "list packages", "order", "top up", and "balance" are
// NOT independently re-verified in this file (eSIM Access's docs live behind
// a Postman collection that needs a live account to browse). The path names
// below (ESIM_PATHS) are eSIM Access's documented naming pattern, but before
// you go live:
//   1. Log into https://docs.esimaccess.com/ with your reseller account
//   2. Click "Run in Postman" and confirm the exact path + request body for
//      each endpoint against the live collection
//   3. Update the ESIM_PATHS object below if anything differs
//
// This file is written so that fixing a path is a one-line change, not a
// rewrite - every call goes through request(), and every path is named here.
// ---------------------------------------------------------------------------
const fetch = require('node-fetch');
const crypto = require('crypto');

const BASE_URL = process.env.ESIMACCESS_BASE_URL || 'https://api.esimaccess.com/api/v1/open';
const ACCESS_CODE = process.env.ESIMACCESS_ACCESS_CODE;
const SECRET_KEY = process.env.ESIMACCESS_SECRET_KEY; // optional, only if you enabled HMAC signing

const ESIM_PATHS = {
  packageList: process.env.ESIMACCESS_PATH_PACKAGE_LIST || '/package/list',
  order: process.env.ESIMACCESS_PATH_ORDER || '/esim/order',
  query: process.env.ESIMACCESS_PATH_QUERY || '/esim/query',
  topup: process.env.ESIMACCESS_PATH_TOPUP || '/esim/topup',
  cancel: process.env.ESIMACCESS_PATH_CANCEL || '/esim/cancel',
  balance: process.env.ESIMACCESS_PATH_BALANCE || '/balance/query',
};

function signBody(bodyString) {
  if (!SECRET_KEY) return null;
  return crypto.createHmac('sha256', SECRET_KEY).update(bodyString).digest('hex');
}

async function request(path, body) {
  if (!ACCESS_CODE) {
    throw new Error('ESIMACCESS_ACCESS_CODE is not set. Add it to your .env file.');
  }
  const bodyString = JSON.stringify(body || {});
  const headers = {
    'Content-Type': 'application/json',
    'RT-AccessCode': ACCESS_CODE,
  };
  const signature = signBody(bodyString);
  if (signature) headers['RT-Signature'] = signature; // header name unconfirmed - check Postman collection

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: bodyString,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`eSIM Access returned non-JSON response (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok || data.success === false) {
    const msg = data.errorMsg || data.message || `HTTP ${res.status}`;
    const err = new Error(`eSIM Access API error: ${msg}`);
    err.raw = data;
    throw err;
  }
  return data.obj !== undefined ? data.obj : data;
}

/** List/search available packages, e.g. { locationCode: 'JP' } */
async function listPackages(params = {}) {
  return request(ESIM_PATHS.packageList, params);
}

/**
 * Order one or more eSIM packages.
 * transactionId MUST be unique per order - use your own internal order id.
 */
async function orderPackage({ transactionId, packageCode, count = 1, price, amount }) {
  return request(ESIM_PATHS.order, {
    transactionId,
    packageInfoList: [{ packageCode, count, price, amount }],
  });
}

/** Look up an eSIM / order by iccid or orderNo to retrieve the QR/LPA payload. */
async function queryEsim({ iccid, orderNo } = {}) {
  return request(ESIM_PATHS.query, { iccid, orderNo });
}

/** Order a top-up for an existing eSIM. */
async function orderTopup({ iccid, packageCode, transactionId, amount }) {
  return request(ESIM_PATHS.topup, { iccid, packageCode, transactionId, amount });
}

/** Cancel/suspend an eSIM. */
async function cancelEsim({ iccid }) {
  return request(ESIM_PATHS.cancel, { iccid });
}

/** Check your prepaid wholesale balance. */
async function getBalance() {
  return request(ESIM_PATHS.balance, {});
}

module.exports = {
  listPackages,
  orderPackage,
  queryEsim,
  orderTopup,
  cancelEsim,
  getBalance,
};
