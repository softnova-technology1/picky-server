const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { uploadImage } = require('../../services/s3.service');
const { ApiResponse } = require('../../utils/apiResponse');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

const ALLOWED_FOLDERS = new Set([
  'products',
  'categories',
  'subcategories',
  'banners',
  'discounts',
  'general',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return cb(new Error('Only supported image formats (JPEG, PNG, WebP, GIF, AVIF, SVG) are allowed'));
    }
    cb(null, true);
  },
});

router.post(
  '/',
  authenticate,
  requireRole('admin'),
  upload.single('image'),
  async (req, res, next) => {
    try {
      const file = req.file || (req.files && req.files[0]);
      if (!file) {
        return res.status(400).json(ApiResponse.error('No image file provided', 400));
      }

      // Safe folder allowlist to prevent path traversal
      const rawFolder = (req.body.folder || req.query.folder || 'products').toString().toLowerCase().trim();
      const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'products';

      let uploadBuffer = file.buffer;
      let contentType = file.mimetype || 'image/webp';

      if (file.mimetype !== 'image/svg+xml') {
        try {
          uploadBuffer = await sharp(file.buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
          contentType = 'image/webp';
        } catch (sharpErr) {
          return res.status(400).json(ApiResponse.error('Corrupted or invalid image file', 400));
        }
      }

      const result = await uploadImage(uploadBuffer, `picky/${folder}`, contentType);
      return res.json(ApiResponse.success({ url: result.url, key: result.key }, 'Image uploaded successfully'));
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
