const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// Safe message shown to clients for any unexpected/unrecognized server error.
// Never leak raw exception messages, stack traces, DB internals, or secrets.
const SAFE_UNEXPECTED_MESSAGE = 'An unexpected error occurred. Please try again.';

/**
 * Global error handling middleware.
 * Handles both operational errors (ApiError) and unexpected errors.
 * Returns consistent JSON error responses and never exposes internals.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
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
    message = 'Validation Error';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    operational = true;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    if (field === 'email') {
      code = 'EMAIL_ALREADY_EXISTS';
      message = 'An account with this email already exists';
    } else {
      code = 'DUPLICATE_ENTRY';
      message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    }
    errors = [{ field, message }];
    operational = true;
  }

  // Mongoose cast error (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid request parameter';
    operational = true;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
    operational = true;
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
    operational = true;
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    code = 'FILE_TOO_LARGE';
    message = `File size exceeds the limit of ${env.maxFileSize / (1024 * 1024)}MB`;
    operational = true;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    code = 'UNEXPECTED_FILE';
    message = 'Unexpected file field';
    operational = true;
  }

  // Non-operational (unexpected) errors: never expose internals to the client.
  if (!operational) {
    message = SAFE_UNEXPECTED_MESSAGE;
    if (!code) code = 'INTERNAL_ERROR';
    errors = null;
  }

  // Log the full details server-side only (never returned to the client).
  if (env.isDev || !operational) {
    console.error('[Error]', {
      statusCode,
      code,
      message,
      errors,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: code || 'ERROR',
      message,
    },
    ...(errors && { errors }),
    ...(err.retryAfterSeconds != null && { retryAfterSeconds: err.retryAfterSeconds }),
  });
};

module.exports = errorHandler;
