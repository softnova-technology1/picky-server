const express = require('express');
const router = express.Router();
const ReturnController = require('./return.controller');
const { authenticate, optionalAuthenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// Customer self-service return creation
router.post('/', optionalAuthenticate, ReturnController.create);
router.get('/my-returns', authenticate, ReturnController.getMyReturns);

// Admin Returns & Reverse Logistics Management
router.get('/', authenticate, requireRole('admin'), ReturnController.getAll);
router.get('/:id', authenticate, requireRole('admin'), ReturnController.getById);
router.patch('/:id/approve', authenticate, requireRole('admin'), ReturnController.approve);
router.patch('/:id/in-transit', authenticate, requireRole('admin'), ReturnController.markInTransit);
router.patch('/:id/inspect', authenticate, requireRole('admin'), ReturnController.markInspected);
router.patch('/:id/refund', authenticate, requireRole('admin'), ReturnController.processRefund);
router.patch('/:id/reject', authenticate, requireRole('admin'), ReturnController.reject);

module.exports = router;
