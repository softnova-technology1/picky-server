const express = require('express');
const router = express.Router();
const customizationController = require('./customization.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// Public: Get all customizations
router.get('/', customizationController.getAllCustomizations);

// Public: Real-time Server-Sent Events (SSE) stream for instant storefront synchronization
router.get('/live-stream', customizationController.streamCustomizationUpdates);

// Admin: Update customization for a page
router.put('/', authenticate, requireRole('admin'), customizationController.updateCustomization);

module.exports = router;

