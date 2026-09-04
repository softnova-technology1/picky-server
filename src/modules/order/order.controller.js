const OrderService = require('./order.service');
const { ApiResponse } = require('../../utils/apiResponse');

// Customer
const checkout = async (req, res, next) => {
  try {
    const order = await OrderService.checkout(req.user, req.body);
    return res.status(201).json(ApiResponse.success(order, 'Order placed successfully'));
  } catch (err) { next(err); }
};

const myOrders = async (req, res, next) => {
  try {
    const result = await OrderService.myOrders(req.user.id, req.query);
    return res.json(ApiResponse.paginated(result.data, result.pagination));
  } catch (err) { next(err); }
};

const orderDetail = async (req, res, next) => {
  try {
    const order = await OrderService.getDetail(req.params.id, req.user.id);
    return res.json(ApiResponse.success(order));
  } catch (err) { next(err); }
};

const getTracking = async (req, res, next) => {
  try {
    const tracking = await OrderService.getTracking(req.params.id, req.user.id);
    return res.json(ApiResponse.success(tracking));
  } catch (err) { next(err); }
};

// Admin
const adminListOrders = async (req, res, next) => {
  try {
    const result = await OrderService.adminListOrders(req.query);
    return res.json(ApiResponse.paginated(result.data, result.pagination));
  } catch (err) { next(err); }
};

const adminOrderDetail = async (req, res, next) => {
  try {
    const order = await OrderService.adminGetDetail(req.params.id);
    return res.json(ApiResponse.success(order));
  } catch (err) { next(err); }
};

const addTracking = async (req, res, next) => {
  try {
    const order = await OrderService.addTracking(req.params.id, req.body);
    return res.json(ApiResponse.success(order, 'Tracking updated. WhatsApp sent.'));
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const order = await OrderService.updateStatus(req.params.id, req.body);
    return res.json(ApiResponse.success(order, `Order status updated to ${req.body.status}`));
  } catch (err) { next(err); }
};

module.exports = { checkout, myOrders, orderDetail, getTracking, adminListOrders, adminOrderDetail, addTracking, updateStatus };
