const CouponService = require('./coupon.service');
const Coupon = require('../../models/coupon.model');
const Product = require('../../models/product.model');
const { ApiResponse } = require('../../utils/apiResponse');

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
 * Public: Real-time Coupon Validation for Checkout (supports Category & Product selectivity)
 */
const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal, items } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json(ApiResponse.error('Please enter a coupon code', 400));
    }

    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() }).lean();
    if (!coupon) {
      return res.status(404).json(ApiResponse.error('Invalid coupon code.', 404));
    }

    const now = new Date();
    if (coupon.endsAt && now > new Date(coupon.endsAt)) {
      return res.status(400).json(ApiResponse.error('This coupon has expired.', 400));
    }
    if (coupon.startsAt && now < new Date(coupon.startsAt)) {
      const dt = new Date(coupon.startsAt);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const hours = dt.getHours();
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const dateFormatted = `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}, ${h12}:${minutes} ${ampm}`;
      return res.status(400).json(ApiResponse.error(`This coupon is scheduled and will be active on ${dateFormatted}.`, 400));
    }
    if (coupon.isActive === false) {
      return res.status(400).json(ApiResponse.error('This coupon is currently inactive.', 400));
    }
    if (coupon.maxUsageTotal && coupon.usageCount >= coupon.maxUsageTotal) {
      return res.status(400).json(ApiResponse.error('Coupon usage limit has been reached.', 400));
    }

    const minAmount = Number(coupon.minOrderAmount) || 0;
    const currentSubtotal = Number(subtotal) || 0;
    if (minAmount > 0 && currentSubtotal < minAmount) {
      return res.status(400).json(
        ApiResponse.error(`Minimum order amount of ₹${minAmount} required.`, 400)
      );
    }

    // ── Selective Category / Product Validation ───────────────────────────
    const applicableOn = coupon.applicableOn;
    const isTargetSpecific =
      applicableOn &&
      typeof applicableOn === 'object' &&
      (applicableOn.type === 'category' || applicableOn.type === 'product');

    let eligibleSubtotal = currentSubtotal;
    let qualifyingCount = 0;

    if (isTargetSpecific) {
      const cartItems = Array.isArray(items) ? items : [];
      if (cartItems.length === 0) {
        const targetType = applicableOn.type === 'category' ? 'category' : 'product';
        return res.status(400).json(
          ApiResponse.error(
            `This coupon is valid only on specific ${targetType} items. Please provide cart items.`,
            400
          )
        );
      }

      // Collect product IDs from cart items to fetch real categories & SKUs
      const productIds = cartItems
        .map((i) => i.productId || i._id || i.id)
        .filter((id) => id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id));

      const dbProducts = await Product.find({ _id: { $in: productIds } })
        .populate('category')
        .lean();

      const productMap = new Map();
      dbProducts.forEach((p) => {
        productMap.set(String(p._id), p);
      });

      eligibleSubtotal = 0;

      if (applicableOn.type === 'category') {
        // Collect target category identifiers: IDs and names (supports multi-category arrays and single-category)
        const targetCatIds = new Set();
        const targetCatNames = new Set();

        if (Array.isArray(applicableOn.categoryIds)) {
          applicableOn.categoryIds.forEach((id) => id && targetCatIds.add(String(id).trim().toLowerCase()));
        }
        if (Array.isArray(applicableOn.categories)) {
          applicableOn.categories.forEach((cat) => {
            if (cat && (cat._id || cat.id)) targetCatIds.add(String(cat._id || cat.id).trim().toLowerCase());
            if (cat && cat.name) targetCatNames.add(String(cat.name).trim().toLowerCase());
          });
        }
        if (applicableOn.categoryId) targetCatIds.add(String(applicableOn.categoryId).trim().toLowerCase());
        if (applicableOn.categoryName) targetCatNames.add(String(applicableOn.categoryName).trim().toLowerCase());
        if (
          applicableOn.value &&
          typeof applicableOn.value === 'string' &&
          targetCatIds.size === 0 &&
          targetCatNames.size === 0
        ) {
          targetCatNames.add(applicableOn.value.trim().toLowerCase());
        }

        for (const item of cartItems) {
          const pId = String(item.productId || item._id || item.id || '');
          const pDoc = productMap.get(pId);
          const itemCatId = String(pDoc?.category?._id || pDoc?.category || item.category?._id || item.category || '').toLowerCase();
          const itemCatName = String(pDoc?.category?.name || item.category?.name || item.category || '').toLowerCase();

          const isMatch =
            (itemCatId && targetCatIds.has(itemCatId)) ||
            (itemCatName && targetCatNames.has(itemCatName)) ||
            (itemCatId && targetCatNames.has(itemCatId)) ||
            (itemCatName && targetCatIds.has(itemCatName));

          if (isMatch) {
            const itemPrice = Number(item.price || item.discountPrice || pDoc?.discountPrice || pDoc?.price || 0);
            const itemQty = Number(item.quantity || 1);
            eligibleSubtotal += itemPrice * itemQty;
            qualifyingCount += itemQty;
          }
        }

        if (qualifyingCount === 0 || eligibleSubtotal <= 0) {
          const displayCat = applicableOn.categoryName || applicableOn.value || 'qualifying categories';
          return res.status(400).json(
            ApiResponse.error(
              `This coupon is valid only for items in selected categories (${displayCat}). Your cart does not contain qualifying items.`,
              400
            )
          );
        }
      } else if (applicableOn.type === 'product') {
        // Collect target product identifiers: IDs, names, SKUs (supports multi-product arrays and single-product)
        const targetIds = new Set();
        const targetNames = new Set();
        const targetSkus = new Set();

        if (Array.isArray(applicableOn.productIds)) {
          applicableOn.productIds.forEach((id) => id && targetIds.add(String(id).trim().toLowerCase()));
        }
        if (Array.isArray(applicableOn.products)) {
          applicableOn.products.forEach((p) => {
            if (p && (p._id || p.id)) targetIds.add(String(p._id || p.id).trim().toLowerCase());
            if (p && p.name) targetNames.add(String(p.name).trim().toLowerCase());
            if (p && p.sku) targetSkus.add(String(p.sku).trim().toLowerCase());
          });
        }
        if (applicableOn.productId) targetIds.add(String(applicableOn.productId).trim().toLowerCase());
        if (applicableOn.productName) targetNames.add(String(applicableOn.productName).trim().toLowerCase());
        if (applicableOn.sku) targetSkus.add(String(applicableOn.sku).trim().toLowerCase());
        if (
          applicableOn.value &&
          typeof applicableOn.value === 'string' &&
          targetIds.size === 0 &&
          targetNames.size === 0
        ) {
          targetNames.add(applicableOn.value.trim().toLowerCase());
        }

        for (const item of cartItems) {
          const pId = String(item.productId || item._id || item.id || '').trim().toLowerCase();
          const pDoc = productMap.get(pId);
          const itemProdName = String(pDoc?.name || item.name || '').trim().toLowerCase();
          const itemSku = String(pDoc?.sku || item.sku || '').trim().toLowerCase();

          const isMatch =
            (pId && targetIds.has(pId)) ||
            (itemProdName && targetNames.has(itemProdName)) ||
            (itemSku && targetSkus.has(itemSku));

          if (isMatch) {
            const itemPrice = Number(item.price || item.discountPrice || pDoc?.discountPrice || pDoc?.price || 0);
            const itemQty = Number(item.quantity || 1);
            eligibleSubtotal += itemPrice * itemQty;
            qualifyingCount += itemQty;
          }
        }

        if (qualifyingCount === 0 || eligibleSubtotal <= 0) {
          const displayProd = applicableOn.productName || applicableOn.value || 'qualifying products';
          return res.status(400).json(
            ApiResponse.error(
              `This coupon is valid only for selected product(s): ${displayProd}. Your cart does not contain qualifying items.`,
              400
            )
          );
        }
      }
    }

    // Calculate discount based on eligibleSubtotal!
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = Math.round((eligibleSubtotal * coupon.value) / 100);
      if (coupon.maxDiscountAmount) {
        discount = Math.min(discount, coupon.maxDiscountAmount);
      }
    } else {
      discount = Math.min(eligibleSubtotal, coupon.value);
    }

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
