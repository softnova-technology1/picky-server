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
          totalSpent: {
            $sum: {
              $cond: [
                { $ne: ['$status', 'cancelled'] },
                { $ifNull: ['$total', { $ifNull: ['$pricing.finalTotal', { $ifNull: ['$totalAmount', { $ifNull: ['$subtotal', 0] }] }] }] },
                0,
              ],
            },
          },
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
        dob: u.dob || null,
        joinedDate: u.createdAt,
        totalOrders: stat.totalOrders !== undefined ? stat.totalOrders : (u.orderCount || 0),
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

    const totalSpent = orders.reduce((sum, o) => {
      if (o.status === 'cancelled') return sum;
      const amount = Number(o.total ?? o.pricing?.finalTotal ?? o.totalAmount ?? o.subtotal ?? 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    return {
      customer: {
        ...user,
        totalOrders: orders.length,
        totalSpent,
      },
      orders,
    };
  },

  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('No customer IDs provided', 400);
    }
    // Safety check: Prevent deleting users with role 'admin'
    const result = await User.deleteMany({
      _id: { $in: ids },
      role: { $ne: 'admin' },
    });
    return { deletedCount: result.deletedCount };
  },

  async delete(id) {
    const user = await User.findById(id);
    if (!user) throw new AppError('Customer not found', 404);
    if (user.role === 'admin') throw new AppError('Cannot delete administrator accounts', 403);
    await User.findByIdAndDelete(id);
    return { success: true };
  },
};

module.exports = CustomerService;
