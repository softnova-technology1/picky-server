const ReviewService = require('./review.service');
const { ApiResponse } = require('../../utils/apiResponse');

const uploadReviewPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(ApiResponse.error('No photo file provided', 400));
    }
    const result = await ReviewService.uploadPhoto(req.file.buffer, req.file.mimetype);
    return res.status(200).json(ApiResponse.success(result, 'Review photo compressed and uploaded successfully to S3'));
  } catch (err) {
    next(err);
  }
};

const createReview = async (req, res, next) => {
  try {
    const review = await ReviewService.createReview(req.body, req.user);
    return res.status(201).json(ApiResponse.success(review, 'Review submitted successfully'));
  } catch (err) {
    next(err);
  }
};

const getProductReviews = async (req, res, next) => {
  try {
    const data = await ReviewService.getByProduct(req.params.productId);
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

const getPublicReviews = async (req, res, next) => {
  try {
    const data = await ReviewService.getPublicReviews();
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

const getAdminReviews = async (req, res, next) => {
  try {
    const data = await ReviewService.getAdminReviews(req.query);
    return res.status(200).json(ApiResponse.success(data));
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const review = await ReviewService.updateStatus(req.params.id, status, rejectionReason);
    return res.status(200).json(ApiResponse.success(review, `Review status updated to ${status}`));
  } catch (err) {
    next(err);
  }
};

const replyToReview = async (req, res, next) => {
  try {
    const { text, author } = req.body;
    const adminAuthor = author || req.user?.name || 'Picky Store Manager';
    const review = await ReviewService.replyToReview(req.params.id, text, adminAuthor);
    return res.status(200).json(ApiResponse.success(review, 'Reply posted successfully'));
  } catch (err) {
    next(err);
  }
};

const deleteReply = async (req, res, next) => {
  try {
    const review = await ReviewService.deleteReply(req.params.id);
    return res.status(200).json(ApiResponse.success(review, 'Reply removed successfully'));
  } catch (err) {
    next(err);
  }
};

const deleteReview = async (req, res, next) => {
  try {
    const review = await ReviewService.deleteReview(req.params.id);
    return res.status(200).json(ApiResponse.success(review, 'Review deleted permanently'));
  } catch (err) {
    next(err);
  }
};

const toggleFeatured = async (req, res, next) => {
  try {
    const review = await ReviewService.toggleFeatured(req.params.id);
    return res.status(200).json(ApiResponse.success(review, 'Featured state toggled'));
  } catch (err) {
    next(err);
  }
};

const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { reviewIds, status, rejectionReason } = req.body;
    const result = await ReviewService.bulkUpdateStatus(reviewIds, status, rejectionReason);
    return res.status(200).json(ApiResponse.success(result, `Bulk updated reviews to ${status}`));
  } catch (err) {
    next(err);
  }
};

const bulkDeleteReviews = async (req, res, next) => {
  try {
    const { reviewIds } = req.body;
    const result = await ReviewService.bulkDeleteReviews(reviewIds);
    return res.status(200).json(ApiResponse.success(result, 'Bulk deleted reviews permanently'));
  } catch (err) {
    next(err);
  }
};

const markAllAsViewed = async (req, res, next) => {
  try {
    const result = await ReviewService.markAllAsViewed();
    return res.status(200).json(ApiResponse.success(result, 'All reviews marked as viewed'));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadReviewPhoto,
  createReview,
  getProductReviews,
  getPublicReviews,
  getAdminReviews,
  updateStatus,
  replyToReview,
  deleteReply,
  deleteReview,
  toggleFeatured,
  bulkUpdateStatus,
  bulkDeleteReviews,
  markAllAsViewed,
};
