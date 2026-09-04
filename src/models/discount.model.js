const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['percentage', 'flat'], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number, default: null }, // cap for percentage discounts
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    // Applied to: 'all' | specific products/categories (extend as needed)
    appliesTo: { type: String, enum: ['all', 'first_order'], default: 'all' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Discount', discountSchema);
