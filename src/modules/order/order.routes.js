const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { addTrackingSchema, updateStatusSchema } = require('./order.schema');

// ─── Customer Razorpay Flow (100% Prepaid Online Payment) ───────────────────
router.post('/razorpay/create-order', authenticate, orderController.createRazorpayOrder);
router.post('/razorpay/verify', authenticate, orderController.verifyRazorpayOrder);

router.get('/', authenticate, orderController.myOrders);
router.get('/:id', authenticate, orderController.orderDetail);
router.get('/:id/tracking', authenticate, orderController.getTracking);

// ─── Admin Order & Dispatch Management (Protected) ──────────────────────────
router.get('/admin/list', authenticate, requireRole('admin'), orderController.adminListOrders);
router.get('/admin/:id', authenticate, requireRole('admin'), orderController.adminOrderDetail);
router.patch('/admin/:id/tracking', authenticate, requireRole('admin'), validate(addTrackingSchema), orderController.addTracking);
router.patch('/admin/:id/status', authenticate, requireRole('admin'), validate(updateStatusSchema), orderController.updateStatus);

module.exports = router;
