const notificationService = require('../services/notification.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const ApiError = require('../utils/errors');

const notificationController = {
  list: asyncHandler(async (req, res) => {
    const result = await notificationService.list(req.userId, req.query);
    return ok(res, result);
  }),

  markRead: asyncHandler(async (req, res) => {
    const notification = await notificationService.markRead(req.userId, req.params.id);
    if (!notification) throw ApiError.notFound('Notification not found');
    return ok(res, null, 'Marked as read');
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.userId);
    return ok(res, null, 'All notifications marked as read');
  }),
};

module.exports = notificationController;