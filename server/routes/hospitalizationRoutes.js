const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  assignInpatientRoom,
  transferRoom,
  dischargePatient,
  getAvailableRooms,
  getHospitalizationByAppointment,
  getPatientHospitalizations,
  getHospitalizationDetails
} = require('../controllers/hospitalizationController');

// All routes require authentication
router.use(protect);

// Hospitalization management
router.post('/assign', assignInpatientRoom);
router.post('/:hospitalizationId/transfer', transferRoom);
router.post('/:hospitalizationId/discharge', dischargePatient);

// Query routes
router.get('/available-rooms', getAvailableRooms);
router.get('/appointment/:appointmentId', getHospitalizationByAppointment);
router.get('/patient/:patientId', getPatientHospitalizations);
router.get('/:id', getHospitalizationDetails);

module.exports = router;

