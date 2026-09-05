const AppError = require('../../utils/appError');
const DiscountRepo = require('./discount.repository');
const Discount = require('../../models/discount.model');

const DiscountService = {
  async list() {
    return Discount.find().sort({ createdAt: -1 }).lean();
  },

  async listActive() {
    return DiscountRepo.findActive();
  },

  async getFirstOrderDiscount() {
    const now = new Date();
    return Discount.findOne({
      appliesTo: 'first_order',
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).lean();
  },

  async getById(id) {
    const discount = await DiscountRepo.findById(id);
    if (!discount) throw new AppError('Discount rule not found', 404);
    return discount;
  },

  async create(data) {
    return DiscountRepo.create(data);
  },

  async update(id, data) {
    const discount = await DiscountRepo.findById(id);
    if (!discount) throw new AppError('Discount rule not found', 404);
    return DiscountRepo.update(id, data);
  },

  async toggleActive(id) {
    const discount = await DiscountRepo.findById(id);
    if (!discount) throw new AppError('Discount rule not found', 404);
    return DiscountRepo.update(id, { isActive: !discount.isActive });
  },

  async remove(id) {
    const discount = await DiscountRepo.findById(id);
    if (!discount) throw new AppError('Discount rule not found', 404);
    return DiscountRepo.delete(id);
  },
};

module.exports = DiscountService;
