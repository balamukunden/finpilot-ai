const env = require('../config/env');
const ApiError = require('../utils/ApiError');

// Per-account (normalized email) failed-login tracker.
// Server-side enforcement only. Reset on process restart (demo-friendly).
const attempts = new Map();

/**
 * Compute the progressive cooldown duration (seconds) for a given failure count.
 * - Failures below AUTH_MAX_FAILED_ATTEMPTS: no cooldown (normal retry).
 * - Threshold crossed: cooldown starts at AUTH_INITIAL_LOCKOUT_SECONDS and
 *   doubles with each further failure, capped at AUTH_MAX_LOCKOUT_SECONDS.
 */
function lockoutSecondsFor(failures) {
  const { maxFailedAttempts, initialLockoutSeconds, maxLockoutSeconds } = env.auth;
  if (failures < maxFailedAttempts) return 0;
  const exponent = failures - maxFailedAttempts;
  const cooldown = initialLockoutSeconds * Math.pow(2, exponent);
  return Math.min(cooldown, maxLockoutSeconds);
}

function entryFor(email) {
  let entry = attempts.get(email);
  if (!entry) {
    entry = { failures: 0, lockoutUntil: 0 };
    attempts.set(email, entry);
  }
  return entry;
}

function remainingSeconds(email) {
  const entry = attempts.get(email);
  if (!entry) return 0;
  return Math.max(0, Math.ceil((entry.lockoutUntil - Date.now()) / 1000));
}

function cooldownLabel(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0 && secs > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ${secs} second${secs > 1 ? 's' : ''}`;
  }
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${secs} second${secs !== 1 ? 's' : ''}`;
}

/**
 * Enforce the cooldown for an email. Throws 429 (with retryAfterSeconds)
 * when a lockout is currently active.
 */
function enforceCooldown(email) {
  const remaining = remainingSeconds(email);
  if (remaining > 0) {
    const err = ApiError.tooManyRequests(
      `Too many failed attempts. Please try again in ${cooldownLabel(remaining)}.`,
      'LOGIN_COOLDOWN'
    );
    err.retryAfterSeconds = remaining;
    throw err;
  }
}

/**
 * Record a failed login attempt. Returns the cooldown seconds that now apply
 * (0 = still allowed to retry immediately).
 */
function recordFailure(email) {
  const entry = entryFor(email);
  entry.failures += 1;
  const cooldown = lockoutSecondsFor(entry.failures);
  if (cooldown > 0) {
    entry.lockoutUntil = Date.now() + cooldown * 1000;
    return cooldown;
  }
  return 0;
}

function clearFailures(email) {
  attempts.delete(email);
}

function getFailureCount(email) {
  const entry = attempts.get(email);
  return entry ? entry.failures : 0;
}

module.exports = {
  enforceCooldown,
  recordFailure,
  clearFailures,
  getFailureCount,
  remainingSeconds,
};
