const { initAbandonedCartCron } = require('./abandonedCart.job');
const { initOrderReconciliationCron } = require('./orderReconciliation.job');
const { initCouponCleanupCron } = require('./couponCleanup.job');
const { initInventoryAlertCron } = require('./inventoryAlert.job');
const { initDailyDigestCron } = require('./dailyDigest.job');
const { initNotificationCleanupCron } = require('./notificationCleanup.job');
const logger = require('../utils/logger');

const initCronJobs = () => {
  try {
    initAbandonedCartCron();
    initOrderReconciliationCron();
    initCouponCleanupCron();
    initInventoryAlertCron();
    initDailyDigestCron();
    initNotificationCleanupCron();
    logger.info(
      '⏰ Cron jobs initialized: [abandonedCart (1h), orderReconciliation (30m), promotionCleanup (Midnight), inventoryAlert (6h), dailyDigest (9 AM), notificationCleanup (Weekly)]'
    );
  } catch (err) {
    logger.error(`❌ Failed to initialize cron jobs: ${err.message}`);
  }
};

module.exports = { initCronJobs };
