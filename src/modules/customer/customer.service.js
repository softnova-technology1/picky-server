const User = require('../../models/user.model');
const Order = require('../../models/order.model');
const AppError = require('../../utils/appError');
const paginate = require('../../utils/paginate');

const CustomerService = {
  async list(query = {}) {
    const { skip, limit, buildPagination } = paginate(query);
    const filter = {};

    if (query.role && query.role !== 'all') {
      filter.role = query.role;
    }

    if (query.search) {
      const q = query.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Enhance each customer with aggregate spend & recent order date
    const customerIds = users.map((u) => u._id);
    const orderAgg = await Order.aggregate([
      { $match: { user: { $in: customerIds } } },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: { $ifNull: ['$pricing.finalTotal', '$totalAmount'] } },
          totalOrders: { $sum: 1 },
          lastOrderDate: { $max: '$createdAt' },
        },
      },
    ]);

    const statsMap = {};
    orderAgg.forEach((stat) => {
      statsMap[stat._id.toString()] = stat;
    });

    const enhancedUsers = users.map((u) => {
      const stat = statsMap[u._id.toString()] || {};
      return {
        ...u,
        city: u.city || u.defaultAddress?.city || u.addresses?.[0]?.city || 'N/A',
        joinedDate: u.createdAt,
        totalOrders: stat.totalOrders || u.orderCount || 0,
        totalSpent: stat.totalSpent || 0,
        lastOrderDate: stat.lastOrderDate || null,
      };
    });

    return { data: enhancedUsers, pagination: buildPagination(total) };
  },

  async getById(id) {
    const user = await User.findById(id)
      .select('-password -__v')
      .lean();
    if (!user) throw new AppError('User not found', 404);

    const orders = await Order.find({ user: id })
      .sort({ createdAt: -1 })
      .lean();

    const totalSpent = orders.reduce((sum, o) => sum + (o.pricing?.finalTotal || o.totalAmount || 0), 0);

    return {
      customer: {
        ...user,
        totalOrders: orders.length,
        totalSpent,
      },
      orders,
    };
  },
};

module.exports = CustomerService;
