const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { addItemSchema, updateQtySchema, applyCouponSchema } = require('./cart.schema');

// Admin: Abandoned Carts recovery endpoints
router.get('/admin/abandoned', cartController.getAbandonedCarts);
router.post('/admin/abandoned/:cartId/alert', cartController.recordRecoveryAlert);
router.post('/admin/abandoned/:cartId/recover', cartController.markCartRecovered);
router.post('/admin/abandoned/:cartId/revert', cartController.revertCartConversion);
router.post('/admin/abandoned/:cartId/expire', cartController.markCartExpired);
router.delete('/admin/abandoned/:cartId/timeline', cartController.deleteTimelineEntry);
router.delete('/admin/abandoned/:cartId/timeline/:index', cartController.deleteTimelineEntry);
router.post('/admin/abandoned/:cartId/timeline/delete', cartController.deleteTimelineEntry);

// All user cart routes require authentication
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', validate(addItemSchema), cartController.addItem);
router.patch('/items', validate(updateQtySchema), cartController.updateQty);
router.delete('/items/:productId', cartController.removeItem);
router.delete('/', cartController.clearCart);
router.post('/merge', cartController.mergeGuestCart);
router.post('/coupon', validate(applyCouponSchema), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);

module.exports = router;
