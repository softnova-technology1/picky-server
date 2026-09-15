const { randomBytes } = require('crypto');
const AppError = require('../../utils/appError');
const OrderRepo = require('./order.repository');
const CartRepo = require('../cart/cart.repository');
const Cart = require('../../models/cart.model');
const Inventory = require('../../models/inventory.model');
const CouponUsage = require('../../models/couponUsage.model');
const Coupon = require('../../models/coupon.model');
const User = require('../../models/user.model');
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
  async createRazorpayOrder(user, { shippingAddress, items }) {
    let cart = await CartRepo.findByUser(user._id);
    if ((!cart || cart.items.length === 0) && items && items.length > 0) {
      const CartService = require('../cart/cart.service');
      await CartService.mergeGuestCart(user._id, items);
      cart = await CartRepo.findByUser(user._id);
    }
    if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', 400);

    // Validate stock for all items
    for (const item of cart.items) {
      const inv = await Inventory.findOne({ product: item.product });
      if (!inv || inv.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for "${item.name}"`, 400);
      }
    }

    const { subtotal, discountAmount, total } = await calculateCartPricing(user, cart);
    const receipt = generateOrderNumber();

    const rzOrder = await RazorpayService.createOrder({
      amountInRupees: total,
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
      subtotal,
      discountAmount,
      total,
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
  async verifyAndCreateOrder(user, { shippingAddress, razorpayOrderId, razorpayPaymentId, razorpaySignature, items }) {
    let cart = await CartRepo.findByUser(user._id);
    if ((!cart || cart.items.length === 0) && items && items.length > 0) {
      const CartService = require('../cart/cart.service');
      await CartService.mergeGuestCart(user._id, items);
      cart = await CartRepo.findByUser(user._id);
    }
    if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', 400);

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

    const { subtotal, discountAmount, discountType, total } = await calculateCartPricing(user, cart);

    // ─── Start MongoDB Transaction (audit fix #1) ─────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();
    let order;
    try {
      // Step 1: Deduct inventory atomically for every cart item
      for (const item of cart.items) {
        const updatedInv = await Inventory.findOneAndUpdate(
          { product: item.product, quantity: { $gte: item.quantity } },
          { $inc: { quantity: -item.quantity } },
          { session, new: true }
        );
        if (!updatedInv) {
          throw new AppError(`"${item.name}" is now out of stock. Your payment was not debited.`, 400);
        }
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

  // ─── Admin Management ──────────────────────────────────────────────────────
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

    // Send WhatsApp with AWB & courier reference (async)
    const user = await User.findById(order.user).lean();
    if (user) {
      NotificationService.sendOrderShipped(user.phone, order.orderNumber, courier, trackingId)
        .catch((err) => logger.error(`[WATI] Order shipped notification failed: ${err.message}`));
    }
    return order;
  },

  async updateStatus(orderId, { status, note }) {
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

    const order = await OrderRepo.updateStatus(orderId, status, note);

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
};

module.exports = OrderService;
