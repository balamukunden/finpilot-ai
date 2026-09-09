const env = require('../config/env');
const ApiError = require('../utils/errors');
const { getRedis } = require('../config/redis');

/**
 * Per-account login cooldown with progressive lockout.
 *
 * Backing store:
 *  - when REDIS_URL is set, state is shared across instances via Redis;
 *  - otherwise an in-memory Map is used (per-process, documented limitation).
 *
 * Every Redis operation degrades to the in-memory path on transient errors so
 * a Redis outage can never take down authentication.
 */
const attempts = new Map(); // email -> { failures, lockedUntil }

const PREFIX = 'finpilot:throttle:';

function getLockoutDuration(failures) {
  const { initialLockoutSeconds, maxLockoutSeconds } = env.auth;
  return Math.min(initialLockoutSeconds * Math.pow(2, failures - env.auth.maxFailedAttempts), maxLockoutSeconds);
}

function throwLocked(lockedUntil) {
  const retryAfterSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
  throw ApiError.tooManyRequests(
    `Too many failed attempts. Please try again in ${retryAfterSeconds} seconds.`,
    retryAfterSeconds
  );
}

async function redisGet(email) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(PREFIX + email);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null; // fall through to in-memory
  }
}

async function redisSet(email, record) {
  const redis = getRedis();
  if (!redis) return;
  const ttlSeconds = record.lockedUntil
    ? Math.max(60, Math.ceil((record.lockedUntil - Date.now()) / 1000) + 60)
    : Math.max(60, env.auth.maxLockoutSeconds);
  try {
    await redis.set(PREFIX + email, JSON.stringify(record), 'EX', ttlSeconds);
  } catch (error) {
    // memory path already holds the same record
  }
}

async function redisDel(email) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(PREFIX + email);
  } catch (error) {
    // ignore — in-memory path clears its own record
  }
}

async function enforceCooldown(email) {
  const record = await redisGet(email);
  if (record && record.lockedUntil > Date.now()) throwLocked(record.lockedUntil);
  if (record) await redisDel(email);

  const memory = attempts.get(email);
  if (!memory || !memory.lockedUntil) return;
  if (memory.lockedUntil > Date.now()) throwLocked(memory.lockedUntil);
  attempts.delete(email);
}

async function recordFailure(email) {
  const record = attempts.get(email) || { failures: 0, lockedUntil: null };
  record.failures += 1;
  if (record.failures >= env.auth.maxFailedAttempts) {
    record.lockedUntil = Date.now() + getLockoutDuration(record.failures) * 1000;
  }
  attempts.set(email, record);
  await redisSet(email, record);
}

async function clearFailures(email) {
  attempts.delete(email);
  await redisDel(email);
}

/**
 * Reset all cooldown state (used by tests).
 */
async function resetAll() {
  attempts.clear();
}

module.exports = { enforceCooldown, recordFailure, clearFailures, resetAll };