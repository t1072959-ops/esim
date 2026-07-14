require('dotenv').config();
const express = require('express');
const path = require('path');

const checkoutRouter = require('./routes/checkout');
const ecpayWebhookRouter = require('./routes/ecpayWebhook');
const ordersRouter = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/public', express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

// The storefront itself - customer lands here, "立即購買" POSTs straight to /api/checkout
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'esim-shop.html'));
});

app.use('/api', checkoutRouter);
app.use('/api', ecpayWebhookRouter);
app.use('/api', ordersRouter);

// convenience: serve order-status.html at the root path used in ecpay.js's clientBackUrl
app.get('/order-status.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'order-status.html'));
});

app.listen(PORT, () => {
  console.log(`eSIM reseller backend listening on http://localhost:${PORT}`);
  console.log(`Health check:  http://localhost:${PORT}/health`);
});
