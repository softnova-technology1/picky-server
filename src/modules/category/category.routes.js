const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const categoryController = require('./category.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createCategorySchema, updateCategorySchema, updateCharacteristicsSchema } = require('./category.schema');
const { uploadImage } = require('../../services/s3.service');
const { ApiResponse } = require('../../utils/apiResponse');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Direct upload category image to S3 (picky/category/ folder)
router.post('/upload-image', authenticate, requireRole('admin'), upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error('No image file provided', 400));
    }
    const buf = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const result = await uploadImage(buf, 'category');
    return res.json(ApiResponse.success({ url: result.url, key: result.key }, 'Category image uploaded to S3 successfully'));
  } catch (err) {
    next(err);
  }
});

// Public
router.get('/', categoryController.list);
router.get('/:slug', categoryController.detail);

// Admin
router.post('/', authenticate, requireRole('admin'), upload.single('image'), validate(createCategorySchema), categoryController.create);
router.put('/:id', authenticate, requireRole('admin'), upload.single('image'), validate(updateCategorySchema), categoryController.update);
router.patch('/:id/characteristics', authenticate, requireRole('admin'), validate(updateCharacteristicsSchema), categoryController.updateCharacteristics);
router.delete('/:id', authenticate, requireRole('admin'), categoryController.remove);

module.exports = router;

