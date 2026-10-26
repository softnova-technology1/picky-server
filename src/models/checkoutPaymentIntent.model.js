const mongoose = require('mongoose');

const checkoutPaymentIntentSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Immutable server-calculated checkout snapshot used when payment is verified.
    pricing: { type: mongoose.Schema.Types.Mixed, required: true },
    shippingAddress: { type: mongoose.Schema.Types.Mixed, required: true },
    giftWrap: { type: mongoose.Schema.Types.Mixed, default: null },
    courier: { type: String, default: null },
    deliveryMode: { type: String, default: 'standard' },
    isBuyNow: { type: Boolean, default: false },
    fromCart: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid'],
      default: 'pending',
      index: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    paymentId: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CheckoutPaymentIntent', checkoutPaymentIntentSchema);
