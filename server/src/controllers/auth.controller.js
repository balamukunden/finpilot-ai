const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const env = require('../config/env');

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite === 'none' ? 'none' : env.cookie.sameSite,
    path: '/api',
    maxAge: maxAgeMs,
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('refreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/api' });
  res.clearCookie('refreshToken', { path: '/api' });
}

const authController = {
  register: asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const result = await authService.register({ name, email, password });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return created(res, result, 'Registration successful');
  }),

  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return ok(res, result, 'Login successful');
  }),

  refreshToken: asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    const result = await authService.refreshToken(token);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return ok(res, result, 'Token refreshed');
  }),

  logout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    await authService.logout(req.userId, refreshToken);
    clearAuthCookies(res);
    return ok(res, null, 'Logged out successfully');
  }),

  changePassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.userId, currentPassword, newPassword);
    clearAuthCookies(res);
    return ok(res, null, 'Password changed successfully. Please sign in again.');
  }),

  me: asyncHandler(async (req, res) => {
    return ok(res, { user: req.user.toJSON() });
  }),
};

module.exports = authController;