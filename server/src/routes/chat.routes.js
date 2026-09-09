const express = require('express');
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { chatLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/history', chatController.history);
router.post('/send', chatLimiter, chatController.send);
router.delete('/clear', chatController.clear);

module.exports = router;