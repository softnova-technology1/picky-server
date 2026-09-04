// TODO (Dev 4): Implement order business logic
const AppError = require('../../utils/appError');
const OrderRepo = require('./order.repository');
const CartRepo = require('../cart/cart.repository');
const Inventory = require('../../models/inventory.model');
const CouponUsage = require('../../models/couponUsage.model');
const Coupon = require('../../models/coupon.model');
const User = require('../../models/user.model');
const NotificationService = require('../../services/notification.service');
const paginate = require('../../utils/paginate');
const mongoose = require('mongoose');

const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PKY-${date}-${rand}`;
};

const OrderService = {
  async checkout(user, { shippingAddress }) {
    const cart = await CartRepo.findByUser(user._id);
    if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', 400);

    // Validate stock for all items
    for (const item of cart.items) {
      const inv = await Inventory.findOne({ product: item.product });
      if (!inv || inv.quantity < item.quantity)
        throw new AppError(`Insufficient stock for ${item.name}`, 400);
    }

    // Calculate pricing
    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let discountAmount = cart.couponDiscount || 0;
    let discountType = null;

    // First-order gift check (SILENT — internal only)
    if (user.orderCount === 0 && !cart.coupon) {
      const Discount = require('../../models/discount.model');
      const now = new Date();
      const firstOrderDiscount = await Discount.findOne({
        appliesTo: 'first_order',
        isActive: true,
        $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
        $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
      }).lean();

      if (firstOrderDiscount && subtotal >= (firstOrderDiscount.minOrderAmount || 0)) {
        let fodAmount = firstOrderDiscount.type === 'percentage'
          ? (subtotal * firstOrderDiscount.value) / 100
          : firstOrderDiscount.value;
        if (firstOrderDiscount.maxDiscountAmount) {
          fodAmount = Math.min(fodAmount, firstOrderDiscount.maxDiscountAmount);
        }
        discountAmount = fodAmount;
        discountType = 'first_order';
      }
    } else if (cart.coupon) {
      discountType = 'coupon';
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Deduct inventory
    for (const item of cart.items) {
      await Inventory.findOneAndUpdate(
        { product: item.product },
        { $inc: { quantity: -item.quantity } }
      );
    }

    // Create order
    const order = await OrderRepo.create({
      orderNumber: generateOrderNumber(),
      user: user._id,
      items: cart.items.map((i) => ({
        product: i.product,
        name: i.name,
        image: i.image,
        price: i.price,
        quantity: i.quantity,
      })),
      shippingAddress,
      subtotal,
      discountAmount,
      total,
      paymentMethod: 'cod',
      coupon: cart.coupon || null,
      discountType,
      status: 'confirmed',
      statusHistory: [{ status: 'confirmed', timestamp: new Date() }],
    });

    // Record coupon usage
    if (cart.coupon) {
      await CouponUsage.create({ coupon: cart.coupon, user: user._id, order: order._id });
      await Coupon.findByIdAndUpdate(cart.coupon, { $inc: { usageCount: 1 } });
    }

    // Increment order count (for first-order gift logic)
    await User.findByIdAndUpdate(user._id, { $inc: { orderCount: 1 } });

    // Clear cart
    await CartRepo.clear(user._id);

    // Send WhatsApp notification (async — don't block)
    NotificationService.sendOrderConfirmed(user.phone, user.name || 'Customer', order.orderNumber, total).catch(console.error);

    return order;
  },

  async myOrders(userId, query) {
    const { skip, limit, buildPagination } = paginate(query);
    const [data, total] = await Promise.all([
      OrderRepo.findByUser(userId, skip, limit),
      OrderRepo.countByUser(userId),
    ]);
    return { data, pagination: buildPagination(total) };
  },

  async getDetail(orderId, userId) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const order = await OrderRepo.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.user.toString() !== userId.toString()) throw new AppError('Not authorized', 403);
    return order;
  },

  async getTracking(orderId, userId) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const order = await OrderRepo.findTracking(orderId);
    if (!order) throw new AppError('Order not found', 404);
    if (order.user.toString() !== userId.toString()) throw new AppError('Not authorized', 403);
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      trackingId: order.trackingId || null,
      courier: order.courier || null,
      statusHistory: order.statusHistory || [],
    };
  },

  async adminListOrders(query) {
    const { skip, limit, buildPagination } = paginate(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    const [data, total] = await Promise.all([
      OrderRepo.findAll(filter, skip, limit),
      OrderRepo.count(filter),
    ]);
    return { data, pagination: buildPagination(total) };
  },

  async adminGetDetail(orderId) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const order = await OrderRepo.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);
    return order;
  },

  async addTracking(orderId, { trackingId, courier }) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const order = await OrderRepo.addTracking(orderId, { trackingId, courier });
    if (!order) throw new AppError('Order not found', 404);

    // Send WhatsApp with AWB (async)
    const user = await User.findById(order.user).lean();
    if (user) {
      NotificationService.sendOrderShipped(user.phone, order.orderNumber, courier, trackingId).catch(console.error);
    }
    return order;
  },

  async updateStatus(orderId, { status, note }) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const order = await OrderRepo.updateStatus(orderId, status, note);
    if (!order) throw new AppError('Order not found', 404);

    // Send WhatsApp on delivered
    if (status === 'delivered') {
      const user = await User.findById(order.user).lean();
      if (user) {
        NotificationService.sendOrderDelivered(user.phone, order.orderNumber).catch(console.error);
      }
    }
    return order;
  },
};

module.exports = OrderService;
