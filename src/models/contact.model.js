const mongoose = require('mongoose');

const contactInquirySchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [3000, 'Message cannot exceed 3000 characters'],
    },
    file: {
      url: { type: String, default: '' },
      key: { type: String, default: '' },
      originalName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      filename: { type: String, default: '' },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'replied'],
      default: 'unread',
    },
    source: {
      type: String,
      enum: ['contact_page', 'homepage', 'footer', 'general'],
      default: 'contact_page',
    },
  },
  {
    timestamps: true,
  }
);

contactInquirySchema.index({ createdAt: -1 });
contactInquirySchema.index({ isRead: 1 });
contactInquirySchema.index({ source: 1 });

module.exports = mongoose.model('ContactInquiry', contactInquirySchema);
