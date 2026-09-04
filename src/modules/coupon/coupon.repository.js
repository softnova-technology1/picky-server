const Coupon = require('../../models/coupon.model');
const CouponRepository = {
  findByCode: (code) => Coupon.findOne({ code: code.toUpperCase() }).lean(),
  findAll: () => Coupon.find().sort({ createdAt: -1 }).lean(),
  findById: (id) => Coupon.findById(id).lean(),
  create: (data) => Coupon.create(data),
  update: (id, data) => Coupon.findByIdAndUpdate(id, data, { new: true }).lean(),
};
module.exports = CouponRepository;
