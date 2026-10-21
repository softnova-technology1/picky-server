// TODO (Dev 3): Implement cart business logic
const AppError = require('../../utils/appError');
const CartRepo = require('./cart.repository');
const User = require('../../models/user.model');
const Cart = require('../../models/cart.model');
const Product = require('../../models/product.model');
const Inventory = require('../../models/inventory.model');
const Coupon = require('../../models/coupon.model');
const CouponUsage = require('../../models/couponUsage.model');
const mongoose = require('mongoose');

const CartService = {
  async getCart(userId) {
    let cart = await CartRepo.findByUser(userId);
    if (!cart) cart = await CartRepo.create(userId);
    return cart;
  },

  async addItem(userId, { productId, quantity = 1 }) {
    const pId = productId.toString();
    const product = await Product.findById(pId).lean();
    if (!product || !product.isActive) throw new AppError('Product not found', 404);

    let cart = await CartRepo.findByUser(userId);
    if (!cart) cart = await CartRepo.create(userId);

    const match = cart.items.find((i) => (i.product?._id || i.product || '').toString() === pId);
    const others = cart.items.filter((i) => (i.product?._id || i.product || '').toString() !== pId);
    const currentQty = match ? match.quantity : 0;
    const requestedTotal = currentQty + quantity;

    const inventory = await Inventory.findOne({ product: pId }).lean();
    if (!inventory || inventory.quantity < requestedTotal) {
      const available = inventory ? inventory.quantity : 0;
      throw new AppError(`Insufficient stock. Only ${available} available (${currentQty} already in cart)`, 400);
    }

    cart.items = [
      {
        product: pId,
        quantity: requestedTotal,
        price: product.discountPrice || product.price,
        name: product.name,
        image: product.images?.[0] || null,
      },
      ...others,
    ];

    return CartRepo.save(cart);
  },

  async updateQty(userId, { productId, quantity }) {
    const pId = productId.toString();
    if (quantity <= 0) return this.removeItem(userId, pId);

    const inventory = await Inventory.findOne({ product: pId }).lean();
    if (inventory && inventory.quantity < quantity) {
      throw new AppError(`Insufficient stock. Only ${inventory.quantity} available`, 400);
    }

    // Fast atomic update for existing item in cart
    const updated = await Cart.findOneAndUpdate(
      { user: userId, 'items.product': pId },
      { $set: { 'items.$.quantity': quantity } },
      { new: true }
    );

    if (updated) {
      return updated;
    }

    // If item was not yet in cart, fetch product details and add
    const product = await Product.findById(pId).lean();
    if (!product || !product.isActive) throw new AppError('Product not found', 404);

    return Cart.findOneAndUpdate(
      { user: userId },
      {
        $push: {
          items: {
            $each: [{
              product: pId,
              quantity,
              price: product.discountPrice || product.price,
              name: product.name,
              image: product.images?.[0] || null,
            }],
            $position: 0,
          },
        },
      },
      { new: true, upsert: true }
    );
  },

  async removeItem(userId, productId) {
    const pId = productId.toString();
    return Cart.findOneAndUpdate(
      { user: userId },
      { $pull: { items: { product: pId } } },
      { new: true }
    );
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
    let cart = await CartRepo.findByUser(userId);
    if (!cart) cart = await CartRepo.create(userId);

    for (const item of guestItems) {
      const pId = (item.productId || item.product || item._id || '').toString();
      if (!pId) continue;
      const targetQty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const others = cart.items.filter((i) => (i.product?._id || i.product || '').toString() !== pId);
      const existing = cart.items.find((i) => (i.product?._id || i.product || '').toString() === pId);

      if (existing) {
        // Set exact client session quantity to prevent runaway duplicate additions
        cart.items = [
          ...others,
          {
            product: existing.product,
            quantity: targetQty,
            price: existing.price,
            name: existing.name,
            image: (typeof existing.image === 'string' && existing.image.startsWith('data:image/')) ? null : (existing.image || null),
          },
        ];
      } else {
        const product = await Product.findById(pId).lean();
        if (product && product.isActive) {
          cart.items = [
            ...others,
            {
              product: pId,
              quantity: targetQty,
              price: product.discountPrice || product.price,
              name: product.name,
              image: product.images?.[0] || null,
            },
          ];
        }
      }
    }
    return CartRepo.save(cart);
  },

  // Admin: Get real carts with items for Abandoned Carts Recovery (including recovered carts)
  async getAbandonedCarts() {
    const carts = await Cart.find({
      $or: [
        { 'items.0': { $exists: true } },
        { status: { $in: ['recovered', 'partial_recovery'] } },
        { recoveredAmount: { $gt: 0 } },
        { 'purchasedItems.0': { $exists: true } },
      ],
    })
      .populate('user', 'name phone email addresses defaultAddress city')
      .populate('items.product', 'name images price discountPrice sku subCategory')
      .populate('purchasedItems.product', 'name images price discountPrice sku subCategory')
      .sort({ updatedAt: -1 })
      .lean();

    return carts.map((c) => {
      const customerName = c.user?.name || 'Customer';
      const customerPhone = c.user?.phone || '';
      const customerEmail = c.user?.email || '';
      const addressObj = c.user?.defaultAddress || c.user?.addresses?.[0] || {};
      const street = addressObj.street || '';
      const landmark = addressObj.landmark || '';
      const city = addressObj.city || c.user?.city || 'Tamil Nadu';
      const state = addressObj.state || 'Tamil Nadu';
      const pincode = addressObj.pincode || '';

      const addrParts = [];
      if (street) addrParts.push(street);
      if (landmark) addrParts.push(`Near ${landmark}`);
      if (city) addrParts.push(city);
      if (state) addrParts.push(state);
      if (pincode) addrParts.push(pincode);

      const fullAddress = addrParts.length > 0
        ? addrParts.join(', ')
        : (city ? `${city}, ${state}` : 'Address not specified');

      // 1. Process active items currently in bag
      const rawActiveItems = Array.isArray(c.items) ? c.items : [];
      const consolidatedActiveMap = new Map();
      for (const i of rawActiveItems) {
        const pKey = (i.product?._id || i.product || i.name).toString();
        if (consolidatedActiveMap.has(pKey)) {
          const prev = consolidatedActiveMap.get(pKey);
          prev.quantity += (i.quantity || 1);
        } else {
          consolidatedActiveMap.set(pKey, {
            sku: i.sku || i.product?.sku || i._id?.toString() || 'SKU-PKY',
            name: i.name || i.product?.name || 'Handcrafted Product',
            variant: i.variant || i.product?.subCategory || 'Standard',
            price: i.price,
            quantity: i.quantity || 1,
            image: i.image || i.product?.images?.[0] || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300',
          });
        }
      }
      const consolidatedItems = Array.from(consolidatedActiveMap.values());
      const totalAmount = consolidatedItems.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 1)), 0);
      const itemCount = consolidatedItems.reduce((s, i) => s + (i.quantity || 1), 0);

      // 2. Process purchased / won-back items
      const rawPurchased = Array.isArray(c.purchasedItems) ? c.purchasedItems : [];
      const consolidatedPurchased = rawPurchased.map((p) => ({
        sku: p.sku || p.product?.sku || 'SKU-PKY',
        name: p.name || p.product?.name || 'Handcrafted Product',
        price: p.price,
        quantity: p.quantity || 1,
        image: p.image || p.product?.images?.[0] || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300',
        orderNumber: p.orderNumber || c.recoveredOrderNumber || 'WON-BACK',
        purchasedAt: p.purchasedAt || c.recoveredAt,
      }));

      // Timeline handling: use saved timeline if exists, else construct initial steps
      const timeline = Array.isArray(c.timeline) && c.timeline.length > 0 ? c.timeline : [
        {
          event: 'Cart Created',
          note: `Customer added ${consolidatedItems.length || 1} item(s) to bag`,
          timestamp: c.createdAt || new Date().toISOString(),
        },
        {
          event: 'Checkout Dropoff',
          note: 'Session dropped off at checkout payment step',
          timestamp: c.updatedAt || new Date().toISOString(),
        },
      ];

      return {
        id: `CART-${c._id.toString().slice(-4).toUpperCase()}`,
        _id: c._id,
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString(),
        customer: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          street,
          landmark,
          city,
          state,
          pincode,
          fullAddress,
          address: fullAddress,
        },
        items: consolidatedItems,
        totalAmount,
        itemCount,
        abandonedStage: 'Payment Gateway (Razorpay Drop)',
        status: c.status || 'pending',
        alertsSentCount: c.alertsSentCount || 0,
        lastAlertSentAt: c.lastAlertSentAt || null,
        lastTemplateUsed: c.lastTemplateUsed || null,
        appliedOffer: c.appliedOffer || null,
        isPartialRecovery: !!c.isPartialRecovery,
        recoveredProducts: c.recoveredProducts || [],
        recoveredOrderNumber: c.recoveredOrderNumber || null,
        recoveredAmount: Number(c.recoveredAmount) || 0,
        recoveredAt: c.recoveredAt || null,
        purchasedItems: consolidatedPurchased,
        timeline,
      };
    });
  },

  // Helper: Find cart by Mongo _id or "CART-XXXX" code
  async findCartById(cartId) {
    if (!cartId) return null;
    const cleanId = cartId.toString().replace(/^CART-/i, '').trim();

    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      const found = await Cart.findById(cleanId);
      if (found) return found;
    }

    const carts = await Cart.find().sort({ updatedAt: -1 });
    return carts.find((c) => c._id.toString().toUpperCase().endsWith(cleanId.toUpperCase())) || null;
  },

  // Admin: Record WhatsApp/SMS recovery alert in Cart Audit Timeline
  async recordRecoveryAlert(cartId, { templateName, discountCode, channel = 'WhatsApp', offerDetails } = {}) {
    const cart = await this.findCartById(cartId);
    if (!cart) throw new AppError('Cart not found', 404);

    const now = new Date();
    const offerSummary = offerDetails
      ? `(Offer: ${offerDetails.discountType === 'flat' ? `₹${offerDetails.discountValue} OFF` : `${offerDetails.discountValue}% OFF`}, Code: ${discountCode || 'None'})`
      : `(Coupon: ${discountCode || 'None'})`;

    const newEvent = {
      event: `${channel} Alert Dispatched`,
      note: `Dispatched recovery alert using "${templateName || 'Comeback Discount'}" ${offerSummary} via ${channel}.`,
      timestamp: now,
    };

    if (!cart.timeline || cart.timeline.length === 0) {
      cart.timeline = [
        {
          event: 'Cart Created',
          note: `Customer added ${cart.items.length} item(s) to bag`,
          timestamp: cart.createdAt || now,
        },
        {
          event: 'Checkout Dropoff',
          note: 'Session dropped off at checkout payment step',
          timestamp: cart.updatedAt || now,
        },
      ];
    }

    cart.timeline.push(newEvent);
    cart.status = 'sent';
    cart.alertsSentCount = (cart.alertsSentCount || 0) + 1;
    cart.lastAlertSentAt = now;
    cart.lastTemplateUsed = templateName || 'Special 5% Comeback Discount';
    if (offerDetails) cart.appliedOffer = offerDetails;

    await cart.save();
    return cart;
  },

  // Admin: Mark Cart as Recovered (Full or Single/Partial Item) and persist in Audit Timeline
  async markCartRecovered(cartId, { orderNumber, convertedProducts = null, convertedItems: clientItems = null, wonBackAmount = null } = {}) {
    const cart = await this.findCartById(cartId);
    if (!cart) throw new AppError('Cart not found', 404);

    const now = new Date();
    const autoOrder = orderNumber || `PKY-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Format 12-Hour AM/PM Time
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const timeFormatted = `${hours}:${minutes} ${ampm} (${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()})`;

    // Match converted items from client payload or cart items
    let convertedItems = [];
    if (Array.isArray(clientItems) && clientItems.length > 0) {
      convertedItems = clientItems;
    } else if (Array.isArray(convertedProducts) && convertedProducts.length > 0) {
      convertedItems = cart.items.filter((i) =>
        convertedProducts.includes(i.sku) ||
        convertedProducts.includes(i.name) ||
        convertedProducts.includes(i.product?.toString())
      );
    } else {
      convertedItems = cart.items;
    }

    if (convertedItems.length === 0) {
      convertedItems = cart.items;
    }

    // Calculate initial cart value from active items or previously purchased items
    const cartItemsValue = (cart.items || []).reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 1)), 0);
    const purchasedItemsValue = (cart.purchasedItems || []).reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 1)), 0);
    const maxCartValue = Math.max(cartItemsValue, purchasedItemsValue, Number(wonBackAmount) || 0);

    const calculatedWonBack = Math.min(
      maxCartValue,
      wonBackAmount || convertedItems.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 1)), 0) || maxCartValue
    );
    const isPartial = convertedItems.length < (cart.items.length || 1);

    // Detailed breakdown with Product Name, Product Price, Total Price, Time with AM/PM
    const itemsDetailList = convertedItems
      .map((i) => `"${i.name}" (₹${((i.price || 0) * (i.quantity || 1)).toLocaleString('en-IN')}, Qty: ${i.quantity || 1})`)
      .join(', ');

    const note = `Product: ${itemsDetailList} | Total Price: ₹${calculatedWonBack.toLocaleString('en-IN')} | Time: ${timeFormatted} | Order #${autoOrder}`;

    const newEvent = {
      event: isPartial ? `Converted (${convertedItems.length} item)` : 'Converted Order (All Items)',
      note,
      timestamp: now,
    };

    if (!cart.timeline || cart.timeline.length === 0) {
      cart.timeline = [
        {
          event: 'Cart Created',
          note: `Customer added ${cart.items.length || 1} item(s) to bag`,
          timestamp: cart.createdAt || now,
        },
        {
          event: 'Checkout Dropoff',
          note: 'Session dropped off at checkout payment step',
          timestamp: cart.updatedAt || now,
        },
      ];
    }

    const isDuplicateOrder = cart.timeline.some((t) => t.note && t.note.includes(`Order #${autoOrder}`));
    if (!isDuplicateOrder) {
      cart.timeline.push(newEvent);
    }

    const targetSkus = convertedItems.map((i) => i.sku || i.name).filter(Boolean);
    cart.recoveredProducts = Array.from(new Set([...(cart.recoveredProducts || []), ...targetSkus]));

    // Move converted items from cart.items to cart.purchasedItems
    const convertedNames = convertedItems.map((i) => i.name?.toLowerCase().trim()).filter(Boolean);
    const convertedSkus = convertedItems.map((i) => i.sku?.toLowerCase().trim()).filter(Boolean);
    const convertedPIds = convertedItems.map((i) => (i.product?._id || i.product || i._id)?.toString()).filter(Boolean);

    const remainingItems = [];
    const justPurchased = [];

    for (const item of (cart.items || [])) {
      const pId = (item.product?._id || item.product || item._id)?.toString();
      const name = item.name?.toLowerCase().trim();
      const sku = item.sku?.toLowerCase().trim();

      const isConverted = (pId && convertedPIds.includes(pId)) ||
                          (sku && convertedSkus.includes(sku)) ||
                          (name && convertedNames.includes(name));

      if (isConverted) {
        justPurchased.push({
          product: item.product?._id || item.product || item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          image: item.image,
          sku: item.sku,
          orderNumber: autoOrder,
          purchasedAt: now,
        });
      } else {
        remainingItems.push(item);
      }
    }

    cart.items = remainingItems;

    if (!cart.purchasedItems) cart.purchasedItems = [];
    for (const jp of justPurchased) {
      const alreadyHas = cart.purchasedItems.some(
        (pi) => pi.orderNumber === jp.orderNumber && (pi.name === jp.name || pi.sku === jp.sku)
      );
      if (!alreadyHas) {
        cart.purchasedItems.push(jp);
      }
    }

    const allRecovered = cart.items.length === 0;

    cart.status = allRecovered ? 'recovered' : 'partial_recovery';
    cart.isPartialRecovery = !allRecovered;
    cart.recoveredAt = now;
    cart.recoveredOrderNumber = autoOrder;
    if (!isDuplicateOrder) {
      cart.recoveredAmount = Math.min(maxCartValue, (cart.recoveredAmount || 0) + calculatedWonBack);
    } else {
      cart.recoveredAmount = Math.min(maxCartValue, cart.recoveredAmount || calculatedWonBack);
    }

    await cart.save();
    return cart;
  },

  // Admin: Revert/Remove Converted Status (Single Item or All Items)
  async revertCartConversion(cartId, { sku = null } = {}) {
    const cart = await this.findCartById(cartId);
    if (!cart) throw new AppError('Cart not found', 404);

    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const timeFormatted = `${hours}:${minutes} ${ampm} (${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()})`;

    if (!cart.timeline) cart.timeline = [];

    if (sku) {
      const revertedItem = cart.items.find((i) => i.sku === sku || i.name === sku || i._id?.toString() === sku);
      const itemName = revertedItem?.name || sku;

      cart.recoveredProducts = (cart.recoveredProducts || []).filter((s) => s !== sku && s !== itemName);

      const remainingRecovered = cart.items.filter((i) =>
        (cart.recoveredProducts || []).includes(i.sku) || (cart.recoveredProducts || []).includes(i.name)
      );
      const remainingAmount = remainingRecovered.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 1)), 0);

      const note = `Reverted Item: "${itemName}" | Remaining Converted: ${remainingRecovered.length} item(s) (₹${remainingAmount.toLocaleString('en-IN')}) | Time: ${timeFormatted}`;

      cart.timeline.push({
        event: `Conversion Reverted (${itemName})`,
        note,
        timestamp: now,
      });

      if (cart.recoveredProducts.length === 0) {
        cart.status = 'pending';
        cart.isPartialRecovery = false;
        cart.recoveredOrderNumber = null;
        cart.recoveredAmount = 0;
        cart.recoveredAt = null;
      } else {
        cart.status = 'partial_recovery';
        cart.isPartialRecovery = true;
        cart.recoveredAmount = remainingAmount;
      }
    } else {
      cart.recoveredProducts = [];
      cart.status = 'pending';
      cart.isPartialRecovery = false;
      cart.recoveredOrderNumber = null;
      cart.recoveredAmount = 0;
      cart.recoveredAt = null;

      cart.timeline.push({
        event: 'All Conversions Reverted',
        note: `All product conversions were reverted to unconverted state by admin | Time: ${timeFormatted}`,
        timestamp: now,
      });
    }

    await cart.save();
    return cart;
  },

  // Admin: Mark Cart as Expired in Audit Timeline
  async markCartExpired(cartId) {
    const cart = await this.findCartById(cartId);
    if (!cart) throw new AppError('Cart not found', 404);

    const now = new Date();
    cart.status = 'expired';

    if (!cart.timeline || cart.timeline.length === 0) {
      cart.timeline = [
        {
          event: 'Cart Created',
          note: `Customer added ${cart.items.length} item(s) to bag`,
          timestamp: cart.createdAt || now,
        },
        {
          event: 'Checkout Dropoff',
          note: 'Session dropped off at checkout payment step',
          timestamp: cart.updatedAt || now,
        },
      ];
    }

    cart.timeline.push({
      event: 'Cart Expired',
      note: 'Cart marked expired by admin.',
      timestamp: now,
    });

    await cart.save();
    return cart;
  },

  // Admin: Delete a single timeline entry from Cart Audit History
  async deleteTimelineEntry(cartId, { index, entryId, timestamp, event } = {}) {
    const cart = await this.findCartById(cartId);
    if (!cart) throw new AppError('Cart not found', 404);

    if (!cart.timeline || cart.timeline.length === 0) {
      return cart;
    }

    let removed = false;

    // 1. Try matching by subdocument _id
    if (entryId) {
      const matchIdx = cart.timeline.findIndex((t) => t._id && t._id.toString() === entryId.toString());
      if (matchIdx !== -1) {
        cart.timeline.splice(matchIdx, 1);
        removed = true;
      }
    }

    // 2. Try matching by index
    if (!removed && typeof index === 'number' && index >= 0 && index < cart.timeline.length) {
      cart.timeline.splice(index, 1);
      removed = true;
    }

    // 3. Try matching by timestamp + event
    if (!removed && (timestamp || event)) {
      const matchIdx = cart.timeline.findIndex((t) => {
        const timeMatch = timestamp ? new Date(t.timestamp).getTime() === new Date(timestamp).getTime() : true;
        const eventMatch = event ? t.event === event : true;
        return timeMatch && eventMatch;
      });
      if (matchIdx !== -1) {
        cart.timeline.splice(matchIdx, 1);
        removed = true;
      }
    }

    if (removed) {
      await cart.save();
    }
    return cart;
  },
};

module.exports = CartService;
