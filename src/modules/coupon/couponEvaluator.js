const Coupon = require('../../models/coupon.model');
const CouponUsage = require('../../models/couponUsage.model');
const Order = require('../../models/order.model');
const Product = require('../../models/product.model');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatScheduleDate(dt) {
  const hours = dt.getHours();
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${dt.getDate()} ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}, ${h12}:${minutes} ${ampm}`;
}

function collectTargetSets(applicableOn, keys) {
  const targetIds = new Set();
  const targetNames = new Set();
  const targetSkus = new Set();

  if (Array.isArray(applicableOn[keys.idsField])) {
    applicableOn[keys.idsField].forEach((id) => id && targetIds.add(String(id).trim().toLowerCase()));
  }
  if (Array.isArray(applicableOn[keys.objectsField])) {
    applicableOn[keys.objectsField].forEach((obj) => {
      if (obj && (obj._id || obj.id)) targetIds.add(String(obj._id || obj.id).trim().toLowerCase());
      if (obj && obj.name) targetNames.add(String(obj.name).trim().toLowerCase());
      if (obj && obj.sku) targetSkus.add(String(obj.sku).trim().toLowerCase());
    });
  }
  if (applicableOn[keys.singleIdField]) {
    targetIds.add(String(applicableOn[keys.singleIdField]).trim().toLowerCase());
  }
  if (applicableOn[keys.singleNameField]) {
    targetNames.add(String(applicableOn[keys.singleNameField]).trim().toLowerCase());
  }
  if (keys.singleSkuField && applicableOn[keys.singleSkuField]) {
    targetSkus.add(String(applicableOn[keys.singleSkuField]).trim().toLowerCase());
  }
  if (
    applicableOn.value &&
    typeof applicableOn.value === 'string' &&
    targetIds.size === 0 &&
    targetNames.size === 0
  ) {
    targetNames.add(applicableOn.value.trim().toLowerCase());
  }

  return { targetIds, targetNames, targetSkus };
}

/**
 * Shared Coupon Validation & Discount Calculator
 * Used by both public /coupons/validate preview and server-side order creation.
 */
async function evaluateCouponDiscount({
  code,
  subtotal = 0,
  items = [],
  userId = null,
  dbProductsMap = null,
}) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { valid: false, statusCode: 400, message: 'Please enter a coupon code.' };
  }

  const cleanCode = code.trim().toUpperCase();
  const coupon = await Coupon.findOne({ code: cleanCode }).lean();
  if (!coupon) {
    return { valid: false, statusCode: 404, message: 'Invalid coupon code.' };
  }

  const now = new Date();
  if (coupon.endsAt && now > new Date(coupon.endsAt)) {
    return { valid: false, statusCode: 400, message: 'This coupon has expired.', coupon };
  }
  if (coupon.startsAt && now < new Date(coupon.startsAt)) {
    return {
      valid: false,
      statusCode: 400,
      message: `This coupon is scheduled and will be active on ${formatScheduleDate(new Date(coupon.startsAt))}.`,
      coupon,
    };
  }
  if (coupon.isActive === false) {
    return { valid: false, statusCode: 400, message: 'This coupon is currently inactive.', coupon };
  }
  if (coupon.maxUsageTotal && (Number(coupon.usageCount) || 0) >= Number(coupon.maxUsageTotal)) {
    return { valid: false, statusCode: 400, message: 'Coupon usage limit has been reached.', coupon };
  }

  // Enforce per-customer limit when userId is known
  const perUserLimit =
    coupon.maxUsagePerUser !== undefined && coupon.maxUsagePerUser !== null
      ? Number(coupon.maxUsagePerUser)
      : 1;
  if (userId && perUserLimit > 0) {
    const userOrderCount = await Order.countDocuments({
      user: userId,
      coupon: coupon._id,
      status: { $ne: 'cancelled' },
    });
    if (userOrderCount >= perUserLimit) {
      return {
        valid: false,
        statusCode: 400,
        message:
          perUserLimit === 1
            ? 'You have already redeemed this coupon code.'
            : `You have reached the maximum limit (${perUserLimit} uses) for this coupon.`,
        coupon,
      };
    }
  }

  const minAmount = Number(coupon.minOrderAmount) || 0;
  const currentSubtotal = Number(subtotal) || 0;
  if (minAmount > 0 && currentSubtotal < minAmount) {
    return {
      valid: false,
      statusCode: 400,
      message: `Minimum order amount of ₹${minAmount} required.`,
      coupon,
    };
  }

  // Selective Category / Product Targeting Evaluation
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
      return {
        valid: false,
        statusCode: 400,
        message: `This coupon is valid only on specific ${targetType} items. Please provide cart items.`,
        coupon,
      };
    }

    // Reuse caller-supplied product map or fetch missing products with populated category
    const productMap = new Map(dbProductsMap ? dbProductsMap.entries() : []);
    const missingIds = cartItems
      .map((i) => String(i.productId || i.product || i._id || i.id || ''))
      .filter((id) => /^[0-9a-fA-F]{24}$/.test(id) && !productMap.has(id));

    if (missingIds.length > 0) {
      const fetchedProducts = await Product.find({ _id: { $in: missingIds } })
        .populate('category')
        .lean();
      fetchedProducts.forEach((p) => {
        productMap.set(String(p._id), p);
      });
    }

    eligibleSubtotal = 0;

    if (applicableOn.type === 'category') {
      const { targetIds: targetCatIds, targetNames: targetCatNames } = collectTargetSets(applicableOn, {
        idsField: 'categoryIds',
        objectsField: 'categories',
        singleIdField: 'categoryId',
        singleNameField: 'categoryName',
      });

      for (const item of cartItems) {
        const pId = String(item.productId || item.product || item._id || item.id || '');
        const pDoc = productMap.get(pId);
        const itemCatId = String(
          pDoc?.category?._id || pDoc?.category || item.category?._id || item.category || ''
        )
          .trim()
          .toLowerCase();
        const itemCatName = String(
          pDoc?.category?.name || item.category?.name || item.category || ''
        )
          .trim()
          .toLowerCase();

        const isMatch =
          (itemCatId && targetCatIds.has(itemCatId)) ||
          (itemCatName && targetCatNames.has(itemCatName)) ||
          (itemCatId && targetCatNames.has(itemCatId)) ||
          (itemCatName && targetCatIds.has(itemCatName));

        if (isMatch) {
          const itemPrice = Number(
            item.price || item.discountPrice || pDoc?.discountPrice || pDoc?.price || 0
          );
          const itemQty = Number(item.quantity || 1);
          eligibleSubtotal += itemPrice * itemQty;
          qualifyingCount += itemQty;
        }
      }

      if (qualifyingCount === 0 || eligibleSubtotal <= 0) {
        const displayCat = applicableOn.categoryName || applicableOn.value || 'qualifying categories';
        return {
          valid: false,
          statusCode: 400,
          message: `This coupon is valid only for items in selected categories (${displayCat}). Your cart does not contain qualifying items.`,
          coupon,
        };
      }
    } else if (applicableOn.type === 'product') {
      const { targetIds, targetNames, targetSkus } = collectTargetSets(applicableOn, {
        idsField: 'productIds',
        objectsField: 'products',
        singleIdField: 'productId',
        singleNameField: 'productName',
        singleSkuField: 'sku',
      });

      for (const item of cartItems) {
        const pId = String(item.productId || item.product || item._id || item.id || '')
          .trim()
          .toLowerCase();
        const pDoc = productMap.get(String(item.productId || item.product || item._id || item.id || ''));
        const itemProdName = String(pDoc?.name || item.name || '').trim().toLowerCase();
        const itemSku = String(pDoc?.sku || item.sku || '').trim().toLowerCase();

        const isMatch =
          (pId && targetIds.has(pId)) ||
          (itemProdName && targetNames.has(itemProdName)) ||
          (itemSku && targetSkus.has(itemSku));

        if (isMatch) {
          const itemPrice = Number(
            item.price || item.discountPrice || pDoc?.discountPrice || pDoc?.price || 0
          );
          const itemQty = Number(item.quantity || 1);
          eligibleSubtotal += itemPrice * itemQty;
          qualifyingCount += itemQty;
        }
      }

      if (qualifyingCount === 0 || eligibleSubtotal <= 0) {
        const displayProd = applicableOn.productName || applicableOn.value || 'qualifying products';
        return {
          valid: false,
          statusCode: 400,
          message: `This coupon is valid only for selected product(s): ${displayProd}. Your cart does not contain qualifying items.`,
          coupon,
        };
      }
    }
  }

  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = Math.round((eligibleSubtotal * Number(coupon.value || 0)) / 100);
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
  } else {
    discount = Math.min(eligibleSubtotal, Number(coupon.value || 0));
  }
  discount = Math.max(0, Math.min(eligibleSubtotal, discount));

  return {
    valid: true,
    statusCode: 200,
    coupon,
    discount,
    eligibleSubtotal,
    qualifyingCount,
  };
}

/**
 * Atomically increment Coupon.usageCount and record CouponUsage audit doc when an order is created.
 */
async function recordCouponRedemption({ couponId, userId = null, orderId = null, session = null }) {
  if (!couponId) return;
  const opts = session ? { session } : {};
  await Coupon.updateOne({ _id: couponId }, { $inc: { usageCount: 1 } }, opts);

  if (userId && orderId) {
    await CouponUsage.updateOne(
      { coupon: couponId, user: userId },
      { $set: { order: orderId, usedAt: new Date() } },
      { upsert: true, ...opts }
    );
  }
}

module.exports = {
  evaluateCouponDiscount,
  recordCouponRedemption,
};
