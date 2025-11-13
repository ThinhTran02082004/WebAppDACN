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
    .populate({
      path: 'medicationBill.prescriptionIds',
      select: 'prescriptionOrder isHospitalization diagnosis totalAmount status createdAt dispensedAt',
      populate: {
        path: 'medications.medicationId',
        select: 'name unitTypeDisplay'
      }
    })
    .populate('medicationBill.prescriptionPayments.prescriptionId')
    .populate('hospitalizationBill.hospitalizationId');

  // If bill exists and hospitalization is paid but missing paymentMethod, get it from BillPayment
  if (bill && bill.hospitalizationBill.status === 'paid' && !bill.hospitalizationBill.paymentMethod) {
    const latestPayment = await BillPayment.findOne({
      billId: bill._id,
      billType: 'hospitalization',
      paymentStatus: 'completed'
    }).sort({ createdAt: -1 });
    
    if (latestPayment) {
      bill.hospitalizationBill.paymentMethod = latestPayment.paymentMethod;
      bill.hospitalizationBill.paymentDate = latestPayment.createdAt;
      // Save to update the bill
      await bill.save();
    }
  }

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

    // Enrich with existing prescriptions and hospitalization
    const prescriptions = await Prescription.find({ appointmentId });
    if (prescriptions.length > 0) {
      bill.medicationBill.prescriptionIds = prescriptions.map(p => p._id);
      bill.medicationBill.amount = prescriptions.reduce((sum, p) => sum + p.totalAmount, 0);
    }
    const hospitalization = await Hospitalization.findOne({ appointmentId });
    if (hospitalization) {
      bill.hospitalizationBill.hospitalizationId = hospitalization._id;
      bill.hospitalizationBill.amount = hospitalization.totalAmount || 0;
    }
    await bill.save();

    bill = await Bill.findById(bill._id)
      .populate('appointmentId', 'appointmentDate bookingCode status')
      .populate('patientId', 'fullName email phoneNumber')
      .populate({
        path: 'medicationBill.prescriptionIds',
        select: 'prescriptionOrder isHospitalization diagnosis totalAmount status createdAt dispensedAt',
        populate: {
          path: 'medications.medicationId',
          select: 'name unitTypeDisplay'
        }
      })
      .populate('medicationBill.prescriptionPayments.prescriptionId')
      .populate('hospitalizationBill.hospitalizationId');
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

    // Update prescriptions status to 'dispensed' when medication is paid
    if (bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0) {
      await Prescription.updateMany(
        { _id: { $in: bill.medicationBill.prescriptionIds } },
        { 
          status: 'dispensed',
          dispensedAt: new Date(),
          dispensedBy: userId
        },
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
  const { 
    patientId, 
    appointmentId, 
    startDate, 
    endDate, 
    page = 1, 
    limit = 20,
    status,
    method,
    billType,
    search
  } = req.query;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  const query = {};

  // Filter by appointmentId if provided (for admin viewing specific appointment)
  if (appointmentId) {
    query.appointmentId = appointmentId;
  }

  // Role-based filtering
  if (userRole !== 'admin') {
    query.patientId = userId;
  } else if (patientId) {
    query.patientId = patientId;
  }

  // Status filter
  if (status && status !== 'all') {
    query.paymentStatus = status;
  }

  // Payment method filter
  if (method && method !== 'all') {
    query.paymentMethod = method;
  }

  // Bill type filter
  if (billType && billType !== 'all') {
    query.billType = billType;
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

  // Search filter (for payment number, transaction ID)
  if (search && userRole === 'admin') {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { paymentNumber: searchRegex },
      { transactionId: searchRegex }
    ];
  }

  const skip = (page - 1) * limit;

  const payments = await BillPayment.find(query)
    .populate('billId', 'billNumber totalAmount')
    .populate({
      path: 'appointmentId',
      select: '_id appointmentDate appointmentTime bookingCode status doctorId patientId hospitalId specialtyId', // Thêm nhiều field hơn
      populate: [
        {
          path: 'doctorId',
          select: 'user title specialtyId hospitalId',
          populate: {
            path: 'user',
            select: 'fullName email avatarUrl'
          }
        },
        {
          path: 'patientId',
          select: 'fullName email phoneNumber'
        },
        {
          path: 'hospitalId',
          select: 'name address'
        },
        {
          path: 'specialtyId',
          select: 'name'
        }
      ]
    })
    .populate('patientId', 'fullName email avatarUrl')
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

  // Initialize prescriptionPayment entry if not exists
  const prescription = await Prescription.findById(prescriptionId);
  if (prescription) {
    const existingPayment = bill.medicationBill.prescriptionPayments?.find(
      p => p.prescriptionId.toString() === prescriptionId.toString()
    );
    
    if (!existingPayment) {
      if (!bill.medicationBill.prescriptionPayments) {
        bill.medicationBill.prescriptionPayments = [];
      }
      bill.medicationBill.prescriptionPayments.push({
        prescriptionId: prescription._id,
        amount: prescription.totalAmount,
        status: 'pending'
      });
    } else {
      // Update amount if prescription amount changed
      existingPayment.amount = prescription.totalAmount;
    }
  }

  await bill.save();

  const populatedBill = await Bill.findById(bill._id)
    .populate('medicationBill.prescriptionIds')
    .populate('medicationBill.prescriptionPayments.prescriptionId');

  res.json({
    success: true,
    message: 'Cập nhật hóa đơn thành công',
    data: populatedBill
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

// Confirm cash payment (for doctor/admin)
exports.confirmCashPayment = asyncHandler(async (req, res) => {
  const { appointmentId, billType } = req.body;
  const userId = req.user.id;

  if (!appointmentId || !billType) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin: appointmentId và billType là bắt buộc'
    });
  }

  // Validate billType
  const validBillTypes = ['consultation', 'medication', 'hospitalization'];
  if (!validBillTypes.includes(billType)) {
    return res.status(400).json({
      success: false,
      message: 'billType không hợp lệ. Phải là: consultation, medication, hoặc hospitalization'
    });
  }

  // Get or create bill
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
        status: 'pending'
      }
    });
  }

  // Check if already paid
  let targetBill = null;
  if (billType === 'consultation') {
    targetBill = bill.consultationBill;
  } else if (billType === 'medication') {
    targetBill = bill.medicationBill;
  } else if (billType === 'hospitalization') {
    targetBill = bill.hospitalizationBill;
  }

  if (!targetBill) {
    return res.status(400).json({
      success: false,
      message: `Không tìm thấy thông tin thanh toán cho ${billType}`
    });
  }

  if (targetBill.status === 'paid') {
    return res.status(400).json({
      success: false,
      message: `Phần ${billType} đã được thanh toán`
    });
  }

  // Create BillPayment record
  const payment = await BillPayment.create({
    billId: bill._id,
    appointmentId: bill.appointmentId,
    patientId: bill.patientId,
    billType,
    amount: targetBill.amount,
    paymentMethod: 'cash',
    paymentStatus: 'completed',
    processedBy: userId,
    notes: `Xác nhận thanh toán tiền mặt bởi ${req.user.role === 'doctor' ? 'bác sĩ' : 'admin'}`
  });

  // Update bill status
  targetBill.status = 'paid';
  targetBill.paymentMethod = 'cash';
  targetBill.paymentDate = new Date();

  // If medication is paid, update prescription status to 'dispensed' only if status is 'verified'
  if (billType === 'medication' && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0) {
    await Prescription.updateMany(
      { _id: { $in: bill.medicationBill.prescriptionIds }, status: 'verified' },
      { 
        status: 'dispensed',
        dispensedAt: new Date(),
        dispensedBy: userId
      }
    );
  }

  // Recalculate totals
  bill.totalAmount = 
    (bill.consultationBill.status === 'paid' ? bill.consultationBill.amount : 0) +
    (bill.medicationBill.status === 'paid' ? bill.medicationBill.amount : 0) +
    (bill.hospitalizationBill.status === 'paid' ? bill.hospitalizationBill.amount : 0);
  
  bill.paidAmount = bill.totalAmount;
  bill.remainingAmount = 0;
  bill.overallStatus = bill.totalAmount > 0 ? 'paid' : 'pending';

  await bill.save();

  const populatedBill = await Bill.findById(bill._id)
    .populate('appointmentId', 'appointmentDate bookingCode')
    .populate('patientId', 'fullName email phoneNumber')
    .populate('medicationBill.prescriptionIds')
    .populate('hospitalizationBill.hospitalizationId');

  res.json({
    success: true,
    message: `Xác nhận thanh toán tiền mặt cho ${billType} thành công`,
    data: {
      bill: populatedBill,
      payment
    }
  });
});

