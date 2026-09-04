const DiscountService = require('./discount.service');
const { ApiResponse } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const discounts = await DiscountService.list();
    return res.json(ApiResponse.success(discounts));
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const discount = await DiscountService.getById(req.params.id);
    return res.json(ApiResponse.success(discount));
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const discount = await DiscountService.create(req.body);
    return res.status(201).json(ApiResponse.success(discount, 'Discount created successfully'));
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const discount = await DiscountService.update(req.params.id, req.body);
    return res.json(ApiResponse.success(discount, 'Discount updated successfully'));
  } catch (err) {
    next(err);
  }
};

const toggleActive = async (req, res, next) => {
  try {
    const discount = await DiscountService.toggleActive(req.params.id);
    return res.json(ApiResponse.success(discount, 'Discount status updated'));
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await DiscountService.remove(req.params.id);
    return res.json(ApiResponse.success(null, 'Discount deactivated'));
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, toggleActive, remove };
