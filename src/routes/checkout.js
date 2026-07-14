const express = require('express');
const { customAlphabet } = require('nanoid');
const { createOrder } = require('../db');
const { getPlan } = require('../catalog');
const { buildCheckoutFields, renderCheckoutForm } = require('../ecpay');

const router = express.Router();

// ECPay's MerchantTradeNo must be alphanumeric only, max 20 chars - so we
// generate our own orderId in that exact format from the start. That way
// the id we store in our DB and the id ECPay echoes back in the webhook are
// always identical, with no separate "sanitized" version to keep in sync.
const genOrderId = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 16);

// POST /api/checkout  { planId, email }
router.post('/checkout', express.json(), (req, res) => {
  try {
    const { planId, email } = req.body;
    const plan = getPlan(planId);
    if (!plan) return res.status(400).json({ error: `Unknown planId: ${planId}` });
    if (!email) return res.status(400).json({ error: 'email is required' });

    const orderId = `o${genOrderId()}`;
    createOrder({
      orderId,
      planId,
      email,
      packageCode: plan.packageCode,
      amountTwd: plan.retailPriceTwd,
      status: 'pending_payment',
    });

    const fields = buildCheckoutFields({
      orderId,
      amountTwd: plan.retailPriceTwd,
      itemName: plan.name,
      returnUrl: `${process.env.PUBLIC_BASE_URL}/api/webhooks/ecpay`,
      clientBackUrl: `${process.env.PUBLIC_BASE_URL}/order-status.html?orderId=${orderId}`,
    });

    // Send back an auto-submitting HTML form that redirects the browser to ECPay.
    res.set('Content-Type', 'text/html');
    res.send(renderCheckoutForm(fields));
  } catch (err) {
    console.error('[checkout] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
