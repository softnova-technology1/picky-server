const Discount = require('../../models/discount.model');
const DiscountRepository = {
  findActive: () => Discount.find({ isActive: true }).lean(),
  findById: (id) => Discount.findById(id).lean(),
  create: (data) => Discount.create(data),
  update: (id, data) => Discount.findByIdAndUpdate(id, data, { new: true }).lean(),
};
module.exports = DiscountRepository;
