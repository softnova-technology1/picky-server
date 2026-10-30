const { Queue, Worker } = require('bullmq');
const logger = require('../utils/logger');

/**
 * Parse REDIS_URL into ioredis/BullMQ connection options.
 * BullMQ requires `maxRetriesPerRequest: null`.
 */
const getRedisConnectionOptions = () => {
  const rawUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  try {
    const parsed = new URL(rawUrl);
    const options = {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port || '6379', 10),
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop reconnect spamming if Redis is offline
        return Math.min(times * 150, 2000);
      },
    };

    if (parsed.username) options.username = parsed.username;
    if (parsed.password) options.password = parsed.password;
    if (parsed.protocol === 'rediss:') options.tls = {};

    return options;
  } catch (err) {
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    };
  }
};

const connectionOptions = getRedisConnectionOptions();

/**
 * Factory to create a BullMQ Queue with standardized error handling and retry defaults.
 */
const createQueue = (name, customOptions = {}) => {
  const queue = new Queue(name, {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
      removeOnComplete: {
        count: 500, // keep latest 500 completed jobs in memory
      },
      removeOnFail: {
        count: 1000, // keep latest 1000 failed jobs for debugging
      },
      ...customOptions.defaultJobOptions,
    },
    ...customOptions,
  });

  queue.on('error', (err) => {
    logger.warn(`[BullMQ Queue "${name}"] Connection warning: ${err.message}`);
  });

  return queue;
};

/**
 * Factory to create a BullMQ Worker with standardized lifecycle logging.
 */
const createWorker = (name, processor, customOptions = {}) => {
  const worker = new Worker(name, processor, {
    connection: connectionOptions,
    concurrency: customOptions.concurrency || 5,
    ...customOptions,
  });

  worker.on('ready', () => {
    logger.info(`🚀 [BullMQ Worker "${name}"] Ready and listening for jobs`);
  });

  worker.on('completed', (job) => {
    logger.info(`✅ [BullMQ Worker "${name}"] Job #${job.id} (${job.name}) completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`❌ [BullMQ Worker "${name}"] Job #${job?.id} (${job?.name}) failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.warn(`⚠️ [BullMQ Worker "${name}"] Connection warning: ${err.message}`);
  });

  return worker;
};

module.exports = {
  connectionOptions,
  createQueue,
  createWorker,
};

