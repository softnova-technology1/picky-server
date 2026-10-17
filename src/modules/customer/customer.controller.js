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

  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      const result = await CustomerService.bulkDelete(ids);
      return sendSuccess(res, result, 200, null, `${result.deletedCount} customer(s) deleted successfully`);
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const result = await CustomerService.delete(req.params.id);
      return sendSuccess(res, result, 200, null, 'Customer deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = CustomerController;
