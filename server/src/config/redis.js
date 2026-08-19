const Redis = require('ioredis');
const env = require('./env');

/**
 * Redis client singleton.
 * Used for caching, session management, and rate limiting state.
 */
const redisConfig = {
  host: env.redis.host,
  port: env.redis.port,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      console.warn('[Redis] Max retry attempts reached. Giving up reconnection.');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 5000);
    console.log(`[Redis] Retry attempt ${times}, next retry in ${delay}ms`);
    return delay;
  },
  lazyConnect: true,
};

// Only add password if it is provided
if (env.redis.password) {
  redisConfig.password = env.redis.password;
}

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log(`[Redis] Connected: ${env.redis.host}:${env.redis.port}`);
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('close', () => {
  console.warn('[Redis] Connection closed.');
});

/**
 * Connect to Redis (called on app startup).
 */
async function connectRedis() {
  try {
    await redis.connect();
    // Test the connection
    await redis.ping();
    console.log('[Redis] PING successful — connection verified.');
  } catch (error) {
    console.error('[Redis] Failed to connect:', error.message);
    console.warn('[Redis] Server will continue without Redis caching.');
  }
}

/**
 * Gracefully disconnect from Redis.
 */
async function disconnectRedis() {
  try {
    await redis.quit();
    console.log('[Redis] Disconnected gracefully.');
  } catch (error) {
    console.error('[Redis] Error during disconnect:', error.message);
  }
}

module.exports = { redis, connectRedis, disconnectRedis };
