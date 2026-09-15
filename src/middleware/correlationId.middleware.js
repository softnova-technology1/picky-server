const { randomUUID } = require('crypto');

/**
 * Correlation ID Middleware
 * Attaches a unique X-Request-ID to every request for end-to-end log tracing.
 * If client sends X-Request-ID header, that value is propagated.
 */
const correlationId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

module.exports = correlationId;
