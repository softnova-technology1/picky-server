const { createQueue } = require('./queue.config');
const logger = require('../utils/logger');

const QUEUE_NAME = 'picky-notifications';

const notificationQueue = createQueue(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 4, // 4 attempts with exponential backoff for messaging
    backoff: {
      type: 'exponential',
      delay: 4000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 2000 },
  },
});

/**
 * Add a notification job to the BullMQ queue.
 *
 * @param {string} type - 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled' | 'customer_otp' | 'abandoned_cart' | 'admin_alert'
 * @param {object} payload - Job data
 * @param {object} [options] - Optional BullMQ Job options (e.g. delay)
 */
const addNotificationJob = async (type, payload, options = {}) => {
  try {
    const job = await notificationQueue.add(type, payload, {
      ...options,
    });
    return job;
  } catch (err) {
    logger.warn(`[BullMQ] Could not enqueue notification (${type}): ${err.message}. Running fallback...`);
    // Fallback: If Redis is offline during local dev without Docker, execute immediately in-process
    try {
      const { processNotificationJob } = require('../workers/notification.worker');
      await processNotificationJob({ name: type, data: payload, id: `fallback-${Date.now()}` });
    } catch (fallbackErr) {
      logger.error(`[BullMQ Fallback] Notification execution failed: ${fallbackErr.message}`);
    }
    return null;
  }
};

module.exports = {
  QUEUE_NAME,
  notificationQueue,
  addNotificationJob,
};

