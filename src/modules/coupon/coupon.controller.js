const CouponService = require('./coupon.service');
const { ApiResponse } = require('../../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const coupons = await CouponService.list();
    return res.json(ApiResponse.success(coupons));
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const coupon = await CouponService.getById(req.params.id);
    return res.json(ApiResponse.success(coupon));
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const coupon = await CouponService.create(req.body);
    return res.status(201).json(ApiResponse.success(coupon, 'Coupon created successfully'));
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const coupon = await CouponService.update(req.params.id, req.body);
    return res.json(ApiResponse.success(coupon, 'Coupon updated successfully'));
  } catch (err) {
    next(err);
  }
};

const toggleActive = async (req, res, next) => {
  try {
    const coupon = await CouponService.toggleActive(req.params.id);
    return res.json(ApiResponse.success(coupon, 'Coupon status updated'));
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await CouponService.remove(req.params.id);
    return res.json(ApiResponse.success(null, 'Coupon deactivated'));
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, toggleActive, remove };
