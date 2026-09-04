const Cart = require('../../models/cart.model');

const CartRepository = {
  findByUser: (userId) => Cart.findOne({ user: userId }).populate('items.product', 'name images price discountPrice isActive').lean(),
  create: (userId) => Cart.create({ user: userId, items: [] }),
  save: (cart) => cart.save(),
  clear: (userId) => Cart.findOneAndUpdate({ user: userId }, { items: [], coupon: null, couponDiscount: 0 }, { new: true }),
  removeCoupon: (userId) => Cart.findOneAndUpdate({ user: userId }, { coupon: null, couponDiscount: 0 }, { new: true }).lean(),
};

module.exports = CartRepository;
