const InventoryService = require('./inventory.service');
const { sendSuccess } = require('../../utils/apiResponse');

const InventoryController = {
  async list(req, res, next) {
    try {
      const result = await InventoryService.list(req.query);
      return sendSuccess(res, { items: result.data, kpis: result.kpis }, 200, result.pagination);
    } catch (err) {
      next(err);
    }
  },

  async updateStock(req, res, next) {
    try {
      const result = await InventoryService.updateStock(req.params.productId, req.body);
      return sendSuccess(res, result, 200, null, 'Stock updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async toggleProductStatus(req, res, next) {
    try {
      const result = await InventoryService.toggleProductStatus(req.params.productId);
      return sendSuccess(res, result, 200, null, `Product ${result.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  },

  async deleteItem(req, res, next) {
    try {
      await InventoryService.deleteItem(req.params.productId);
      return sendSuccess(res, null, 200, null, 'Item deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};

module.exports = InventoryController;
