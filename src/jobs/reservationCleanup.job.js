const cron = require('node-cron');
const CheckoutReservation = require('../models/checkoutReservation.model');
const Inventory = require('../models/inventory.model');
const Product = require('../models/product.model');
const logger = require('../utils/logger');

/**
 * Reservation Cleanup & Stock Reconcile Cron Job
 *
 * 1. Automatically finds expired checkout reservations (status: 'reserved' & expiresAt <= now)
 *    and gracefully restores inventory quantity & product stock, setting status to 'released'.
 *
 * 2. Self-Healing Orphan Check: If any product in Inventory has reserved > 0 but there is no
 *    active, unexpired reservation for it, the orphan difference is automatically restored to
 *    available quantity, and reserved is reset to 0.
 *
 * 3. Purges released/completed checkout reservations older than 7 days.
 */
const runReservationCleanupJob = async () => {
  try {
    const now = new Date();

    // ─── 1. Release Expired Checkout Reservations ─────────────────────────────
    const expiredReservations = await CheckoutReservation.find({
      status: 'reserved',
      expiresAt: { $lte: now },
    });

    if (expiredReservations.length > 0) {
      logger.info(
        `⏰ [CRON] Reservation Cleanup: Found ${expiredReservations.length} expired checkout reservation(s) to release.`
      );

      for (const res of expiredReservations) {
        try {
          if (Array.isArray(res.items)) {
            for (const item of res.items) {
              if (item.product && item.quantity > 0) {
                // Restore available quantity and deduct reserved
                await Inventory.findOneAndUpdate(
                  { product: item.product },
                  { $inc: { quantity: item.quantity, reserved: -item.quantity } }
                );
                await Inventory.updateOne(
                  { product: item.product, reserved: { $lt: 0 } },
                  { $set: { reserved: 0 } }
                );
                await Product.findByIdAndUpdate(item.product, {
                  $inc: { stock: item.quantity },
                });
              }
            }
          }
          res.status = 'released';
          await res.save();
          logger.info(`⏰ [CRON] Successfully released expired reservation session: ${res.sessionId}`);
        } catch (resErr) {
          logger.error(`❌ [CRON] Failed releasing reservation ${res._id}: ${resErr.message}`);
        }
      }
    }

    // ─── 2. Self-Healing Orphan Reservation Audit ────────────────────────────
    const activeHolds = await CheckoutReservation.aggregate([
      { $match: { status: 'reserved', expiresAt: { $gt: now } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalActiveHold: { $sum: '$items.quantity' },
        },
      },
    ]);

    const holdMap = {};
    activeHolds.forEach((h) => {
      if (h._id) holdMap[String(h._id)] = Number(h.totalActiveHold) || 0;
    });

    const inventoriesWithReserved = await Inventory.find({ reserved: { $gt: 0 } });
    for (const inv of inventoriesWithReserved) {
      const pId = String(inv.product);
      const expectedHold = holdMap[pId] || 0;

      if (inv.reserved > expectedHold) {
        const orphanDiff = inv.reserved - expectedHold;
        logger.info(
          `⏰ [CRON] Self-Healing: Product ${pId} has ${inv.reserved} reserved, but only ${expectedHold} active. Restoring ${orphanDiff} unit(s) to stock.`
        );

        await Inventory.findByIdAndUpdate(inv._id, {
          $set: { reserved: expectedHold },
          $inc: { quantity: orphanDiff },
        });

        await Product.findByIdAndUpdate(inv.product, {
          $inc: { stock: orphanDiff },
        });
      }
    }

    // ─── 3. Purge Released / Completed Records Older Than 7 Days ───────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await CheckoutReservation.deleteMany({
      status: { $in: ['released', 'completed'] },
      updatedAt: { $lt: sevenDaysAgo },
    }).catch(() => {});
  } catch (err) {
    logger.error(`❌ [CRON] Reservation Cleanup Job Error: ${err.message}`);
  }
};

const initReservationCleanupCron = () => {
  // Immediate run 2 seconds after server starts up to clean any downtime stale holds
  setTimeout(() => {
    runReservationCleanupJob().catch((e) =>
      logger.warn(`Startup reservation cleanup notice: ${e.message}`)
    );
  }, 2000);

  // Scheduled to run every 2 minutes
  cron.schedule('*/2 * * * *', () => {
    logger.info('⏰ [CRON] Running 2-Minute Checkout Reservation & Stock Audit...');
    runReservationCleanupJob();
  });
};

module.exports = { initReservationCleanupCron, runReservationCleanupJob };
