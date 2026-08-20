/**
 * Operational API error with HTTP status, machine-readable code,
 * optional field errors, and optional retryAfterSeconds (for 429s).
 */
class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = options.code || 'ERROR';
    this.errors = options.errors || [];
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', errors = [], code = 'BAD_REQUEST') {
    return new ApiError(400, message, { errors, code });
  }

  static validation(errors = []) {
    return new ApiError(400, 'Validation failed', { errors, code: 'VALIDATION_ERROR' });
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, { code });
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, message, { code });
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, { code });
  }

  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new ApiError(409, message, { code });
  }

  static tooManyRequests(message = 'Too many requests', retryAfterSeconds = null, code = 'RATE_LIMITED') {
    return new ApiError(429, message, { code, retryAfterSeconds });
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE') {
    return new ApiError(503, message, { code });
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    const err = new ApiError(500, message, { code });
    err.isOperational = false;
    return err;
  }
}

module.exports = ApiError;