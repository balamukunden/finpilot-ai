const { connectDB } = require('../src/config/db');
const logger = require('../src/config/logger');

/**
 * Vercel Serverless entry point.
 *
 * Health checks are intercepted *before* importing the full Express app so
 * that /api/health can respond even when required environment variables
 * (MONGODB_URI, JWT secrets, …) are missing.  This lets operators verify
 * that the function is deployed and routable without needing every secret
 * configured first.
 */
let app = null;

function getApp() {
  if (!app) {
    // eslint-disable-next-line global-require
    app = require('../src/app');
  }
  return app;
}

let initialized = false;

async function initialize() {
  if (initialized) return;
  await connectDB();
  initialized = true;
}

module.exports = async (req, res) => {
  // ── Fast-path: health endpoint ──────────────────────────────────
  // Always reachable.  Never depends on DB, Redis, AI, or secrets.
  if (req.url === '/api/health' || req.url === '/api/health/') {
    try {
      // Attempt to load env config; if it throws (missing required vars)
      // report a clear "configuration required" state instead of 500.
      require('../src/config/env'); // side-effect: may throw in prod
      return res.status(200).json({
        success: true,
        message: 'FinPilot API is running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Configuration is incomplete but the service itself is deployed.
      // Return 200 with a degraded status so load-balancers/monitors see
      // the function is alive, while clearly stating it cannot serve
      // traffic until configuration is completed.
      return res.status(200).json({
        success: true,
        status: 'configuration_required',
        message: 'FinPilot API is deployed but not yet fully configured.',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── All other routes ────────────────────────────────────────────
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
  return getApp()(req, res);
};