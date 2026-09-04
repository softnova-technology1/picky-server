const AppError = require('../utils/appError');

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Not authenticated', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Access denied: insufficient permissions', 403));
    }
    next();
  };
};

module.exports = { requireRole };
