/**
 * Custom API Error class.
 * Extends native Error with HTTP status code and operational flag.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Array} errors - Array of validation errors or sub-errors
   * @param {boolean} isOperational - Whether this is an expected (operational) error
   * @param {string} code - Machine-readable error code
   */
  constructor(statusCode, message, errors = [], isOperational = true, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.success = false;
    this.code = code;
    this.retryAfterSeconds = null;

    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  // Factory methods for common errors
  static badRequest(message = 'Bad Request', errors = [], code = 'BAD_REQUEST') {
    return new ApiError(400, message, errors, true, code);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, [], true, code);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, message, [], true, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, [], true, code);
  }

  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new ApiError(409, message, [], true, code);
  }

  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMITED') {
    return new ApiError(429, message, [], true, code);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE') {
    return new ApiError(503, message, [], true, code);
  }

  static internal(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
    return new ApiError(500, message, [], false, code);
  }
}

module.exports = ApiError;
