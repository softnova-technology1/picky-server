const cron = require('node-cron');
const Coupon = require('../models/coupon.model');
const Discount = require('../models/discount.model');
const logger = require('../utils/logger');

/**
 * Promotion (Coupon & Flash Sales) Expiration Job
 * Runs daily at midnight (0 0 * * *)
 * Automatically deactivates expired coupons and discounts.
 */
const runCouponCleanupJob = async () => {
  try {
    const now = new Date();

    // 1. Deactivate expired coupons
    const couponResult = await Coupon.updateMany(
      {
        isActive: true,
        endsAt: { $ne: null, $lt: now },
      },
      {
        $set: { isActive: false },
      }
    );

    // 2. Deactivate expired discounts / flash sales
    const discountResult = await Discount.updateMany(
      {
        isActive: true,
        endsAt: { $ne: null, $lt: now },
      },
      {
        $set: { isActive: false },
      }
    );

    if (couponResult.modifiedCount > 0 || discountResult.modifiedCount > 0) {
      logger.info(
        `⏰ [CRON] Promotion Cleanup: Deactivated ${couponResult.modifiedCount} coupon(s) and ${discountResult.modifiedCount} flash sale(s).`
      );
    }
  } catch (err) {
    logger.error(`❌ [CRON] Promotion Cleanup Job Error: ${err.message}`);
  }
};

const initCouponCleanupCron = () => {
  // Run daily at midnight: 00:00
  cron.schedule('0 0 * * *', () => {
    logger.info('⏰ [CRON] Running Expired Coupons Maintenance...');
    runCouponCleanupJob();
  });
};

module.exports = { initCouponCleanupCron, runCouponCleanupJob };
