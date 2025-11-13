const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all notifications
// GET /api/notifications
router.get('/', notificationController.getNotifications);

// Get unread notifications count
// GET /api/notifications/unread-count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all notifications as read
// PUT /api/notifications/read-all
router.put('/read-all', notificationController.markAllAsRead);

// Mark a notification as read
// PUT /api/notifications/:id/read
router.put('/:id/read', notificationController.markAsRead);

// Delete a notification
// DELETE /api/notifications/:id
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;

