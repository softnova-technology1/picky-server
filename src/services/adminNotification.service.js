const Notification = require('../models/notification.model');
const logger = require('../utils/logger');

const AdminNotificationService = {
  /**
   * 1. Order Placed
   */
  async notifyOrderPlaced(order, user, shippingAddress) {
    try {
      const entityKey = `order-placed-${order._id}`;
      const exists = await Notification.findOne({ entityKey });
      if (exists) return exists;

      const customerName = user?.name || shippingAddress?.fullName || 'Customer';
      const totalAmt = order.total ? `₹${Number(order.total).toLocaleString('en-IN')}` : '₹0';
      const itemsCount = order.items?.length || 1;
      const isGift = Boolean(order.giftWrap?.isGiftWrapped);

      return await Notification.create({
        entityKey,
        type: 'order',
        category: 'Orders',
        title: 'New order received',
        subtitle: `Order #${order.orderNumber} · ${totalAmt}`,
        message: `${customerName} placed order for ${totalAmt} (${itemsCount} item${itemsCount > 1 ? 's' : ''}) via ${order.paymentMethod || 'Online'} Payment.${isGift ? ' [🎁 Gift Wrapped]' : ''}`,
        unread: true,
        link: '/softpicky-sn2026/orders',
        linkText: 'View Order',
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          customerName,
          total: order.total,
          isGiftWrapped: isGift,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyOrderPlaced: ${err.message}`);
    }
  },

  /**
   * 2. Order Cancelled
   */
  async notifyOrderCancelled(order, customerName, reason) {
    try {
      const entityKey = `order-cancelled-${order._id}`;
      const exists = await Notification.findOne({ entityKey });
      if (exists) return exists;

      return await Notification.create({
        entityKey,
        type: 'order',
        category: 'Orders',
        title: 'Order cancelled',
        subtitle: `Order #${order.orderNumber} · Cancelled`,
        message: `Order #${order.orderNumber} was cancelled. ${reason ? `Reason: ${reason}` : ''}`,
        unread: true,
        link: '/softpicky-sn2026/orders',
        linkText: 'View Order',
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          reason,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyOrderCancelled: ${err.message}`);
    }
  },

  /**
   * 3. Low Stock Alert (Threshold: stock <= 5)
   */
  async notifyLowStock(product, currentStock) {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const isOut = currentStock === 0;
      const entityKey = `stock-${isOut ? 'out' : 'low'}-${product._id}-${todayStr}`;
      const exists = await Notification.findOne({ entityKey });
      if (exists) return exists;

      return await Notification.create({
        entityKey,
        type: 'inventory',
        category: 'Inventory',
        title: isOut ? 'Out of stock' : 'Low stock alert',
        subtitle: isOut
          ? `${product.name} · 0 units remaining`
          : `${product.name} · ${currentStock} units remaining`,
        message: isOut
          ? `Product "${product.name}" (SKU: ${product.sku || 'N/A'}) is out of stock.`
          : `Product "${product.name}" (SKU: ${product.sku || 'N/A'}) has only ${currentStock} units remaining (Threshold <= 5).`,
        unread: true,
        link: '/softpicky-sn2026/inventory',
        linkText: 'Inspect Stock',
        metadata: {
          productId: product._id,
          productName: product.name,
          stock: currentStock,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyLowStock: ${err.message}`);
    }
  },

  /**
   * 4. Stock Replenished
   */
  async notifyStockReplenished(product, newStock) {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const entityKey = `stock-replenished-${product._id}-${todayStr}`;
      const exists = await Notification.findOne({ entityKey });
      if (exists) return exists;

      return await Notification.create({
        entityKey,
        type: 'inventory',
        category: 'Inventory',
        title: 'Product stock replenished',
        subtitle: `${product.name} · ${newStock} units available`,
        message: `Inventory for "${product.name}" has been replenished to ${newStock} units.`,
        unread: true,
        link: '/softpicky-sn2026/inventory',
        linkText: 'View Inventory',
        metadata: {
          productId: product._id,
          productName: product.name,
          stock: newStock,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyStockReplenished: ${err.message}`);
    }
  },

  /**
   * 5. Payment Failed
   */
  async notifyPaymentFailed(order, reason) {
    try {
      const entityKey = `payment-failed-${order._id}-${Date.now().toString(36)}`;
      return await Notification.create({
        entityKey,
        type: 'payment',
        category: 'Payments',
        title: 'Payment failed',
        subtitle: `Order #${order.orderNumber} · Action may be required`,
        message: `Online payment attempt failed for order #${order.orderNumber}. ${reason ? `Details: ${reason}` : 'Action may be required.'}`,
        unread: true,
        link: '/softpicky-sn2026/orders',
        linkText: 'Inspect Order',
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          reason,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyPaymentFailed: ${err.message}`);
    }
  },

  /**
   * 6. Refund Requested
   */
  async notifyRefundRequested(order, amount, reason) {
    try {
      const entityKey = `refund-req-${order._id}`;
      const exists = await Notification.findOne({ entityKey });
      if (exists) return exists;

      return await Notification.create({
        entityKey,
        type: 'payment',
        category: 'Payments',
        title: 'Refund requested',
        subtitle: `Order #${order.orderNumber} · ₹${amount || order.total}`,
        message: `Refund requested for order #${order.orderNumber}. Amount: ₹${amount || order.total}. Reason: ${reason || 'Customer request'}`,
        unread: true,
        link: '/softpicky-sn2026/returns',
        linkText: 'Review Refund',
        metadata: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount,
          reason,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyRefundRequested: ${err.message}`);
    }
  },

  /**
   * 7. New Customer Registration
   */
  async notifyNewCustomer(user) {
    try {
      const entityKey = `customer-reg-${user._id}`;
      const exists = await Notification.findOne({ entityKey });
      if (exists) return exists;

      const name = user.name || user.phone || 'New Customer';
      return await Notification.create({
        entityKey,
        type: 'customer',
        category: 'Customers',
        title: 'New customer registered',
        subtitle: `${name} · Mobile account created`,
        message: `${name} (${user.phone || user.email || 'Mobile user'}) registered an account on Picky store.`,
        unread: true,
        link: '/softpicky-sn2026/customers',
        linkText: 'View Customer',
        metadata: {
          customerId: user._id,
          name,
          phone: user.phone,
          email: user.email,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyNewCustomer: ${err.message}`);
    }
  },

  /**
   * 8. New Review Received
   */
  async notifyNewReview(review, productDoc) {
    try {
      const entityKey = `review-sub-${review._id}`;
      const exists = await Notification.findOne({ entityKey });
      if (exists) return exists;

      const custName = review.customer?.name || 'Customer';
      return await Notification.create({
        entityKey,
        type: 'customer',
        category: 'Customers',
        title: `New ${review.rating}-star review`,
        subtitle: `${productDoc.name} · By ${custName}`,
        message: `${custName} gave ${review.rating} stars to "${productDoc.name}": "${(review.comment || '').slice(0, 80)}"`,
        unread: true,
        link: '/softpicky-sn2026/reviews',
        linkText: 'Moderate Review',
        metadata: {
          reviewId: review._id,
          productId: productDoc._id,
          productName: productDoc.name,
          rating: review.rating,
        },
      });
    } catch (err) {
      if (err.code !== 11000) logger.warn(`[NOTIF] notifyNewReview: ${err.message}`);
    }
  },
};

module.exports = AdminNotificationService;
