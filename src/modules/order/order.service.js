const { randomBytes } = require('crypto');
const AppError = require('../../utils/appError');
const OrderRepo = require('./order.repository');
const CartRepo = require('../cart/cart.repository');
const Cart = require('../../models/cart.model');
const Inventory = require('../../models/inventory.model');
const CheckoutReservation = require('../../models/checkoutReservation.model');
const CheckoutPaymentIntent = require('../../models/checkoutPaymentIntent.model');
const Coupon = require('../../models/coupon.model');
const User = require('../../models/user.model');
const Product = require('../../models/product.model');
const Order = require('../../models/order.model');
const NotificationService = require('../../services/notification.service');
const RazorpayService = require('../../services/razorpay.service');
const paginate = require('../../utils/paginate');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const { assertPaymentMatchesIntent, assertDirectOrderIsAllowed } = require('./paymentValidation');

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

const triggerOrderNotification = async (order, user, shippingAddress) => {
  try {
    const Notification = require('../../models/notification.model');
    const isGift = Boolean(order.giftWrap?.isGiftWrapped);
    const giftMessage = (order.giftWrap?.message || '').trim();
    const giftMsgText = isGift ? (giftMessage ? ` • 🎁 Gift Message: "${giftMessage}"` : ' • 🎁 Gift Wrap Included (No custom message)') : '';
    const giftTitleTag = isGift ? ' 🎁 [GIFT WRAP]' : '';
    const customerName = user?.name || shippingAddress?.fullName || 'Customer';
    const totalAmt = order.total ? `₹${order.total.toLocaleString('en-IN')}` : '₹0';
    const itemsCount = order.items?.length || 1;

    await Notification.create({
      entityKey: `order-${order._id}`,
      type: 'order',
      category: 'Orders',
      title: `New order received${giftTitleTag}`,
      subtitle: `Order #${order.orderNumber} · ${totalAmt}`,
      message: `${customerName} placed order for ${totalAmt} (${itemsCount} item${itemsCount > 1 ? 's' : ''}) with ${order.paymentMethod || 'Online'} Payment.${giftMsgText}`,
      unread: true,
      starred: false,
      link: '/softpicky-sn2026/orders',
      linkText: 'View Order',
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName,
        total: order.total,
        isGiftWrapped: isGift,
        giftMessage: isGift ? (giftMessage || 'No message') : null,
        giftWrapFee: order.giftWrap?.fee || 0,
      },
      createdAt: order.createdAt || new Date(),
    });
  } catch (err) {
    logger.warn(`[NOTIFICATION] Could not create order notification: ${err.message}`);
  }
};

const isTamilNaduPincode = (pincodeStr) => {
  const pin = (pincodeStr || '').toString().trim().replace(/\D/g, '');
  if (!pin || pin.length < 2) return false;
  const firstTwo = parseInt(pin.slice(0, 2), 10);
  return firstTwo >= 60 && firstTwo <= 64;
};

