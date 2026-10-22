const mongoose = require('mongoose');
const Product = require('../../models/product.model');

const ProductRepository = {
  find: (filter, skip, limit, sort = 'newest') => {
    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      featured: { isFeatured: -1, createdAt: -1 },
    };
    return Product.find(filter).populate('category', 'name slug').sort(sortMap[sort] || sortMap.newest).skip(skip).limit(limit).lean();
  },
  count: (filter) => Product.countDocuments(filter),
  findBySlug: (slug) => {
    const isObjectId = mongoose.isValidObjectId(slug);
    const query = isObjectId ? { $or: [{ slug }, { _id: slug }], isActive: true } : { slug, isActive: true };
    return Product.findOne(query).populate('category', 'name slug').lean();
  },
  findById: (id) => Product.findById(id).lean(),
  search: (q, skip, limit) =>
    Product.find({ $text: { $search: q }, isActive: true }).sort({ score: { $meta: 'textScore' } }).skip(skip).limit(limit).lean(),
  countSearch: (q) => Product.countDocuments({ $text: { $search: q }, isActive: true }),
  create: (data) => Product.create(data),
  update: (id, data) => Product.findByIdAndUpdate(id, data, { new: true }).lean(),
  delete: (id) => Product.findByIdAndDelete(id).lean(),
};

module.exports = ProductRepository;
