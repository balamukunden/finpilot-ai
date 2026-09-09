const mongoose = require('mongoose');
const logger = require('./logger');
const env = require('./env');

let cachedConnection = null;

/**
 * Connect to MongoDB.
 * Caches the connection so serverless warm starts reuse it.
 */
async function connectDB(uri) {
  const connectionString = uri || env.mongoUri;
  if (!connectionString) {
    throw new Error('MONGODB_URI is required');
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => {
    logger.error({ error: err.message }, '[DB] MongoDB connection error');
  });

  cachedConnection = await mongoose.connect(connectionString, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: env.isProd ? 10 : 50,
  });

  logger.info(`[DB] Connected to MongoDB: ${mongoose.connection.name}`);
  return cachedConnection;
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

async function disconnectDB() {
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
  }
}

module.exports = { connectDB, disconnectDB, isDbConnected };