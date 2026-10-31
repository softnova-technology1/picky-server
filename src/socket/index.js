const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.IO with HTTP server
 */
const initSocket = (httpServer) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:80,http://localhost')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Optional authentication middleware for identifying customer vs admin
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
          socket.userId = decoded.id;
          socket.userRole = decoded.role || 'customer';
        } catch (_) {
          // Token expired or invalid - allow anonymous connection for public catalog updates
        }
      }
      next();
    } catch (err) {
      next();
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 [Socket.IO] Client connected: ${socket.id} (user: ${socket.userId || 'guest'})`);

    // Automatically join personal user room if authenticated
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      if (socket.userRole === 'admin' || socket.userRole === 'superadmin') {
        socket.join('admin');
        logger.info(`👑 [Socket.IO] Admin socket joined admin room: ${socket.id}`);
      }
    }

    // Explicit room joins from client
    socket.on('admin:join', () => {
      socket.join('admin');
      logger.info(`👑 [Socket.IO] Socket joined admin room: ${socket.id}`);
    });

    socket.on('order:watch', (orderId) => {
      if (orderId) {
        socket.join(`order:${orderId}`);
        logger.info(`📦 [Socket.IO] Socket ${socket.id} watching order #${orderId}`);
      }
    });

    socket.on('order:unwatch', (orderId) => {
      if (orderId) {
        socket.leave(`order:${orderId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`🔌 [Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  logger.info('🚀 Socket.IO server initialized successfully');
  return io;
};

const getIO = () => {
  if (!io) {
    logger.warn('[Socket.IO] Warning: getIO() called before initSocket()');
  }
  return io;
};

// ─── Real-Time Broadcasting Helpers ──────────────────────────────────────────

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

const emitToAdmin = (event, data) => {
  if (io) {
    io.to('admin').emit(event, data);
  }
};

const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(`user:${userId.toString()}`).emit(event, data);
  }
};

/**
 * Broadcast catalog / store mutation to all online customers & admin
 * e.g. 'CATEGORY_CREATED', 'PRODUCT_UPDATED', 'BLOG_UPDATED', 'COUPON_ADDED'
 */
const emitCatalogUpdate = (type, payload = null) => {
  if (io) {
    logger.info(`📡 [Socket.IO] Broadcasting catalog update: ${type}`);
    io.emit('catalog:update', { type, payload, timestamp: Date.now() });
  }
};

/**
 * Broadcast order updates to Admin Dashboard & Customer Tracking
 */
const emitOrderUpdate = (order, action = 'UPDATED') => {
  if (io && order) {
    const orderNumber = order.orderNumber || order._id;
    logger.info(`📦 [Socket.IO] Broadcasting order event: ${action} #${orderNumber}`);

    // Notify Admin Dashboard
    io.to('admin').emit('order:change', { action, order, timestamp: Date.now() });

    // Notify the specific customer
    const userId = order.user?._id || order.user;
    if (userId) {
      io.to(`user:${userId.toString()}`).emit('order:status_changed', {
        action,
        orderId: order._id,
        orderNumber,
        status: order.status,
        timestamp: Date.now(),
      });
    }

    // Notify anyone watching this specific order ID
    io.to(`order:${order._id}`).emit('order:track_update', {
      orderId: order._id,
      orderNumber,
      status: order.status,
      timestamp: Date.now(),
    });
  }
};

module.exports = {
  initSocket,
  getIO,
  emitToAll,
  emitToAdmin,
  emitToUser,
  emitCatalogUpdate,
  emitOrderUpdate,
};

