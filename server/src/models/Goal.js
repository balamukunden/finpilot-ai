const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Goal name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['emergency-fund', 'vacation', 'laptop', 'bike', 'car', 'house', 'education', 'custom'],
      default: 'custom',
    },
    icon: { type: String, default: '🎯' },
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [1, 'Target must be at least 1'],
    },
    currentAmount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused'],
      default: 'active',
    },
    milestones: [
      {
        percentage: { type: Number },
        reached: { type: Boolean, default: false },
        reachedAt: { type: Date },
      },
    ],
    color: { type: String, default: '#3B82F6' },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters'],
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes must not exceed 1000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

goalSchema.virtual('progress').get(function () {
  return this.targetAmount > 0 ? Math.min((this.currentAmount / this.targetAmount) * 100, 100) : 0;
});

module.exports = mongoose.model('Goal', goalSchema);
