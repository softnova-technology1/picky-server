const cron = require('node-cron');
const Cart = require('../models/cart.model');
const logger = require('../utils/logger');

/**
 * Abandoned Cart Maintenance Job
 * Runs every hour (0 * * * *)
 * 1. Automatically marks carts older than 14 days as 'expired'
 */
const runAbandonedCartJob = async () => {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = await Cart.updateMany(
      {
        status: { $in: ['pending', 'sent'] },
        updatedAt: { $lt: fourteenDaysAgo },
        'items.0': { $exists: true },
      },
      {
        $set: { status: 'expired' },
        $push: {
          timeline: {
            event: 'Auto Expired',
            note: 'Cart inactive for over 14 days, auto-marked as expired by maintenance cron.',
            timestamp: new Date(),
          },
        },
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`⏰ [CRON] Abandoned Cart Job: Marked ${result.modifiedCount} old cart(s) as expired.`);
    }
  } catch (err) {
    logger.error(`❌ [CRON] Abandoned Cart Job Error: ${err.message}`);
  }
};

const initAbandonedCartCron = () => {
  // Run every hour
  cron.schedule('0 * * * *', () => {
    logger.info('⏰ [CRON] Running Abandoned Cart Maintenance...');
    runAbandonedCartJob();
  });
};

module.exports = { initAbandonedCartCron, runAbandonedCartJob };
