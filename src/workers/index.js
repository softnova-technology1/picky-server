const { initNotificationWorker, closeNotificationWorker } = require('./notification.worker');
const { initOrderWorker, closeOrderWorker } = require('./order.worker');
const logger = require('../utils/logger');

const initWorkers = () => {
  try {
    initNotificationWorker();
    initOrderWorker();
    logger.info('👷 BullMQ workers initialized: [picky-notifications (concurrency: 5), picky-orders (concurrency: 3)]');
  } catch (err) {
    logger.warn(`⚠️ BullMQ workers initialization warning: ${err.message}`);
  }
};

const closeWorkers = async () => {
  try {
    logger.info('Stopping BullMQ workers gracefully...');
    await Promise.allSettled([
      closeNotificationWorker(),
      closeOrderWorker(),
    ]);
    logger.info('BullMQ workers stopped.');
  } catch (err) {
    logger.warn(`Error closing BullMQ workers: ${err.message}`);
  }
};

module.exports = {
  initWorkers,
  closeWorkers,
};

