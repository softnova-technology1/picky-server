const cron = require('node-cron');
const Order = require('../models/order.model');
const OrderService = require('../modules/order/order.service');
const logger = require('../utils/logger');

/**
 * Order Reconciliation Cron Job
 * Runs every 30 minutes
 * Auto-cancels orders that remain in 'pending' payment status for over 60 minutes,
 * automatically restoring inventory stock via OrderService.updateStatus.
 */
const runOrderReconciliationJob = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const pendingOrders = await Order.find({
      paymentStatus: 'pending',
      status: { $nin: ['cancelled', 'delivered'] },
      createdAt: { $lt: oneHourAgo },
    }).select('_id orderNumber createdAt');

    if (pendingOrders.length === 0) return;

    logger.info(`⏰ [CRON] Order Reconciliation: Found ${pendingOrders.length} expired pending order(s) to cancel.`);

    for (const order of pendingOrders) {
      try {
        await OrderService.updateStatus(order._id, {
          status: 'cancelled',
          note: 'Auto-cancelled: Payment not completed within 60 minutes.',
        });
        logger.info(`⏰ [CRON] Auto-cancelled unpaid order: ${order.orderNumber}`);
      } catch (orderErr) {
        logger.error(`❌ [CRON] Failed to cancel order ${order.orderNumber}: ${orderErr.message}`);
      }
    }
  } catch (err) {
    logger.error(`❌ [CRON] Order Reconciliation Job Error: ${err.message}`);
  }
};

const initOrderReconciliationCron = () => {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', () => {
    logger.info('⏰ [CRON] Running Order Reconciliation Check...');
    runOrderReconciliationJob();
  });
};

module.exports = { initOrderReconciliationCron, runOrderReconciliationJob };
