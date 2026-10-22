const mongoose = require('mongoose');

const returnTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'approved', 'in_transit', 'inspected', 'refunded', 'rejected'],
      required: true,
    },
    note: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    }, // e.g. RET-20261022-8491
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
      address: { type: String, required: true },
    },

    item: {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name: { type: String, required: true },
      image: { type: String, default: '' },
      sku: { type: String, default: '' },
      variant: { type: String, default: '' },
      quantity: { type: Number, default: 1, min: 1 },
      price: { type: Number, required: true },
      refundAmount: { type: Number, required: true },
    },

    reason: {
      type: String,
      required: true,
      enum: [
        'Wrong Size / Fit Issue',
        'Fabric Defective / Damaged Piece',
        'Different from Product Image',
        'Color Mismatch',
        'Quality Unsatisfactory',
        'Customer Changed Mind',
        'Received Wrong Item',
        'Other',
      ],
      default: 'Wrong Size / Fit Issue',
    },
    customerNote: { type: String, default: '' },
    proofImages: [{ type: String }],

    resolution: {
      type: String,
      enum: ['refund', 'replacement'],
      default: 'refund',
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'in_transit', 'inspected', 'refunded', 'rejected'],
      default: 'pending',
      index: true,
    },

    courier: { type: String, default: null },
    awbNumber: { type: String, default: null },
    scheduledPickupDate: { type: Date, default: null },

    inspection: {
      tagsIntact: { type: Boolean, default: true },
      unwornCheck: { type: Boolean, default: true },
      packagingCheck: { type: Boolean, default: true },
      note: { type: String, default: '' },
      inspectedAt: { type: Date, default: null },
    },

    refund: {
      refundAmount: { type: Number, default: 0 },
      refundStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'rejected'],
        default: 'pending',
      },
      razorpayRefundId: { type: String, default: null },
      refundedAt: { type: Date, default: null },
      note: { type: String, default: '' },
    },

    rejectionReason: { type: String, default: null },
    timeline: [returnTimelineSchema],
  },
  { timestamps: true }
);

returnSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Return', returnSchema);
