const express = require('express');
const router = express.Router();
const subcategoryController = require('./subcategory.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// Public
router.get('/', subcategoryController.list);

// Admin
router.post('/', authenticate, requireRole('admin'), subcategoryController.create);
router.put('/:id', authenticate, requireRole('admin'), subcategoryController.update);
router.delete('/:id', authenticate, requireRole('admin'), subcategoryController.remove);

module.exports = router;
