const express = require('express');
const { verifyCallback } = require('../ecpay');
const { getOrder, updateOrder } = require('../db');
const { getPlan } = require('../catalog');
const esim = require('../esimAccessClient');
const { sendOrderReceivedEmail, sendEsimReadyEmail } = require('../email');

const router = express.Router();

function statusUrlFor(orderId) {
  return `${process.env.PUBLIC_BASE_URL}/order-status.html?orderId=${orderId}`;
}

// ECPay POSTs application/x-www-form-urlencoded to this endpoint after payment.
router.post('/webhooks/ecpay', express.urlencoded({ extended: false }), async (req, res) => {
  const body = req.body;
  console.log('[ecpay webhook] received:', body);

  // 1. Verify the signature before trusting anything in this payload.
  if (!verifyCallback(body)) {
    console.error('[ecpay webhook] CheckMacValue mismatch - possible spoofed request, ignoring.');
    return res.send('0|CheckMacValueError');
  }

  const orderId = body.MerchantTradeNo;
  const order = getOrder(orderId);
  if (!order) {
    console.error(`[ecpay webhook] unknown order: ${orderId}`);
    return res.send('0|OrderNotFound');
  }

  const plan = getPlan(order.planId);
  const planName = plan ? plan.name : order.planId;

  // RtnCode "1" means payment succeeded. Any other value = failed/cancelled.
  if (String(body.RtnCode) !== '1') {
    updateOrder(orderId, { status: 'payment_failed', ecpayRtnMsg: body.RtnMsg });
    return res.send('1|OK'); // still ack receipt so ECPay stops retrying
  }

  updateOrder(orderId, { status: 'paid' });

  // Email the order-status link the moment payment is confirmed - this is
  // the customer's only way back to their QR code if they close the tab
  // before the eSIM finishes provisioning. No-ops silently if RESEND_API_KEY
  // isn't configured (see src/email.js).
  if (order.email) {
    sendOrderReceivedEmail({
      to: order.email,
      orderId,
      planName,
      amountTwd: order.amountTwd,
      statusUrl: statusUrlFor(orderId),
    }).catch(err => console.error('[ecpay webhook] order-received email failed:', err.message));
  }

  // Testing escape hatch: set SKIP_ESIM_ORDER=true in .env to verify the
  // ECPay payment flow end-to-end WITHOUT placing a real (money-spending)
  // eSIM Access order. Remove/unset this before going live.
  if (process.env.SKIP_ESIM_ORDER === 'true') {
    console.log(`[ecpay webhook] SKIP_ESIM_ORDER=true - marking ${orderId} as issued without calling eSIM Access`);
    updateOrder(orderId, {
      status: 'issued',
      qrCode: 'TEST_MODE_NO_REAL_ESIM_ORDERED',
    });
    return res.send('1|OK');
  }

  // 2. Payment confirmed -> order the real eSIM from the wholesaler.
  try {
    const orderResult = await esim.orderPackage({
      transactionId: orderId,           // reuse our own order id so it's traceable end to end
      packageCode: plan.packageCode,
      count: 1,
      // NOTE: eSIM Access's price/amount fields and unit conventions need to
      // be confirmed against your account (often USD cents x100). Pull the
      // exact value from listPackages() rather than hardcoding a conversion.
    });

    // 3. Fetch the QR/LPA payload for what we just ordered.
    const esimDetails = await esim.queryEsim({ orderNo: orderResult.orderNo });

    updateOrder(orderId, {
      status: 'issued',
      esimOrderNo: orderResult.orderNo,
      iccid: esimDetails.iccid,
      qrCode: esimDetails.qrCode || esimDetails.ac || null, // field name depends on eSIM Access's response shape - verify in Postman
    });

    console.log(`[ecpay webhook] order ${orderId} issued successfully`);

    if (order.email) {
      sendEsimReadyEmail({
        to: order.email,
        orderId,
        planName,
        statusUrl: statusUrlFor(orderId),
      }).catch(err => console.error('[ecpay webhook] esim-ready email failed:', err.message));
    }
  } catch (err) {
    console.error(`[ecpay webhook] eSIM Access order failed for ${orderId}:`, err.message);
    updateOrder(orderId, { status: 'esim_order_failed', error: err.message });
    // Payment already succeeded - this needs a human to look at it and either
    // retry the eSIM order or refund the customer. Consider alerting yourself
    // here (email/Slack) rather than only logging to console.
  }

  // Always ack "1|OK" so ECPay knows we received the notification, even if
  // the downstream eSIM order failed - we don't want ECPay retrying the
  // payment notification forever over an unrelated provisioning error.
  res.send('1|OK');
});

module.exports = router;
