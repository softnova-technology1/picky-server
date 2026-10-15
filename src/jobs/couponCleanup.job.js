const cron = require('node-cron');
const Coupon = require('../models/coupon.model');
const logger = require('../utils/logger');

/**
 * Coupon Expiration Maintenance Job
 * Runs daily at midnight (0 0 * * *)
 * Automatically deactivates expired coupons.
 */
const runCouponCleanupJob = async () => {
  try {
    const now = new Date();
    const result = await Coupon.updateMany(
      {
        isActive: true,
        endsAt: { $ne: null, $lt: now },
      },
      {
        $set: { isActive: false },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`⏰ [CRON] Coupon Cleanup: Deactivated ${result.modifiedCount} expired coupon(s).`);
    }
  } catch (err) {
    logger.error(`❌ [CRON] Coupon Cleanup Job Error: ${err.message}`);
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
