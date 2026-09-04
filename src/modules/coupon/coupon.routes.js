const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createCouponSchema, updateCouponSchema } = require('./coupon.schema');

// Admin Coupon Management
router.get('/', authenticate, requireRole('admin'), couponController.list);
router.get('/:id', authenticate, requireRole('admin'), couponController.getById);
router.post('/', authenticate, requireRole('admin'), validate(createCouponSchema), couponController.create);
router.put('/:id', authenticate, requireRole('admin'), validate(updateCouponSchema), couponController.update);
router.patch('/:id/toggle', authenticate, requireRole('admin'), couponController.toggleActive);
router.delete('/:id', authenticate, requireRole('admin'), couponController.remove);

module.exports = router;
