const Category = require('../../models/category.model');

const CategoryRepository = {
  findAll: (filter = { isActive: true }) => Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean(),
  findBySlug: (slug) => Category.findOne({ slug }).lean(),
  findById: (id) => Category.findById(id).lean(),
  create: (data) => Category.create(data),
  update: (id, data) => Category.findByIdAndUpdate(id, data, { new: true }).lean(),
};

module.exports = CategoryRepository;
