const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const subcategoryController = require('./subcategory.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { uploadImage } = require('../../services/s3.service');
const { ApiResponse } = require('../../utils/apiResponse');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Direct upload sub-category image to S3 (picky/sub-category/ folder)
router.post('/upload-image', authenticate, requireRole('admin'), upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error('No image file provided', 400));
    }
    const buf = await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const result = await uploadImage(buf, 'sub-category');
    return res.json(ApiResponse.success({ url: result.url, key: result.key }, 'Sub-category image uploaded to S3 successfully'));
  } catch (err) {
    next(err);
  }
});

// Public
router.get('/', subcategoryController.list);

// Admin
router.post('/bulk-delete', authenticate, requireRole('admin'), subcategoryController.bulkRemove);
router.post('/', authenticate, requireRole('admin'), subcategoryController.create);
router.put('/:id', authenticate, requireRole('admin'), subcategoryController.update);
router.delete('/:id', authenticate, requireRole('admin'), subcategoryController.remove);

module.exports = router;
