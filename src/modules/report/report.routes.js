const express = require('express');
const router = express.Router();
const reportController = require('./report.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// Admin Report Endpoints
router.get('/sales', authenticate, requireRole('admin'), reportController.getSalesSummary);
router.get('/top-products', authenticate, requireRole('admin'), reportController.getTopProducts);
router.get('/orders', authenticate, requireRole('admin'), reportController.getOrdersReport);

module.exports = router;
