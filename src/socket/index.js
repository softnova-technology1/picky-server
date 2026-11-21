const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

/**
 * Clean & verify JWT token from handshake or event payload
 */
const extractAndVerifyToken = (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const cleanToken = rawToken.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) return null;
  try {
    return jwt.verify(cleanToken, process.env.JWT_ACCESS_SECRET);
  } catch (_) {
    return null;
  }
};

/**
 * Initialize Socket.IO with HTTP server
 */
const initSocket = (httpServer) => {
  const envOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:80,http://localhost')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    if (envOrigins.includes(cleanOrigin) || envOrigins.includes('*')) return true;

    // Allow local development on any port & LAN IP (for phone preview)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const u = new URL(cleanOrigin);
        if (
          u.hostname === 'localhost' ||
          u.hostname === '127.0.0.1' ||
          u.hostname.startsWith('192.168.') ||
          u.hostname.startsWith('10.')
        ) {
          return true;
        }
      } catch (_) {}
    }
    return false;
  };

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          logger.warn(`⚠️ [Socket.IO] CORS blocked origin: ${origin}`);
          callback(new Error('CORS origin not allowed'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Optional authentication middleware on connection handshake
  io.use((socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token || socket.handshake.query?.token;
      const decoded = extractAndVerifyToken(rawToken);
      if (decoded) {
        socket.userId = decoded.id;
        socket.userRole = decoded.role || 'customer';
        logger.info(`🔌 [Socket.IO] Handshake authenticated: ${socket.id} (user: ${socket.userId}, role: ${socket.userRole})`);
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
        logger.info(`👑 [Socket.IO] Admin socket joined admin room on connect: ${socket.id}`);
      }
    }

    // Post-connection authentication (e.g. user logs in after page loads)
    socket.on('user:authenticate', (data) => {
      const decoded = extractAndVerifyToken(data?.token);
      if (decoded) {
        socket.userId = decoded.id;
        socket.userRole = decoded.role || 'customer';
        socket.join(`user:${socket.userId}`);
        if (socket.userRole === 'admin' || socket.userRole === 'superadmin') {
          socket.join('admin');
        }
        socket.emit('user:authenticated', { success: true, userId: socket.userId, role: socket.userRole });
        logger.info(`🔑 [Socket.IO] Socket ${socket.id} authenticated post-connect: ${socket.userId} (${socket.userRole})`);
      } else {
        socket.emit('user:authenticated', { success: false, error: 'Invalid token' });
      }
    });

    // Explicit room joins from client (Strictly role-protected)
    socket.on('admin:join', (data) => {
      let role = socket.userRole;
      if (!role && data?.token) {
        const decoded = extractAndVerifyToken(data.token);
        if (decoded) {
          socket.userId = decoded.id;
          socket.userRole = decoded.role || 'customer';
          role = socket.userRole;
          socket.join(`user:${socket.userId}`);
        }
      }

      if (role === 'admin' || role === 'superadmin') {
        socket.join('admin');
        logger.info(`👑 [Socket.IO] Verified admin socket joined admin room: ${socket.id}`);
        socket.emit('admin:joined', { success: true });
      } else {
        logger.warn(`⚠️ [Socket.IO] Unauthorized attempt to join admin room from socket: ${socket.id}`);
        socket.emit('error', { message: 'Unauthorized: Admin privileges required' });
      }
    });

    socket.on('order:watch', (orderId) => {
      if (orderId) {
        const idStr = String(orderId).trim();
        socket.join(`order:${idStr}`);
        logger.info(`📦 [Socket.IO] Socket ${socket.id} watching order #${idStr}`);
      }
    });

    socket.on('order:unwatch', (orderId) => {
      if (orderId) {
        const idStr = String(orderId).trim();
        socket.leave(`order:${idStr}`);
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
 * Broadcast new admin notification
 */
const emitNotification = (notification) => {
  if (io && notification) {
    logger.info(`🔔 [Socket.IO] Broadcasting notification: ${notification.title || notification.type || 'new'}`);
    io.to('admin').emit('notification:new', notification);
  }
};

/**
 * Broadcast order updates to Admin Dashboard, Admin Orders & Customer Tracking
 */
const emitOrderUpdate = (order, action = 'UPDATED') => {
  if (io && order) {
    const orderNumber = order.orderNumber || order._id;
    const orderIdStr = order._id ? order._id.toString() : '';
    logger.info(`📦 [Socket.IO] Broadcasting order event: ${action} #${orderNumber}`);

    // 1. Notify Admin Dashboard & Orders list
    io.to('admin').emit('order:change', { action, order, timestamp: Date.now() });

    // 2. Notify the specific customer
    const userId = order.user?._id || order.user;
    if (userId) {
      io.to(`user:${userId.toString()}`).emit('order:status_changed', {
        action,
        orderId: orderIdStr,
        orderNumber,
        status: order.status,
        timestamp: Date.now(),
      });
    }

    // 3. Notify anyone watching this specific order ID or orderNumber
    const trackPayload = {
      orderId: orderIdStr,
      orderNumber,
      status: order.status,
      timestamp: Date.now(),
    };
    if (orderIdStr) {
      io.to(`order:${orderIdStr}`).emit('order:track_update', trackPayload);
    }
    if (orderNumber && orderNumber !== orderIdStr) {
      io.to(`order:${orderNumber}`).emit('order:track_update', trackPayload);
    }
  }
};

module.exports = {
  initSocket,
  getIO,
  emitToAll,
  emitToAdmin,
  emitToUser,
  emitCatalogUpdate,
  emitNotification,
  emitOrderUpdate,
};

