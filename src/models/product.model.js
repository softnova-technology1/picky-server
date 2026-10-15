const mongoose = require('mongoose');

const characteristicSchema = new mongoose.Schema(
  { key: String, value: String },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    shortDescription: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: String, trim: true },
    sku: { type: String, trim: true, uppercase: true },
    images: [{ type: String }], // Cloudinary or CDN URLs
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    discountPrice: { type: Number, min: 0 }, // null = no discount
    characteristics: [characteristicSchema],
    variants: {
      type: { type: String, default: 'none' },
      options: [{ type: String, trim: true }],
      default: { type: String, trim: true },
      colors: [mongoose.Schema.Types.Mixed],
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ subCategory: 1 });
productSchema.index({ sku: 1 }, { sparse: true });
productSchema.index({ isActive: 1 });
productSchema.index({ name: 'text', tags: 'text', description: 'text', shortDescription: 'text' });

module.exports = mongoose.model('Product', productSchema);
