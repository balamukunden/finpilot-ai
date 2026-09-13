const env = require('../config/env');
const packageJson = require('../../package.json');

/**
 * Build the public service-info payload for GET /.
 *
 * Intentionally DB/Redis/AI-independent so the root route stays reachable
 * even when those dependencies are unavailable. Never includes secrets,
 * internal paths, or stack traces.
 */
function buildServiceInfo() {
  return {
    success: true,
    service: 'FinPilot API',
    status: 'online',
    version: packageJson.version,
    frontend: env.clientUrl,
    health: '/api/health',
  };
}

module.exports = { buildServiceInfo };