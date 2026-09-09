const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const env = require('./config/env');
const logger = require('./config/logger');
const { generalLimiter } = require('./middleware/rateLimit.middleware');
const csrfProtection = require('./middleware/csrf.middleware');
const notFoundMiddleware = require('./middleware/notFound.middleware');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

// Distributed-state notice. Without REDIS_URL, rate limits and the login
// cooldown are per-instance — fine for dev, not distributed on serverless.
if (env.isProd && !env.redisUrl) {
  logger.warn('REDIS_URL is not set — rate limits and login cooldown are per-instance, not distributed.');
}

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.isProd ? undefined : false,
  })
);

// CORS — allowlist from CLIENT_URL (comma-separated). Loopback is allowed
// only in non-production so local development keeps working.
const allowedOrigins = env.clientUrl
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
if (!env.isProd && !allowedOrigins.includes('http://localhost:5173')) {
  allowedOrigins.push('http://localhost:5173');
}

app.use(
  cors({
    origin(origin, callback) {
      // No origin (same-origin/curl) is allowed; otherwise require allowlist.
      const allowed = !origin || allowedOrigins.includes(origin);
      return callback(null, allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  })
);

// General rate limiting (health is skipped)
app.use(generalLimiter);

// Body parsing + cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Structured request logging
app.use(
  require('pino-http')({
    logger,
    autoLogging: env.isProd,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[REDACTED]',
    },
  })
);

// Static uploaded receipts (local development only)
if (!env.isProd) {
  const uploadDir = path.resolve(process.cwd(), env.uploadDir);
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    app.use('/uploads', express.static(uploadDir));
  } catch (error) {
    logger.warn({ error: error.message }, 'Could not prepare uploads dir (serverless)');
  }
}

// Health check (no DB / Redis / AI dependency)
app.use('/api/health', require('./routes/health.routes'));

// CSRF protection for cookie-authenticated mutating requests.
// Must run after cookie-parser and before the API routes.
app.use(csrfProtection);

// API routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/transactions', require('./routes/transaction.routes'));
app.use('/api/goals', require('./routes/goal.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/scanner', require('./routes/scanner.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));

// 404 + centralized error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;