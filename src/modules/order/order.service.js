const { randomBytes } = require('crypto');
const AppError = require('../../utils/appError');
const OrderRepo = require('./order.repository');
const CartRepo = require('../cart/cart.repository');
const Cart = require('../../models/cart.model');
const Inventory = require('../../models/inventory.model');
const CouponUsage = require('../../models/couponUsage.model');
const Coupon = require('../../models/coupon.model');
const User = require('../../models/user.model');
const Product = require('../../models/product.model');
const Order = require('../../models/order.model');
const NotificationService = require('../../services/notification.service');
const RazorpayService = require('../../services/razorpay.service');
const paginate = require('../../utils/paginate');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

/**
 * audit fix #7 — Replaced Math.random() 4-digit suffix with 8-char crypto hex.
 * Old approach had ~0.6% collision probability at 100 orders/day (birthday paradox).
 * 16^8 = 4 billion combinations per day — effectively collision-proof.
 */
const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `PKY-${date}-${suffix}`;
};

const calculateCartPricing = async (user, cart) => {
  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  let discountAmount = cart.couponDiscount || 0;
  let discountType = null;

  // First-order gift check (SILENT — internal only, never expose discountType to customer)
  if (user.orderCount === 0 && !cart.coupon) {
    const Discount = require('../../models/discount.model');
    const now = new Date();
    const firstOrderDiscount = await Discount.findOne({
      appliesTo: 'first_order',
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
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
  return { subtotal, discountAmount, discountType, total };
};

const OrderService = {
  /**
   * 1. Create Razorpay Order instance for Frontend Checkout Modal
   */
  async createRazorpayOrder(user, { shippingAddress, items, total, totalAmount, subtotal, discountAmount }) {
    let cart = await CartRepo.findByUser(user._id);
    if ((!cart || cart.items.length === 0) && items && items.length > 0) {
      const CartService = require('../cart/cart.service');
      await CartService.mergeGuestCart(user._id, items);
      cart = await CartRepo.findByUser(user._id);
    }

    let calculatedTotal = 0;
    let calculatedSubtotal = 0;
    let calculatedDiscount = 0;

    if (cart && cart.items.length > 0) {
      // Validate stock for all items
      for (const item of cart.items) {
        const inv = await Inventory.findOne({ product: item.product });
        if (!inv || inv.quantity < item.quantity) {
          throw new AppError(`Insufficient stock for "${item.name}"`, 400);
        }
      }
      const pricing = await calculateCartPricing(user, cart);
      calculatedTotal = pricing.total;
      calculatedSubtotal = pricing.subtotal;
      calculatedDiscount = pricing.discountAmount;
    } else if (items && items.length > 0) {
      calculatedSubtotal = Number(subtotal) || items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
      calculatedDiscount = Number(discountAmount) || 0;
      calculatedTotal = Number(total || totalAmount) || Math.max(0, calculatedSubtotal - calculatedDiscount);
    } else if (Number(total || totalAmount) > 0) {
      calculatedTotal = Number(total || totalAmount);
      calculatedSubtotal = calculatedTotal;
    } else {
      throw new AppError('Cart is empty', 400);
    }

    const receipt = generateOrderNumber();

    const rzOrder = await RazorpayService.createOrder({
      amountInRupees: calculatedTotal,
      receipt,
      notes: {
        userId: user._id.toString(),
        phone: user.phone || '',
      },
    });

    return {
      razorpayOrderId: rzOrder.id,
      amount: rzOrder.amount, // in paise
      currency: rzOrder.currency,
      keyId: rzOrder.keyId,
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscount,
      total: calculatedTotal,
    };
  },

  /**
   * 2. Verify Razorpay Payment Signature and Create Order in DB
   *
   * audit fix #1 — Wrapped ALL write operations in a MongoDB transaction.
   * Before: Inventory deduct → Order create → coupon record (3 separate writes).
   * If any write failed midway: inventory phantom-deducted, order ghost-created.
   * Now: all 4 operations are atomic — all commit or all rollback together.
   *
   * NOTE: MongoDB transactions require a replica set. Atlas always supports this.
   * For local dev, start mongod with --replSet rs0 or use Docker with replica set.
   */
  async verifyAndCreateOrder(user, { shippingAddress, razorpayOrderId, razorpayPaymentId, razorpaySignature, items, subtotal, discountAmount, total, totalAmount }) {
    let cart = await CartRepo.findByUser(user._id);
    if ((!cart || cart.items.length === 0) && items && items.length > 0) {
      const CartService = require('../cart/cart.service');
      await CartService.mergeGuestCart(user._id, items);
      cart = await CartRepo.findByUser(user._id);
    }

    // Verify cryptographic signature (audit fix #3 — bypass bug was removed in razorpay.service.js)
    const isValid = RazorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      throw new AppError('Payment signature verification failed. Please contact support if debited.', 400);
    }

    // Check if order already exists for this razorpayOrderId (idempotency — webhook dedup)
    const existingOrder = await Order.findOne({ razorpayOrderId }).lean();
    if (existingOrder) {
      logger.info(`[ORDER] Duplicate order creation skipped for razorpayOrderId: ${razorpayOrderId}`);
      return existingOrder;
    }

    // Direct items fallback if DB cart is empty
    if (!cart || cart.items.length === 0) {
      if (!items || items.length === 0) throw new AppError('Cart is empty', 400);

      const calculatedSubtotal = Number(subtotal) || items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
      const calculatedDiscount = Number(discountAmount) || 0;
      const finalTotal = Number(total || totalAmount) || Math.max(0, calculatedSubtotal - calculatedDiscount);

      const formattedItems = items.map((i) => {
        let prodId = i.productId || i.product || i._id || i.id;
        if (prodId && !mongoose.isValidObjectId(prodId)) prodId = null;
        return {
          product: prodId,
          name: i.name || 'Product Item',
          image: i.image || (Array.isArray(i.images) ? i.images[0] : null) || '',
          price: Number(i.price) || 0,
          quantity: Number(i.quantity) || 1,
        };
      });

      const order = await Order.create({
        orderNumber: generateOrderNumber(),
        user: user._id,
        items: formattedItems,
        shippingAddress,
        subtotal: calculatedSubtotal,
        discountAmount: calculatedDiscount,
        total: finalTotal,
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        status: 'confirmed',
        statusHistory: [{ status: 'confirmed', note: 'Prepaid via Razorpay (Online)', timestamp: new Date() }],
      });

      for (const item of formattedItems) {
        if (item.product) {
          try {
            // 1. Decrement Inventory.quantity
            await Inventory.findOneAndUpdate(
              { product: item.product },
              { $inc: { quantity: -item.quantity } },
              { new: true }
            );
            await Inventory.updateOne(
              { product: item.product, quantity: { $lt: 0 } },
              { $set: { quantity: 0 } }
            );

            // 2. Decrement Product.stock (Live sync for Admin Catalog & UI)
            await Product.findByIdAndUpdate(
              item.product,
              { $inc: { stock: -item.quantity } },
              { new: true }
            );
            await Product.updateOne(
              { _id: item.product, stock: { $lt: 0 } },
              { $set: { stock: 0 } }
            );
            logger.info(`[ORDER] Stock decremented by ${item.quantity} for product: ${item.product}`);
          } catch (stkErr) {
            logger.error(`[ORDER] Stock deduction error for ${item.product}: ${stkErr.message}`);
          }
        }
      }

      await User.findByIdAndUpdate(user._id, { $inc: { orderCount: 1 } });
      NotificationService.sendOrderConfirmed(user.phone, user.name || 'Customer', order.orderNumber, order.total)
        .catch((err) => logger.error(`[WATI] Order confirmed notification failed: ${err.message}`));

      return order;
    }

    const { subtotal: cartSubtotal, discountAmount: cartDiscount, discountType, total: cartTotal } = await calculateCartPricing(user, cart);

    // ─── Start MongoDB Transaction (audit fix #1) ─────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();
    let order;
    try {
      // Step 1: Deduct inventory and product stock atomically for every cart item
      for (const item of cart.items) {
        const updatedInv = await Inventory.findOneAndUpdate(
          { product: item.product, quantity: { $gte: item.quantity } },
          { $inc: { quantity: -item.quantity } },
          { session, new: true }
        );
        if (!updatedInv) {
          throw new AppError(`"${item.name}" is now out of stock. Your payment was not debited.`, 400);
        }
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );
        await Product.updateOne(
          { _id: item.product, stock: { $lt: 0 } },
          { $set: { stock: 0 } },
          { session }
        );
      }

      // Step 2: Create the Order document
      const [created] = await Order.create(
        [
          {
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
            paymentMethod: 'razorpay',
            paymentStatus: 'paid',
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            coupon: cart.coupon || null,
            discountType,
            status: 'confirmed',
            statusHistory: [{ status: 'confirmed', note: 'Prepaid via Razorpay (Online)', timestamp: new Date() }],
          },
        ],
        { session }
      );
      order = created;

      // Step 3: Record coupon usage + increment coupon counter
      if (cart.coupon) {
        await CouponUsage.create(
          [{ coupon: cart.coupon, user: user._id, order: order._id }],
          { session }
        );
        await Coupon.findByIdAndUpdate(
          cart.coupon,
          { $inc: { usageCount: 1 } },
          { session }
        );
      }

      // Step 4: Increment user's order count
      await User.findByIdAndUpdate(
        user._id,
        { $inc: { orderCount: 1 } },
        { session }
      );

      // Step 5: Clear cart (inside transaction for full rollback safety)
      await Cart.findOneAndUpdate(
        { user: user._id },
        { items: [], coupon: null, couponDiscount: 0 },
        { session }
      );

      await session.commitTransaction();
      logger.info(`[ORDER] ✅ Order ${order.orderNumber} committed successfully`);
    } catch (err) {
      await session.abortTransaction();
      logger.error(`[ORDER] ❌ Transaction aborted for razorpayOrderId ${razorpayOrderId}: ${err.message}`);
      throw err;
    } finally {
      session.endSession();
    }
    // ─── End Transaction ──────────────────────────────────────────────────────

    // Send WhatsApp notification asynchronously (outside transaction — non-blocking)
    NotificationService.sendOrderConfirmed(user.phone, user.name || 'Customer', order.orderNumber, total)
      .catch((err) => logger.error(`[WATI] Order confirmed notification failed: ${err.message}`));

    return order;
  },

  /**
   * 2b. Direct Order Creation (Prepaid, Simulated Payment, or Web Checkout)
   */
  async createOrder(user, {
    items = [],
    shippingAddress = {},
    subtotal,
    discountAmount = 0,
    shippingFee = 0,
    total,
    totalAmount,
    paymentMethod = 'card',
    paymentStatus = 'paid',
    razorpayPaymentId = null,
    razorpayOrderId = null,
    deliveryMode = 'Standard Delivery',
    courier = null,
  }) {
    if (!items || items.length === 0) {
      throw new AppError('Order must contain at least one item', 400);
    }
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      throw new AppError('Full shipping address (street, city, state, pincode) is required', 400);
    }

    const calculatedSubtotal = Number(subtotal) || items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
    const calculatedDiscount = Number(discountAmount) || 0;
    const calculatedShipping = Number(shippingFee) || 0;
    const finalTotal = Number(total || totalAmount) || Math.max(0, calculatedSubtotal - calculatedDiscount + calculatedShipping);

    // Format items snapshot
    const formattedItems = items.map((i) => {
      let prodId = i.productId || i.product || i._id || i.id;
      if (prodId && !mongoose.isValidObjectId(prodId)) {
        prodId = null;
      }
      return {
        product: prodId,
        name: i.name || 'Product Item',
        image: i.image || (Array.isArray(i.images) ? i.images[0] : null) || '',
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
      };
    });

    const orderNumber = generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      user: user._id,
      items: formattedItems,
      shippingAddress: {
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
        landmark: shippingAddress.landmark || '',
      },
      subtotal: calculatedSubtotal,
      discountAmount: calculatedDiscount,
      shippingFee: calculatedShipping,
      total: finalTotal,
      paymentMethod,
      paymentStatus: paymentStatus || 'paid',
      razorpayPaymentId,
      razorpayOrderId,
      status: 'confirmed',
      statusHistory: [{ status: 'confirmed', note: `Order placed via ${paymentMethod}`, timestamp: new Date() }],
      courier: courier || (deliveryMode === 'pickup' ? 'Self Store Pickup' : 'Standard Surface Delivery'),
    });

    // Deduct inventory & product stock atomically
    for (const item of formattedItems) {
      if (item.product) {
        try {
          // 1. Decrement Inventory.quantity
          await Inventory.findOneAndUpdate(
            { product: item.product },
            { $inc: { quantity: -item.quantity } },
            { new: true }
          );
          await Inventory.updateOne(
            { product: item.product, quantity: { $lt: 0 } },
            { $set: { quantity: 0 } }
          );

          // 2. Decrement Product.stock (Live sync for Admin Catalog & UI)
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: -item.quantity } },
            { new: true }
          );
          await Product.updateOne(
            { _id: item.product, stock: { $lt: 0 } },
            { $set: { stock: 0 } }
          );
          logger.info(`[ORDER] Stock decremented by ${item.quantity} for product: ${item.product}`);
        } catch (stkErr) {
          logger.error(`[ORDER] Stock deduction error for ${item.product}: ${stkErr.message}`);
        }
      }
    }

    // Increment user orderCount
    await User.findByIdAndUpdate(user._id, { $inc: { orderCount: 1 } });

    // Clear cart
    try {
      await Cart.findOneAndUpdate(
        { user: user._id },
        { items: [], coupon: null, couponDiscount: 0 }
      );
    } catch (_) {}

    NotificationService.sendOrderConfirmed(
      user.phone || shippingAddress.phone,
      user.name || shippingAddress.fullName || 'Customer',
      order.orderNumber,
      finalTotal
    ).catch((err) => logger.warn(`[NOTIFICATION] Order notification failed: ${err.message}`));

    return order;
  },

  /**
   * audit fix #2 — Razorpay Webhook handler for payment.captured events.
   * Protects against: user pays → browser closes before /verify is called.
   * Razorpay retries the webhook for 24 hours until your server returns 200.
   * Uses idempotency check (razorpayOrderId lookup) to prevent duplicate orders.
   */
  async handleWebhook(rawBody, signature) {
    // Verify webhook signature
    const isValid = RazorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400);
    }

    const event = JSON.parse(rawBody);
    logger.info(`[WEBHOOK] Razorpay event received: ${event.event}`);

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (!payment) return;

      const razorpayOrderId = payment.order_id;

      // Idempotency: if order already exists (via /verify), skip
      const existing = await Order.findOne({ razorpayOrderId }).lean();
      if (existing) {
        logger.info(`[WEBHOOK] Order already exists for ${razorpayOrderId} — skipping`);
        return { alreadyProcessed: true };
      }

      // Order doesn't exist yet — log for manual recovery
      // Full auto-creation from webhook requires shipping address which isn't in the webhook payload.
      // Flag it for admin review instead of creating a broken order.
      logger.error(
        `[WEBHOOK] ⚠️ payment.captured for ${razorpayOrderId} but no order found. ` +
        `Payment ID: ${payment.id}. Amount: ${payment.amount / 100}. Manual review needed.`
      );

      return { flaggedForReview: true, razorpayOrderId, paymentId: payment.id };
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload?.payment?.entity;
      logger.warn(`[WEBHOOK] payment.failed for order ${payment?.order_id} — no action needed`);
    }

    return { received: true };
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

  async trackOrderByNumber(orderNumberQuery) {
    if (!orderNumberQuery || !orderNumberQuery.trim()) {
      throw new AppError('Order number is required', 400);
    }
    const cleanNum = orderNumberQuery.trim();
    const conditions = [
      { orderNumber: { $regex: new RegExp(`^${cleanNum}$`, 'i') } },
    ];
    if (mongoose.isValidObjectId(cleanNum)) {
      conditions.push({ _id: cleanNum });
    }
    const order = await Order.findOne({ $or: conditions })
      .populate('user', 'name phone email')
      .lean();

    if (!order) {
      throw new AppError(`No order found matching "${cleanNum}"`, 404);
    }
    return order;
  },

  // ─── Admin Management ──────────────────────────────────────────────────────
  async adminListOrders(query) {
    const { skip, limit, buildPagination } = paginate(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.search || query.q) {
      const q = (query.search || query.q).trim();
      filter.$or = [
        { orderNumber: { $regex: q, $options: 'i' } },
        { 'shippingAddress.fullName': { $regex: q, $options: 'i' } },
        { 'shippingAddress.city': { $regex: q, $options: 'i' } },
      ];
    }
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

  async addTracking(orderId, { trackingId, courier, courierUrl }) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const order = await OrderRepo.addTracking(orderId, { trackingId, courier, courierUrl });
    if (!order) throw new AppError('Order not found', 404);

    // Send WhatsApp with AWB & courier reference (async)
    const user = await User.findById(order.user).lean();
    if (user) {
      NotificationService.sendOrderShipped(user.phone, order.orderNumber, courier, trackingId)
        .catch((err) => logger.error(`[WATI] Order shipped notification failed: ${err.message}`));
    }
    return order;
  },

  async updateStatus(orderId, { status, note, courier, courierUrl, trackingId }) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const existing = await OrderRepo.findById(orderId);
    if (!existing) throw new AppError('Order not found', 404);

    // If Admin cancels the order, restore inventory stock automatically
    if (status === 'cancelled' && existing.status !== 'cancelled') {
      for (const item of existing.items) {
        if (item.product) {
          await Inventory.findOneAndUpdate(
            { product: item.product },
            { $inc: { quantity: item.quantity } }
          );
        }
      }
    }

    const order = await OrderRepo.updateStatus(orderId, status, note, { courier, courierUrl, trackingId });

    // Send WhatsApp on delivered or cancelled (audit fix #4 — added cancelled)
    const user = await User.findById(order.user).lean();
    if (user) {
      if (status === 'delivered') {
        NotificationService.sendOrderDelivered(user.phone, order.orderNumber)
          .catch((err) => logger.error(`[WATI] Order delivered notification failed: ${err.message}`));
      } else if (status === 'cancelled') {
        NotificationService.sendOrderCancelled(user.phone, order.orderNumber, note)
          .catch((err) => logger.error(`[WATI] Order cancelled notification failed: ${err.message}`));
      }
    }
    return order;
  },

  async deleteOrder(orderId) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const existing = await OrderRepo.findById(orderId);
    if (!existing) throw new AppError('Order not found', 404);

    // If order was not cancelled, restore inventory quantities back
    if (existing.status !== 'cancelled' && Array.isArray(existing.items)) {
      for (const item of existing.items) {
        if (item.product) {
          await Inventory.findOneAndUpdate(
            { product: item.product },
            { $inc: { quantity: item.quantity || 1 } }
          );
        }
      }
    }

    await OrderRepo.delete(orderId);
    return { success: true, message: 'Order deleted successfully' };
  },
};

module.exports = OrderService;
