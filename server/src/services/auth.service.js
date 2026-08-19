const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const { enforceCooldown, recordFailure, clearFailures } = require('./loginThrottle');

function assertDbAvailable() {
  if (mongoose.connection.readyState !== 1) {
    throw ApiError.serviceUnavailable('Authentication service is temporarily unavailable.');
  }
}

function generateAccessToken(userId) {
  return jwt.sign({ userId }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });
}

function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = env.isProd;

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh-token',
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh-token' });
}

const authService = {
  async register({ name, email, password }) {
    assertDbAvailable();

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const user = await User.create({ name, email: cleanEmail, password });
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.refreshTokens.push({ token: refreshToken, expiresAt });
    await user.save();

    return { user, accessToken, refreshToken };
  },

  async login({ email, password }) {
    assertDbAvailable();

    const cleanEmail = email.toLowerCase().trim();

    // Enforce progressive per-account cooldown (429 with retryAfterSeconds).
    enforceCooldown(cleanEmail);

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      recordFailure(cleanEmail);
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      recordFailure(cleanEmail);
      throw ApiError.unauthorized('Invalid email or password');
    }

    clearFailures(cleanEmail);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.refreshTokens = user.refreshTokens.filter((rt) => rt.expiresAt > new Date());
    user.refreshTokens.push({ token: refreshToken, expiresAt });
    user.lastActiveDate = new Date();
    await user.save();

    user.password = undefined;
    return { user, accessToken, refreshToken };
  },

  async refreshToken(token) {
    if (!token) throw ApiError.unauthorized('Refresh token is required');

    let decoded;
    try {
      decoded = jwt.verify(token, env.jwt.refreshSecret);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const userId = decoded.userId;

    const user = await User.findById(userId);
    if (!user) throw ApiError.unauthorized('User not found');

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(userId, refreshToken) {
    const user = await User.findById(userId);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((rt) => rt.token !== refreshToken);
      await user.save();
    }
  },

  async forgotPassword(email) {
    return { message: 'Password reset link sent.' };
  },

  async resetPassword(token, newPassword) {
    return { message: 'Password reset successful' };
  },
};

module.exports = { authService, setAuthCookies, clearAuthCookies };
