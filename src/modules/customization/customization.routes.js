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

// Admin: Clear an image from S3 storage and MongoDB customization collection
router.post('/clear-image', authenticate, requireRole('admin'), customizationController.clearCustomizationImage);

module.exports = router;

