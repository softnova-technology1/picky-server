require('dotenv').config();
const validateEnv = require('./config/env');
const connectDB = require('./config/db');
const redis = require('./config/redis');
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const start = async () => {
  // 1. Validate all required env vars before doing anything
  validateEnv();

  // 2. Connect to MongoDB
  await connectDB();

  // 3. Connect to Redis (with fallback)
  try {
    if (typeof redis.connect === 'function') {
      await redis.connect();
    }
  } catch (err) {
    logger.warn(`Redis connection skipped: ${err.message}`);
  }

  // 4. Start Express server
  app.listen(PORT, () => {
    logger.info(`✅ picky-server running on http://localhost:${PORT}`);
    logger.info(`📡 API: http://localhost:${PORT}/api/v1`);
    logger.info(`🏥 Health: http://localhost:${PORT}/health`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
