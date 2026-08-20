const mongoose = require('mongoose');

const GOAL_TYPES = [
  'emergency-fund', 'vacation', 'laptop', 'bike',
  'car', 'house', 'education', 'custom',
];

const milestoneSchema = new mongoose.Schema(
  {
    percentage: { type: Number },
    reached: { type: Boolean, default: false },
    reachedAt: { type: Date },
  },
  { _id: false }
);

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
      maxlength: [100, 'Goal name must not exceed 100 characters'],
    },
    type: {
      type: String,
      enum: GOAL_TYPES,
      default: 'custom',
    },
    icon: { type: String, default: '🎯' },
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [0.01, 'Target amount must be greater than zero'],
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: [0, 'Current savings cannot be negative'],
    },
    deadline: { type: Date },
    status: {
      type: String,
      enum: ['active', 'completed', 'paused'],
      default: 'active',
    },
    milestones: { type: [milestoneSchema], default: [] },
    color: { type: String, default: '#3B82F6' },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    notes: { type: String, trim: true, default: '', maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

goalSchema.virtual('progress').get(function () {
  if (!this.targetAmount) return 0;
  return Math.min((this.currentAmount / this.targetAmount) * 100, 100);
});

goalSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Goal', goalSchema);
module.exports.GOAL_TYPES = GOAL_TYPES;