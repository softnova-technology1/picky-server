const ReturnService = require('./return.service');
const { ApiResponse } = require('../../utils/apiResponse');
const AppError = require('../../utils/appError');

const ReturnController = {
  async getAll(req, res, next) {
    try {
      // If customer / non-admin, return only their own returns
      if (req.user && req.user.role !== 'admin') {
        const returns = await ReturnService.getCustomerReturns(req.user._id);
        return res.status(200).json(ApiResponse.success(returns, 'Customer returns retrieved successfully'));
      }
      // If unauthenticated guest
      if (!req.user) {
        return res.status(200).json(ApiResponse.success([], 'No returns for unauthenticated guest'));
      }
      // Admin: full KPI stats and tab counts
      const result = await ReturnService.getAllReturns(req.query);
      return res.status(200).json(ApiResponse.success(result, 'Returns retrieved successfully'));
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const ret = await ReturnService.getReturnById(req.params.id);
      if (req.user && req.user.role !== 'admin') {
        const returnUserId = ret.user?._id ? ret.user._id.toString() : ret.user?.toString();
        const returnOrderUserId = ret.order?.user?._id ? ret.order.user._id.toString() : ret.order?.user?.toString();
        const currentUserId = req.user._id ? req.user._id.toString() : '';
        if (returnUserId !== currentUserId && returnOrderUserId !== currentUserId) {
          return next(new AppError('Access denied: You can only view your own return requests', 403));
        }
      }
      return res.status(200).json(ApiResponse.success(ret, 'Return retrieved successfully'));
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const ret = await ReturnService.createReturnRequest(req.body, req.user);
      return res.status(201).json(ApiResponse.success(ret, 'Return request submitted successfully', 201));
    } catch (err) {
      next(err);
    }
  },

  async approve(req, res, next) {
    try {
      const ret = await ReturnService.approveReturn(req.params.id, req.body);
      return res.status(200).json(ApiResponse.success(ret, 'Return approved & pickup scheduled'));
    } catch (err) {
      next(err);
    }
  },

  async markInTransit(req, res, next) {
    try {
      const ret = await ReturnService.markInTransit(req.params.id);
      return res.status(200).json(ApiResponse.success(ret, 'Return marked as in-transit'));
    } catch (err) {
      next(err);
    }
  },

  async markInspected(req, res, next) {
    try {
      const ret = await ReturnService.markInspected(req.params.id, req.body);
      return res.status(200).json(ApiResponse.success(ret, 'Return quality inspection completed'));
    } catch (err) {
      next(err);
    }
  },

  async processRefund(req, res, next) {
    try {
      const ret = await ReturnService.processRefund(req.params.id, req.body);
      return res.status(200).json(ApiResponse.success(ret, 'Refund processed successfully'));
    } catch (err) {
      next(err);
    }
  },

  async reject(req, res, next) {
    try {
      const ret = await ReturnService.rejectReturn(req.params.id, req.body);
      return res.status(200).json(ApiResponse.success(ret, 'Return request rejected'));
    } catch (err) {
      next(err);
    }
  },

  async getMyReturns(req, res, next) {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(200).json(ApiResponse.success([], 'Customer returns retrieved successfully'));
      }
      const returns = await ReturnService.getCustomerReturns(userId);
      return res.status(200).json(ApiResponse.success(returns, 'Customer returns retrieved successfully'));
    } catch (err) {
      next(err);
    }
  },
};

module.exports = ReturnController;