const calculateServerOrderPricing = async ({
  user = null,
  items = [],
  couponCode = null,
  shippingAddress = {},
  deliveryMode = 'standard',
  isGiftWrap = false,
  giftWrapFee = 0,
}) => {
  const now = new Date();
  const verifiedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const prodId = item.productId || item.product || item._id || item.id;
    if (!prodId || !mongoose.isValidObjectId(prodId)) continue;

    const dbProd = await Product.findById(prodId).lean();
    if (!dbProd) {
      throw new AppError(`Product not found or unavailable: ${item.name || prodId}`, 400);
    }

    const qty = Math.max(1, Number(item.quantity) || 1);

    // Validate active discount: regular selling discount or active campaign window
    const hasDiscountPrice = Boolean(
      dbProd.discountPrice &&
      Number(dbProd.discountPrice) > 0 &&
      Number(dbProd.discountPrice) < Number(dbProd.price)
    );
    const isOfferDateValid = Boolean(
      (!dbProd.offerStartDate || new Date(dbProd.offerStartDate) <= now) &&
      (!dbProd.offerEndDate || new Date(dbProd.offerEndDate) >= now)
    );
    const hasActiveOffer = hasDiscountPrice && isOfferDateValid;

    const unitPrice = hasActiveOffer ? Number(dbProd.discountPrice) : Number(dbProd.price);
    subtotal += unitPrice * qty;

    verifiedItems.push({
      product: dbProd._id,
      name: dbProd.name,
      image: (dbProd.images && dbProd.images[0]) || item.image || '',
      price: unitPrice,
      quantity: qty,
    });
  }

  if (verifiedItems.length === 0) {
    throw new AppError('Order must contain at least one valid product', 400);
  }

  // 2. Validate and calculate Coupon Discount
  let discountAmount = 0;
  let appliedCoupon = null;

  if (couponCode) {
    const cleanCode = couponCode.toString().trim().toUpperCase();
    const dbCoupon = await Coupon.findOne({
      code: cleanCode,
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).lean();

    if (dbCoupon && subtotal >= (dbCoupon.minOrderAmount || 0)) {
      appliedCoupon = dbCoupon.code;
      let calculated = dbCoupon.type === 'percentage'
        ? Math.round((subtotal * dbCoupon.value) / 100)
        : dbCoupon.value;
      if (dbCoupon.maxDiscountAmount) {
        calculated = Math.min(calculated, dbCoupon.maxDiscountAmount);
      }
      discountAmount = Math.min(subtotal, calculated);
    }
  } else if (user && user.orderCount === 0) {
    const Discount = require('../../models/discount.model');
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
        ? Math.round((subtotal * firstOrderDiscount.value) / 100)
        : firstOrderDiscount.value;
      if (firstOrderDiscount.maxDiscountAmount) {
        fodAmount = Math.min(fodAmount, firstOrderDiscount.maxDiscountAmount);
      }
      discountAmount = Math.min(subtotal, fodAmount);
    }
  }

  // 3. Shipping fee from live DB settings and pincode
  let calculatedShippingFee = 0;
  if (deliveryMode !== 'pickup') {
    try {
      const Settings = require('../../models/settings.model');
      const settings = await Settings.findOne().lean();
      const shipping = settings?.shipping || {};
      const tnFee = Number(shipping?.tamilNadu?.shippingFee !== undefined ? shipping.tamilNadu.shippingFee : 50);
      const allIndiaFee = Number(shipping?.allIndia?.shippingFee !== undefined ? shipping.allIndia.shippingFee : (shipping?.standardShippingFee || 70));
      calculatedShippingFee = isTamilNaduPincode(shippingAddress?.pincode) ? tnFee : allIndiaFee;
    } catch (_e) {
      calculatedShippingFee = isTamilNaduPincode(shippingAddress?.pincode) ? 50 : 70;
    }
  }

  // 4. Convenience fee & gift wrap
  const convenienceFee = 2;
  const calculatedGiftWrapFee = isGiftWrap ? (Number(giftWrapFee) || 30) : 0;

  // 5. Final Total
  const finalTotal = Math.max(0, subtotal - discountAmount + calculatedShippingFee + convenienceFee + calculatedGiftWrapFee);

  return {
    verifiedItems,
    subtotal,
    discountAmount,
    coupon: appliedCoupon,
    shippingFee: calculatedShippingFee,
    convenienceFee,
    giftWrapFee: calculatedGiftWrapFee,
    total: finalTotal,
  };
};


