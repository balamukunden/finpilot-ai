const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const logger = require('../config/logger');
const { getRedis } = require('../config/redis');

/**
 * Distributed rate-limit store (shared across serverless instances) when
 * REDIS_URL is configured. Falls back to the process-local memory store
 * otherwise — that fallback is per-instance and is documented as such.
 */
function buildStore() {
  const redis = getRedis();
  if (!redis) return undefined;
  try {
    const { RedisStore } = require('rate-limit-redis');
    return new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: 'finpilot:rl:',
    });
  } catch (error) {
    logger.warn({ error: error.message }, 'rate-limit-redis unavailable — using in-memory store');
    return undefined;
  }
}

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

const store = buildStore();
const sharedOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipHealth,
  // If the backing store errors (e.g. Redis outage), let the request through
  // rather than 500ing the whole API. Limits degrade, they do not fail closed.
  passOnStoreError: true,
}

/**
 * Broad per-IP protection for all routes.
 */
const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.maxRequests,
  ...sharedOptions,
  handler: rateLimitHandler('Too many requests, please try again later.'),
});

/**
 * Tighter per-IP limiter for authentication endpoints.
 * Per-account brute-force protection is handled by the login cooldown service.
 */
const authLimiter = rateLimit({
  windowMs: env.rateLimit.authWindowMs,
  limit: env.rateLimit.authMax,
  ...sharedOptions,
  handler: rateLimitHandler('Too many authentication attempts, please try again shortly.'),
});

/**
 * Per-IP limiter for file uploads (30/hour).
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  ...sharedOptions,
  handler: rateLimitHandler('Upload limit reached. Please try again later.'),
});

/**
 * Per-IP limiter for AI chat (LLM calls are expensive).
 */
const chatLimiter = rateLimit({
  windowMs: env.rateLimit.chatWindowMs,
  limit: env.rateLimit.chatMax,
  ...sharedOptions,
  handler: rateLimitHandler('Chat limit reached. Please try again shortly.'),
});

module.exports = { generalLimiter, authLimiter, uploadLimiter, chatLimiter };