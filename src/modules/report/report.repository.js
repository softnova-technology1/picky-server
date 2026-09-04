const Order = require('../../models/order.model');
const Product = require('../../models/product.model');
const User = require('../../models/user.model');

const ReportRepository = {
  async getSalesSummary() {
    const totalOrders = await Order.countDocuments();
    const confirmedOrders = await Order.countDocuments({ status: { $ne: 'cancelled' } });
    
    const revenueAgg = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' }, totalDiscount: { $sum: '$discountAmount' } } },
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalDiscount = revenueAgg[0]?.totalDiscount || 0;

    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProducts = await Product.countDocuments({ isActive: true });

    // Recent 7 days sales
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySales = await Order.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          sales: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      totalRevenue,
      totalOrders,
      confirmedOrders,
      totalDiscount,
      totalCustomers,
      totalProducts,
      dailySales,
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