const OrderService = {
  /**
   * Reserve stock during Checkout (Available -> Reserved)
   */
  async reserveCheckout(user, { items = [], sessionId }) {
    if (!sessionId) {
      sessionId = `sess_${randomBytes(8).toString('hex')}`;
    }

    let checkoutItems = [];
    if (Array.isArray(items) && items.length > 0) {
      checkoutItems = items
        .map((i) => ({
          product: (i.productId || i.product || i._id || i.id)?.toString(),
          quantity: Math.max(1, Number(i.quantity) || 1),
        }))
        .filter((i) => i.product);
    } else if (user) {
      const cart = await CartRepo.findByUser(user._id || user);
      if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
        checkoutItems = cart.items
          .map((i) => ({
            product: (i.product?._id || i.product)?.toString(),
            quantity: Math.max(1, Number(i.quantity) || 1),
          }))
          .filter((i) => i.product);
      }
    }

    if (checkoutItems.length === 0) {
      return { sessionId, reserved: false, items: [] };
    }

    // Check existing active reservation for this session (idempotent / dynamic update)
    const existing = await CheckoutReservation.findOne({ sessionId, status: 'reserved' });
    if (existing) {
      if (!user?._id || existing.user?.toString() !== user._id.toString()) {
        throw new AppError('Checkout reservation does not belong to this account', 403);
      }
      const existingKey = existing.items.map((i) => `${i.product}:${i.quantity}`).sort().join(',');
      const newKey = checkoutItems.map((i) => `${i.product}:${i.quantity}`).sort().join(',');
      if (existingKey === newKey) {
        return { sessionId, reserved: true, items: existing.items };
      }
      // Quantities or items changed, release old reservation first
      for (const item of existing.items) {
        await Inventory.findOneAndUpdate(
          { product: item.product },
          { $inc: { quantity: item.quantity, reserved: -item.quantity } }
        );
        await Inventory.updateOne(
          { product: item.product, reserved: { $lt: 0 } },
          { $set: { reserved: 0 } }
        );
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      }
      existing.status = 'released';
      await existing.save();
    }

    // 1 & 2. Atomically reserve available stock with automatic rollback on concurrency failure
    const reservedItems = [];
    for (const item of checkoutItems) {
      let inv = await Inventory.findOne({ product: item.product });
      if (!inv) {
        const prod = await Product.findById(item.product).lean();
        if (prod) {
          inv = await Inventory.create({
            product: prod._id,
            sku: prod.sku || `SKU-${Date.now()}`,
            quantity: prod.stock || 0,
            reserved: 0,
            sold: 0,
            lowStockThreshold: 5,
          });
        }
      }

      // Atomic conditional decrement: only succeeds if current available quantity >= item.quantity
      const updatedInv = await Inventory.findOneAndUpdate(
        { product: item.product, quantity: { $gte: item.quantity } },
        { $inc: { quantity: -item.quantity, reserved: item.quantity } },
        { new: true }
      );

      if (!updatedInv) {
        // Rollback all items reserved so far in this checkout loop
        for (const resItem of reservedItems) {
          await Inventory.findOneAndUpdate(
            { product: resItem.product },
            { $inc: { quantity: resItem.quantity, reserved: -resItem.quantity } }
          );
          await Product.findByIdAndUpdate(
            resItem.product,
            { $inc: { stock: resItem.quantity } }
          );
        }
        const prod = await Product.findById(item.product).select('name').lean();
        throw new AppError(`"${prod?.name || 'Item'}" has insufficient stock available right now.`, 400);
      }

      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } }
      );
      reservedItems.push(item);
    }

    // 3. Persist reservation document with TTL
    await CheckoutReservation.create({
      sessionId,
      user: user?._id || user || null,
      items: checkoutItems,
      status: 'reserved',
      expiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 min hold
    });

    logger.info(`[CHECKOUT] Reserved ${checkoutItems.length} items for session: ${sessionId}`);
    return { sessionId, reserved: true, items: checkoutItems };
  },

  /**
   * Release reserved stock on Checkout Failure / Cancellation (Restock back to Available)
   */
  async releaseCheckout(user, { sessionId }) {
    if (!user?._id) throw new AppError('Please log in before releasing checkout stock', 401);
    if (!sessionId) throw new AppError('Checkout session is required', 400);

    const session = await mongoose.startSession();
    let itemsReleased = 0;
    try {
      await session.withTransaction(async () => {
        const reservation = await CheckoutReservation.findOne({ sessionId }).session(session);
        if (!reservation) return;
        if (reservation.user?.toString() !== user._id.toString()) {
          throw new AppError('Checkout reservation does not belong to this account', 403);
        }
        if (reservation.status !== 'reserved') return;

        const claimedReservation = await CheckoutReservation.findOneAndUpdate(
          { _id: reservation._id, user: user._id, status: 'reserved' },
          { $set: { status: 'released' } },
          { new: false, session }
        );
        if (!claimedReservation) return;

        for (const item of claimedReservation.items) {
          const updatedInventory = await Inventory.findOneAndUpdate(
            { product: item.product, reserved: { $gte: item.quantity } },
            { $inc: { quantity: item.quantity, reserved: -item.quantity } },
            { new: true, session }
          );
          if (!updatedInventory) throw new AppError('Inventory reservation is inconsistent', 409);
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { session }
          );
          itemsReleased += 1;
        }
      });
    } finally {
      await session.endSession();
    }

    if (itemsReleased > 0) {
      logger.info(`[CHECKOUT] Released ${itemsReleased} reserved items for session: ${sessionId}`);
    }
    return { released: itemsReleased > 0, count: itemsReleased };
  },

  /**
   * 1. Create Razorpay Order instance for Frontend Checkout Modal and Reserve Stock
   */
  async createRazorpayOrder(user, {
    shippingAddress = {},
    items = [],
    coupon,
    couponCode,
    deliveryMode = 'standard',
    giftWrap,
    giftWrapFee,
    sessionId,
    isBuyNow = false,
    fromCart = false,
  }) {
    if (!user?._id) throw new AppError('Please log in before checkout', 401);

    let checkoutItems = items;
    if ((!checkoutItems || checkoutItems.length === 0) && user?._id) {
      const cart = await CartRepo.findByUser(user._id);
      if (cart && cart.items.length > 0) {
        checkoutItems = cart.items.map((i) => ({
          productId: i.product,
          quantity: i.quantity,
        }));
      }
    }

    if (!checkoutItems || checkoutItems.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    const isGift = Boolean(giftWrap?.isGiftWrapped || giftWrap === true);
    const pricing = await calculateServerOrderPricing({
      user,
      items: checkoutItems,
      couponCode: couponCode || coupon,
      shippingAddress,
      deliveryMode,
      isGiftWrap: isGift,
      giftWrapFee,
    });

    const receipt = generateOrderNumber();

    const rzOrder = await RazorpayService.createOrder({
      amountInRupees: pricing.total,
      receipt,
      notes: {
        userId: user?._id ? user._id.toString() : 'guest',
        phone: user?.phone || shippingAddress?.phone || '',
      },
    });

    // Payment must not proceed unless stock is reserved for this user and exact item set.
    if (sessionId) {
      const existingRes = await CheckoutReservation.findOne({ sessionId, status: 'reserved' });
      if (existingRes) {
        if (existingRes.user?.toString() !== user._id.toString()) {
          throw new AppError('Checkout reservation does not belong to this account', 403);
        }
        const resItems = existingRes.items
          .map((item) => `${item.product}:${item.quantity}`).sort().join(',');
        const priceItems = pricing.verifiedItems
          .map((item) => `${item.product}:${item.quantity}`).sort().join(',');
        if (resItems !== priceItems) {
          throw new AppError('Reserved items changed. Please restart checkout.', 409);
        }
        existingRes.sessionId = rzOrder.id;
        existingRes.expiresAt = new Date(Date.now() + 20 * 60 * 1000);
        await existingRes.save();
      } else {
        await this.reserveCheckout(user, { items: pricing.verifiedItems, sessionId: rzOrder.id });
      }
    } else {
      await this.reserveCheckout(user, { items: pricing.verifiedItems, sessionId: rzOrder.id });
    }

    try {
      await CheckoutPaymentIntent.create({
        razorpayOrderId: rzOrder.id,
        user: user._id,
        pricing,
        shippingAddress,
        giftWrap: giftWrap ? {
          isGiftWrapped: isGift,
          fee: pricing.giftWrapFee,
          message: isGift ? (giftWrap?.message || '').trim() : '',
        } : null,
        deliveryMode,
        isBuyNow: Boolean(isBuyNow),
        fromCart: Boolean(fromCart),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      });
    } catch (err) {
      await this.releaseCheckout(user, { sessionId: rzOrder.id }).catch(() => null);
      throw err;
    }

    return {
      razorpayOrderId: rzOrder.id,
      amount: rzOrder.amount,
      amountInRupees: pricing.total,
      currency: rzOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TUoIIdQyUdDIxE',
      orderNumber: receipt,
      pricing,
    };
  },


  /**
   * Verify the Razorpay signature, gateway order/payment and stored checkout intent,
   * then atomically create the order and consume the matching stock reservation.
   * Requires MongoDB transaction support (a replica set, as provided by Atlas).
   */
  async verifyAndCreateOrder(user, {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  }) {
    if (!user?._id) throw new AppError('Please log in before verifying payment', 401);
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new AppError('Razorpay payment details are incomplete', 400);
    }

    const existingOrder = await Order.findOne({ razorpayOrderId, user: user._id }).lean();
    if (existingOrder) return existingOrder;

    const intent = await CheckoutPaymentIntent.findOne({
      razorpayOrderId,
      user: user._id,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!intent) throw new AppError('Checkout expired or does not belong to this account', 404);

    const signatureIsValid = RazorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    if (!signatureIsValid) {
      throw new AppError('Payment signature verification failed', 400);
    }

    const { order: gatewayOrder, payment } = await RazorpayService.fetchPaymentDetails(
      razorpayOrderId,
      razorpayPaymentId
    );
    assertPaymentMatchesIntent({
      intent,
      razorpayOrderId,
      razorpayPaymentId,
      gatewayOrder,
      payment,
    });

    const session = await mongoose.startSession();
    let order;
    try {
      await session.withTransaction(async () => {
        const claimedIntent = await CheckoutPaymentIntent.findOneAndUpdate(
          { _id: intent._id, status: 'pending', expiresAt: { $gt: new Date() } },
          { $set: { status: 'processing' } },
          { new: true, session }
        );
        if (!claimedIntent) throw new AppError('Payment is already being processed', 409);

        const reservation = await CheckoutReservation.findOne({
          sessionId: razorpayOrderId,
          user: user._id,
          status: 'reserved',
          expiresAt: { $gt: new Date() },
        }).session(session);
        if (!reservation) throw new AppError('Reserved stock is no longer available; contact support', 409);

        const expectedItems = intent.pricing.verifiedItems
          .map((item) => `${item.product}:${item.quantity}`).sort().join(',');
        const reservedItems = reservation.items
          .map((item) => `${item.product}:${item.quantity}`).sort().join(',');
        if (expectedItems !== reservedItems) {
          throw new AppError('Reserved products do not match the paid checkout', 409);
        }

        const pricing = intent.pricing;
        const orderData = {
          orderNumber: generateOrderNumber(),
          user: user._id,
          items: pricing.verifiedItems,
          shippingAddress: intent.shippingAddress,
          subtotal: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          shippingFee: pricing.shippingFee,
          convenienceFee: pricing.convenienceFee,
          giftWrapFee: pricing.giftWrapFee,
          giftWrap: intent.giftWrap || { isGiftWrapped: false, fee: 0, message: '' },
          total: pricing.total,
          paymentMethod: 'razorpay',
          paymentStatus: 'paid',
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          courier: intent.courier || (intent.deliveryMode === 'pickup' ? 'Self Store Pickup' : ''),
          status: 'placed',
          statusHistory: [{ status: 'placed', note: 'Payment captured by Razorpay', timestamp: new Date() }],
        };
        [order] = await Order.create([orderData], { session });

        for (const item of reservation.items) {
          const updatedInventory = await Inventory.findOneAndUpdate(
            { product: item.product, reserved: { $gte: item.quantity } },
            { $inc: { reserved: -item.quantity, sold: item.quantity } },
            { new: true, session }
          );
          if (!updatedInventory) throw new AppError('Inventory reservation is inconsistent', 409);
        }

        reservation.status = 'completed';
        await reservation.save({ session });

        await User.findByIdAndUpdate(user._id, { $inc: { orderCount: 1 } }, { session });
        if (!intent.isBuyNow || intent.fromCart) {
          await Cart.findOneAndUpdate(
            { user: user._id },
            { items: [], coupon: null, couponDiscount: 0 },
            { session }
          );
        }

        claimedIntent.status = 'paid';
        claimedIntent.order = order._id;
        claimedIntent.paymentId = razorpayPaymentId;
        await claimedIntent.save({ session });
      });
    } finally {
      await session.endSession();
    }

    await triggerOrderNotification(order, user, intent.shippingAddress);
    NotificationService.sendOrderConfirmed(
      user.phone,
      user.name || 'Customer',
      order.orderNumber,
      order.total
    ).catch((err) => logger.error(`[WATI] Order confirmed notification failed: ${err.message}`));
    return order;
  },

  /**
   * 2b. Direct Order Creation (Prepaid, Simulated Payment, or Web Checkout)
   */
  async createOrder(user, {
    items = [],
    shippingAddress = {},
    giftWrap,
    giftWrapFee,
    paymentMethod = 'razorpay',
    paymentStatus = 'pending',
    razorpayPaymentId = null,
    razorpayOrderId = null,
    sessionId = null,
    deliveryMode = 'Standard Delivery',
    courier = null,
    isBuyNow = false,
    fromCart = false,
  }) {
    if (!items || items.length === 0) {
      throw new AppError('Order must contain at least one item', 400);
    }
    if (!shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      throw new AppError('Full shipping address (street, city, state, pincode) is required', 400);
    }

    assertDirectOrderIsAllowed({
      environment: process.env.NODE_ENV,
      paymentMethod,
      paymentStatus,
      razorpayPaymentId,
      razorpayOrderId,
    });
    // Direct order creation never records a payment as paid; only verified Razorpay can.
    const resolvedPaymentStatus = 'pending';

    const isGift = Boolean(giftWrap?.isGiftWrapped || giftWrap === true);
    const giftMessage = isGift ? (giftWrap?.message || '').trim() : '';

    const pricing = await calculateServerOrderPricing({
      user,
      items,
      shippingAddress,
      deliveryMode,
      isGiftWrap: isGift,
      giftWrapFee,
    });

    const formattedItems = pricing.verifiedItems;
    const orderNumber = generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      user: user?._id || null,
      items: formattedItems,
      shippingAddress: {
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
        landmark: shippingAddress.landmark || '',
        fullName: shippingAddress.fullName || '',
        phone: shippingAddress.phone || '',
      },
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      shippingFee: pricing.shippingFee,
      convenienceFee: pricing.convenienceFee,
      giftWrapFee: pricing.giftWrapFee,
      giftWrap: {
        isGiftWrapped: isGift,
        fee: pricing.giftWrapFee,
        message: giftMessage,
      },
      total: pricing.total,
      paymentMethod,
      paymentStatus: resolvedPaymentStatus,
      razorpayPaymentId,
      razorpayOrderId,
      status: 'placed',
      statusHistory: [{ status: 'placed', note: `Order placed via ${paymentMethod}`, timestamp: new Date() }],
      courier: courier || (deliveryMode === 'pickup' ? 'Self Store Pickup' : ''),
    });

    triggerOrderNotification(order, user, shippingAddress);

    // Move from RESERVED to SOLD or decrement available and mark as SOLD
    const activeDirectRes = await CheckoutReservation.findOne({
      $or: [
        ...(sessionId ? [{ sessionId }] : []),
        ...(razorpayOrderId ? [{ sessionId: razorpayOrderId }] : []),
        ...(user?._id ? [{ user: user._id, status: 'reserved' }] : []),
      ],
      status: 'reserved',
    });

    if (activeDirectRes) {
      activeDirectRes.status = 'completed';
      await activeDirectRes.save();
      for (const item of activeDirectRes.items) {
        await Inventory.findOneAndUpdate(
          { product: item.product },
          { $inc: { reserved: -item.quantity, sold: item.quantity } }
        );
        await Inventory.updateOne(
          { product: item.product, reserved: { $lt: 0 } },
          { $set: { reserved: 0 } }
        );
      }
      logger.info(`[ORDER] Pre-reserved items moved to SOLD for session: ${sessionId || razorpayOrderId}`);
    } else {
      for (const item of formattedItems) {
        if (item.product) {
          try {
            await Inventory.findOneAndUpdate(
              { product: item.product },
              { $inc: { quantity: -item.quantity, sold: item.quantity } },
              { new: true }
            );
            await Inventory.updateOne(
              { product: item.product, quantity: { $lt: 0 } },
              { $set: { quantity: 0 } }
            );
            await Product.findByIdAndUpdate(
              item.product,
              { $inc: { stock: -item.quantity } },
              { new: true }
            );
            await Product.updateOne(
              { _id: item.product, stock: { $lt: 0 } },
              { $set: { stock: 0 } }
            );
            logger.info(`[ORDER] Stock moved directly to SOLD for product: ${item.product}`);
          } catch (stkErr) {
            logger.error(`[ORDER] Stock deduction error for ${item.product}: ${stkErr.message}`);
          }
        }
      }
    }

    // Increment user orderCount & sync phone to profile if user has no phone linked
    const userUpdate = { $inc: { orderCount: 1 } };
    const orderPhone = (shippingAddress?.phone || '').toString().replace(/\D/g, '').slice(-10);
    if (orderPhone && orderPhone.length === 10) {
      try {
        const freshUser = await User.findById(user._id).select('phone');
        if (freshUser && (!freshUser.phone || !freshUser.phone.trim())) {
          userUpdate.phone = orderPhone;
        }
      } catch (phoneSyncErr) {
        logger.warn(`[ORDER] Non-critical phone sync notice: ${phoneSyncErr.message}`);
      }
    }
    await User.findByIdAndUpdate(user._id, userUpdate);

    // Clear cart or remove ordered items (ONLY for cart checkouts or single items from cart, NEVER direct Buy Now!)
    try {
      if (!isBuyNow || fromCart) {
        const existingCart = await Cart.findOne({ user: user._id });
        if (existingCart) {
          const orderedProductIds = formattedItems
            .map((i) => (i.product || i._id || i.id)?.toString())
            .filter(Boolean);

          const purchasedPayload = formattedItems.map((i) => ({
            product: i.product || i._id,
            name: i.name,
            price: i.price,
            quantity: i.quantity || 1,
            image: i.image,
            orderNumber: order.orderNumber,
            purchasedAt: new Date(),
          }));

          if (isBuyNow && fromCart) {
            // Partial recovery of single item from cart
            await Cart.findOneAndUpdate(
              { user: user._id },
              {
                $pull: { items: { product: { $in: orderedProductIds } } },
                $push: { purchasedItems: { $each: purchasedPayload } },
              }
            );
          } else if (existingCart.items && existingCart.items.length > formattedItems.length) {
            await Cart.findOneAndUpdate(
              { user: user._id },
              {
                $pull: { items: { product: { $in: orderedProductIds } } },
                $push: { purchasedItems: { $each: purchasedPayload } },
              }
            );
          } else {
            await Cart.findOneAndUpdate(
              { user: user._id },
              {
                items: [],
                coupon: null,
                couponDiscount: 0,
                $push: { purchasedItems: { $each: purchasedPayload } },
              }
            );
          }

          // Auto sync with Abandoned Cart Recovery (ONLY if paid AND items match cart items)
          if (order.paymentStatus === 'paid') {
            try {
              const cartProductIds = (existingCart.items || []).map((i) => (i.product?._id || i.product || i._id)?.toString()).filter(Boolean);
              const convertedFromCart = formattedItems.filter((i) => {
                const pId = (i.product?._id || i.product || i._id || i.id)?.toString();
                return cartProductIds.includes(pId) || (existingCart.items || []).some((ci) => ci.name === i.name || (ci.sku && ci.sku === i.sku));
              });

              if (convertedFromCart.length > 0) {
                const CartService = require('../cart/cart.service');
                await CartService.markCartRecovered(existingCart._id, {
                  orderNumber: order.orderNumber,
                  convertedItems: convertedFromCart,
                  wonBackAmount: convertedFromCart.reduce((sum, i) => sum + ((i.price || 0) * (i.quantity || 1)), 0),
                });
              }
            } catch (recErr) {
              logger.warn(`[RECOVERY_SYNC] Failed auto-sync: ${recErr.message}`);
            }
          }
        }
      }
    } catch (_) {}

    try { const { emitOrderUpdate } = require('../../socket'); emitOrderUpdate(order, 'NEW_ORDER'); } catch (_) {}
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

    let event;
    try {
      if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
        event = rawBody;
      } else {
        const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
        event = JSON.parse(bodyStr);
      }
    } catch (_e) {
      throw new AppError('Malformed webhook payload JSON', 400);
    }
    logger.info(`[WEBHOOK] Razorpay event received: ${event?.event}`);

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
    // Status lifecycle protection: Disallow backward transitions
    if (existing.status === 'delivered' && status !== 'delivered') {
      throw new AppError('Delivered orders are completed and cannot be modified.', 400);
    }
    if (existing.status === 'cancelled' && status !== 'cancelled') {
      throw new AppError('Cancelled orders cannot be reopened.', 400);
    }
    if (existing.status === 'shipped' && (status === 'confirmed' || status === 'placed')) {
      throw new AppError('Shipped orders cannot be reverted back to confirmed or placed.', 400);
    }

    if (status === 'shipped') {
      if (!courier?.trim() || !courierUrl?.trim() || !trackingId?.trim()) {
        throw new AppError('Courier Name, Courier Site URL, and Tracking / AWB Number are required to ship this order.', 400);
      }
    }

    // If status transitions from confirmed/processing to shipped, delivered, or out_for_delivery:
    // Move from reserved to sold!
    const wasPendingFulfillment = ['placed', 'confirmed', 'processing', 'pending'].includes(existing.status);
    const isFulfilling = ['shipped', 'delivered', 'out_for_delivery'].includes(status);

    if (wasPendingFulfillment && isFulfilling) {
      for (const item of existing.items) {
        if (item.product) {
          await Inventory.findOneAndUpdate(
            { product: item.product },
            { $inc: { reserved: -item.quantity, sold: item.quantity } }
          );
          await Inventory.updateOne(
            { product: item.product, reserved: { $lt: 0 } },
            { $set: { reserved: 0 } }
          );
        }
      }
    }

    // If Admin cancels the order, restore inventory stock automatically & decrement sold
    if (status === 'cancelled' && existing.status !== 'cancelled') {
      for (const item of existing.items) {
        if (item.product) {
          await Inventory.findOneAndUpdate(
            { product: item.product },
            {
              $inc: {
                quantity: item.quantity,
                sold: -item.quantity,
              },
            }
          );
          await Inventory.updateOne(
            { product: item.product, sold: { $lt: 0 } },
            { $set: { sold: 0 } }
          );
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } }
          );
        }
      }
    }

    if (status === 'cancelled' && existing.status !== 'cancelled') {
      try {
        const AdminNotificationService = require('../../services/adminNotification.service');
        AdminNotificationService.notifyOrderCancelled(existing, null, note);
      } catch {}
    }

    const order = await OrderRepo.updateStatus(orderId, status, note, { courier, courierUrl, trackingId });

    // Send WhatsApp on confirmed, delivered, or cancelled
    const user = await User.findById(order.user).lean();
    const customerPhone = user?.phone || order.shippingAddress?.phone || existing.shippingAddress?.phone;
    const customerName = user?.name || order.shippingAddress?.fullName || existing.shippingAddress?.fullName || 'Customer';

    if (status === 'confirmed' && existing.status !== 'confirmed') {
      if (customerPhone) {
        NotificationService.sendOrderConfirmed(customerPhone, customerName, order.orderNumber, order.total)
          .catch((err) => logger.error(`[WATI] Order confirmed notification failed: ${err.message}`));
      }
    } else if (status === 'delivered') {
      if (customerPhone) {
        NotificationService.sendOrderDelivered(customerPhone, order.orderNumber)
          .catch((err) => logger.error(`[WATI] Order delivered notification failed: ${err.message}`));
      }
    } else if (status === 'cancelled') {
      if (customerPhone) {
        NotificationService.sendOrderCancelled(customerPhone, order.orderNumber, note)
          .catch((err) => logger.error(`[WATI] Order cancelled notification failed: ${err.message}`));
      }
    }
    return order;
  },

  async customerCancelOrder(orderId, userId, reason) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const existing = await OrderRepo.findById(orderId);
    if (!existing) throw new AppError('Order not found', 404);

    if (existing.user.toString() !== userId.toString()) {
      throw new AppError('You are not authorized to cancel this order', 403);
    }

    const cancellableStatuses = ['placed', 'pending', 'confirmed'];
    if (!cancellableStatuses.includes(existing.status)) {
      throw new AppError(`Order cannot be cancelled because it is already '${existing.status}'.`, 400);
    }

    const cancelNote = reason ? `Customer Cancellation: ${reason}` : 'Cancelled by customer';
    return await this.updateStatus(orderId, { status: 'cancelled', note: cancelNote });
  },

  async deleteOrder(orderId) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError('Invalid order ID', 400);
    const existing = await OrderRepo.findById(orderId);
    if (!existing) throw new AppError('Order not found', 404);

    // If order was not cancelled, restore inventory quantities back
    if (existing.status !== 'cancelled' && Array.isArray(existing.items)) {
      const wasPendingFulfillment = ['placed', 'confirmed', 'processing', 'pending'].includes(existing.status);
      for (const item of existing.items) {
        if (item.product) {
          await Inventory.findOneAndUpdate(
            { product: item.product },
            {
              $inc: {
                quantity: item.quantity || 1,
                sold: -(item.quantity || 1),
              },
            }
          );
          await Inventory.updateOne(
            { product: item.product, sold: { $lt: 0 } },
            { $set: { sold: 0 } }
          );
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity || 1 } }
          );
        }
      }
    }

    await OrderRepo.delete(orderId);
    return { success: true, message: 'Order deleted successfully' };
  },
};

module.exports = OrderService;
