const ReportService = require('./report.service');
const { ApiResponse } = require('../../utils/apiResponse');

const getSalesSummary = async (req, res, next) => {
  try {
    const summary = await ReportService.getSalesSummary();
    return res.json(ApiResponse.success(summary));
  } catch (err) {
    next(err);
  }
};

const getTopProducts = async (req, res, next) => {
  try {
    const top = await ReportService.getTopProducts(req.query.limit);
    return res.json(ApiResponse.success(top));
  } catch (err) {
    next(err);
  }
};

const getOrdersReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const orders = await ReportService.getOrdersReport(startDate, endDate);
    return res.json(ApiResponse.success(orders));
  } catch (err) {
    next(err);
  }
};

module.exports = { getSalesSummary, getTopProducts, getOrdersReport };
