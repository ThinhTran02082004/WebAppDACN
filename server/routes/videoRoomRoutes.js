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
  getRoomByAppointmentId
} = require('../controllers/videoRoomController');

// Protected routes - require authentication
router.use(protect);

// Routes for all authenticated users
router.post('/create', createVideoRoom);
router.get('/join/:roomId', joinVideoRoom);
router.get('/appointment/:appointmentId', getRoomByAppointmentId);
router.get('/:roomId', getVideoRoomDetails);
router.post('/:roomId/end', endVideoRoom);
router.get('/', listVideoRooms);

// Admin only routes
router.get('/admin/active-rooms', authorize('admin'), getActiveLiveKitRooms);
router.post('/admin/remove-participant', authorize('admin'), removeParticipantFromRoom);

module.exports = router;
