const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

/**
 * @desc    Get all notifications for the current user
 * @route   GET /api/notifications
 * @access  Private (User, Doctor, Admin)
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type, unreadOnly = false } = req.query;

    // Build filter
    const filter = { userId };
    if (type) filter.type = type;
    if (unreadOnly === 'true') filter.isRead = false;

    // Get notifications with pagination
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('data.senderId', 'fullName avatar avatarUrl')
      .lean();

    // Get total count
    const total = await Notification.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách thông báo',
      error: error.message
    });
  }
};

/**
 * @desc    Mark a notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private (User, Doctor, Admin)
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      _id: id,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu thông báo đã đọc',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đánh dấu thông báo đã đọc',
      error: error.message
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private (User, Doctor, Admin)
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo đã đọc',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đánh dấu tất cả thông báo đã đọc',
      error: error.message
    });
  }
};

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread-count
 * @access  Private (User, Doctor, Admin)
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy số thông báo chưa đọc',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private (User, Doctor, Admin)
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa thông báo'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa thông báo',
      error: error.message
    });
  }
};

/**
 * Helper function to create notification
 * @param {Object} notificationData
 */
exports.createNotification = async (notificationData) => {
  try {
    const notification = await Notification.create(notificationData);
    
    // Emit socket event to the user if socket is available
    if (global.io) {
      global.io.to(notificationData.userId.toString()).emit('new_notification', notification);
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

