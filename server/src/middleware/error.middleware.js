const ApiError = require('../utils/errors');
const logger = require('../config/logger');
const env = require('../config/env');

const SAFE_UNEXPECTED_MESSAGE = 'An unexpected error occurred. Please try again.';

/**
 * Global error handler. Always returns the standard error envelope and
 * never leaks internal details (stack traces, DB internals, secrets).
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || null;
  let message = err.message || SAFE_UNEXPECTED_MESSAGE;
  let errors = Array.isArray(err.errors) && err.errors.length > 0 ? err.errors : null;
  let operational = err.isOperational === true;

  // Body-parser JSON parse error
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
    operational = true;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    operational = true;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    if (field === 'email') {
      code = 'EMAIL_ALREADY_EXISTS';
      message = 'An account with this email already exists.';
    } else {
      code = 'DUPLICATE_ENTRY';
      message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    }
    errors = [{ field, message }];
    operational = true;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid request parameter';
    operational = true;
  }

  // Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    code = 'FILE_TOO_LARGE';
    message = `File size exceeds the limit of ${(env.maxFileSize / (1024 * 1024)).toFixed(0)}MB`;
    operational = true;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    code = 'UNEXPECTED_FILE';
    message = 'Unexpected file field';
    operational = true;
  }

  // Never expose unexpected errors to the client
  if (!operational) {
    message = SAFE_UNEXPECTED_MESSAGE;
    if (!code) code = 'INTERNAL_ERROR';
    errors = null;
  }

  logger.error({ err, statusCode, code, path: req.originalUrl, reqId: req.id }, 'request failed');

  const body = {
    success: false,
    message,
    error: { code: code || 'ERROR', message },
  };
  if (errors) body.errors = errors;
  if (err.retryAfterSeconds != null) body.retryAfterSeconds = err.retryAfterSeconds;

  return res.status(statusCode).json(body);
}

module.exports = errorMiddleware;