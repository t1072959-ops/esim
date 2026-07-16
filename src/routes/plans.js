const express = require('express');
const { listPublicPlans } = require('../catalog');

const router = express.Router();

// GET /api/plans - the storefront fetches this instead of hardcoding prices,
// so what the customer sees always matches exactly what /api/checkout charges.
router.get('/plans', (req, res) => {
  res.json({ plans: listPublicPlans() });
});

module.exports = router;
