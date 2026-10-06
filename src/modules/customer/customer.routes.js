const router = require('express').Router();
const CustomerController = require('./customer.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// All customer management routes are protected for Administrator role
router.use(authenticate, requireRole('admin'));

router.get('/', CustomerController.list);
router.get('/:id', CustomerController.getById);

module.exports = router;
