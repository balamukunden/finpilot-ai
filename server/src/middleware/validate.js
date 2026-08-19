const ApiError = require('../utils/ApiError');

/**
 * Zod validation middleware factory.
 * Validates req.body against the provided Zod schema.
 * @param {import('zod').ZodSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw ApiError.badRequest('Validation failed', errors, 'VALIDATION_ERROR');
  }

  // Replace body with parsed (cleaned) data
  req.body = result.data;
  next();
};

module.exports = validate;
