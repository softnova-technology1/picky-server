const CouponService = require('./coupon.service');
const Coupon = require('../../models/coupon.model');
const { ApiResponse } = require('../../utils/apiResponse');
const { evaluateCouponDiscount } = require('./couponEvaluator');

/**
 * Public: List all active coupons for storefront checkout
 */
const getPublicCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({ isActive: true })
      .select('code type value minOrderAmount maxDiscountAmount startsAt endsAt isActive maxUsageTotal usageCount applicableOn')
      .lean();
    const mapped = coupons.map((c) => ({
      ...c,
      validFrom: c.startsAt || null,
      validTill: c.endsAt || null,
      applicableOn: c.applicableOn || 'All Products',
    }));
    return res.json(ApiResponse.success(mapped));
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Real-time Coupon Validation for Checkout (supports Category & Product selectivity + per-user limits)
 */
const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal, items, userId } = req.body || {};
    const resolvedUserId = req.user?._id || userId || null;

    const result = await evaluateCouponDiscount({
      code,
      subtotal,
      items,
      userId: resolvedUserId,
    });

    if (!result.valid) {
      return res.status(result.statusCode || 400).json(ApiResponse.error(result.message, result.statusCode || 400));
    }

    const { coupon, discount, eligibleSubtotal } = result;
    return res.json(
      ApiResponse.success(
        {
          valid: true,
          coupon: {
            _id: coupon._id,
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            minOrderAmount: coupon.minOrderAmount,
            maxDiscountAmount: coupon.maxDiscountAmount,
            applicableOn: coupon.applicableOn,
          },
          discount,
          eligibleSubtotal,
        },
        'Coupon validated successfully'
      )
    );
  } catch (err) {
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const coupons = await CouponService.list();
    const mapped = (coupons || []).map((c) => {
      const obj = typeof c.toObject === 'function' ? c.toObject() : { ...c };
      return {
        ...obj,
        validFrom: obj.startsAt || null,
        validTill: obj.endsAt || null,
      };
    });
    return res.json(ApiResponse.success(mapped));
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const coupon = await CouponService.getById(req.params.id);
    const obj = typeof coupon.toObject === 'function' ? coupon.toObject() : { ...coupon };
    return res.json(
      ApiResponse.success({
        ...obj,
        validFrom: obj.startsAt || null,
        validTill: obj.endsAt || null,
      })
    );
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.validFrom && !data.startsAt) {
      data.startsAt = new Date(data.validFrom);
    } else if (data.startsAt) {
      data.startsAt = new Date(data.startsAt);
    }
    if (data.validTill && !data.endsAt) {
      data.endsAt = new Date(data.validTill);
    } else if (data.endsAt) {
      data.endsAt = new Date(data.endsAt);
    }
    const coupon = await CouponService.create(data);
    const obj = typeof coupon.toObject === 'function' ? coupon.toObject() : { ...coupon };
    return res.status(201).json(
      ApiResponse.success(
        {
          ...obj,
          validFrom: obj.startsAt || null,
          validTill: obj.endsAt || null,
        },
        'Coupon created successfully'
      )
    );
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.validFrom !== undefined) {
      data.startsAt = data.validFrom ? new Date(data.validFrom) : null;
    } else if (data.startsAt !== undefined) {
      data.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    }
    if (data.validTill !== undefined) {
      data.endsAt = data.validTill ? new Date(data.validTill) : null;
    } else if (data.endsAt !== undefined) {
      data.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    }
    const coupon = await CouponService.update(req.params.id, data);
    const obj = typeof coupon.toObject === 'function' ? coupon.toObject() : { ...coupon };
    return res.json(
      ApiResponse.success(
        {
          ...obj,
          validFrom: obj.startsAt || null,
          validTill: obj.endsAt || null,
        },
        'Coupon updated successfully'
      )
    );
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

module.exports = { list, getById, create, update, toggleActive, remove, getPublicCoupons, validateCoupon };
