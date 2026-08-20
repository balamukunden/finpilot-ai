const User = require('../models/user.model');
const ApiError = require('../utils/errors');
const { isDbConnected } = require('../config/db');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshTokenExpiryMs,
} = require('../utils/jwt');
const throttle = require('./loginThrottle.service');

function assertDbAvailable() {
  if (!isDbConnected()) {
    throw ApiError.serviceUnavailable('Authentication service is temporarily unavailable.');
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function toSafeUser(user) {
  return user.toJSON();
}

const authService = {
  async register({ name, email, password }) {
    assertDbAvailable();

    const cleanEmail = normalizeEmail(email);

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists.', 'EMAIL_ALREADY_EXISTS');
    }

    const user = await User.create({ name, email: cleanEmail, passwordHash: password });

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    user.refreshTokens.push({ token: refreshToken, expiresAt: new Date(Date.now() + refreshTokenExpiryMs()) });
    await user.save();

    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async login({ email, password }) {
    assertDbAvailable();

    const cleanEmail = normalizeEmail(email);
    throttle.enforceCooldown(cleanEmail);

    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');
    if (!user) {
      throttle.recordFailure(cleanEmail);
      throw ApiError.unauthorized('Email or password is incorrect.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throttle.recordFailure(cleanEmail);
      throw ApiError.unauthorized('Email or password is incorrect.');
    }

    throttle.clearFailures(cleanEmail);

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.refreshTokens = user.refreshTokens.filter((rt) => rt.expiresAt > new Date());
    user.refreshTokens.push({ token: refreshToken, expiresAt: new Date(Date.now() + refreshTokenExpiryMs()) });
    user.lastActiveDate = new Date();
    await user.save();

    return { user: toSafeUser(user), accessToken, refreshToken };
  },

  async refreshToken(token) {
    assertDbAvailable();
    if (!token) throw ApiError.unauthorized('Refresh token is required.');

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Refresh token expired.', 'TOKEN_EXPIRED');
      }
      throw ApiError.unauthorized('Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN');
    }

    const user = await User.findById(decoded.userId);
    if (!user) throw ApiError.unauthorized('User not found.');

    const accessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);

    user.refreshTokens = user.refreshTokens.filter((rt) => rt.expiresAt > new Date());
    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + refreshTokenExpiryMs()),
    });
    await user.save();

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(userId, refreshToken) {
    const user = await User.findById(userId);
    if (user && refreshToken) {
      user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
      await user.save();
    }
  },
};

module.exports = authService;