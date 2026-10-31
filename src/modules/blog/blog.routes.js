const express = require('express');
const router = express.Router();
const multer = require('multer');
const blogController = require('./blog.controller');
const { optionalAuthenticate } = require('../../middleware/auth.middleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
    files: 1,
  },
});

// Public: Fetch blog data from MongoDB
router.get('/', blogController.getBlogData);

// Save blog data to MongoDB
router.put('/', optionalAuthenticate, blogController.updateBlogData);

// Upload image directly to AWS S3
router.post(
  '/upload-image',
  optionalAuthenticate,
  upload.single('image'),
  blogController.uploadBlogImage
);

module.exports = router;
