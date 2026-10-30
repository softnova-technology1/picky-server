const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}
require('dotenv').config();
const validateEnv = require('./config/env');
const connectDB = require('./config/db');
const initializeDB = require('./config/initializeDB');
const redis = require('./config/redis');
const app = require('./app');
const logger = require('./utils/logger');
// Server entry point - Picky Backend API (Atlas DB configured & Google OAuth enabled)
const PORT = process.env.PORT || 5000;

const start = async () => {
  // 1. Validate all required env vars before doing anything
  validateEnv();

  // 2. Connect to MongoDB
  await connectDB();
  
  // 2.5 Initialize DB
  await initializeDB();

  // 3. Connect to Redis (with fallback)
  try {
    if (typeof redis.connect === 'function') {
      await redis.connect();
    }
  } catch (err) {
    logger.warn(`Redis connection skipped: ${err.message}`);
  }

  // 4. Start Express server
  const server = app.listen(PORT, () => {
    logger.info(`✅ picky-server running on http://localhost:${PORT}`);
    logger.info(`📡 API: http://localhost:${PORT}/api/v1`);
    logger.info(`🏥 Health: http://localhost:${PORT}/health`);

    // 5. Initialize Automated Background Cron Jobs
    try {
      const { initCronJobs } = require('./jobs');
      initCronJobs();
    } catch (cronErr) {
      logger.error(`❌ Cron jobs failed to initialize: ${cronErr.message}`);
    }
  });

  // Graceful shutdown on cloud deployment (Render, AWS, Docker)
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
