const WishlistService = require('./wishlist.service');
const { ApiResponse } = require('../../utils/apiResponse');

const getWishlist = async (req, res, next) => {
  try {
    const wishlist = await WishlistService.getWishlist(req.user._id);
    return res.json(ApiResponse.success(wishlist));
  } catch (err) {
    next(err);
  }
};

const toggleItem = async (req, res, next) => {
  try {
    const wishlist = await WishlistService.toggleItem(req.user._id, req.body.productId);
    return res.json(ApiResponse.success(wishlist, 'Wishlist updated'));
  } catch (err) {
    next(err);
  }
};

const removeItem = async (req, res, next) => {
  try {
    const wishlist = await WishlistService.removeItem(req.user._id, req.params.productId);
    return res.json(ApiResponse.success(wishlist, 'Item removed from wishlist'));
  } catch (err) {
    next(err);
  }
};

const mergeWishlist = async (req, res, next) => {
  try {
    const wishlist = await WishlistService.mergeGuestWishlist(req.user._id, req.body.productIds || []);
    return res.json(ApiResponse.success(wishlist, 'Guest wishlist merged'));
  } catch (err) {
    next(err);
  }
};

module.exports = { getWishlist, toggleItem, removeItem, mergeWishlist };
