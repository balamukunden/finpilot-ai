const ApiError = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function notFoundMiddleware(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = notFoundMiddleware;