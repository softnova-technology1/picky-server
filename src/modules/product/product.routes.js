const express = require('express');
const router = express.Router();
const multer = require('multer');
const productController = require('./product.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createProductSchema, updateProductSchema } = require('./product.schema');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public
router.get('/', productController.list);
router.get('/search', productController.search);
router.get('/:slug', productController.detail);

// Admin
router.post('/', authenticate, requireRole('admin'), upload.array('images', 15), validate(createProductSchema), productController.create);
router.put('/:id', authenticate, requireRole('admin'), upload.array('images', 15), validate(updateProductSchema), productController.update);
router.patch('/:id/toggle', authenticate, requireRole('admin'), productController.toggleStatus);
router.delete('/:id', authenticate, requireRole('admin'), productController.remove);

module.exports = router;
