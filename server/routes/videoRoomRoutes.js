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
<<<<<<< HEAD
  getVideoCallHistoryDetail
=======
  getVideoCallHistoryDetail,
  leaveVideoRoom,
  validateRoomCode,
  joinByRoomCode
>>>>>>> 78151d69be06d1d5326202c25c4ce002ec62c673
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
<<<<<<< HEAD
=======
router.post('/join-by-code', joinByRoomCode);
router.get('/validate-code/:code', validateRoomCode);
>>>>>>> 78151d69be06d1d5326202c25c4ce002ec62c673
router.get('/appointment/:appointmentId', getRoomByAppointmentId);

// General room routes - list must be before /:roomId
router.get('/', listVideoRooms);

// Routes with :roomId parameter - MUST BE LAST
router.get('/:roomId', getVideoRoomDetails);
<<<<<<< HEAD
=======
router.post('/:roomId/leave', leaveVideoRoom);
>>>>>>> 78151d69be06d1d5326202c25c4ce002ec62c673
router.post('/:roomId/end', endVideoRoom);

module.exports = router;
