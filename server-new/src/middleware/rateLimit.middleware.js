const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function rateLimitHandler(message) {
  return (req, res, next, options) => {
    const resetTime = req.rateLimit && req.rateLimit.resetTime ? req.rateLimit.resetTime.getTime() : Date.now();
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
    return res.status(429).json({
      success: false,
      message,
      error: { code: 'RATE_LIMITED', message },
      retryAfterSeconds,
    });
  };
}

const skipHealth = (req) => req.path === '/api/health';

/**
 * Broad per-IP protection for all routes.
 */
const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.maxRequests,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipHealth,
  handler: rateLimitHandler('Too many requests, please try again later.'),
});

/**
 * Tighter per-IP limiter for authentication endpoints.
 * Per-account brute-force protection is handled by the login cooldown service.
 */
const authLimiter = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  limit: env.rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('Too many authentication attempts, please try again shortly.'),
});

/**
 * Per-IP limiter for file uploads (30/hour).
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('Upload limit reached. Please try again later.'),
});

module.exports = { generalLimiter, authLimiter, uploadLimiter };