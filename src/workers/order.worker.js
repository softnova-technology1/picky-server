const { createWorker } = require('../queues/queue.config');
const { QUEUE_NAME } = require('../queues/order.queue');
const Order = require('../models/order.model');
const Cart = require('../models/cart.model');
const Inventory = require('../models/inventory.model');
const logger = require('../utils/logger');

/**
 * Processor for order delayed jobs:
 * 1. cancel_unpaid_order: After 15 minutes, if online payment was not captured, cancel the order and release inventory.
 * 2. check_abandoned_cart: After 2 hours, if user abandoned cart, trigger reminder.
 */
const processOrderJob = async (job) => {
  const { name, data } = job;
  logger.info(`📦 [Order Worker] Processing job ${name} for ID: ${data.orderId || data.cartId}`);

  if (name === 'cancel_unpaid_order') {
    const { orderId } = data;
    const order = await Order.findById(orderId);
    if (!order) return { skipped: true, reason: 'order_not_found' };

    // If order was already paid or confirmed, do nothing
    if (order.paymentStatus === 'paid' || ['confirmed', 'shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return { skipped: true, reason: 'order_already_processed', status: order.status };
    }

    // Cancel expired unpaid order
    order.status = 'cancelled';
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: 'cancelled',
      note: 'Auto-cancelled by system: Payment window expired (15 minutes).',
      timestamp: new Date(),
    });
    await order.save();

    // Restore inventory quantities
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.product) {
          await Inventory.findOneAndUpdate(
            { product: item.product },
            {
              $inc: {
                quantity: item.quantity || 1,
                sold: -(item.quantity || 1),
              },
            }
          ).catch((e) => logger.warn(`[Order Worker] Restoring inventory failed: ${e.message}`));
        }
      }
    }

    logger.info(`🚫 [Order Worker] Order #${order.orderNumber} successfully auto-cancelled due to payment timeout`);
    return { cancelled: true, orderId: order._id };
  }

  if (name === 'check_abandoned_cart') {
    const { cartId } = data;
    const cart = await Cart.findById(cartId).populate('user').lean();
    if (!cart || !cart.items || cart.items.length === 0) {
      return { skipped: true, reason: 'cart_empty_or_cleared' };
    }

    // Cart is still abandoned! Trigger reminder via notificationQueue
    const { addNotificationJob } = require('../queues/notification.queue');
    const customerPhone = cart.user?.phone;
    if (customerPhone) {
      await addNotificationJob('abandoned_cart', {
        phone: customerPhone,
        name: cart.user?.name || 'Customer',
        itemCount: cart.items.length,
      });
      logger.info(`🛒 [Order Worker] Abandoned cart reminder queued for ${customerPhone}`);
    }
    return { reminded: true, cartId };
  }

  return { skipped: true, reason: 'unknown_job' };
};

let orderWorker = null;

const initOrderWorker = () => {
  if (!orderWorker) {
    orderWorker = createWorker(QUEUE_NAME, processOrderJob, {
      concurrency: 3,
    });
  }
  return orderWorker;
};

const closeOrderWorker = async () => {
  if (orderWorker) {
    await orderWorker.close();
    orderWorker = null;
  }
};

module.exports = {
  processOrderJob,
  initOrderWorker,
  closeOrderWorker,
};

