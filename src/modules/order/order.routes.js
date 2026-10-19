const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { addTrackingSchema, updateStatusSchema } = require('./order.schema');

// ─── Razorpay Webhook (audit fix #2) ───────────────────────────────────────
// IMPORTANT: This route must use express.raw() — NOT express.json().
// Razorpay webhook signature is verified against the raw request body bytes.
// If json() middleware parses it first, the raw body is lost and HMAC fails.
router.post(
  '/razorpay/webhook',
  require('express').raw({ type: 'application/json' }),
  orderController.handleRazorpayWebhook
);

// ─── Customer Order Creation & List ──────────────────────────────────────
router.post('/checkout/reserve', authenticate, orderController.reserveCheckout);
router.post('/checkout/release', authenticate, orderController.releaseCheckout);
router.post('/razorpay/create-order', authenticate, orderController.createRazorpayOrder);
router.post('/razorpay/verify', authenticate, orderController.verifyRazorpayOrder);
router.post('/', authenticate, orderController.createOrder);

router.get('/track/:orderNumber', orderController.trackOrderByNumber);
router.get('/', authenticate, orderController.myOrders);
router.get('/:id', authenticate, orderController.orderDetail);
router.get('/:id/tracking', authenticate, orderController.getTracking);
router.patch('/:id/cancel', authenticate, orderController.customerCancelOrder);

// ─── Admin Order & Dispatch Management (Protected) ──────────────────────────
router.get('/admin/list', authenticate, requireRole('admin'), orderController.adminListOrders);
router.get('/admin/:id', authenticate, requireRole('admin'), orderController.adminOrderDetail);
router.patch('/admin/:id/tracking', authenticate, requireRole('admin'), validate(addTrackingSchema), orderController.addTracking);
router.patch('/admin/:id/status', authenticate, requireRole('admin'), validate(updateStatusSchema), orderController.updateStatus);
router.delete('/admin/:id', authenticate, requireRole('admin'), orderController.deleteOrder);

module.exports = router;
