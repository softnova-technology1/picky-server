const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');
const reviewController = require('./review.controller');

// Multer memory storage with 5MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB maximum
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WebP) are allowed'), false);
    }
  },
});

// ─── Customer / Public Endpoints ───
// 1. Upload review photo to S3 with Sharp compression (max 5MB)
router.post('/upload-photo', upload.single('photo'), reviewController.uploadReviewPhoto);

// 2. Submit new product review
router.post('/', authenticate, reviewController.createReview);

// 3. Get all published reviews for a product (PDP)
router.get('/product/:productId', reviewController.getProductReviews);

// ─── Admin Moderation Endpoints ───
// 4. Get all reviews with status counts & KPIs
router.get('/admin', authenticate, requireRole('admin'), reviewController.getAdminReviews);

// 4.1 Bulk update review statuses
router.post('/admin/bulk-status', authenticate, requireRole('admin'), reviewController.bulkUpdateStatus);

// 4.2 Bulk delete reviews permanently
router.post('/admin/bulk-delete', authenticate, requireRole('admin'), reviewController.bulkDeleteReviews);

// 4.3 Mark all reviews as viewed by admin
router.post('/admin/mark-viewed', authenticate, requireRole('admin'), reviewController.markAllAsViewed);

// 5. Update review moderation status (approve / reject / flag)
router.patch('/admin/:id/status', authenticate, requireRole('admin'), reviewController.updateStatus);

// 6. Post / update official store reply
router.post('/admin/:id/reply', authenticate, requireRole('admin'), reviewController.replyToReview);

// 7. Delete official store reply
router.delete('/admin/:id/reply', authenticate, requireRole('admin'), reviewController.deleteReply);

// 8. Delete review permanently
router.delete('/admin/:id', authenticate, requireRole('admin'), reviewController.deleteReview);

// 9. Toggle featured status
router.patch('/admin/:id/featured', authenticate, requireRole('admin'), reviewController.toggleFeatured);

module.exports = router;
