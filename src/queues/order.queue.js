const { createQueue } = require('./queue.config');
const logger = require('../utils/logger');

const QUEUE_NAME = 'picky-orders';

const orderQueue = createQueue(QUEUE_NAME, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

/**
 * Schedule an unpaid order cancellation after delay (e.g. 15 minutes = 900,000 ms).
 * Uses predictable jobId `order-timeout-${orderId}` so it can be cancelled if payment arrives!
 */
const scheduleOrderTimeout = async (orderId, delayMs = 15 * 60 * 1000) => {
  try {
    const jobId = `order-timeout-${orderId}`;
    return await orderQueue.add(
      'cancel_unpaid_order',
      { orderId: orderId.toString() },
      {
        delay: delayMs,
        jobId,
        removeOnComplete: true,
      }
    );
  } catch (err) {
    logger.warn(`[BullMQ] Could not schedule order timeout for ${orderId}: ${err.message}`);
    return null;
  }
};

/**
 * Remove a scheduled timeout job when customer completes payment.
 */
const cancelOrderTimeout = async (orderId) => {
  try {
    const jobId = `order-timeout-${orderId}`;
    const job = await orderQueue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`[BullMQ] Cancelled unpaid timeout job for order #${orderId}`);
    }
  } catch (err) {
    logger.warn(`[BullMQ] Error removing order timeout job: ${err.message}`);
  }
};

/**
 * Schedule an abandoned cart check after delay (e.g. 2 hours = 7,200,000 ms).
 */
const scheduleAbandonedCartCheck = async (cartId, delayMs = 2 * 60 * 60 * 1000) => {
  try {
    const jobId = `cart-check-${cartId}`;
    return await orderQueue.add(
      'check_abandoned_cart',
      { cartId: cartId.toString() },
      {
        delay: delayMs,
        jobId,
        removeOnComplete: true,
      }
    );
  } catch (err) {
    logger.warn(`[BullMQ] Could not schedule cart check for ${cartId}: ${err.message}`);
    return null;
  }
};

module.exports = {
  QUEUE_NAME,
  orderQueue,
  scheduleOrderTimeout,
  cancelOrderTimeout,
  scheduleAbandonedCartCheck,
};

