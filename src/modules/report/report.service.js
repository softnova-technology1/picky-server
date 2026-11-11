const ReportRepo = require('./report.repository');

const ReportService = {
  async getSalesSummary(timeframe = 'Week') {
    return ReportRepo.getSalesSummary(timeframe);
  },

  async getTopProducts(limit) {
    return ReportRepo.getTopProducts(limit ? parseInt(limit) : 5);
  },

  async getOrdersReport(startDate, endDate) {
    return ReportRepo.getOrdersReport(startDate, endDate);
  },
};

module.exports = ReportService;
