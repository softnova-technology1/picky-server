const Redis = require('ioredis');
const logger = require('../utils/logger');

// Unified in-memory fallback store
const inMemoryStore = new Map();
const expiryStore = new Map();

const memoryFallback = {
  async set(key, value, mode, duration) {
    inMemoryStore.set(key, value);
    if (mode === 'EX' && duration) {
      if (expiryStore.has(key)) clearTimeout(expiryStore.get(key));
      const t = setTimeout(() => {
        inMemoryStore.delete(key);
        expiryStore.delete(key);
      }, duration * 1000);
      expiryStore.set(key, t);
    }
    return 'OK';
  },

  async get(key) {
    return inMemoryStore.get(key) || null;
  },

  async del(key) {
    if (expiryStore.has(key)) {
      clearTimeout(expiryStore.get(key));
      expiryStore.delete(key);
    }
    return inMemoryStore.delete(key) ? 1 : 0;
  },
};

let realRedis = null;
let isRealRedisReady = false;

const isConfiguredRedis =
  process.env.REDIS_URL &&
  !process.env.REDIS_URL.includes('mock') &&
  !process.env.REDIS_URL.includes('localhost') &&
  !process.env.REDIS_URL.includes('127.0.0.1');

if (isConfiguredRedis) {
  try {
    realRedis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    realRedis.on('connect', () => {
      isRealRedisReady = true;
      logger.info('✅ Remote Redis connected');
    });

    realRedis.on('error', (err) => {
      isRealRedisReady = false;
      logger.warn(`Redis connection error: ${err.message}. Using in-memory fallback.`);
    });
  } catch (err) {
    isRealRedisReady = false;
  }
}

// Export a robust client proxy that delegates to real Redis when ready or in-memory fallback
const redisProxy = {
  async connect() {
    if (realRedis) {
      try {
        await realRedis.connect();
        isRealRedisReady = true;
      } catch {
        isRealRedisReady = false;
      }
    }
    return true;
  },

  async set(key, value, mode, duration) {
    if (realRedis && isRealRedisReady) {
      try {
        return await realRedis.set(key, value, mode, duration);
      } catch {
        isRealRedisReady = false;
      }
    }
    return memoryFallback.set(key, value, mode, duration);
  },

  async get(key) {
    if (realRedis && isRealRedisReady) {
      try {
        return await realRedis.get(key);
      } catch {
        isRealRedisReady = false;
      }
    }
    return memoryFallback.get(key);
  },

  async del(key) {
    if (realRedis && isRealRedisReady) {
      try {
        return await realRedis.del(key);
      } catch {
        isRealRedisReady = false;
      }
    }
    return memoryFallback.del(key);
  },

  getStatus() {
    return realRedis && isRealRedisReady ? 'connected' : 'in-memory-fallback';
  },

  isReady() {
    return Boolean(realRedis && isRealRedisReady);
  },

  on() {},
};

module.exports = redisProxy;
