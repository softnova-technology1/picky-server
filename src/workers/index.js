const { initNotificationWorker, closeNotificationWorker } = require('./notification.worker');
const { initOrderWorker, closeOrderWorker } = require('./order.worker');
const { isRedisAvailable, connectionOptions } = require('../queues/queue.config');
const logger = require('../utils/logger');

let workersRunning = false;

const initWorkers = async () => {
  try {
    const available = await isRedisAvailable(1200);
    if (!available) {
      logger.info(
        `ℹ️ Redis is offline (${connectionOptions.host}:${connectionOptions.port}). BullMQ workers are on standby (In-process fallback active). Run with Docker to engage live Redis.`
      );
      workersRunning = false;
      return;
    }

    initNotificationWorker();
    initOrderWorker();
    workersRunning = true;
    logger.info('👷 BullMQ workers initialized: [picky-notifications (concurrency: 5), picky-orders (concurrency: 3)]');
  } catch (err) {
    logger.warn(`⚠️ BullMQ workers initialization notice: ${err?.message || err}`);
  }
};

const closeWorkers = async () => {
  if (!workersRunning) return;
  try {
    logger.info('Stopping BullMQ workers gracefully...');
    await Promise.allSettled([
      closeNotificationWorker(),
      closeOrderWorker(),
    ]);
    workersRunning = false;
    logger.info('BullMQ workers stopped.');
  } catch (err) {
    logger.warn(`Error closing BullMQ workers: ${err?.message || err}`);
  }
};

module.exports = {
  initWorkers,
  closeWorkers,
};
