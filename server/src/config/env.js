require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const WEAK_SECRETS = new Set([
  'change-me',
  'change-me-in-production',
  'change-me-refresh-in-production',
  'dev-only-insecure-jwt-secret',
  'dev-only-insecure-refresh-secret',
  'dev-jwt-secret-for-testing-only',
  'dev-refresh-secret-for-testing-only',
  'secret',
  'jwt-secret',
  'jwt-secret-key',
  'password',
  '123456',
  'changeme',
]);

function isWeakSecret(value) {
  if (!value) return true;
  const normalized = String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
  return WEAK_SECRETS.has(String(value).trim().toLowerCase()) || WEAK_SECRETS.has(normalized);
}

function required(name, fallback) {
  const value = process.env[name];
  if (isProd) {
    if (!value) {
      throw new Error(`Environment variable ${name} is required in production.`);
    }
    if (name === 'JWT_SECRET' || name === 'JWT_REFRESH_SECRET') {
      if (isWeakSecret(value)) {
        throw new Error(
          `Environment variable ${name} must be a strong, unique secret in production. ` +
          'Rejecting insecure placeholder value.'
        );
      }
    }
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
  aiServiceKey: process.env.AI_SERVICE_KEY || '',
  redisUrl: process.env.REDIS_URL || '',

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024,

  storage: {
    provider: (process.env.RECEIPT_STORAGE_PROVIDER || 'local').toLowerCase(),
    bucket: process.env.RECEIPT_STORAGE_BUCKET || '',
    region: process.env.RECEIPT_STORAGE_REGION || 'auto',
    endpoint: process.env.RECEIPT_STORAGE_ENDPOINT || '',
    accessKeyId: process.env.RECEIPT_STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.RECEIPT_STORAGE_SECRET_ACCESS_KEY || '',
    publicBaseUrl: process.env.RECEIPT_STORAGE_PUBLIC_BASE_URL || '',
    cdnHost: process.env.RECEIPT_STORAGE_CDN_HOST || '',
  },

  cookie: {
    sameSite: (process.env.COOKIE_SAME_SITE || (isProd ? 'none' : 'lax')).toLowerCase(),
    secure: process.env.COOKIE_SECURE === 'true' || isProd,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 60,
    chatWindowMs: parseInt(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
    chatMax: parseInt(process.env.CHAT_RATE_LIMIT_MAX, 10) || 20,
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