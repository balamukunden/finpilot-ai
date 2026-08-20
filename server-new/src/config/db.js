const mongoose = require('mongoose');

let cachedConnection = null;

/**
 * Connect to MongoDB.
 * Caches the connection so serverless warm starts reuse it.
 */
async function connectDB(uri) {
  const connectionString = uri || process.env.MONGODB_URI;
  if (!connectionString) {
    throw new Error('MONGODB_URI is required');
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
  });

  cachedConnection = await mongoose.connect(connectionString, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`[DB] Connected to MongoDB: ${mongoose.connection.name}`);
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