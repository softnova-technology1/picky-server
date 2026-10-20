const mongoose = require('mongoose');

const adminReplySchema = new mongoose.Schema(
  {
    text: { type: String, trim: true },
    author: { type: String, default: 'Picky Store Manager', trim: true },
    repliedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true, default: '' },
      location: { type: String, trim: true, default: 'Tamil Nadu, India' },
      avatar: { type: String, default: '' },
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    photos: [
      {
        type: String, // Full S3 or CDN image URLs
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'published', 'rejected', 'flagged'],
      default: 'published',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    isVerifiedBuyer: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    likes: {
      type: Number,
      default: 0,
    },
    isViewedByAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    adminReply: adminReplySchema,
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
