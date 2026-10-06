const router = require('express').Router();
const SettingsController = require('./settings.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// Public: customer store can read settings & banners
router.get('/', SettingsController.get);

// Protected: Admin can update settings & theme
router.patch('/', authenticate, requireRole('admin'), SettingsController.update);

module.exports = router;
