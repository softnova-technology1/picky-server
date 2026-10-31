const { notificationQueue } = require('../../queues/notification.queue');
const { orderQueue } = require('../../queues/order.queue');
const { ApiResponse } = require('../../utils/apiResponse');

const getQueueStats = async (queue) => {
  try {
    const [counts, isPaused] = await Promise.all([
      queue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting'),
      queue.isPaused(),
    ]);
    return {
      status: isPaused ? 'paused' : 'running',
      counts: {
        active: counts.active || 0,
        waiting: counts.waiting || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      },
    };
  } catch (err) {
    return {
      status: 'offline',
      error: err.message,
      counts: { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 },
    };
  }
};

const getMetrics = async (req, res, next) => {
  try {
    const [notificationStats, orderStats] = await Promise.all([
      getQueueStats(notificationQueue),
      getQueueStats(orderQueue),
    ]);

    return res.json(
      ApiResponse.success({
        engine: 'BullMQ',
        queues: {
          notifications: notificationStats,
          orders: orderStats,
        },
        uptime: process.uptime(),
        timestamp: new Date(),
      })
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMetrics,
};

