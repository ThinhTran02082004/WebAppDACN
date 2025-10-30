const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  generateBill,
  getBillByAppointment,
  payConsultation,
  payMedication,
  payHospitalization,
  getPaymentHistory,
  getBillDetails,
  updateBillWithPrescription,
  updateBillWithHospitalization
} = require('../controllers/billingController');

// All routes require authentication
router.use(protect);

// Bill management
router.post('/generate', generateBill);
router.get('/appointment/:appointmentId', getBillByAppointment);
router.get('/:id', getBillDetails);

// Payment routes
router.post('/pay-consultation', payConsultation);
router.post('/pay-medication', payMedication);
router.post('/pay-hospitalization', payHospitalization);

// Payment history
router.get('/payments/history', getPaymentHistory);

// Update bill
router.post('/update-prescription', updateBillWithPrescription);
router.post('/update-hospitalization', updateBillWithHospitalization);

module.exports = router;

