const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const Notification = require('../models/Notification');

// GET /api/notifications
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ userId: req.userId }).sort('-createdAt').skip(skip).limit(parseInt(limit)),
    Notification.countDocuments({ userId: req.userId }),
    Notification.countDocuments({ userId: req.userId, isRead: false }),
  ]);

  ApiResponse.ok({ notifications, unreadCount, pagination: { page: parseInt(page), total } }).send(res);
}));

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { isRead: true });
  ApiResponse.ok(null, 'Marked as read').send(res);
}));

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
  ApiResponse.ok(null, 'All notifications marked as read').send(res);
}));

module.exports = router;
