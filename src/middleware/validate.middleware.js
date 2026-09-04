const { ApiResponse } = require('../utils/apiResponse');

/**
 * Zod schema validation middleware
 * Usage: validate(myZodSchema)
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    return res.status(400).json(ApiResponse.error(errors.join(', '), 400));
  }
  req.body = result.data; // use parsed (sanitized) data
  next();
};

module.exports = { validate };
