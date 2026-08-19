const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const env = require('./env');

// Embedded (in-process) MongoDB instance. Only started when the configured
// MongoDB URI is unreachable, and only stopped on graceful shutdown.
let embeddedServer = null;

// Persistent on-disk data directory for the embedded fallback so accounts and
// data survive backend restarts (dev/demo environments without a real MongoDB).
const EMBEDDED_DB_PATH = path.resolve(__dirname, '..', '..', '.data', 'mongodb');

const MONGOOSE_OPTS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 2000,
  socketTimeoutMS: 10000,
};

async function connectToMongo(uri, label) {
  await mongoose.connect(uri, MONGOOSE_OPTS);
  console.log(
    `[MongoDB] Connected: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}${label ? ` (${label})` : ''}`
  );
}

async function startEmbeddedMongo() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  fs.mkdirSync(EMBEDDED_DB_PATH, { recursive: true });

  console.log('[MongoDB] Starting persistent embedded MongoDB instance...');
  embeddedServer = await MongoMemoryServer.create({
    binary: { version: '6.0.14' },
    instance: {
      dbPath: EMBEDDED_DB_PATH,
      storageEngine: 'wiredTiger',
      dbName: 'finpilot',
      port: 27017,
    },
  });
  console.log(`[MongoDB] Embedded MongoDB data dir: ${EMBEDDED_DB_PATH}`);
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;

  try {
    await connectToMongo(env.mongodbUri);
  } catch (error) {
    console.warn(`[MongoDB] Connection to ${env.mongodbUri} failed: ${error.message}`);
    try {
      await startEmbeddedMongo();
      await connectToMongo(env.mongodbUri, 'embedded-persistent');
    } catch (memErr) {
      // Never crash the API server because the database is unavailable.
      // The server starts anyway and authentication/data routes respond
      // with a safe 503 ("service temporarily unavailable") until the
      // database becomes reachable again.
      console.error('[MongoDB] Embedded fallback error:', memErr.message);
      console.warn('[MongoDB] Server will start WITHOUT a database connection.');
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });
}

async function stopEmbeddedMongo() {
  if (embeddedServer) {
    try {
      await embeddedServer.stop();
      console.log('[MongoDB] Embedded MongoDB stopped. Data preserved on disk.');
    } catch (error) {
      console.error('[MongoDB] Error stopping embedded MongoDB:', error.message);
    } finally {
      embeddedServer = null;
    }
  }
}

async function disconnectDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log('[MongoDB] Disconnected gracefully.');
  } catch (error) {
    console.error('[MongoDB] Error during disconnect:', error.message);
  } finally {
    await stopEmbeddedMongo();
  }
}

module.exports = { connectDB, disconnectDB, stopEmbeddedMongo };
