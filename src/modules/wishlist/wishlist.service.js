const AppError = require('../../utils/appError');
const WishlistRepo = require('./wishlist.repository');
const Product = require('../../models/product.model');
const mongoose = require('mongoose');

const WishlistService = {
  async getWishlist(userId) {
    let wishlist = await WishlistRepo.findByUser(userId);
    if (!wishlist) {
      const created = await WishlistRepo.create(userId, []);
      wishlist = { _id: created._id, user: userId, products: [] };
    }
    return wishlist;
  },

  async toggleItem(userId, productId) {
    if (!mongoose.isValidObjectId(productId)) {
      throw new AppError('Invalid Product ID', 400);
    }

    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) throw new AppError('Product not found or unavailable', 404);

    let doc = await WishlistRepo.findRawByUser(userId);
    if (!doc) {
      doc = await WishlistRepo.create(userId, [productId]);
      return this.getWishlist(userId);
    }

    const existsIndex = doc.products.findIndex((p) => p.toString() === productId);
    if (existsIndex > -1) {
      doc.products.splice(existsIndex, 1);
    } else {
      doc.products.push(productId);
    }

    await doc.save();
    return this.getWishlist(userId);
  },

  async removeItem(userId, productId) {
    const doc = await WishlistRepo.findRawByUser(userId);
    if (!doc) return { user: userId, products: [] };

    doc.products = doc.products.filter((p) => p.toString() !== productId);
    await doc.save();
    return this.getWishlist(userId);
  },

  async mergeGuestWishlist(userId, guestProductIds = []) {
    if (!guestProductIds || !guestProductIds.length) {
      return this.getWishlist(userId);
    }

    let doc = await WishlistRepo.findRawByUser(userId);
    if (!doc) {
      doc = await WishlistRepo.create(userId, []);
    }

    const existingStrings = new Set(doc.products.map((p) => p.toString()));

    for (const pid of guestProductIds) {
      const stringId = typeof pid === 'object' && pid._id ? pid._id.toString() : pid.toString();
      if (mongoose.isValidObjectId(stringId) && !existingStrings.has(stringId)) {
        doc.products.push(stringId);
        existingStrings.add(stringId);
      }
    }

    await doc.save();
    return this.getWishlist(userId);
  },
};

module.exports = WishlistService;
