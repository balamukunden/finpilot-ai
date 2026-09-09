const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const logger = require('./config/logger');

async function start() {
  try {
    await connectDB(env.mongoUri);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    logger.info(`FinPilot API running on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();