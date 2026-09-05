const mongoose = require('mongoose');

const characteristicFieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['select', 'multi_select', 'text', 'number', 'boolean'],
      default: 'text',
    },
    values: [{ type: String, trim: true }], // predefined values for select / multi_select
    required: { type: Boolean, default: false },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String }, // Cloudinary URL
    description: { type: String, trim: true },
    characteristics: [characteristicFieldSchema],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);

