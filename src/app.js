require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const correlationId = require('./middleware/correlationId.middleware');
const AppError = require('./utils/appError');
const { ApiResponse } = require('./utils/apiResponse');
const logger = require('./utils/logger');
const mongoose = require('mongoose');

// ─── Route imports ──────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const productRoutes = require('./modules/product/product.routes');
const categoryRoutes = require('./modules/category/category.routes');
const subcategoryRoutes = require('./modules/subcategory/subcategory.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/order/order.routes');
const discountRoutes = require('./modules/discount/discount.routes');
const couponRoutes = require('./modules/coupon/coupon.routes');
const reportRoutes = require('./modules/report/report.routes');
const wishlistRoutes = require('./modules/wishlist/wishlist.routes');
const customerRoutes = require('./modules/customer/customer.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const customizationRoutes = require('./modules/customization/customization.routes');
const uploadRoutes = require('./modules/upload/upload.routes');
const contactRoutes = require('./modules/contact/contact.routes');
const notificationRoutes = require('./modules/notification/notification.routes');
const reviewRoutes = require('./modules/review/review.routes');
const returnRoutes = require('./modules/return/return.routes');
const path = require('path');

const app = express();

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: false, // allow images/files to be accessed cross-origin by the client
}));
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
}));
app.use(apiLimiter);

// ─── Static Uploads ──────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Request Parsing ─────────────────────────────────────────────────────────
// Capture rawBody for cryptographic signature verification (e.g. Razorpay webhook HMAC)
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/razorpay/webhook')) {
      req.rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// audit fix #10: attach unique X-Request-ID to every request for log tracing
app.use(correlationId);
// audit fix #9: only use verbose 'dev' format locally — avoids PII in prod logs
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === '/health',
  }));
}

// ─── Health Check with Database Readiness ──────────────────────────────────
app.get('/health', (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  const status = isDbReady ? 'ok' : 'degraded';
  const statusCode = isDbReady ? 200 : 503;
  res.status(statusCode).json({
    status,
    database: isDbReady ? 'connected' : 'disconnected',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/subcategories`, subcategoryRoutes);
app.use(`${API}/cart`, cartRoutes);
app.use(`${API}/wishlist`, wishlistRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/discounts`, discountRoutes);
app.use(`${API}/coupons`, couponRoutes);
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}/settings`, settingsRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/customization`, customizationRoutes);
app.use(`${API}/upload`, uploadRoutes);
app.use(`${API}/contact`, contactRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/reviews`, reviewRoutes);
app.use(`${API}/returns`, returnRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'Internal Server Error';

  // Handle Mongoose Validation Errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((el) => el.message);
    message = `Invalid input data: ${errors.join('. ')}`;
    statusCode = 400;
  }
  // Handle Mongoose Duplicate Key
  else if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate field value entered for ${field}. Please use another value!`;
    statusCode = 400;
  }
  // Handle Mongoose CastError
  else if (err.name === 'CastError') {
    message = `Invalid ${err.path}: ${err.value}`;
    statusCode = 400;
  }

  if (!err.isOperational && statusCode === 500) {
    logger.error(err);
  }
  
  res.status(statusCode).json(ApiResponse.error(message, statusCode));
});

module.exports = app;
