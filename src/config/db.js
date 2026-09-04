const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/picky';
  try {
    const conn = await mongoose.connect(uri, {
      dbName: 'picky',
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`✅ MongoDB connected: ${conn.connection.host} (DB: ${conn.connection.name})`);
  } catch (error) {
    logger.error(`❌ MongoDB connection error: ${error.message}`);
    logger.warn('💡 Tip: If using MongoDB Atlas, check your credentials and ensure your IP is whitelisted (0.0.0.0/0) in Atlas Network Access.');
    if (process.env.NODE_ENV !== 'development') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
