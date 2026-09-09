const mongoose = require('mongoose');
const { hashPassword, comparePassword } = require('../utils/password');

const refreshTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must not exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    currency: { type: String, default: 'INR' },
    monthlyIncome: { type: Number, default: 0, min: 0 },
    monthlyBudget: { type: Number, default: 0, min: 0 },

    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    badges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Badge' }],

    savingsStreak: { type: Number, default: 0 },
    investmentStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: Date.now },

    refreshTokens: { type: [refreshTokenSchema], default: [] },

    isOnboarded: { type: Boolean, default: false },
    financialGoal: {
      type: String,
      enum: ['save', 'invest', 'reduce-debt', 'build-emergency', 'grow-wealth', ''],
      default: '',
    },
    riskProfile: {
      type: String,
      enum: ['conservative', 'moderate', 'aggressive', ''],
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.refreshTokens;
      },
    },
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await hashPassword(this.passwordHash);
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Compare a candidate password with the stored hash.
 */
userSchema.methods.comparePassword = async function (candidate) {
  return comparePassword(candidate, this.passwordHash);
};

/**
 * XP needed for the next level.
 */
userSchema.methods.xpForNextLevel = function () {
  return Math.floor(100 * Math.pow(this.level, 1.5));
};

/**
 * Add XP and auto level-up.
 */
userSchema.methods.addXP = async function (amount) {
  this.xp += amount;
  let leveledUp = false;
  while (this.xp >= this.xpForNextLevel()) {
    this.xp -= this.xpForNextLevel();
    this.level += 1;
    leveledUp = true;
  }
  await this.save();
  return { leveledUp, newLevel: this.level, xp: this.xp };
};

module.exports = mongoose.model('User', userSchema);