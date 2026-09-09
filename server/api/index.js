const app = require('../src/app');
const { connectDB } = require('../src/config/db');
const logger = require('../src/config/logger');

/**
 * Vercel Serverless entry point.
 * Initializes the database connection once per cold start, then delegates
 * every request to the existing Express application.
 */
let initialized = false;

async function initialize() {
  if (initialized) return;
  await connectDB();
  initialized = true;
}

module.exports = async (req, res) => {
  try {
    await initialize();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize database');
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable.',
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable.' },
    });
  }
  return app(req, res);
};