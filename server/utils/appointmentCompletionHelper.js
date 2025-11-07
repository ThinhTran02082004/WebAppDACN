const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Hospitalization = require('../models/Hospitalization');
const Bill = require('../models/Bill');

const ALLOWED_COMPLETION_STATUSES = ['confirmed', 'hospitalized', 'pending_payment'];

const PAYMENT_PART_LABELS = {
  consultation: 'phí khám',
  medication: 'tiền thuốc',
  hospitalization: 'phí nội trú'
};

/**
 * Build a human-readable list of unpaid bill sections.
 * @param {Bill} bill
 * @returns {string[]}
 */
function collectUnpaidParts(bill) {
  if (!bill) {
    return [PAYMENT_PART_LABELS.consultation, PAYMENT_PART_LABELS.medication, PAYMENT_PART_LABELS.hospitalization];
  }

  const unpaid = [];

  if (bill.consultationBill?.amount > 0 && bill.consultationBill?.status !== 'paid') {
    unpaid.push(PAYMENT_PART_LABELS.consultation);
  }

  const medicationAmount = bill.medicationBill?.amount || 0;
  if (medicationAmount > 0 && bill.medicationBill?.status !== 'paid') {
    unpaid.push(PAYMENT_PART_LABELS.medication);
  }

  const hospitalizationAmount = bill.hospitalizationBill?.amount || 0;
  if (hospitalizationAmount > 0 && bill.hospitalizationBill?.status !== 'paid') {
    unpaid.push(PAYMENT_PART_LABELS.hospitalization);
  }

  return unpaid;
}

/**
 * Validate all prerequisites before completing an appointment.
 * Accepts preloaded documents to minimise extra queries.
 */
async function checkCompletionEligibility({
  appointmentId,
  appointmentDoc,
  billDoc,
  prescriptions,
  hospitalizationDoc
}) {
  const result = {
    canComplete: false,
    code: null,
    message: '',
    unpaidParts: []
  };

  const appointment = appointmentDoc || await Appointment.findById(appointmentId);
  if (!appointment) {
    return {
      ...result,
      code: 'APPOINTMENT_NOT_FOUND',
      message: 'Không tìm thấy lịch hẹn để hoàn thành.'
    };
  }

  if (!ALLOWED_COMPLETION_STATUSES.includes(appointment.status)) {
    return {
      ...result,
      appointment,
      code: 'INVALID_STATUS',
      message: `Không thể hoàn thành lịch hẹn với trạng thái hiện tại là ${appointment.status}.`
    };
  }

  const prescriptionList = prescriptions || await Prescription.find({ appointmentId: appointment._id });
  if (!prescriptionList || prescriptionList.length === 0) {
    return {
      ...result,
      appointment,
      code: 'NO_PRESCRIPTION',
      message: 'Không thể hoàn thành lịch hẹn. Chưa có đơn thuốc nào được ký.',
      prescriptions: prescriptionList
    };
  }

  let hospitalization = hospitalizationDoc;
  if (appointment.hospitalizationId) {
    hospitalization = hospitalization || await Hospitalization.findById(appointment.hospitalizationId);
    if (!hospitalization) {
      return {
        ...result,
        appointment,
        code: 'HOSPITALIZATION_NOT_FOUND',
        message: 'Không tìm thấy thông tin nằm viện.'
      };
    }

    if (hospitalization.status !== 'discharged') {
      return {
        ...result,
        appointment,
        code: 'HOSPITALIZATION_NOT_DISCHARGED',
        message: 'Bệnh nhân đang nằm viện, chưa thể hoàn thành. Vui lòng xuất viện trước.'
      };
    }
  }

  const bill = billDoc || await Bill.findOne({ appointmentId: appointment._id });
  if (!bill) {
    return {
      ...result,
      appointment,
      code: 'BILL_NOT_FOUND',
      message: 'Không tìm thấy hóa đơn để kiểm tra thanh toán.'
    };
  }

  const unpaidParts = collectUnpaidParts(bill);
  if (unpaidParts.length > 0) {
    return {
      ...result,
      appointment,
      bill,
      prescriptions: prescriptionList,
      hospitalization,
      unpaidParts,
      code: 'UNPAID',
      message: `Chưa thanh toán đủ. Còn thiếu: ${unpaidParts.join(', ')}.`
    };
  }

  return {
    canComplete: true,
    appointment,
    bill,
    prescriptions: prescriptionList,
    hospitalization
  };
}

/**
 * Persist completion metadata on the provided appointment.
 */
async function finalizeAppointmentCompletion(validationResult, options = {}) {
  const appointment = validationResult.appointment;

  appointment.status = 'completed';
  appointment.completionDate = new Date();

  if (options.updatePaymentStatus) {
    appointment.paymentStatus = 'completed';
  }

  await appointment.save();

  return appointment;
}

/**
 * Attempt to automatically complete an appointment after all bills are paid.
 * Falls back to confirming the appointment if prerequisites are missing.
 */
async function autoCompleteAppointmentAfterPayment({ appointmentId, billDoc }) {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return {
      completed: false,
      code: 'APPOINTMENT_NOT_FOUND'
    };
  }

  appointment.paymentStatus = 'completed';

  const eligibility = await checkCompletionEligibility({
    appointmentId,
    appointmentDoc: appointment,
    billDoc
  });

  if (eligibility.canComplete) {
    await finalizeAppointmentCompletion(eligibility);
    return {
      completed: true,
      appointment
    };
  }

  if (['pending', 'pending_payment'].includes(appointment.status)) {
    appointment.status = 'confirmed';
  }

  await appointment.save();

  return {
    completed: false,
    code: eligibility.code,
    details: eligibility
  };
}

module.exports = {
  checkCompletionEligibility,
  finalizeAppointmentCompletion,
  autoCompleteAppointmentAfterPayment
};
