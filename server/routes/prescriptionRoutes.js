const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  createPrescription,
  getPrescriptionsByAppointment,
  getPrescriptionById,
  updatePrescription,
  validateStock,
  cancelPrescription,
  getPatientPrescriptions
} = require('../controllers/prescriptionController');

// All routes require authentication
router.use(protect);

// Prescription routes
router.post('/', createPrescription);
router.post('/validate-stock', validateStock);
router.get('/appointment/:appointmentId', getPrescriptionsByAppointment);
router.get('/patient/:patientId', getPatientPrescriptions);
router.get('/:id', getPrescriptionById);
router.put('/:id', updatePrescription);
router.post('/:id/cancel', cancelPrescription);

module.exports = router;

