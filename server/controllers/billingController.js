const Bill = require('../models/Bill');
const BillPayment = require('../models/BillPayment');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Hospitalization = require('../models/Hospitalization');
const asyncHandler = require('../middlewares/async');
const mongoose = require('mongoose');

// Generate or get bill for appointment
exports.generateBill = asyncHandler(async (req, res) => {
  const { appointmentId } = req.body;

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy lịch hẹn'
    });
  }

  // Check if bill already exists
  let bill = await Bill.findOne({ appointmentId });

  if (bill) {
    // Update bill amounts if needed
    await updateBillAmounts(bill);
    await bill.save();

    const populatedBill = await Bill.findById(bill._id)
      .populate('appointmentId', 'appointmentDate bookingCode')
      .populate('patientId', 'fullName email phoneNumber')
      .populate('medicationBill.prescriptionIds')
      .populate('hospitalizationBill.hospitalizationId');

    return res.json({
      success: true,
      data: populatedBill
    });
  }

  // Create new bill
  bill = await Bill.create({
    appointmentId,
    patientId: appointment.patientId,
    consultationBill: {
      amount: appointment.fee?.totalAmount || 0,
      status: appointment.paymentStatus === 'completed' ? 'paid' : 'pending'
    }
  });

  // Update with prescriptions if any
  const prescriptions = await Prescription.find({ appointmentId });
  if (prescriptions.length > 0) {
    bill.medicationBill.prescriptionIds = prescriptions.map(p => p._id);
    bill.medicationBill.amount = prescriptions.reduce((sum, p) => sum + p.totalAmount, 0);
  }

  // Update with hospitalization if any
  const hospitalization = await Hospitalization.findOne({ appointmentId });
  if (hospitalization) {
    bill.hospitalizationBill.hospitalizationId = hospitalization._id;
    bill.hospitalizationBill.amount = hospitalization.totalAmount || 0;
  }

  await bill.save();

  const populatedBill = await Bill.findById(bill._id)
    .populate('appointmentId', 'appointmentDate bookingCode')
    .populate('patientId', 'fullName email phoneNumber')
    .populate('medicationBill.prescriptionIds')
    .populate('hospitalizationBill.hospitalizationId');

  res.status(201).json({
    success: true,
    message: 'Tạo hóa đơn thành công',
    data: populatedBill
  });
});

// Helper function to update bill amounts
async function updateBillAmounts(bill) {
  // Update medication amount
  if (bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0) {
    const prescriptions = await Prescription.find({
      _id: { $in: bill.medicationBill.prescriptionIds }
    });
    bill.medicationBill.amount = prescriptions.reduce((sum, p) => sum + p.totalAmount, 0);
  }

  // Update hospitalization amount
  if (bill.hospitalizationBill.hospitalizationId) {
    const hospitalization = await Hospitalization.findById(bill.hospitalizationBill.hospitalizationId);
    if (hospitalization) {
      bill.hospitalizationBill.amount = hospitalization.totalAmount || 0;
    }
  }
}

// Get bill by appointment
exports.getBillByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  let bill = await Bill.findOne({ appointmentId })
    .populate('appointmentId', 'appointmentDate bookingCode status')
    .populate('patientId', 'fullName email phoneNumber')
    .populate('medicationBill.prescriptionIds')
    .populate('hospitalizationBill.hospitalizationId');

  if (!bill) {
    // Auto-generate bill if doesn't exist
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    bill = await Bill.create({
      appointmentId,
      patientId: appointment.patientId,
      consultationBill: {
        amount: appointment.fee?.totalAmount || 0,
        status: appointment.paymentStatus === 'completed' ? 'paid' : 'pending'
      }
    });

    bill = await Bill.findById(bill._id)
      .populate('appointmentId', 'appointmentDate bookingCode status')
      .populate('patientId', 'fullName email phoneNumber');
  }

  res.json({
    success: true,
    data: bill
  });
});

