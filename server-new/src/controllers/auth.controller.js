const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = isProduction ? 'none' : 'lax';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
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

  me: asyncHandler(async (req, res) => {
    return ok(res, { user: req.user.toJSON() });
  }),
};

module.exports = authController;