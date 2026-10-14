const CartService = require('./cart.service');
const { ApiResponse } = require('../../utils/apiResponse');

const getUserId = (req) => req.user?._id || req.user?.id;

const getCart = async (req, res, next) => {
  try {
    const cart = await CartService.getCart(getUserId(req));
    return res.json(ApiResponse.success(cart));
  } catch (err) { next(err); }
};

const addItem = async (req, res, next) => {
  try {
    const cart = await CartService.addItem(getUserId(req), req.body);
    return res.json(ApiResponse.success(cart, 'Item added to cart'));
  } catch (err) { next(err); }
};

const updateQty = async (req, res, next) => {
  try {
    const cart = await CartService.updateQty(getUserId(req), req.body);
    return res.json(ApiResponse.success(cart, 'Cart updated'));
  } catch (err) { next(err); }
};

const removeItem = async (req, res, next) => {
  try {
    const cart = await CartService.removeItem(getUserId(req), req.params.productId);
    return res.json(ApiResponse.success(cart, 'Item removed'));
  } catch (err) { next(err); }
};

const clearCart = async (req, res, next) => {
  try {
    await CartService.clearCart(getUserId(req));
    return res.json(ApiResponse.success(null, 'Cart cleared'));
  } catch (err) { next(err); }
};

const mergeGuestCart = async (req, res, next) => {
  try {
    await CartService.mergeGuestCart(getUserId(req), req.body.items || []);
    const updated = await CartService.getCart(getUserId(req));
    return res.json(ApiResponse.success(updated, 'Guest cart merged'));
  } catch (err) { next(err); }
};

const applyCoupon = async (req, res, next) => {
  try {
    const cart = await CartService.applyCoupon(getUserId(req), req.body.code);
    return res.json(ApiResponse.success(cart, 'Coupon applied'));
  } catch (err) { next(err); }
};

const removeCoupon = async (req, res, next) => {
  try {
    const cart = await CartService.removeCoupon(getUserId(req));
    return res.json(ApiResponse.success(cart, 'Coupon removed'));
  } catch (err) { next(err); }
};

const getAbandonedCarts = async (req, res, next) => {
  try {
    const carts = await CartService.getAbandonedCarts();
    return res.json(ApiResponse.success(carts));
  } catch (err) { next(err); }
};

const recordRecoveryAlert = async (req, res, next) => {
  try {
    const cart = await CartService.recordRecoveryAlert(req.params.cartId, req.body);
    return res.json(ApiResponse.success(cart, 'Recovery alert recorded'));
  } catch (err) { next(err); }
};

const markCartRecovered = async (req, res, next) => {
  try {
    const cart = await CartService.markCartRecovered(req.params.cartId, req.body);
    return res.json(ApiResponse.success(cart, 'Cart marked as recovered'));
  } catch (err) { next(err); }
};

const markCartExpired = async (req, res, next) => {
  try {
    const cart = await CartService.markCartExpired(req.params.cartId);
    return res.json(ApiResponse.success(cart, 'Cart marked as expired'));
  } catch (err) { next(err); }
};

const revertCartConversion = async (req, res, next) => {
  try {
    const cart = await CartService.revertCartConversion(req.params.cartId, req.body);
    return res.json(ApiResponse.success(cart, 'Conversion reverted'));
  } catch (err) { next(err); }
};

const deleteTimelineEntry = async (req, res, next) => {
  try {
    const { index, entryId, timestamp, event } = { ...req.body, ...req.query, ...req.params };
    const numIndex = index !== undefined && !isNaN(parseInt(index, 10)) ? parseInt(index, 10) : undefined;
    const cart = await CartService.deleteTimelineEntry(req.params.cartId, {
      index: numIndex,
      entryId,
      timestamp,
      event,
    });
    return res.json(ApiResponse.success(cart, 'Timeline entry deleted'));
  } catch (err) { next(err); }
};

module.exports = {
  getCart,
  addItem,
  updateQty,
  removeItem,
  clearCart,
  mergeGuestCart,
  applyCoupon,
  removeCoupon,
  getAbandonedCarts,
  recordRecoveryAlert,
  markCartRecovered,
  markCartExpired,
  revertCartConversion,
  deleteTimelineEntry,
};
