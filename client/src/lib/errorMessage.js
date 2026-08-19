/**
 * Centralized API error-message extraction.
 *
 * Turns an Axios error into a safe, user-friendly message.
 * - Never leaks stack traces, raw exceptions, or backend internals.
 * - Maps HTTP status codes to specific, safe messages.
 * - Falls back to a generic message for anything unknown.
 */

const NETWORK_ERROR_MESSAGE = 'Unable to reach the server. Check your connection and try again.';
const SERVER_ERROR_MESSAGE = 'Unable to complete the request right now. Please try again.';
const UNAVAILABLE_ERROR_MESSAGE = 'Registration is temporarily unavailable. Please try again.';
const EMAIL_EXISTS_MESSAGE = 'An account with this email already exists.';
const REQUIRED_FIELDS_MESSAGE = 'Please fill in all required fields.';
export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Extract a safe, user-facing message from an error.
 * @param {*} error - The caught error (typically an Axios error).
 * @param {string} [fallback] - Fallback message when nothing usable is found.
 * @returns {string}
 */
export function extractErrorMessage(error, fallback = DEFAULT_ERROR_MESSAGE) {
  if (!error || typeof error !== 'object') return fallback;

  const status = error.response?.status;
  const data = error.response?.data;
  const code = data?.error?.code || data?.code;
  const message = data?.error?.message || data?.message;
  const fieldMessage =
    Array.isArray(data?.errors) && data.errors[0]?.message ? data.errors[0].message : undefined;

  // No HTTP response received — network / server unreachable.
  if (!error.response) return NETWORK_ERROR_MESSAGE;

  // Duplicate resource (existing email).
  if (status === 409) {
    if (code === 'EMAIL_ALREADY_EXISTS' || /email/i.test(message || '')) return EMAIL_EXISTS_MESSAGE;
    return message || fallback;
  }

  // Validation error — prefer the field-specific message from the backend.
  if (status === 400) return fieldMessage || message || REQUIRED_FIELDS_MESSAGE;

  // Authentication / authorization.
  if (status === 401) return message || 'Your session has expired. Please sign in again.';
  if (status === 403) return message || 'You do not have permission to perform this action.';

  if (status === 404) return message || fallback;

  // Rate limited.
  if (status === 429) return message || 'Too many attempts. Please try again later.';

  // Service / database unavailable.
  if (status === 503) return UNAVAILABLE_ERROR_MESSAGE;

  // Any other server error — safe generic message.
  if (status >= 500) return SERVER_ERROR_MESSAGE;

  return message || fallback;
}
