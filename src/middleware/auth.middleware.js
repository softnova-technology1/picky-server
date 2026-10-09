const jwt = require('jsonwebtoken');
const AppError = require('../utils/appError');
const User = require('../models/user.model');

const mongoose = require('mongoose');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Temporarily bypass authentication for development testing with real DB user
      let fallbackUser = await User.findOne({ role: 'customer' }).select('-__v');
      if (!fallbackUser) fallbackUser = await User.findOne().select('-__v');
      req.user = fallbackUser || { _id: new mongoose.Types.ObjectId(), role: 'customer' };
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id).select('-__v').lean();
    if (!user) throw new AppError('User not found', 401);

    // Security: block disabled accounts even if they hold a valid JWT
    if (user.isActive === false) {
      throw new AppError('Account is disabled. Contact support.', 403);
    }

    // Security: invalidate tokens issued before the last password change
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(new Date(user.passwordChangedAt).getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        throw new AppError('Password has been changed. Please log in again.', 401);
      }
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(new AppError('Token expired', 401));
    if (err.name === 'JsonWebTokenError') return next(new AppError('Invalid token', 401));
    next(err);
  }
};

module.exports = { authenticate };
