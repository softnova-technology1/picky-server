const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { uploadImage, deleteImage } = require('../../services/s3.service');
const { ApiResponse } = require('../../utils/apiResponse');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/',
  authenticate,
  requireRole('admin'),
  upload.any(),
  async (req, res, next) => {
    try {
      const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
      if (!file) {
        return res.status(400).json(ApiResponse.error('No image file provided', 400));
      }

      const folder = req.body.folder || req.query.folder || 'products';

      let uploadBuffer = file.buffer;
      let contentType = file.mimetype || 'image/webp';

      try {
        uploadBuffer = await sharp(file.buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        contentType = 'image/webp';
      } catch (_) {
        // Fallback to original buffer if not resizable by sharp (e.g. svg)
        uploadBuffer = file.buffer;
      }

      const result = await uploadImage(uploadBuffer, `picky/${folder}`, contentType);
      return res.json(ApiResponse.success({ url: result.url, key: result.key }, 'Image uploaded successfully'));
    } catch (err) {
      next(err);
    }
  }
);

// ── Public Endpoint: Direct upload for contact inquiries reference files to S3 bucket (picky/inquiries)
router.post(
  '/inquiry',
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  }).any(),
  async (req, res, next) => {
    try {
      const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
      if (!file) {
        return res.status(400).json(ApiResponse.error('No file provided', 400));
      }

      const { uploadFile } = require('../../services/s3.service');
      const result = await uploadFile(file.buffer, 'inquiries', file.originalname, file.mimetype);
      return res.json(
        ApiResponse.success(
          {
            url: result.url,
            key: result.key,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          },
          'Reference file uploaded to S3 successfully'
        )
      );
    } catch (err) {
      next(err);
    }
  }
);

// ── Admin Endpoint: Delete image/file from S3 bucket and local fallback
router.delete('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const target = req.body?.url || req.body?.key || req.query?.url || req.query?.key;
    if (!target) {
      return res.status(400).json(ApiResponse.error('Image url or key is required', 400));
    }
    await deleteImage(target);
    return res.json(ApiResponse.success(null, 'Image deleted successfully from S3 storage'));
  } catch (err) {
    next(err);
  }
});

router.post('/delete', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const target = req.body?.url || req.body?.key || req.query?.url || req.query?.key;
    if (!target) {
      return res.status(400).json(ApiResponse.error('Image url or key is required', 400));
    }
    await deleteImage(target);
    return res.json(ApiResponse.success(null, 'Image deleted successfully from S3 storage'));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
