require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function required(name, fallback) {
  const value = process.env[name];
  if (isProd && !value) {
    throw new Error(`Environment variable ${name} is required in production.`);
  }
  return value || fallback;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  isTest,
  isDev: !isProd && !isTest,
  port: parseInt(process.env.PORT, 10) || 5000,

  mongoUri: required('MONGODB_URI', 'mongodb://localhost:27017/finpilot'),

  jwt: {
    secret: required('JWT_SECRET', 'dev-only-insecure-jwt-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-only-insecure-refresh-secret'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  aiServiceUrl: (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, ''),

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024,

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 60,
  },

  auth: {
    maxFailedAttempts: parseInt(process.env.AUTH_MAX_FAILED_ATTEMPTS, 10) || 5,
    initialLockoutSeconds: parseInt(process.env.AUTH_INITIAL_LOCKOUT_SECONDS, 10) || 30,
    maxLockoutSeconds: parseInt(process.env.AUTH_MAX_LOCKOUT_SECONDS, 10) || 300,
  },

  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Admin',
  },

  testMongoUri: process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/finpilot_test',
};

module.exports = env;