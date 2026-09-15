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

// ─── Route imports ──────────────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const productRoutes = require('./modules/product/product.routes');
const categoryRoutes = require('./modules/category/category.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const orderRoutes = require('./modules/order/order.routes');
const discountRoutes = require('./modules/discount/discount.routes');
const couponRoutes = require('./modules/coupon/coupon.routes');
const reportRoutes = require('./modules/report/report.routes');
const wishlistRoutes = require('./modules/wishlist/wishlist.routes');

const app = express();

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
}));
app.use(apiLimiter);

// ─── Request Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
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

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/cart`, cartRoutes);
app.use(`${API}/wishlist`, wishlistRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/discounts`, discountRoutes);
app.use(`${API}/coupons`, couponRoutes);
app.use(`${API}/reports`, reportRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';
  if (!err.isOperational) logger.error(err);
  res.status(statusCode).json(ApiResponse.error(message, statusCode));
});

module.exports = app;
