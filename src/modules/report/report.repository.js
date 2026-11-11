const Order = require('../../models/order.model');
const Product = require('../../models/product.model');
const Inventory = require('../../models/inventory.model');
const User = require('../../models/user.model');
const Coupon = require('../../models/coupon.model');
const Return = require('../../models/return.model');
const Review = require('../../models/review.model');
const ContactInquiry = require('../../models/contact.model');
const Cart = require('../../models/cart.model');
const Discount = require('../../models/discount.model');

const ReportRepository = {
  async getSalesSummary(timeframe = 'Week') {
    const now = new Date();
    const tf = timeframe === 'This Month' || timeframe === 'Year' ? timeframe : 'Week';

    // Exact IST (+05:30) day boundaries so Today vs Yesterday stays accurate across any host timezone
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const todayStart = new Date(
      Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - istOffsetMs
    );
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);
    const weekAgoStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Determine date windows for current and previous periods
    let currentStart;
    let prevStart;
    let prevEnd;

    if (tf === 'Year') {
      currentStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else if (tf === 'This Month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else {
      // Last 7 days including today
      currentStart = new Date(now);
      currentStart.setDate(currentStart.getDate() - 6);
      currentStart.setHours(0, 0, 0, 0);

      prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(currentStart.getTime() - 1);
    }

    const [
      totalOrders,
      confirmedOrders,
      revenueAgg,
      totalCustomers,
      totalProducts,
      dailySalesAgg,
      timeframeOrdersList,
      prevPeriodAgg,
      statusCountsAgg,
      paymentSplitAgg,
      readyToDispatch,
      inventoryDocs,
      prodLowStockCount,
      prodOutOfStockCount,
      pendingReturns,
      unreadInquiries,
      pendingReviews,
      allCoupons,
      couponOrdersAgg,
      abandonedCartsRaw,
      categorySalesAgg,
      recentOrdersFeed,
      recentReturnsFeed,
      recentInquiriesFeed,
      recentReviewsFeed,
      todayOrdersAgg,
      yesterdayOrdersAgg,
      todaySignupsCount,
      newUsersWeekCount,
      awaitingAwbCount,
      inTransitCount,
      cancelledAgg,
      refundedReturnsAgg,
      topCitiesAgg,
      regionSplitAgg,
      buyerStatsAgg,
      activeDiscountsList,
      discountedProductsCount,
      fallbackLowStockProducts,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: { $ne: 'cancelled' } }),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalDiscount: { $sum: '$discountAmount' },
          },
        },
      ]),
      User.countDocuments({ role: 'customer' }),
      Product.countDocuments({ isActive: true }),
      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            sales: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.find({
        createdAt: { $gte: currentStart },
        status: { $ne: 'cancelled' },
      })
        .select('total createdAt')
        .lean(),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: prevStart, $lte: prevEnd },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: {
              $cond: [{ $eq: ['$paymentMethod', 'cod'] }, 'cod', 'online'],
            },
            count: { $sum: 1 },
            amount: { $sum: '$total' },
          },
        },
      ]),
      Order.countDocuments({ status: { $in: ['placed', 'confirmed'] } }),
      Inventory.find()
        .populate('product', 'name images price discountPrice isActive sku stock')
        .select('quantity reserved lowStockThreshold product')
        .lean()
        .catch(() => []),
      Product.countDocuments({ isActive: true, stock: { $gt: 0, $lte: 5 } }),
      Product.countDocuments({ isActive: true, stock: { $lte: 0 } }),
      Return.countDocuments({ status: 'pending' }).catch(() => 0),
      ContactInquiry.countDocuments({ isRead: false }).catch(() => 0),
      Review.countDocuments({ status: 'pending' }).catch(() => 0),
      Coupon.find()
        .select('code type value usageCount isActive startsAt endsAt')
        .lean()
        .catch(() => []),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, discountAmount: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            ordersCount: { $sum: 1 },
            discountSaved: { $sum: '$discountAmount' },
            salesGenerated: { $sum: '$total' },
          },
        },
      ]),
      Cart.find({
        $or: [
          { 'items.0': { $exists: true } },
          { status: { $in: ['recovered', 'partial_recovery'] } },
          { recoveredAmount: { $gt: 0 } },
        ],
      })
        .select('items status recoveredAmount')
        .lean()
        .catch(() => []),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'prodDoc',
          },
        },
        { $unwind: { path: '$prodDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'categories',
            localField: 'prodDoc.category',
            foreignField: '_id',
            as: 'catDoc',
          },
        },
        { $unwind: { path: '$catDoc', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$catDoc.name', 'Handcrafted Store'] },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            units: { $sum: '$items.quantity' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]).catch(() => []),
      Order.find()
        .populate('user', 'name')
        .select('orderNumber total status paymentMethod createdAt user')
        .sort({ createdAt: -1 })
        .limit(4)
        .lean()
        .catch(() => []),
      Return.find()
        .select('returnId orderNumber status customer item createdAt')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()
        .catch(() => []),
      ContactInquiry.find()
        .select('fullName source isRead createdAt')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()
        .catch(() => []),
      Review.find()
        .populate('product', 'name')
        .select('customer rating status product createdAt')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()
        .catch(() => []),
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' } } },
      ]),
      User.countDocuments({ role: 'customer', createdAt: { $gte: todayStart } }).catch(() => 0),
      User.countDocuments({ role: 'customer', createdAt: { $gte: weekAgoStart } }).catch(() => 0),
      Order.countDocuments({
        status: { $in: ['placed', 'confirmed', 'packing'] },
        $or: [{ trackingId: null }, { trackingId: '' }, { trackingId: { $exists: false } }],
      }).catch(() => 0),
      Order.countDocuments({ status: { $in: ['shipped', 'out_for_delivery'] } }).catch(() => 0),
      Order.aggregate([
        { $match: { status: 'cancelled' } },
        { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$total' } } },
      ]).catch(() => []),
      Return.aggregate([
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            refundedValue: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$item.refundAmount', 0] } },
          },
        },
      ]).catch(() => []),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, 'shippingAddress.city': { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: {
              city: { $trim: { input: '$shippingAddress.city' } },
              state: { $ifNull: ['$shippingAddress.state', ''] },
            },
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
        { $sort: { revenue: -1, orders: -1 } },
        { $limit: 5 },
      ]).catch(() => []),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: {
              $cond: [
                { $regexMatch: { input: { $ifNull: ['$shippingAddress.state', ''] }, regex: /tamil\s*nadu/i } },
                'tn',
                'other',
              ],
            },
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
      ]).catch(() => []),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' }, user: { $ne: null } } },
        { $group: { _id: '$user', orders: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            uniqueBuyers: { $sum: 1 },
            repeatBuyers: { $sum: { $cond: [{ $gte: ['$orders', 2] }, 1, 0] } },
          },
        },
      ]).catch(() => []),
      Discount.find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      })
        .select('name type value appliesTo minOrderAmount endsAt')
        .limit(4)
        .lean()
        .catch(() => []),
      Product.countDocuments({ isActive: true, discountPrice: { $gt: 0 } }).catch(() => 0),
      Product.find({ isActive: true, stock: { $lte: 5 } })
        .sort({ stock: 1 })
        .limit(5)
        .select('name images price discountPrice stock sku')
        .lean()
        .catch(() => []),
    ]);

    // Stock counts & Watchlist matching AdminInventory logic
    const validInventory = Array.isArray(inventoryDocs)
      ? inventoryDocs.filter((inv) => inv.product && inv.product.isActive !== false)
      : [];
    const lowStockCount =
      validInventory.length > 0
        ? validInventory.filter((inv) => {
            const qty = Number(inv.quantity) || 0;
            const thresh = Number(inv.lowStockThreshold) || 5;
            return qty > 0 && qty <= thresh;
          }).length
        : prodLowStockCount;
    const outOfStockCount =
      validInventory.length > 0
        ? validInventory.filter((inv) => (Number(inv.quantity) || 0) <= 0).length
        : prodOutOfStockCount;

    const lowStockWatchlist =
      validInventory.length > 0
        ? validInventory
            .filter((inv) => (Number(inv.quantity) || 0) <= (Number(inv.lowStockThreshold) || 5))
            .sort((a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0))
            .slice(0, 5)
            .map((inv) => ({
              _id: String(inv._id),
              productId: String(inv.product._id),
              name: inv.product.name,
              image: inv.product.images?.[0] || '',
              sku: inv.product.sku || '',
              quantity: Number(inv.quantity) || 0,
              threshold: Number(inv.lowStockThreshold) || 5,
            }))
        : (fallbackLowStockProducts || []).map((p) => ({
            _id: String(p._id),
            productId: String(p._id),
            name: p.name,
            image: p.images?.[0] || '',
            sku: p.sku || '',
            quantity: Number(p.stock) || 0,
            threshold: 5,
          }));

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalDiscount = revenueAgg[0]?.totalDiscount || 0;
    const avgOrderValue = confirmedOrders > 0 ? Math.round(totalRevenue / confirmedOrders) : 0;

    // Build timeframe revenue series cleanly from real DB orders
    const timeframeSeries = [];
    let timeframeRevenue = 0;
    let timeframeOrders = timeframeOrdersList.length;

    if (tf === 'Year') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const buckets = monthNames.map((m, idx) => ({
        day: m,
        label: `${m} ${now.getFullYear()}`,
        revenue: 0,
        ordersCount: 0,
        monthIdx: idx,
      }));
      timeframeOrdersList.forEach((o) => {
        const dt = new Date(o.createdAt);
        const idx = dt.getMonth();
        if (buckets[idx]) {
          buckets[idx].revenue += Number(o.total) || 0;
          buckets[idx].ordersCount += 1;
          timeframeRevenue += Number(o.total) || 0;
        }
      });
      buckets.forEach((b) => timeframeSeries.push(b));
    } else if (tf === 'This Month') {
      const buckets = [1, 2, 3, 4].map((w) => ({
        day: `Wk ${w}`,
        label: `Week ${w}`,
        revenue: 0,
        ordersCount: 0,
      }));
      timeframeOrdersList.forEach((o) => {
        const dt = new Date(o.createdAt);
        const weekIdx = Math.min(3, Math.floor((dt.getDate() - 1) / 7));
        buckets[weekIdx].revenue += Number(o.total) || 0;
        buckets[weekIdx].ordersCount += 1;
        timeframeRevenue += Number(o.total) || 0;
      });
      buckets.forEach((b) => timeframeSeries.push(b));
    } else {
      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const fullDayMap = new Map();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        fullDayMap.set(key, {
          day: dayLabels[d.getDay()],
          label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
          revenue: 0,
          ordersCount: 0,
        });
      }
      timeframeOrdersList.forEach((o) => {
        const d = new Date(o.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const bucket = fullDayMap.get(key);
        if (bucket) {
          bucket.revenue += Number(o.total) || 0;
          bucket.ordersCount += 1;
          timeframeRevenue += Number(o.total) || 0;
        }
      });
      for (const b of fullDayMap.values()) {
        timeframeSeries.push(b);
      }
    }

    const prevRev = prevPeriodAgg[0]?.revenue || 0;
    let growthPct = 0;
    if (prevRev > 0) {
      growthPct = Number((((timeframeRevenue - prevRev) / prevRev) * 100).toFixed(1));
    } else if (timeframeRevenue > 0) {
      growthPct = 100;
    }

    // Real Order Status Breakdown
    const orderStatusBreakdown = {
      placed: 0,
      confirmed: 0,
      shipped: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    };
    statusCountsAgg.forEach((row) => {
      if (row && row._id && Object.prototype.hasOwnProperty.call(orderStatusBreakdown, row._id)) {
        orderStatusBreakdown[row._id] = row.count || 0;
      }
    });

    // Payment Method Split
    const paymentBreakdown = {
      onlineCount: 0,
      onlineAmount: 0,
      codCount: 0,
      codAmount: 0,
    };
    paymentSplitAgg.forEach((p) => {
      if (p._id === 'cod') {
        paymentBreakdown.codCount = p.count || 0;
        paymentBreakdown.codAmount = p.amount || 0;
      } else {
        paymentBreakdown.onlineCount += p.count || 0;
        paymentBreakdown.onlineAmount += p.amount || 0;
      }
    });

    // Coupon Insights
    let activeCoupons = 0;
    let scheduledCoupons = 0;
    let totalRedemptions = 0;
    let topCoupon = null;
    allCoupons.forEach((c) => {
      const redemptions = Number(c.usageCount) || 0;
      totalRedemptions += redemptions;
      if (!topCoupon || redemptions > (Number(topCoupon.usageCount) || 0)) {
        topCoupon = { code: c.code, type: c.type, value: c.value, usageCount: redemptions };
      }
      if (c.isActive !== false) {
        const expired = c.endsAt && now > new Date(c.endsAt);
        const scheduled = c.startsAt && now < new Date(c.startsAt);
        if (!expired) {
          if (scheduled) scheduledCoupons++;
          else activeCoupons++;
        }
      }
    });

    const couponInsights = {
      totalCoupons: allCoupons.length,
      activeCoupons,
      scheduledCoupons,
      totalRedemptions,
      discountSaved: couponOrdersAgg[0]?.discountSaved || totalDiscount || 0,
      salesViaCoupons: couponOrdersAgg[0]?.salesGenerated || 0,
      topCoupon,
    };

    // Abandoned Cart Insights
    let activeAbandonedCount = 0;
    let atRiskValue = 0;
    let recoveredCount = 0;
    let recoveredValue = 0;
    abandonedCartsRaw.forEach((cart) => {
      const st = cart.status || 'pending';
      if (st === 'recovered' || st === 'partial_recovery') {
        recoveredCount++;
        recoveredValue += Number(cart.recoveredAmount) || 0;
      } else if (st !== 'expired' && Array.isArray(cart.items) && cart.items.length > 0) {
        activeAbandonedCount++;
        const cartVal = cart.items.reduce(
          (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
          0
        );
        atRiskValue += cartVal;
      }
    });

    const abandonedCartInsights = {
      activeCount: activeAbandonedCount,
      atRiskValue,
      recoveredCount,
      recoveredValue,
    };

    // Category Sales Leaderboard
    const categorySales = categorySalesAgg.map((c) => ({
      name: c._id || 'General',
      revenue: c.revenue || 0,
      units: c.units || 0,
    }));

    // Live Store Activity Feed
    const activityEvents = [];
    recentOrdersFeed.forEach((o) => {
      activityEvents.push({
        id: `ord-${o._id}`,
        type: 'order',
        title: `Order #${o.orderNumber}`,
        subtitle: `${o.user?.name || 'Customer'} • ${o.paymentMethod === 'cod' ? 'COD' : 'Prepaid'} (${o.status})`,
        amount: o.total || 0,
        status: o.status,
        timestamp: o.createdAt,
        link: `/orders/${o._id}`,
      });
    });
    recentReturnsFeed.forEach((r) => {
      activityEvents.push({
        id: `ret-${r._id}`,
        type: 'return',
        title: `Return ${r.returnId}`,
        subtitle: `${r.customer?.name || 'Customer'} • ${r.item?.name || 'Item'} (${r.status})`,
        amount: r.item?.refundAmount || 0,
        status: r.status,
        timestamp: r.createdAt,
        link: '/returns',
      });
    });
    recentInquiriesFeed.forEach((inq) => {
      activityEvents.push({
        id: `inq-${inq._id}`,
        type: 'inquiry',
        title: `Inquiry from ${inq.fullName}`,
        subtitle: `${inq.source === 'homepage' ? 'Homepage Form' : 'Contact Page'} • ${inq.isRead ? 'Read' : 'Unread'}`,
        status: inq.isRead ? 'read' : 'unread',
        timestamp: inq.createdAt,
        link: '/inquiries',
      });
    });
    recentReviewsFeed.forEach((rev) => {
      activityEvents.push({
        id: `rev-${rev._id}`,
        type: 'review',
        title: `${rev.rating}★ Review on ${rev.product?.name || 'Product'}`,
        subtitle: `By ${rev.customer?.name || 'Customer'} (${rev.status})`,
        status: rev.status,
        timestamp: rev.createdAt,
        link: '/reviews',
      });
    });

    const liveActivity = activityEvents
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    // Today vs Yesterday Snapshot
    const todayOrders = todayOrdersAgg[0]?.count || 0;
    const todayRevenue = todayOrdersAgg[0]?.revenue || 0;
    const yesterdayOrders = yesterdayOrdersAgg[0]?.count || 0;
    const yesterdayRevenue = yesterdayOrdersAgg[0]?.revenue || 0;
    const todayRevenueGrowthPct =
      yesterdayRevenue > 0
        ? Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1))
        : todayRevenue > 0
        ? 100
        : 0;

    const todaySnapshot = {
      orders: todayOrders,
      revenue: todayRevenue,
      yesterdayOrders,
      yesterdayRevenue,
      revenueGrowthPct: todayRevenueGrowthPct,
      signups: todaySignupsCount || 0,
    };

    // Shiprocket Fulfillment & Cancellations / Return Losses
    const cancelledCount = cancelledAgg[0]?.count || 0;
    const cancelledValue = cancelledAgg[0]?.value || 0;
    const returnRequests = refundedReturnsAgg[0]?.totalRequests || 0;
    const refundedValue = refundedReturnsAgg[0]?.refundedValue || 0;
    const fulfillmentHealth = {
      awaitingAwb: awaitingAwbCount || 0,
      inTransit: inTransitCount || 0,
      cancelledCount,
      cancelledValue,
      cancellationRatePct: totalOrders > 0 ? Number(((cancelledCount / totalOrders) * 100).toFixed(1)) : 0,
      returnRequests,
      refundedValue,
    };

    // Location & Region Insights
    const topCities = (topCitiesAgg || []).map((c) => ({
      city: c._id?.city || 'Other',
      state: c._id?.state || '',
      orders: c.orders || 0,
      revenue: c.revenue || 0,
    }));
    let tnOrders = 0;
    let tnRevenue = 0;
    let otherOrders = 0;
    let otherRevenue = 0;
    (regionSplitAgg || []).forEach((r) => {
      if (r._id === 'tn') {
        tnOrders += r.orders || 0;
        tnRevenue += r.revenue || 0;
      } else {
        otherOrders += r.orders || 0;
        otherRevenue += r.revenue || 0;
      }
    });
    const locationInsights = {
      topCities,
      tnOrders,
      tnRevenue,
      otherOrders,
      otherRevenue,
    };

    // Repeat Customer Rate & Weekly Signups
    const uniqueBuyers = buyerStatsAgg[0]?.uniqueBuyers || 0;
    const repeatBuyers = buyerStatsAgg[0]?.repeatBuyers || 0;
    const repeatRatePct = uniqueBuyers > 0 ? Number(((repeatBuyers / uniqueBuyers) * 100).toFixed(1)) : 0;
    const customerRetention = {
      totalCustomers,
      uniqueBuyers,
      repeatBuyers,
      repeatRatePct,
      newUsersThisWeek: newUsersWeekCount || 0,
    };

    // Active Store Promotions & Flash Deals
    const activePromotions = {
      activeDiscountsCount: Array.isArray(activeDiscountsList) ? activeDiscountsList.length : 0,
      discountedProductsCount: discountedProductsCount || 0,
      highlights: (activeDiscountsList || []).map((d) => ({
        _id: String(d._id),
        name: d.name,
        type: d.type,
        value: d.value,
        appliesTo: d.appliesTo,
        endsAt: d.endsAt || null,
      })),
    };

    return {
      totalRevenue,
      totalOrders,
      confirmedOrders,
      totalDiscount,
      totalCustomers,
      totalProducts,
      avgOrderValue,
      timeframe: tf,
      timeframeRevenue,
      timeframeOrders,
      growthPct,
      timeframeSeries,
      dailySales: dailySalesAgg,
      orderStatusBreakdown,
      paymentBreakdown,
      actionAlerts: {
        readyToDispatch,
        lowStockCount,
        outOfStockCount,
        pendingReturns,
        unreadInquiries,
        pendingReviews,
      },
      couponInsights,
      abandonedCartInsights,
      categorySales,
      liveActivity,
      todaySnapshot,
      fulfillmentHealth,
      lowStockWatchlist,
      locationInsights,
      customerRetention,
      activePromotions,
    };
  },

  async getTopProducts(limit = 5) {
    return Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          image: { $first: '$items.image' },
          unitsSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: limit },
    ]);
  },

  async getOrdersReport(startDate, endDate) {
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    return Order.find(filter).populate('user', 'phone name').sort({ createdAt: -1 }).lean();
  },
};

module.exports = ReportRepository;
