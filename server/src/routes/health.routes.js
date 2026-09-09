const express = require('express');
const env = require('../config/env');

const router = express.Router();

/**
 * GET /api/health
 * Must never depend on Redis, AI, or background processes.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FinPilot API is running',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;