// Pay individual prescription
exports.payPrescription = asyncHandler(async (req, res) => {
  const { prescriptionId, paymentMethod, transactionId, paymentDetails } = req.body;
  const userId = req.user.id;

  if (!prescriptionId) {
    return res.status(400).json({
      success: false,
      message: 'prescriptionId là bắt buộc'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get prescription
    const prescription = await Prescription.findById(prescriptionId).session(session);
    if (!prescription) {
      throw new Error('Không tìm thấy đơn thuốc');
    }

    // Check if already dispensed
    if (prescription.status === 'dispensed' || prescription.status === 'completed') {
      throw new Error('Đơn thuốc đã được thanh toán');
    }

    // Check if prescription status allows payment (must be approved or verified)
    if (!['approved', 'verified'].includes(prescription.status)) {
      throw new Error(`Không thể thanh toán đơn thuốc ở trạng thái '${prescription.status}'. Đơn thuốc phải được bác sĩ kê đơn (approved) hoặc dược sĩ phê duyệt (verified).`);
    }

    // Get bill
    let bill = await Bill.findOne({ appointmentId: prescription.appointmentId }).session(session);
    if (!bill) {
      const appointment = await Appointment.findById(prescription.appointmentId).session(session);
      if (!appointment) {
        throw new Error('Không tìm thấy lịch hẹn');
      }
      
      bill = await Bill.create([{
        appointmentId: prescription.appointmentId,
        patientId: prescription.patientId,
        consultationBill: {
          amount: appointment.fee?.totalAmount || 0,
          status: appointment.paymentStatus === 'completed' ? 'paid' : 'pending'
        },
        medicationBill: {
          prescriptionIds: [prescriptionId],
          amount: prescription.totalAmount,
          prescriptionPayments: [{
            prescriptionId: prescription._id,
            amount: prescription.totalAmount,
            status: 'pending'
          }]
        }
      }], { session });
      bill = bill[0];
    }

    // Find prescriptionPayment entry
    const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
      p => p.prescriptionId.toString() === prescriptionId.toString()
    );

    if (!prescriptionPayment) {
      // Create new entry if doesn't exist
      if (!bill.medicationBill.prescriptionPayments) {
        bill.medicationBill.prescriptionPayments = [];
      }
      bill.medicationBill.prescriptionPayments.push({
        prescriptionId: prescription._id,
        amount: prescription.totalAmount,
        status: 'paid',
        paymentMethod,
        paymentDate: new Date(),
        transactionId
      });
    } else {
      if (prescriptionPayment.status === 'paid') {
        throw new Error('Đơn thuốc này đã được thanh toán');
      }
      // Update payment entry
      prescriptionPayment.status = 'paid';
      prescriptionPayment.paymentMethod = paymentMethod;
      prescriptionPayment.paymentDate = new Date();
      prescriptionPayment.transactionId = transactionId;
    }

    // Check if all prescriptions are paid
    const allPrescriptions = bill.medicationBill.prescriptionPayments || [];
    const allPaid = allPrescriptions.length > 0 && 
                    allPrescriptions.every(p => p.status === 'paid');
    
    if (allPaid) {
      bill.medicationBill.status = 'paid';
      bill.medicationBill.paymentMethod = paymentMethod;
      bill.medicationBill.paymentDate = new Date();
      bill.medicationBill.transactionId = transactionId;
    }

    await bill.save({ session });

    // Create BillPayment record
    await BillPayment.create([{
      billId: bill._id,
      appointmentId: prescription.appointmentId,
      patientId: prescription.patientId,
      billType: 'medication',
      amount: prescription.totalAmount,
      paymentMethod,
      paymentStatus: 'completed',
      transactionId,
      paymentDetails: {
        ...paymentDetails,
        prescriptionId: prescription._id
      },
      processedBy: userId
    }], { session });

    // Do NOT auto-dispense. Prescription should only be dispensed by pharmacist action.
    // Payment updates payment status only, prescription status remains unchanged.

    await session.commitTransaction();

    const updatedBill = await Bill.findById(bill._id)
      .populate('appointmentId', 'appointmentDate bookingCode status')
      .populate('patientId', 'fullName email phoneNumber')
      .populate('medicationBill.prescriptionIds')
      .populate('medicationBill.prescriptionPayments.prescriptionId');

    res.json({
      success: true,
      message: 'Thanh toán đơn thuốc thành công',
      data: {
        bill: updatedBill,
        prescription
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error paying prescription:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể thanh toán đơn thuốc'
    });
  } finally {
    session.endSession();
  }
});

// Confirm payment by pharmacist (for cash payments)
exports.confirmPaymentByPharmacist = asyncHandler(async (req, res) => {
  const { appointmentId, billType } = req.body;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  // Check if user is pharmacist or admin
  if (userRole !== 'pharmacist' && userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ dược sĩ hoặc admin mới có quyền xác nhận thanh toán'
    });
  }

  if (!appointmentId || !billType) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin: appointmentId và billType là bắt buộc'
    });
  }

  // Validate billType (pharmacist can only confirm medication payment)
  if (billType !== 'medication') {
    return res.status(400).json({
      success: false,
      message: 'Dược sĩ chỉ có thể xác nhận thanh toán thuốc'
    });
  }

  // Get or create bill
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
        status: 'pending'
      }
    });
  }

  // Validate pharmacist's hospital matches appointment hospital
  if (userRole === 'pharmacist') {
    const User = require('../models/User');
    const pharmacist = await User.findById(userId);
    if (!pharmacist || !pharmacist.hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Dược sĩ chưa được gán vào chi nhánh'
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    if (appointment.hospitalId.toString() !== pharmacist.hospitalId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể xác nhận thanh toán cho lịch hẹn của chi nhánh mình'
      });
    }
  }

  const targetBill = bill.medicationBill;

  if (!targetBill) {
    return res.status(400).json({
      success: false,
      message: 'Không tìm thấy thông tin thanh toán thuốc'
    });
  }

  if (targetBill.status === 'paid') {
    return res.status(400).json({
      success: false,
      message: 'Thanh toán thuốc đã được xác nhận'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Mark all prescription payments as paid if not already
    if (targetBill.prescriptionPayments && targetBill.prescriptionPayments.length > 0) {
      for (const payment of targetBill.prescriptionPayments) {
        if (payment.status === 'pending') {
          payment.status = 'paid';
          payment.paymentMethod = 'cash';
          payment.paymentDate = new Date();
        }
      }
    }

    // Update medication bill status
    targetBill.status = 'paid';
    targetBill.paymentMethod = 'cash';
    targetBill.paymentDate = new Date();

    // Create BillPayment record for each prescription if needed
    if (targetBill.prescriptionIds && targetBill.prescriptionIds.length > 0) {
      const prescriptions = await Prescription.find({
        _id: { $in: targetBill.prescriptionIds }
      }).session(session);

      for (const prescription of prescriptions) {
        // Check if payment record already exists
        const existingPayment = await BillPayment.findOne({
          billId: bill._id,
          appointmentId: bill.appointmentId,
          billType: 'medication',
          'paymentDetails.prescriptionId': prescription._id
        }).session(session);

        if (!existingPayment) {
          await BillPayment.create([{
            billId: bill._id,
            appointmentId: bill.appointmentId,
            patientId: bill.patientId,
            billType: 'medication',
            amount: prescription.totalAmount,
            paymentMethod: 'cash',
            paymentStatus: 'completed',
            paymentDetails: {
              prescriptionId: prescription._id
            },
            processedBy: userId
          }], { session });
        }
      }
    }

    await bill.save({ session });
    await session.commitTransaction();

    const populatedBill = await Bill.findById(bill._id)
      .populate('appointmentId', 'appointmentDate bookingCode status')
      .populate('patientId', 'fullName email phoneNumber')
      .populate({
        path: 'medicationBill.prescriptionIds',
        select: 'prescriptionOrder isHospitalization diagnosis totalAmount status createdAt dispensedAt',
        populate: {
          path: 'medications.medicationId',
          select: 'name unitTypeDisplay'
        }
      })
      .populate('medicationBill.prescriptionPayments.prescriptionId')
      .populate('hospitalizationBill.hospitalizationId');

    res.json({
      success: true,
      message: 'Xác nhận thanh toán thuốc thành công',
      data: populatedBill
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error confirming payment by pharmacist:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể xác nhận thanh toán'
    });
  } finally {
    session.endSession();
  }
});

