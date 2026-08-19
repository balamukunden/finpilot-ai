const dotenv = require('dotenv');
const path = require('path');

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Validated environment configuration.
 * All values are validated at startup — the server will not start with missing config.
 */
const env = {
  // App
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/finpilot',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // AI Service
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  // File Uploads
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
  uploadDir: process.env.UPLOAD_DIR || 'uploads',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Auth brute-force / progressive cooldown
  auth: {
    maxFailedAttempts: parseInt(process.env.AUTH_MAX_FAILED_ATTEMPTS, 10) || 5,
    initialLockoutSeconds: parseInt(process.env.AUTH_INITIAL_LOCKOUT_SECONDS, 10) || 30,
    maxLockoutSeconds: parseInt(process.env.AUTH_MAX_LOCKOUT_SECONDS, 10) || 300,
  },

  // Admin / demo account seed (optional; skipped when not configured)
  admin: {
    email: (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Admin',
  },

  // Currency
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'INR',
};

/**
 * Validate required environment variables at startup.
 */
function validateEnv() {
  const required = [
    { key: 'JWT_SECRET', value: env.jwt.secret },
    { key: 'JWT_REFRESH_SECRET', value: env.jwt.refreshSecret },
  ];

  const missing = required.filter((item) => !item.value);

  if (missing.length > 0) {
    const keys = missing.map((item) => item.key).join(', ');
    console.error(`[ENV] Missing required environment variables: ${keys}`);
    process.exit(1);
  }
}

// Validate on import
validateEnv();

module.exports = env;
