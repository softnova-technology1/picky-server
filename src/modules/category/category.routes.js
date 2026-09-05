const express = require('express');
const router = express.Router();
const multer = require('multer');
const categoryController = require('./category.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createCategorySchema, updateCategorySchema, updateCharacteristicsSchema } = require('./category.schema');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });

// Public
router.get('/', categoryController.list);
router.get('/:slug', categoryController.detail);

// Admin
router.post('/', authenticate, requireRole('admin'), upload.single('image'), validate(createCategorySchema), categoryController.create);
router.put('/:id', authenticate, requireRole('admin'), upload.single('image'), validate(updateCategorySchema), categoryController.update);
router.patch('/:id/characteristics', authenticate, requireRole('admin'), validate(updateCharacteristicsSchema), categoryController.updateCharacteristics);
router.delete('/:id', authenticate, requireRole('admin'), categoryController.remove);

module.exports = router;

