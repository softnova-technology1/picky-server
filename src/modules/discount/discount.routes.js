const express = require('express');
const router = express.Router();
const discountController = require('./discount.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createDiscountSchema, updateDiscountSchema } = require('./discount.schema');

// Admin Discount Management
router.get('/', authenticate, requireRole('admin'), discountController.list);
router.get('/:id', authenticate, requireRole('admin'), discountController.getById);
router.post('/', authenticate, requireRole('admin'), validate(createDiscountSchema), discountController.create);
router.put('/:id', authenticate, requireRole('admin'), validate(updateDiscountSchema), discountController.update);
router.patch('/:id/toggle', authenticate, requireRole('admin'), discountController.toggleActive);
router.delete('/:id', authenticate, requireRole('admin'), discountController.remove);

module.exports = router;
