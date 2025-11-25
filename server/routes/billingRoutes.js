const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  generateBill,
  getBillByAppointment,
  getBillByPrescription,
  payConsultation,
  payMedication,
  payHospitalization,
  getPaymentHistory,
  getBillDetails,
  updateBillWithPrescription,
  updateBillWithHospitalization,
  confirmCashPayment,
  payPrescription,
  confirmPaymentByPharmacist
} = require('../controllers/billingController');

// All routes require authentication
router.use(protect);

// Bill management
router.post('/generate', generateBill);
router.get('/appointment/:appointmentId', getBillByAppointment);
router.get('/prescription/:prescriptionId', getBillByPrescription);

// Payment routes (phải đặt trước route /:id)
router.post('/pay-consultation', payConsultation);
router.post('/pay-medication', payMedication);
router.post('/pay-hospitalization', payHospitalization);
router.post('/pay-prescription', payPrescription);

// Payment history (phải đặt trước route /:id)
router.get('/payment-history', getPaymentHistory); // Đổi từ /payments/history thành /payment-history
router.get('/payments/history', getPaymentHistory); // Giữ để backward compatibility
router.get('/payments/appointment/:appointmentId', getPaymentHistory);

// Update bill
router.post('/update-prescription', updateBillWithPrescription);
router.post('/update-hospitalization', updateBillWithHospitalization);

// Confirm cash payment (doctor/admin only)
router.post('/confirm-cash-payment', confirmCashPayment);

// Confirm payment by pharmacist
router.post('/pharmacist/confirm-payment', confirmPaymentByPharmacist);

// Generic route phải đặt CUỐI CÙNG
router.get('/:id', getBillDetails);

module.exports = router;

