const User = require('../models/user.model');
const ApiError = require('../utils/errors');
const { verifyAccessToken } = require('../utils/jwt');
const { isDbConnected } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Require a valid access token (Bearer header or httpOnly cookie).
 * Sets req.userId and req.user.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw ApiError.unauthorized('Access denied. No token provided.');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired.', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid token.', 'INVALID_TOKEN');
  }

  if (!isDbConnected()) {
    throw ApiError.serviceUnavailable('Authentication service is temporarily unavailable.');
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw ApiError.unauthorized('User not found.');
  }

  req.userId = user._id;
  req.user = user;
  next();
});

/**
 * Restrict a route to specific roles.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required.');
    }
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action.');
    }
    next();
  };
}

module.exports = { authenticate, authorize };