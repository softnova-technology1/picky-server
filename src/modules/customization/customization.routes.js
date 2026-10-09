const express = require('express');
const router = express.Router();
const customizationController = require('./customization.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// Public: Get all customizations
router.get('/', customizationController.getAllCustomizations);

// Admin: Update customization for a page
router.put('/', authenticate, requireRole('admin'), customizationController.updateCustomization);

module.exports = router;
