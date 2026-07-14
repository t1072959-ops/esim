const express = require('express');
const { verifyCallback } = require('../ecpay');
const { getOrder, updateOrder } = require('../db');
const { getPlan } = require('../catalog');
const esim = require('../esimAccessClient');

const router = express.Router();

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

  // RtnCode "1" means payment succeeded. Any other value = failed/cancelled.
  if (String(body.RtnCode) !== '1') {
    updateOrder(orderId, { status: 'payment_failed', ecpayRtnMsg: body.RtnMsg });
    return res.send('1|OK'); // still ack receipt so ECPay stops retrying
  }

  updateOrder(orderId, { status: 'paid' });

  // 2. Payment confirmed -> order the real eSIM from the wholesaler.
  try {
    const plan = getPlan(order.planId);
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
