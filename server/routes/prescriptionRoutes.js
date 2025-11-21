const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  createPrescription,
  getPrescriptionsByAppointment,
  getPrescriptionById,
  updatePrescription,
  validateStock,
  cancelPrescription,
  getPatientPrescriptions,
  getUserPrescriptionHistory,
  getPrescriptionsForPharmacy,
  getDoctorApprovalSummary,
  getAdminPrescriptionFilters,
  getPrescriptionsForAdmin,
  verifyPrescription,
  rejectPrescription,
  dispensePrescription
} = require('../controllers/prescriptionController');

// All routes require authentication
router.use(protect);

// Prescription routes
router.post('/', createPrescription);
router.post('/validate-stock', validateStock);
router.get('/user/history', getUserPrescriptionHistory); // For MedicalHistory page
router.get('/appointment/:appointmentId', getPrescriptionsByAppointment);
router.get('/patient/:patientId', getPatientPrescriptions);
router.get('/admin', authorize('admin'), getPrescriptionsForAdmin);
router.get('/doctor/approval-summary', authorize('doctor', 'admin'), getDoctorApprovalSummary);
router.get('/admin/filters', authorize('admin'), getAdminPrescriptionFilters);
router.get('/:id', getPrescriptionById);
router.put('/:id', updatePrescription);
router.post('/:id/cancel', cancelPrescription);

// Pharmacist routes
router.get('/pharmacy/pending', authorize('pharmacist', 'admin'), getPrescriptionsForPharmacy);
router.post('/:id/verify', authorize('pharmacist', 'admin'), verifyPrescription);
router.post('/:id/reject', authorize('pharmacist', 'admin'), rejectPrescription);
router.post('/:id/dispense', authorize('pharmacist', 'admin'), dispensePrescription);

module.exports = router;

