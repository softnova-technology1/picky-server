const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const { uploadImage } = require('../../services/s3.service');
const { ApiResponse } = require('../../utils/apiResponse');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', authenticate, requireRole('admin'), upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error('No image file provided', 400));
    }
    const result = await uploadImage(req.file.buffer, 'customization', req.file.mimetype);
    return res.json(ApiResponse.success({ url: result.url }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
