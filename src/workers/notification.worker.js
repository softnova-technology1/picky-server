const { createWorker } = require('../queues/queue.config');
const { QUEUE_NAME } = require('../queues/notification.queue');
const NotificationService = require('../services/notification.service');
const AdminNotificationService = require('../services/adminNotification.service');
const logger = require('../utils/logger');

/**
 * Processor for notification jobs.
 * Supports running inside BullMQ Worker or standalone fallback.
 */
const processNotificationJob = async (job) => {
  const { name, data } = job;
  logger.info(`📨 [Notification Worker] Processing ${name} for ${data.phone || data.recipient || 'system'}`);

  switch (name) {
    case 'order_confirmed':
      await NotificationService.sendOrderConfirmed(
        data.phone,
        data.name,
        data.orderNumber,
        data.amount
      );
      break;

    case 'order_shipped':
      await NotificationService.sendOrderShipped(
        data.phone,
        data.orderNumber,
        data.courier,
        data.trackingId
      );
      break;

    case 'order_delivered':
      await NotificationService.sendOrderDelivered(
        data.phone,
        data.orderNumber
      );
      break;

    case 'order_cancelled':
      await NotificationService.sendOrderCancelled(
        data.phone,
        data.orderNumber,
        data.note
      );
      break;

    case 'customer_otp':
      await NotificationService.sendOTP(data.phone, data.otp);
      break;

    case 'admin_alert':
      if (data.handler && typeof AdminNotificationService[data.handler] === 'function') {
        await AdminNotificationService[data.handler](...(data.args || []));
      }
      break;

    default:
      logger.warn(`[Notification Worker] Unrecognized notification type: ${name}`);
  }

  return { status: 'delivered', type: name, timestamp: new Date() };
};

let notificationWorker = null;

const initNotificationWorker = () => {
  if (!notificationWorker) {
    notificationWorker = createWorker(QUEUE_NAME, processNotificationJob, {
      concurrency: 5,
    });
  }
  return notificationWorker;
};

const closeNotificationWorker = async () => {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
};

module.exports = {
  processNotificationJob,
  initNotificationWorker,
  closeNotificationWorker,
};

