const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { connectRedis, disconnectRedis } = require('./config/redis');
const { ensureAdmin } = require('./services/adminSeed');
const { app, registerRoutes } = require('./app');

// Track server instance for graceful shutdown
let server;

/**
 * Start the server.
 * 1. Connect to MongoDB
 * 2. Connect to Redis
 * 3. Register API routes
 * 4. Start listening
 */
async function startServer() {
  try {
    console.log('==========================================');
    console.log('  FinPilot AI â€” Starting Server');
    console.log('==========================================');
    console.log(`  Environment: ${env.nodeEnv}`);
    console.log(`  Port: ${env.port}`);
    console.log('==========================================\n');

    // Connect to MongoDB
    await connectDB();

    // Ensure the admin/demo account exists (best-effort — never blocks startup
    // when the database is temporarily unavailable).
    try {
      await ensureAdmin();
    } catch (error) {
      console.warn(`[Server] Admin seed skipped: ${error.message}`);
    }

    // Connect to Redis (non-blocking â€” server continues if Redis is unavailable)
    await connectRedis();

    // Register all API routes after DB connections
    registerRoutes();

    // Start Express server
    server = app.listen(env.port, () => {
      console.log(`\n[Server] FinPilot API running on http://localhost:${env.port}`);
      console.log(`[Server] Health check: http://localhost:${env.port}/api/health\n`);
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${env.port} is already in use.`);
        process.exit(1);
      }
      throw err;
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler.
 * Closes server, database, and cache connections cleanly.
 */
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log('[Server] HTTP server closed.');
    });
  }

  // Disconnect from services
  await disconnectDB();
  await disconnectRedis();

  console.log('[Server] Graceful shutdown complete. Goodbye!\n');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Start the server
startServer();


