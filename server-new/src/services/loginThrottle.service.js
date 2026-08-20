const env = require('../config/env');
const ApiError = require('../utils/errors');

/**
 * In-memory per-account login cooldown.
 * NOTE: state is per-process — resets on restart and is not shared across
 * serverless instances. Sufficient for basic protection; a shared store
 * (Redis) is a documented production upgrade, not a requirement.
 */
const attempts = new Map(); // email -> { failures, lockedUntil }

function getLockoutDuration(failures) {
  const { initialLockoutSeconds, maxLockoutSeconds } = env.auth;
  return Math.min(initialLockoutSeconds * Math.pow(2, failures - env.auth.maxFailedAttempts), maxLockoutSeconds);
}

/**
 * Throw 429 (with retryAfterSeconds) when the account is currently locked.
 */
function enforceCooldown(email) {
  const record = attempts.get(email);
  if (!record || !record.lockedUntil) return;
  if (record.lockedUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    throw ApiError.tooManyRequests(
      `Too many failed attempts. Please try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds
    );
  }
  // Lock expired — clear it.
  attempts.delete(email);
}

function recordFailure(email) {
  const record = attempts.get(email) || { failures: 0, lockedUntil: null };
  record.failures += 1;
  if (record.failures >= env.auth.maxFailedAttempts) {
    const durationSeconds = getLockoutDuration(record.failures);
    record.lockedUntil = Date.now() + durationSeconds * 1000;
  }
  attempts.set(email, record);
}

function clearFailures(email) {
  attempts.delete(email);
}

/**
 * Reset all cooldown state (used by tests).
 */
function resetAll() {
  attempts.clear();
}

module.exports = { enforceCooldown, recordFailure, clearFailures, resetAll };