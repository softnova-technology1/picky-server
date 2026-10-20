const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { uploadImage } = require('../../services/s3.service');
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

module.exports = router;
