const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

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
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password by default
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    monthlyIncome: {
      type: Number,
      default: 0,
    },
    monthlyBudget: {
      type: Number,
      default: 0,
    },

    // Gamification
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    badges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge',
      },
    ],

    // Streaks
    savingsStreak: {
      type: Number,
      default: 0,
    },
    investmentStreak: {
      type: Number,
      default: 0,
    },
    lastActiveDate: {
      type: Date,
      default: Date.now,
    },

    // Auth
    refreshTokens: [
      {
        token: { type: String, required: true },
        device: { type: String, default: 'unknown' },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpiry: {
      type: Date,
      select: false,
    },

    // Profile
    isOnboarded: {
      type: Boolean,
      default: false,
    },
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
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiry;
        return ret;
      },
    },
  }
);

// ============================================
// Indexes
// ============================================

// email index is auto-created by `unique: true` — no need to duplicate
userSchema.index({ level: -1, xp: -1 }); // For leaderboard

// ============================================
// Pre-save: Hash password
// ============================================

userSchema.pre('save', async function (next) {
  // Only hash password if it has been modified
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ============================================
// Methods
// ============================================

/**
 * Compare a candidate password with the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Calculate XP needed for next level.
 * Formula: 100 * level^1.5
 * @returns {number}
 */
userSchema.methods.xpForNextLevel = function () {
  return Math.floor(100 * Math.pow(this.level, 1.5));
};

/**
 * Add XP and auto-level-up if threshold is crossed.
 * @param {number} amount - XP to add
 * @returns {{ leveledUp: boolean, newLevel: number, xp: number }}
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

/**
 * Clean up expired refresh tokens.
 */
userSchema.methods.cleanExpiredTokens = async function () {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(
    (rt) => rt.expiresAt > now
  );
  await this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
