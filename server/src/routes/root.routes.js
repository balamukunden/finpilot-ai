const express = require('express');
const { buildServiceInfo } = require('../utils/serviceInfo');

const router = express.Router();

/**
 * GET /
 * DB-independent production root route so the backend domain reads as a
 * user-friendly API service rather than a 404.
 */
router.get('/', (req, res) => {
  res.status(200).json(buildServiceInfo());
});

module.exports = router;