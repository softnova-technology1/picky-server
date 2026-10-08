const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, trim: true },
    image: { type: String }, // Optional image
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    displayOrder: { type: Number, default: 1 }
  },
  { timestamps: true }
);

subCategorySchema.index({ categoryId: 1 });
subCategorySchema.index({ slug: 1 });

module.exports = mongoose.model('SubCategory', subCategorySchema);
