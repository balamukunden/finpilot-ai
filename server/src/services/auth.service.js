const User = require('../models/user.model');
const ApiError = require('../utils/errors');
const logger = require('../config/logger');
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
    await throttle.enforceCooldown(cleanEmail);

    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');
    if (!user) {
      await throttle.recordFailure(cleanEmail);
      throw ApiError.unauthorized('Email or password is incorrect.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await throttle.recordFailure(cleanEmail);
      throw ApiError.unauthorized('Email or password is incorrect.');
    }

    await throttle.clearFailures(cleanEmail);

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

    user.refreshTokens = user.refreshTokens.filter((rt) => rt.expiresAt > new Date());

    const storedToken = user.refreshTokens.find((rt) => rt.token === token);

    if (!storedToken) {
      // The presented token is validly signed but no longer stored on the
      // user. This is the signature of token reuse after rotation — revoke
      // every refresh token so a stolen session cannot continue.
      user.refreshTokens = [];
      await user.save();
      logger.warn({ userId: user._id.toString() }, 'Refresh token reuse detected — all sessions revoked.');
      throw ApiError.unauthorized('Refresh token reuse detected. Please sign in again.', 'REUSE_DETECTED');
    }

    // Token rotation: the used refresh token is invalidated immediately.
    user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== token);

    const accessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);
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

  async changePassword(userId, currentPassword, newPassword) {
    assertDbAvailable();

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) throw ApiError.notFound('User not found.');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect.', [], 'INVALID_CURRENT_PASSWORD');
    }
    if (currentPassword === newPassword) {
      throw ApiError.badRequest('New password must be different from the current password.');
    }

    user.passwordHash = newPassword;
    // Changing the password invalidates every active session.
    user.refreshTokens = [];
    await user.save();

    return { changed: true };
  },
};

module.exports = authService;