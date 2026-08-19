const express = require('express');
const router = express.Router();
const { authService, setAuthCookies, clearAuthCookies } = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require('../validators/auth.validator');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

// Apply auth rate limiter to all auth routes
router.use(authLimiter);

/**
 * POST /api/auth/register
 */
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.register({ name, email, password });
    setAuthCookies(res, accessToken, refreshToken);
    ApiResponse.created({ user, accessToken, refreshToken }, 'Registration successful').send(res);
  })
);

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login({ email, password });
    setAuthCookies(res, accessToken, refreshToken);
    ApiResponse.ok({ user, accessToken, refreshToken }, 'Login successful').send(res);
  })
);

/**
 * POST /api/auth/refresh-token
 */
router.post(
  '/refresh-token',
  asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken || req.body.refreshToken;
    const { accessToken, refreshToken } = await authService.refreshToken(token);
    setAuthCookies(res, accessToken, refreshToken);
    ApiResponse.ok({ accessToken, refreshToken }, 'Token refreshed').send(res);
  })
);

/**
 * POST /api/auth/logout
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    await authService.logout(req.userId, refreshToken);
    clearAuthCookies(res);
    ApiResponse.ok(null, 'Logged out successfully').send(res);
  })
);

/**
 * POST /api/auth/forgot-password
 */
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    ApiResponse.ok(result).send(res);
  })
);

/**
 * POST /api/auth/reset-password
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const result = await authService.resetPassword(token, password);
    ApiResponse.ok(result).send(res);
  })
);

/**
 * GET /api/auth/me
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) throw ApiError.notFound('User not found');
    ApiResponse.ok({ user }).send(res);
  })
);

/**
 * PUT /api/auth/change-password
 */
router.put(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId).select('+password');
    if (!user) throw ApiError.notFound('User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();

    clearAuthCookies(res);
    ApiResponse.ok(null, 'Password changed. Please log in again.').send(res);
  })
);

module.exports = router;