// Pay consultation fee
exports.payConsultation = asyncHandler(async (req, res) => {
  const { billId, paymentMethod, transactionId, paymentDetails } = req.body;
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bill = await Bill.findById(billId).session(session);
    if (!bill) {
      throw new Error('Không tìm thấy hóa đơn');
    }

    if (bill.consultationBill.status === 'paid') {
      throw new Error('Phí khám đã được thanh toán');
    }

    if (bill.consultationBill.amount === 0) {
      throw new Error('Không có phí khám cần thanh toán');
    }

    // Update consultation bill
    bill.consultationBill.status = 'paid';
    bill.consultationBill.paymentMethod = paymentMethod;
    bill.consultationBill.paymentDate = new Date();
    bill.consultationBill.transactionId = transactionId;

    await bill.save({ session });

    // Create payment record
    await BillPayment.create([{
      billId: bill._id,
      appointmentId: bill.appointmentId,
      patientId: bill.patientId,
      billType: 'consultation',
      amount: bill.consultationBill.amount,
      paymentMethod,
      paymentStatus: 'completed',
      transactionId,
      paymentDetails,
      processedBy: userId
    }], { session });

    // Update appointment payment status
    await Appointment.findByIdAndUpdate(
      bill.appointmentId,
      { paymentStatus: 'completed' },
      { session }
    );

    await session.commitTransaction();

    const updatedBill = await Bill.findById(billId)
      .populate('appointmentId')
      .populate('patientId', 'fullName email');

    res.json({
      success: true,
      message: 'Thanh toán phí khám thành công',
      data: updatedBill
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error paying consultation:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể thanh toán phí khám'
    });
  } finally {
    session.endSession();
  }
});

// Pay medication
exports.payMedication = asyncHandler(async (req, res) => {
  const { billId, paymentMethod, transactionId, paymentDetails } = req.body;
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bill = await Bill.findById(billId).session(session);
    if (!bill) {
      throw new Error('Không tìm thấy hóa đơn');
    }

    if (bill.medicationBill.status === 'paid') {
      throw new Error('Tiền thuốc đã được thanh toán');
    }

    if (bill.medicationBill.amount === 0) {
      throw new Error('Không có tiền thuốc cần thanh toán');
    }

    // Update medication bill
    bill.medicationBill.status = 'paid';
    bill.medicationBill.paymentMethod = paymentMethod;
    bill.medicationBill.paymentDate = new Date();
    bill.medicationBill.transactionId = transactionId;

    await bill.save({ session });

    // Create payment record
    await BillPayment.create([{
      billId: bill._id,
      appointmentId: bill.appointmentId,
      patientId: bill.patientId,
      billType: 'medication',
      amount: bill.medicationBill.amount,
      paymentMethod,
      paymentStatus: 'completed',
      transactionId,
      paymentDetails,
      processedBy: userId
    }], { session });

    // Update prescriptions status
    if (bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0) {
      await Prescription.updateMany(
        { _id: { $in: bill.medicationBill.prescriptionIds } },
        { status: 'approved' },
        { session }
      );
    }

    await session.commitTransaction();

    const updatedBill = await Bill.findById(billId)
      .populate('appointmentId')
      .populate('patientId', 'fullName email')
      .populate('medicationBill.prescriptionIds');

    res.json({
      success: true,
      message: 'Thanh toán tiền thuốc thành công',
      data: updatedBill
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error paying medication:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể thanh toán tiền thuốc'
    });
  } finally {
    session.endSession();
  }
});

// Pay hospitalization
exports.payHospitalization = asyncHandler(async (req, res) => {
  const { billId, paymentMethod, transactionId, paymentDetails } = req.body;
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bill = await Bill.findById(billId).session(session);
    if (!bill) {
      throw new Error('Không tìm thấy hóa đơn');
    }

    if (bill.hospitalizationBill.status === 'paid') {
      throw new Error('Phí nội trú đã được thanh toán');
    }

    if (bill.hospitalizationBill.amount === 0) {
      throw new Error('Không có phí nội trú cần thanh toán');
    }

    // Update hospitalization bill
    bill.hospitalizationBill.status = 'paid';
    bill.hospitalizationBill.paymentMethod = paymentMethod;
    bill.hospitalizationBill.paymentDate = new Date();
    bill.hospitalizationBill.transactionId = transactionId;

    await bill.save({ session });

    // Create payment record
    await BillPayment.create([{
      billId: bill._id,
      appointmentId: bill.appointmentId,
      patientId: bill.patientId,
      billType: 'hospitalization',
      amount: bill.hospitalizationBill.amount,
      paymentMethod,
      paymentStatus: 'completed',
      transactionId,
      paymentDetails,
      processedBy: userId
    }], { session });

    await session.commitTransaction();

    const updatedBill = await Bill.findById(billId)
      .populate('appointmentId')
      .populate('patientId', 'fullName email')
      .populate('hospitalizationBill.hospitalizationId');

    res.json({
      success: true,
      message: 'Thanh toán phí nội trú thành công',
      data: updatedBill
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error paying hospitalization:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể thanh toán phí nội trú'
    });
  } finally {
    session.endSession();
  }
});

