const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { addTrackingSchema, updateStatusSchema } = require('./order.schema');

// ─── Razorpay Webhook ────────────────────────────────────────────────────────
// Raw bytes are preserved via app.js express.json verify hook into req.rawBody
router.post(
  '/razorpay/webhook',
  orderController.handleRazorpayWebhook
);

// ─── Customer Order Creation & List (Guest or Logged In) ─────────────────────
router.post('/checkout/reserve', optionalAuthenticate, orderController.reserveCheckout);
router.post('/checkout/release', optionalAuthenticate, orderController.releaseCheckout);
router.post('/razorpay/create-order', optionalAuthenticate, orderController.createRazorpayOrder);
router.post('/razorpay/verify', optionalAuthenticate, orderController.verifyRazorpayOrder);
router.post('/', optionalAuthenticate, orderController.createOrder);

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
