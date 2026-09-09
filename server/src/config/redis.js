const env = require('./env');
const logger = require('./logger');

/**
 * Optional Redis client (REDIS_URL).
 *
 * When REDIS_URL is set, rate limits and the per-account login cooldown are
 * backed by a shared store so they survive across Vercel/serverless
 * instances. When it is not set, the app degrades to per-instance in-memory
 * stores — usable, but not distributed state. Production deployments should
 * provide REDIS_URL.
 */
let client = null;
let disabled = false;

function getRedis() {
  if (disabled || !env.redisUrl) return null;
  if (client && (client.status === 'ready' || client.status === 'connecting' || client.status === 'connect')) {
    return client;
  }
  let Redis;
  try {
    // eslint-disable-next-line global-require
    Redis = require('ioredis');
  } catch (error) {
    disabled = true;
    logger.warn({ error: error.message }, 'ioredis unavailable — using in-memory stores');
    return null;
  }

  try {
    client = new Redis(env.redisUrl, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      enableReadyCheck: true,
    });
    client.on('error', (error) => {
      // ioredis reconnects and retries; keep serving with in-memory fallbacks.
      logger.warn({ error: error.message }, 'Redis connection issue — serving with in-memory fallbacks');
    });
    return client;
  } catch (error) {
    disabled = true;
    logger.warn({ error: error.message }, 'Redis unavailable — using in-memory stores');
    return null;
  }
}

async function closeRedis() {
  if (client && (client.status === 'ready' || client.status === 'connecting' || client.status === 'connect')) {
    await client.quit();
  }
  client = null;
}

module.exports = { getRedis, closeRedis };