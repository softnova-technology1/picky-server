const CustomerService = require('./customer.service');
const { sendSuccess } = require('../../utils/apiResponse');

const CustomerController = {
  async list(req, res, next) {
    try {
      const result = await CustomerService.list(req.query);
      return sendSuccess(res, result.data, 200, result.pagination);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const result = await CustomerService.getById(req.params.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = CustomerController;
