const { initAbandonedCartCron } = require('./abandonedCart.job');
const { initOrderReconciliationCron } = require('./orderReconciliation.job');
const { initCouponCleanupCron } = require('./couponCleanup.job');
const logger = require('../utils/logger');

const initCronJobs = () => {
  try {
    initAbandonedCartCron();
    initOrderReconciliationCron();
    initCouponCleanupCron();
    logger.info('⏰ Cron jobs initialized: [abandonedCart (1h), orderReconciliation (30m), couponCleanup (Daily)]');
  } catch (err) {
    logger.error(`❌ Failed to initialize cron jobs: ${err.message}`);
  }
};

module.exports = { initCronJobs };
