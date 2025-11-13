const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  listRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomStatus,
  getRoomStatistics
} = require('../controllers/inpatientRoomController');

// All routes require authentication
router.use(protect);

// Room management routes
router.get('/', listRooms);
router.post('/', createRoom); // Admin only
router.get('/statistics', getRoomStatistics);
router.get('/:id', getRoomStatus);
router.put('/:id', updateRoom); // Admin only
router.delete('/:id', deleteRoom); // Admin only

module.exports = router;

