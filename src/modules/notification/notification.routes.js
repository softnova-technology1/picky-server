const express = require('express');
const router = express.Router();
const NotificationController = require('./notification.controller');

router.get('/', NotificationController.list);
router.patch('/mark-all-read', NotificationController.markAllRead);
router.patch('/:id/read', NotificationController.markRead);
router.patch('/:id/star', NotificationController.toggleStar);
router.delete('/:id', NotificationController.delete);

module.exports = router;
