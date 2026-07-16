const express = require('express');
const { getOrder } = require('../db');
const { getPlan } = require('../catalog');

const router = express.Router();

// GET /api/orders/:orderId
router.get('/orders/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const plan = getPlan(order.planId);

  // Only return what the customer-facing page actually needs.
  res.json({
    orderId: order.orderId,
    status: order.status,
    planName: plan ? plan.name : order.planId,
    amountTwd: order.amountTwd || (plan ? plan.retailPriceTwd : null),
    createdAt: order.createdAt || null,
    qrCode: order.qrCode || null,
    iccid: order.iccid || null,
    error: order.status === 'esim_order_failed' ? '出票時發生問題，我們已收到通知並會盡快處理；您也可以直接聯繫客服協助處理或退款。' : undefined,
  });
});

module.exports = router;
