const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // SNAPSHOT fields — DO NOT reference live product for these
    name: { type: String, required: true },
    image: { type: String },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true }, // PKY-YYYYMMDD-XXXX
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    items: [orderItemSchema], // snapshots — never change after order creation

    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: String,
    },

    // Pricing
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    convenienceFee: { type: Number, default: 0 },
    giftWrapFee: { type: Number, default: 0 },
    giftWrap: {
      isGiftWrapped: { type: Boolean, default: false },
      fee: { type: Number, default: 0 },
      message: { type: String, default: '' },
    },
    total: { type: Number, required: true },

    // Payment (Online / Razorpay / Card / UPI / NetBanking / Simulated)
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'card', 'upi', 'netbanking', 'cod', 'prepaid', 'mock', 'simulated', 'Standard Delivery', 'Self Pickup'],
      default: 'razorpay',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'refunded'],
      default: 'pending',
    },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },

    // Coupon / Discount
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    discountType: {
      type: String,
      enum: ['coupon', 'first_order', null],
      default: null,
    }, // 'first_order' is INTERNAL — never expose to customer

    // Order Status (Admin-Driven Workflow)
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
    },
    statusHistory: [statusHistorySchema], // push on every status change

    // Tracking & Shiprocket Fulfillment
    trackingId: { type: String, default: null }, // AWB number (Shiprocket or external)
    courier: { type: String, default: null }, // courier partner name (Delhivery, BlueDart, DTDC, etc.)
    courierUrl: { type: String, default: null }, // courier tracking website URL
    shiprocketOrderId: { type: String, default: null }, // Shiprocket Order ID
    shiprocketShipmentId: { type: String, default: null }, // Shiprocket Shipment ID
    shippingLabelUrl: { type: String, default: null }, // Printable barcode shipping label URL
    pickupScheduledDate: { type: String, default: null }, // Scheduled courier pickup date
    shippingStatus: { type: String, default: 'pending' }, // Shiprocket live lifecycle status
    packageDetails: {
      weight: { type: Number, default: 0.5 },
      length: { type: Number, default: 15 },
      breadth: { type: Number, default: 12 },
      height: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
// Note: orderNumber is indexed via unique:true on the field definition above.

module.exports = mongoose.model('Order', orderSchema);
