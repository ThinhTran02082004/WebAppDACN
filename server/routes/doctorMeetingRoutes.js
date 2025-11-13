const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');
const {
  createMeeting,
  joinMeetingByCode,
  listMyMeetings,
  listAllMeetings,
  getActiveRooms,
  removeParticipant,
  endMeeting,
  getMeetingDetails,
  leaveMeeting,
  validateMeetingCode
} = require('../controllers/doctorMeetingController');

// All routes require authentication
router.use(protect);

// Admin routes (must be admin)
router.get('/all', restrictTo('admin'), listAllMeetings);
router.get('/active-rooms', restrictTo('admin'), getActiveRooms);
router.post('/admin/remove-participant', restrictTo('admin'), removeParticipant);

// Doctor/Admin meeting routes
router.post('/create', createMeeting);
router.post('/join/:code', joinMeetingByCode);
router.get('/my-meetings', listMyMeetings);
router.get('/validate/:code', validateMeetingCode);

// Specific meeting routes
router.get('/:id', getMeetingDetails);
router.post('/:id/end', endMeeting);
router.post('/:id/leave', leaveMeeting);

module.exports = router;

