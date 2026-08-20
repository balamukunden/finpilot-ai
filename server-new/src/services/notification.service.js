const Notification = require('../models/notification.model');

const notificationService = {
  async list(userId, { page = 1, limit = 20 } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort('-createdAt').skip(skip).limit(Number(limit)),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return {
      notifications: notifications.map((n) => n.toJSON()),
      unreadCount,
      pagination: { page: Number(page), total },
    };
  },

  async markRead(userId, id) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );
    return notification ? notification.toJSON() : null;
  },

  async markAllRead(userId) {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  },

  async create(userId, { type = 'info', title, message }) {
    const notification = await Notification.create({ userId, type, title, message });
    return notification.toJSON();
  },
};

module.exports = notificationService;