// Get payment history
exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const { patientId, startDate, endDate, page = 1, limit = 20 } = req.query;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  const query = {};

  // Role-based filtering
  if (userRole !== 'admin') {
    query.patientId = userId;
  } else if (patientId) {
    query.patientId = patientId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const skip = (page - 1) * limit;

  const payments = await BillPayment.find(query)
    .populate('billId', 'billNumber totalAmount')
    .populate('appointmentId', 'appointmentDate bookingCode')
    .populate('patientId', 'fullName email')
    .populate('processedBy', 'fullName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await BillPayment.countDocuments(query);

  res.json({
    success: true,
    data: payments,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get bill details
exports.getBillDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const bill = await Bill.findById(id)
    .populate('appointmentId')
    .populate('patientId', 'fullName email phoneNumber address')
    .populate({
      path: 'medicationBill.prescriptionIds',
      populate: {
        path: 'medications.medicationId',
        select: 'name unitTypeDisplay'
      }
    })
    .populate({
      path: 'hospitalizationBill.hospitalizationId',
      populate: {
        path: 'inpatientRoomId roomHistory.inpatientRoomId',
        select: 'roomNumber type hourlyRate'
      }
    });

  if (!bill) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy hóa đơn'
    });
  }

  // Get payment history for this bill
  const payments = await BillPayment.find({ billId: id })
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      bill,
      payments
    }
  });
});

// Update bill with prescription
exports.updateBillWithPrescription = asyncHandler(async (req, res) => {
  const { appointmentId, prescriptionId } = req.body;

  let bill = await Bill.findOne({ appointmentId });

  if (!bill) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    bill = await Bill.create({
      appointmentId,
      patientId: appointment.patientId,
      consultationBill: {
        amount: appointment.fee?.totalAmount || 0,
        status: appointment.paymentStatus === 'completed' ? 'paid' : 'pending'
      }
    });
  }

  // Add prescription to medication bill
  if (!bill.medicationBill.prescriptionIds.includes(prescriptionId)) {
    bill.medicationBill.prescriptionIds.push(prescriptionId);
  }

  // Update medication amount
  const prescriptions = await Prescription.find({
    _id: { $in: bill.medicationBill.prescriptionIds }
  });
  bill.medicationBill.amount = prescriptions.reduce((sum, p) => sum + p.totalAmount, 0);

  await bill.save();

  res.json({
    success: true,
    message: 'Cập nhật hóa đơn thành công',
    data: bill
  });
});

// Update bill with hospitalization
exports.updateBillWithHospitalization = asyncHandler(async (req, res) => {
  const { appointmentId, hospitalizationId } = req.body;

  let bill = await Bill.findOne({ appointmentId });

  if (!bill) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    bill = await Bill.create({
      appointmentId,
      patientId: appointment.patientId,
      consultationBill: {
        amount: appointment.fee?.totalAmount || 0,
        status: appointment.paymentStatus === 'completed' ? 'paid' : 'pending'
      }
    });
  }

  // Update hospitalization bill
  bill.hospitalizationBill.hospitalizationId = hospitalizationId;

  const hospitalization = await Hospitalization.findById(hospitalizationId);
  if (hospitalization) {
    bill.hospitalizationBill.amount = hospitalization.totalAmount || 0;
  }

  await bill.save();

  res.json({
    success: true,
    message: 'Cập nhật hóa đơn thành công',
    data: bill
  });
});

