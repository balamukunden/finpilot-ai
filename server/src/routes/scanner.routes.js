const express = require('express');
const scannerController = require('../controllers/scanner.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadLimiter } = require('../middleware/rateLimit.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

router.use(authenticate);

router.post('/upload', uploadLimiter, upload.single('receipt'), scannerController.upload);
router.post('/confirm', scannerController.confirm);

module.exports = router;