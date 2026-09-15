const OrderService = require('./order.service');
const { ApiResponse } = require('../../utils/apiResponse');

const getUserId = (req) => req.user?._id || req.user?.id;

// Customer Razorpay Flow
const createRazorpayOrder = async (req, res, next) => {
  try {
    const result = await OrderService.createRazorpayOrder(req.user, req.body);
    return res.json(ApiResponse.success(result, 'Razorpay order initialized'));
  } catch (err) { next(err); }
};

const verifyRazorpayOrder = async (req, res, next) => {
  try {
    const order = await OrderService.verifyAndCreateOrder(req.user, req.body);
    return res.status(201).json(ApiResponse.success(order, 'Payment verified and order placed successfully'));
  } catch (err) { next(err); }
};

// audit fix #2 — Razorpay Webhook handler
const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body; // Buffer (express.raw middleware used on this route)
    const result = await OrderService.handleWebhook(rawBody, signature);
    return res.status(200).json({ received: true, ...result });
  } catch (err) { next(err); }
};

const myOrders = async (req, res, next) => {
  try {
    const result = await OrderService.myOrders(getUserId(req), req.query);
    return res.json(ApiResponse.paginated(result.data, result.pagination));
  } catch (err) { next(err); }
};

const orderDetail = async (req, res, next) => {
  try {
    const order = await OrderService.getDetail(req.params.id, getUserId(req));
    return res.json(ApiResponse.success(order));
  } catch (err) { next(err); }
};

const getTracking = async (req, res, next) => {
  try {
    const tracking = await OrderService.getTracking(req.params.id, getUserId(req));
    return res.json(ApiResponse.success(tracking));
  } catch (err) { next(err); }
};

// Admin Management
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

module.exports = {
  createRazorpayOrder,
  verifyRazorpayOrder,
  handleRazorpayWebhook,
  myOrders,
  orderDetail,
  getTracking,
  adminListOrders,
  adminOrderDetail,
  addTracking,
  updateStatus,
};
