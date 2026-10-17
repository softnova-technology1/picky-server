const mongoose = require('mongoose');

const checkoutReservationSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    status: {
      type: String,
      enum: ['reserved', 'released', 'completed'],
      default: 'reserved',
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 20 * 60 * 1000), // 20 minutes auto-expiration
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CheckoutReservation', checkoutReservationSchema);
