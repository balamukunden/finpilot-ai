const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['ai-alert', 'goal-progress', 'overspending', 'investment', 'weekly-summary', 'achievement', 'system'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: '🔔' },
    isRead: { type: Boolean, default: false },
    actionUrl: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: { transform(doc, ret) { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
