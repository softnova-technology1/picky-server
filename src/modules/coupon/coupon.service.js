const AppError = require('../../utils/appError');
const CouponRepo = require('./coupon.repository');

const CouponService = {
  async list() {
    return CouponRepo.findAll();
  },

  async getById(id) {
    const coupon = await CouponRepo.findById(id);
    if (!coupon) throw new AppError('Coupon not found', 404);
    return coupon;
  },

  async create(data) {
    const existing = await CouponRepo.findByCode(data.code);
    if (existing) throw new AppError('Coupon code already exists', 400);
    return CouponRepo.create(data);
  },

  async update(id, data) {
    const coupon = await CouponRepo.findById(id);
    if (!coupon) throw new AppError('Coupon not found', 404);
    if (data.code && data.code.toUpperCase() !== coupon.code) {
      const existing = await CouponRepo.findByCode(data.code);
      if (existing) throw new AppError('Coupon code already exists', 400);
    }
    return CouponRepo.update(id, data);
  },

  async toggleActive(id) {
    const coupon = await CouponRepo.findById(id);
    if (!coupon) throw new AppError('Coupon not found', 404);
    return CouponRepo.update(id, { isActive: !coupon.isActive });
  },

  async remove(id) {
    const coupon = await CouponRepo.findById(id);
    if (!coupon) throw new AppError('Coupon not found', 404);
    return CouponRepo.delete(id);
  },
};

module.exports = CouponService;
