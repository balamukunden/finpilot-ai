const ApiError = require('../utils/errors');

function formatIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Validate req.body (and optionally req.query) with a Zod schema.
 * On failure, throws a 400 with field-level errors (VALIDATION_ERROR).
 */
function validate(schema, { query = false } = {}) {
  return (req, res, next) => {
    const source = query ? req.query : req.body;
    const result = schema.safeParse(source);

    if (!result.success) {
      throw ApiError.validation(formatIssues(result.error.issues));
    }

    if (query) {
      req.query = result.data;
    } else {
      req.body = result.data;
    }
    next();
  };
}

module.exports = validate;