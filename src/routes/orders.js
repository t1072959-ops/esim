const express = require('express');
const { getOrder } = require('../db');

const router = express.Router();

// GET /api/orders/:orderId
router.get('/orders/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Only return what the customer-facing page actually needs.
  res.json({
    orderId: order.orderId,
    status: order.status,
    qrCode: order.qrCode || null,
    iccid: order.iccid || null,
    error: order.status === 'esim_order_failed' ? '出票失敗，我們已收到通知並會盡快處理，或聯繫客服協助退款。' : undefined,
  });
});

module.exports = router;
