const cron = require('node-cron');
const Order = require('../models/order.model');
const Notification = require('../models/notification.model');
const logger = require('../utils/logger');

/**
 * Daily Sales & Performance Digest Job
 * Runs every day at 09:00 AM (0 9 * * *)
 * Computes yesterday's store metrics (Orders, Revenue, Shipments) and posts an admin notification.
 */
const runDailyDigestJob = async () => {
  try {
    const now = new Date();
    // Yesterday 00:00:00 to 23:59:59.999
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    const dateKey = startOfYesterday.toISOString().slice(0, 10);

    const yesterdayOrders = await Order.find({
      createdAt: { $gte: startOfYesterday, $lte: endOfYesterday },
      status: { $ne: 'cancelled' },
    }).select('total status orderNumber paymentStatus');

    const totalOrders = yesterdayOrders.length;
    const grossRevenue = yesterdayOrders.reduce((sum, ord) => sum + (ord.total || 0), 0);
    const pendingShipments = yesterdayOrders.filter((ord) => ord.status === 'confirmed').length;

    const formattedRevenue = Math.round(grossRevenue).toLocaleString('en-IN');
    const entityKey = `daily_digest_${dateKey}`;

    await Notification.create({
      type: 'system',
      category: 'Daily Sales Digest',
      title: `📊 Daily Store Digest: ₹${formattedRevenue}`,
      message: `Yesterday (${dateKey}), your store processed ${totalOrders} order(s) generating ₹${formattedRevenue} in revenue. There are ${pendingShipments} pending shipment(s) waiting to be dispatched.`,
      link: '/softpicky-sn2026/dashboard',
      linkText: 'Open Dashboard',
      entityKey,
      metadata: {
        date: dateKey,
        totalOrders,
        grossRevenue,
        pendingShipments,
      },
    });

    logger.info(
      `⏰ [CRON] Daily Digest posted: ${totalOrders} orders, ₹${formattedRevenue} revenue for ${dateKey}.`
    );
  } catch (err) {
    if (err.code === 11000) {
      // Already posted for yesterday
      return;
    }
    logger.error(`❌ [CRON] Daily Digest Job Error: ${err.message}`);
  }
};

const initDailyDigestCron = () => {
  // Run every morning at 09:00 AM
  cron.schedule('0 9 * * *', () => {
    logger.info('⏰ [CRON] Running Daily Store Digest Calculation...');
    runDailyDigestJob();
  });
};

module.exports = { initDailyDigestCron, runDailyDigestJob };
