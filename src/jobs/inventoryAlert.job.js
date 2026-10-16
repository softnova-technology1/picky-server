const cron = require('node-cron');
const Inventory = require('../models/inventory.model');
const Notification = require('../models/notification.model');
const logger = require('../utils/logger');

/**
 * Low Stock & Out-of-Stock Alert Job
 * Schedule: Every 6 hours
 * Automatically creates admin notifications when product inventory falls below threshold.
 */
const runInventoryAlertJob = async () => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Find all inventory items where quantity <= lowStockThreshold
    const lowStockItems = await Inventory.find({
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
    }).populate('product', 'name sku');

    if (!lowStockItems || lowStockItems.length === 0) return;

    let createdCount = 0;

    for (const item of lowStockItems) {
      if (!item.product) continue;

      const isOutOfStock = item.quantity === 0;
      const entityKey = `low_stock_${item.product._id}_${todayStr}`;

      try {
        await Notification.create({
          type: 'inventory',
          category: 'Inventory & Stock',
          title: isOutOfStock
            ? `🚨 Out of Stock: ${item.product.name}`
            : `⚠️ Low Stock Alert: ${item.product.name}`,
          message: isOutOfStock
            ? `Product "${item.product.name}" (SKU: ${item.sku || 'N/A'}) is completely sold out! Restock immediately to avoid losing sales.`
            : `Product "${item.product.name}" (SKU: ${item.sku || 'N/A'}) has only ${item.quantity} unit(s) remaining (Threshold: ${item.lowStockThreshold}).`,
          link: '/softpicky-sn2026/inventory',
          linkText: 'Restock Now',
          entityKey,
          metadata: {
            productId: item.product._id,
            quantity: item.quantity,
            lowStockThreshold: item.lowStockThreshold,
          },
        });
        createdCount++;
      } catch (dupErr) {
        // Ignored if entityKey duplicate (notification already sent today for this product)
        if (dupErr.code !== 11000) {
          logger.error(`❌ [CRON] Low Stock Alert notification error: ${dupErr.message}`);
        }
      }
    }

    if (createdCount > 0) {
      logger.info(`⏰ [CRON] Inventory Alert: Created ${createdCount} low-stock notification(s).`);
    }
  } catch (err) {
    logger.error(`❌ [CRON] Inventory Alert Job Error: ${err.message}`);
  }
};

const initInventoryAlertCron = () => {
  // Run every 6 hours: 00:00, 06:00, 12:00, 18:00
  cron.schedule('0 */6 * * *', () => {
    logger.info('⏰ [CRON] Running Inventory Low-Stock Audit...');
    runInventoryAlertJob();
  });
};

module.exports = { initInventoryAlertCron, runInventoryAlertJob };
