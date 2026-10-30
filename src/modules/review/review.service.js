const mongoose = require('mongoose');
const sharp = require('sharp');
const Review = require('../../models/review.model');
const Product = require('../../models/product.model');
const Order = require('../../models/order.model');
const { uploadImage } = require('../../services/s3.service');
const { AppError } = require('../../utils/appError');
const logger = require('../../utils/logger');

const ReviewService = {
  /**
   * 1. Compress and Upload Customer Review Photo to AWS S3
   * Compresses image to WebP (quality 80, max 1600px width) before sending to S3
   */
  async uploadPhoto(fileBuffer, originalMimetype = 'image/jpeg') {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError('No image buffer provided', 400);
    }

    try {
      // Compress with Sharp: convert to high-efficiency WebP, limit dimensions to 1600px max
      const compressedBuffer = await sharp(fileBuffer)
        .rotate() // auto-orient based on EXIF
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const result = await uploadImage(compressedBuffer, 'reviews', 'image/webp');
      return result;
    } catch (err) {
      logger.error(`[REVIEW] Photo compression/upload failed: ${err.message}`);
      throw new AppError(`Failed to process and upload image: ${err.message}`, 500);
    }
  },

  /**
   * 2. Submit a New Customer Review
   */
  async createReview(payload, user = null) {
    const { productId, rating, title, comment, photos = [], customer = {} } = payload;

    if (!productId) {
      throw new AppError('Product ID is required', 400);
    }
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      throw new AppError('Rating must be between 1 and 5 stars', 400);
    }
    if (!comment || !comment.trim()) {
      throw new AppError('Review comment is required', 400);
    }

    // Resolve product by ID or slug
    let productDoc = null;
    if (mongoose.isValidObjectId(productId)) {
      productDoc = await Product.findById(productId);
    }
    if (!productDoc) {
      productDoc = await Product.findOne({ slug: productId });
    }
    if (!productDoc) {
      throw new AppError('Product not found', 404);
    }

    // Check if user is a verified buyer
    let isVerified = false;
    if (user?._id) {
      const pastOrder = await Order.findOne({
        user: user._id,
        'items.product': productDoc._id,
        status: { $in: ['confirmed', 'shipped', 'out_for_delivery', 'delivered'] },
      }).lean();
      if (pastOrder) isVerified = true;
    }

    const customerName = (customer.name || user?.name || user?.email?.split('@')[0] || 'Verified Customer').trim();
    const customerEmail = (customer.email || user?.email || '').trim().toLowerCase();
    const customerLocation = (customer.location || user?.defaultAddress?.city || 'Tamil Nadu, India').trim();

    // Ensure photos array is clean, valid URLs, max 5
    const cleanPhotos = Array.isArray(photos)
      ? photos.filter((p) => typeof p === 'string' && p.startsWith('http')).slice(0, 5)
      : [];

    const newReview = await Review.create({
      product: productDoc._id,
      user: user?._id || null,
      customer: {
        name: customerName,
        email: customerEmail,
        location: customerLocation,
        avatar: customer.avatar || user?.avatar || '',
      },
      rating: Number(rating),
      title: (title || '').trim(),
      comment: comment.trim(),
      photos: cleanPhotos,
      status: 'published', // Published by default so storefront shows instantly; admin can moderate anytime
      isVerifiedBuyer: isVerified || true,
    });

    // Trigger admin review notification
    try {
      const AdminNotificationService = require('../../services/adminNotification.service');
      AdminNotificationService.notifyNewReview(newReview, productDoc);
    } catch {}

    return newReview;
  },

  /**
   * 3. Get Public Reviews for a Product (Storefront PDP)
   */
  async getByProduct(productId) {
    let pId = productId;
    if (!mongoose.isValidObjectId(productId)) {
      const prod = await Product.findOne({ slug: productId }).select('_id').lean();
      if (prod) pId = prod._id;
    }

    const reviews = await Review.find({
      product: pId,
      status: 'published',
    })
      .sort({ createdAt: -1 })
      .lean();

    const total = reviews.length;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    reviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      distribution[star] = (distribution[star] || 0) + 1;
      sum += r.rating || 5;
    });

    const average = total > 0 ? Number((sum / total).toFixed(1)) : 5.0;
    const percentages = {
      5: total > 0 ? Math.round((distribution[5] / total) * 100) : 0,
      4: total > 0 ? Math.round((distribution[4] / total) * 100) : 0,
      3: total > 0 ? Math.round((distribution[3] / total) * 100) : 0,
      2: total > 0 ? Math.round((distribution[2] / total) * 100) : 0,
      1: total > 0 ? Math.round((distribution[1] / total) * 100) : 0,
    };

    return {
      reviews,
      total,
      average,
      distribution: percentages,
      counts: distribution,
    };
  },

  /**
   * 4. Admin: Get All Reviews with Moderation Filters & Real-time KPIs
   */
    /**
   * 3.1 Public: Get Published & Featured Reviews for Storefront
   */
  async getPublicReviews() {
    const reviews = await Review.find({ status: 'published' })
      .populate('product', 'name slug images price discountPrice category subCategory')
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(30)
      .lean();
    return reviews;
  },

  async getAdminReviews(query = {}) {
    const { status, rating, search, sortBy } = query;
    const filter = {};

    if (status && status !== 'all') {
      if (status === 'photos') {
        filter['photos.0'] = { $exists: true };
      } else {
        filter.status = status;
      }
    }

    if (rating && rating !== 'all') {
      filter.rating = Number(rating);
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { 'customer.name': regex },
        { 'customer.email': regex },
        { comment: regex },
        { title: regex },
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sortBy === 'oldest') sortOption = { createdAt: 1 };
    else if (sortBy === 'highest') sortOption = { rating: -1, createdAt: -1 };
    else if (sortBy === 'lowest') sortOption = { rating: 1, createdAt: -1 };

    const [reviews, allReviews] = await Promise.all([
      Review.find(filter)
        .populate('product', 'name slug images price discountPrice category subCategory')
        .sort(sortOption)
        .lean(),
      Review.find({}).select('rating status photos isViewedByAdmin').lean(),
    ]);

    // Calculate Real-time KPIs across entire review database
    const totalCount = allReviews.length;
    const avgScore = totalCount > 0
      ? (allReviews.reduce((sum, r) => sum + (r.rating || 5), 0) / totalCount).toFixed(1)
      : '5.0';
    const pendingCount = allReviews.filter((r) => r.status === 'pending').length;
    const publishedCount = allReviews.filter((r) => r.status === 'published').length;
    const flaggedCount = allReviews.filter((r) => r.status === 'flagged').length;
    const withPhotosCount = allReviews.filter((r) => r.photos && r.photos.length > 0).length;
    const unviewedCount = allReviews.filter((r) => r.isViewedByAdmin === false).length;

    return {
      reviews: reviews.map((r) => ({
        id: r._id.toString(),
        _id: r._id,
        product: {
          id: r.product?._id?.toString() || '',
          name: r.product?.name || 'Handcrafted Product',
          slug: r.product?.slug || '',
          image: r.product?.images?.[0] || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300',
          category: r.product?.subCategory || r.product?.category || 'Handmade',
          price: r.product?.discountPrice || r.product?.price || 0,
        },
        customer: {
          name: r.customer?.name || 'Customer',
          email: r.customer?.email || '',
          location: r.customer?.location || 'Tamil Nadu',
          isVerifiedBuyer: Boolean(r.isVerifiedBuyer),
          avatar: r.customer?.avatar || '',
        },
        rating: r.rating,
        title: r.title || '',
        comment: r.comment,
        photos: r.photos || [],
        createdAt: r.createdAt || new Date(),
        status: r.status || 'published',
        rejectionReason: r.rejectionReason || null,
        isFeatured: Boolean(r.isFeatured),
        isViewedByAdmin: Boolean(r.isViewedByAdmin),
        likes: r.likes || 0,
        adminReply: r.adminReply || null,
      })),
      kpis: {
        total: totalCount,
        avgScore,
        pending: pendingCount,
        published: publishedCount,
        flagged: flaggedCount,
        withPhotos: withPhotosCount,
        unviewed: unviewedCount,
      },
    };
  },

  /**
   * 5. Admin: Update Review Moderation Status (Approve / Reject / Flag)
   */
  async updateStatus(reviewId, status, rejectionReason = null) {
    const review = await Review.findById(reviewId);
    if (!review) throw new AppError('Review not found', 404);

    review.status = status;
    if (rejectionReason) review.rejectionReason = rejectionReason;
    if (status === 'published') review.rejectionReason = null;
    await review.save();

    return review;
  },

  /**
   * 6. Admin: Add or Update Official Store Reply
   */
  async replyToReview(reviewId, text, author = 'Picky Store Manager') {
    if (!text || !text.trim()) {
      throw new AppError('Reply message text is required', 400);
    }

    const review = await Review.findById(reviewId);
    if (!review) throw new AppError('Review not found', 404);

    review.adminReply = {
      text: text.trim(),
      author: author.trim() || 'Picky Store Manager',
      repliedAt: new Date(),
    };
    await review.save();

    return review;
  },

  /**
   * 7. Admin: Delete Official Reply
   */
  async deleteReply(reviewId) {
    const review = await Review.findById(reviewId);
    if (!review) throw new AppError('Review not found', 404);

    review.adminReply = null;
    await review.save();
    return review;
  },

  /**
   * 8. Admin: Delete Review Permanently
   */
  async deleteReview(reviewId) {
    const review = await Review.findByIdAndDelete(reviewId);
    if (!review) throw new AppError('Review not found', 404);
    return review;
  },

  /**
   * 9. Admin: Toggle Featured Review
   */
  async toggleFeatured(reviewId) {
    const review = await Review.findById(reviewId);
    if (!review) throw new AppError('Review not found', 404);

    review.isFeatured = !review.isFeatured;
    await review.save();
    return review;
  },

  /**
   * 10. Admin: Bulk Update Review Moderation Status
   */
  async bulkUpdateStatus(reviewIds, status, rejectionReason = null) {
    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      throw new AppError('Review IDs array is required', 400);
    }
    const updateObj = { status };
    if (rejectionReason) updateObj.rejectionReason = rejectionReason;
    if (status === 'published') updateObj.rejectionReason = null;

    const res = await Review.updateMany(
      { _id: { $in: reviewIds } },
      { $set: updateObj }
    );
    return res;
  },

  /**
   * 11. Admin: Bulk Delete Reviews Permanently
   */
  async bulkDeleteReviews(reviewIds) {
    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      throw new AppError('Review IDs array is required', 400);
    }
    const res = await Review.deleteMany({ _id: { $in: reviewIds } });
    return res;
  },

  /**
   * 12. Admin: Mark All Reviews As Viewed By Admin
   */
  async markAllAsViewed() {
    const res = await Review.updateMany(
      { isViewedByAdmin: false },
      { $set: { isViewedByAdmin: true } }
    );
    return res;
  },
};

module.exports = ReviewService;
