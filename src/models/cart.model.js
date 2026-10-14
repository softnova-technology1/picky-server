const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }, // snapshot at time of add
    name: { type: String, required: true },  // snapshot
    image: { type: String },                 // snapshot
  },
  { _id: false }
);

const cartTimelineSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    note: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    couponDiscount: { type: Number, default: 0 },
    // Recovery & Audit History fields
    status: {
      type: String,
      enum: ['pending', 'sent', 'recovered', 'partial_recovery', 'expired'],
      default: 'pending',
    },
    alertsSentCount: { type: Number, default: 0 },
    lastAlertSentAt: { type: Date, default: null },
    lastTemplateUsed: { type: String, default: null },
    appliedOffer: { type: mongoose.Schema.Types.Mixed, default: null },
    isPartialRecovery: { type: Boolean, default: false },
    recoveredProducts: [{ type: String }],
    recoveredOrderNumber: { type: String, default: null },
    recoveredAmount: { type: Number, default: null },
    recoveredAt: { type: Date, default: null },
    purchasedItems: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String },
        price: { type: Number },
        quantity: { type: Number, default: 1 },
        image: { type: String },
        sku: { type: String },
        orderNumber: { type: String },
        purchasedAt: { type: Date, default: Date.now },
      },
    ],
    timeline: [cartTimelineSchema],
  },
  { timestamps: true }
);

cartSchema.index({ 'items.0': 1, updatedAt: -1 });
cartSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Cart', cartSchema);

