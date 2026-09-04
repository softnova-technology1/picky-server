// TODO (Dev 3): Implement cart business logic
const AppError = require('../../utils/appError');
const CartRepo = require('./cart.repository');
const Product = require('../../models/product.model');
const Inventory = require('../../models/inventory.model');
const Coupon = require('../../models/coupon.model');
const CouponUsage = require('../../models/couponUsage.model');

const CartService = {
  async getCart(userId) {
    let cart = await CartRepo.findByUser(userId);
    if (!cart) cart = await CartRepo.create(userId);
    return cart;
  },

  async addItem(userId, { productId, quantity }) {
    const product = await Product.findById(productId).lean();
    if (!product || !product.isActive) throw new AppError('Product not found', 404);

    const inventory = await Inventory.findOne({ product: productId }).lean();
    if (!inventory || inventory.quantity < quantity) throw new AppError('Insufficient stock', 400);

    let cart = await CartRepo.findByUser(userId);
    if (!cart) cart = await CartRepo.create(userId);

    const existingIdx = cart.items.findIndex((i) => i.product.toString() === productId);
    if (existingIdx > -1) {
      cart.items[existingIdx].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: product.discountPrice || product.price,
        name: product.name,
        image: product.images[0] || null,
      });
    }
    return CartRepo.save(cart);
  },

  async updateQty(userId, { productId, quantity }) {
    const cart = await CartRepo.findByUser(userId);
    if (!cart) throw new AppError('Cart not found', 404);
    if (quantity === 0) return this.removeItem(userId, productId);
    const idx = cart.items.findIndex((i) => i.product.toString() === productId);
    if (idx === -1) throw new AppError('Item not in cart', 404);
    cart.items[idx].quantity = quantity;
    return CartRepo.save(cart);
  },

  async removeItem(userId, productId) {
    const cart = await CartRepo.findByUser(userId);
    if (!cart) throw new AppError('Cart not found', 404);
    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    return CartRepo.save(cart);
  },

  async clearCart(userId) {
    return CartRepo.clear(userId);
  },

  async applyCoupon(userId, code) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true }).lean();
    if (!coupon) throw new AppError('Invalid coupon code', 400);

    const now = new Date();
    if (coupon.startsAt && now < coupon.startsAt) throw new AppError('Coupon not yet active', 400);
    if (coupon.endsAt && now > coupon.endsAt) throw new AppError('Coupon expired', 400);

    const alreadyUsed = await CouponUsage.findOne({ coupon: coupon._id, user: userId });
    if (alreadyUsed) throw new AppError('You have already used this coupon', 400);

    const cart = await CartRepo.findByUser(userId);
    if (!cart) throw new AppError('Cart is empty', 400);

    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (subtotal < coupon.minOrderAmount) throw new AppError(`Minimum order amount is Rs.${coupon.minOrderAmount}`, 400);

    let discount = coupon.type === 'percentage'
      ? (subtotal * coupon.value) / 100
      : coupon.value;

    if (coupon.maxDiscountAmount) discount = Math.min(discount, coupon.maxDiscountAmount);

    cart.coupon = coupon._id;
    cart.couponDiscount = discount;
    return CartRepo.save(cart);
  },

  async removeCoupon(userId) {
    return CartRepo.removeCoupon(userId);
  },

  // Called on login — merge guest cart (localStorage items) into DB cart
  async mergeGuestCart(userId, guestItems = []) {
    if (!guestItems.length) return;
    for (const item of guestItems) {
      try { await this.addItem(userId, item); } catch (_) { /* skip invalid items */ }
    }
  },
};

module.exports = CartService;
