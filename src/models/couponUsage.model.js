const mongoose = require('mongoose');

// Tracks which user used which coupon (prevents duplicate usage)
const couponUsageSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    usedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Compound unique — one use per coupon per user
couponUsageSchema.index({ coupon: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
