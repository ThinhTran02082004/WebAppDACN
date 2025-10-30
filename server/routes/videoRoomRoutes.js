const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  createVideoRoom,
  joinVideoRoom,
  endVideoRoom,
  getVideoRoomDetails,
  listVideoRooms,
  getActiveLiveKitRooms,
  removeParticipantFromRoom,
  getRoomByAppointmentId,
  getVideoCallHistory,
  getVideoCallHistoryDetail,
  leaveVideoRoom,
  validateRoomCode,
  joinByRoomCode
} = require('../controllers/videoRoomController');

// Protected routes - require authentication
router.use(protect);

// Admin only routes - MUST BE FIRST to avoid conflict with /:roomId
router.get('/admin/active-rooms', authorize('admin'), getActiveLiveKitRooms);
router.post('/admin/remove-participant', authorize('admin'), removeParticipantFromRoom);

// Video call history routes - role-based access control
router.get('/history', getVideoCallHistory);
router.get('/history/:roomId', getVideoCallHistoryDetail);

// Routes for all authenticated users
router.post('/create', createVideoRoom);
router.get('/join/:roomId', joinVideoRoom);
router.post('/join-by-code', joinByRoomCode);
router.get('/validate-code/:code', validateRoomCode);
router.get('/appointment/:appointmentId', getRoomByAppointmentId);

// General room routes - list must be before /:roomId
router.get('/', listVideoRooms);

// Routes with :roomId parameter - MUST BE LAST
router.get('/:roomId', getVideoRoomDetails);
router.post('/:roomId/leave', leaveVideoRoom);
router.post('/:roomId/end', endVideoRoom);

module.exports = router;
