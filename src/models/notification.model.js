const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['contact', 'order', 'inventory', 'customer', 'coupon', 'product', 'system', 'payment'],
      default: 'contact',
    },
    category: {
      type: String,
      default: 'Contact & Support',
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    unread: {
      type: Boolean,
      default: true,
    },
    starred: {
      type: Boolean,
      default: false,
    },
    link: {
      type: String,
      default: '/softpicky-sn2026/notifications',
    },
    linkText: {
      type: String,
      default: 'View Details',
    },
    entityKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ unread: 1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
