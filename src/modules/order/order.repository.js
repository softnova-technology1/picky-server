const Order = require('../../models/order.model');

const OrderRepository = {
  create: (data) => Order.create(data),

  findByUser: (userId, skip, limit) =>
    Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-discountType') // hide internal discountType from customer list, keep items for preview
      .lean(),

  countByUser: (userId) => Order.countDocuments({ user: userId }),

  findById: (id) =>
    Order.findById(id)
      .populate('user', 'name phone')
      .select('-discountType') // NEVER expose discountType to customer API
      .lean(),

  findTracking: (id) =>
    Order.findById(id)
      .select('orderNumber status trackingId courier statusHistory user')
      .lean(),

  findAll: (filter, skip, limit) =>
    Order.find(filter)
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

  count: (filter) => Order.countDocuments(filter),

  addTracking: (id, { trackingId, courier }) =>
    Order.findByIdAndUpdate(
      id,
      {
        trackingId,
        courier,
        status: 'shipped',
        $push: { statusHistory: { status: 'shipped', timestamp: new Date() } },
      },
      { new: true }
    ).lean(),

  updateStatus: (id, status, note) =>
    Order.findByIdAndUpdate(
      id,
      {
        status,
        $push: { statusHistory: { status, timestamp: new Date(), note: note || '' } },
      },
      { new: true }
    ).lean(),
};

module.exports = OrderRepository;
