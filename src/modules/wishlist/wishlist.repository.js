const Wishlist = require('../../models/wishlist.model');

const WishlistRepository = {
  findByUser: (userId) =>
    Wishlist.findOne({ user: userId })
      .populate({
        path: 'products',
        match: { isActive: true },
        populate: { path: 'category', select: 'name slug' },
      })
      .lean(),

  findRawByUser: (userId) => Wishlist.findOne({ user: userId }),

  create: (userId, productIds = []) => Wishlist.create({ user: userId, products: productIds }),

  save: (doc) => doc.save(),
};

module.exports = WishlistRepository;
