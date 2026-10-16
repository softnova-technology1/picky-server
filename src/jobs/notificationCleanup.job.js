const cron = require('node-cron');
const Notification = require('../models/notification.model');
const logger = require('../utils/logger');

/**
 * Old Notifications Cleanup Job
 * Runs every Sunday at midnight (0 0 * * 0)
 * Purges notifications older than 30 days that are already read and not starred.
 */
const runNotificationCleanupJob = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await Notification.deleteMany({
      unread: false,
      starred: false,
      createdAt: { $lt: thirtyDaysAgo },
    });

    if (result.deletedCount > 0) {
      logger.info(`⏰ [CRON] Notification Cleanup: Purged ${result.deletedCount} old read notification(s).`);
    }
  } catch (err) {
    logger.error(`❌ [CRON] Notification Cleanup Job Error: ${err.message}`);
  }
};

const initNotificationCleanupCron = () => {
  // Run weekly on Sunday at 00:00
  cron.schedule('0 0 * * 0', () => {
    logger.info('⏰ [CRON] Running Old Notifications Cleanup...');
    runNotificationCleanupJob();
  });
};

module.exports = { initNotificationCleanupCron, runNotificationCleanupJob };
