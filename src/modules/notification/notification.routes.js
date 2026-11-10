const express = require('express');
const router = express.Router();
const NotificationController = require('./notification.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

// Protect all notification routes — Admin access only
router.use(authenticate, requireRole('admin'));

router.get('/', NotificationController.list);
router.patch('/mark-all-read', NotificationController.markAllRead);
router.patch('/bulk-read', NotificationController.bulkRead);
router.post('/bulk-delete', NotificationController.bulkDelete);
router.patch('/:id/read', NotificationController.markRead);
router.patch('/:id/star', NotificationController.toggleStar);
router.delete('/:id', NotificationController.delete);

module.exports = router;
