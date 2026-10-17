const router = require('express').Router();
const InventoryController = require('./inventory.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// All inventory management routes are protected for Administrator role
router.use(authenticate, requireRole('admin'));

router.get('/', InventoryController.list);
router.patch('/:productId/toggle-status', InventoryController.toggleProductStatus);
router.patch('/:productId', InventoryController.updateStock);
router.delete('/:productId', InventoryController.deleteItem);

module.exports = router;
