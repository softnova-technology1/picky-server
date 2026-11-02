const { Queue, Worker } = require('bullmq');
const net = require('net');
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
 * Fast non-blocking TCP probe to check if Redis is actively accepting connections
 */
const isRedisAvailable = (timeoutMs = 1200) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(connectionOptions.port, connectionOptions.host);
  });
};

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
    const msg = err?.message || err?.code || 'Connection error';
    if (!msg.includes('ECONNREFUSED')) {
      logger.warn(`[BullMQ Queue "${name}"] Warning: ${msg}`);
    }
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
    const msg = err?.message || err?.code || 'Connection error';
    if (!msg.includes('ECONNREFUSED')) {
      logger.warn(`⚠️ [BullMQ Worker "${name}"] Warning: ${msg}`);
    }
  });

  return worker;
};

module.exports = {
  connectionOptions,
  isRedisAvailable,
  createQueue,
  createWorker,
};
