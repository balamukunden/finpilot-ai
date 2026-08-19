const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * General API rate limiter.
 * Applies to all routes to prevent abuse.
 */
const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/api/health';
  },
});

/**
 * Lightweight rate limiter for authentication routes.
 * Broad per-IP abuse protection only — per-account brute-force protection is
 * handled by the progressive login cooldown (services/loginThrottle).
 * Configurable and demo-friendly (no 15-minute lockouts).
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000, // 1 minute
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 60, // 60 requests/min/IP
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again shortly.',
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts, please try again shortly.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter.
 * Prevents abuse of file upload endpoints.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 uploads per hour
  message: {
    success: false,
    message: 'Upload limit reached. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
};
