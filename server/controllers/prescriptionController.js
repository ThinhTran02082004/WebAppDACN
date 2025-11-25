const Prescription = require('../models/Prescription');
const PrescriptionDraft = require('../models/PrescriptionDraft');
const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const Medication = require('../models/Medication');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const Bill = require('../models/Bill');
const BillPayment = require('../models/BillPayment');
const asyncHandler = require('../middlewares/async');
const mongoose = require('mongoose');

// Create new prescription
exports.createPrescription = asyncHandler(async (req, res) => {
  const { appointmentId, medications, templateId, notes, diagnosis, prescriptionOrder, isHospitalization } = req.body;
  const userId = req.user.id;

  // Find doctor
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  // Validate appointment và populate specialtyId để lấy tên specialty
  const appointment = await Appointment.findById(appointmentId)
    .populate('specialtyId', 'name');
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy lịch hẹn'
    });
  }

  // Validate appointment có hospitalId
  if (!appointment.hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Lịch hẹn không có thông tin chi nhánh. Vui lòng kiểm tra lại.'
    });
  }

  // Check if doctor owns this appointment
  const appointmentDoctorId = appointment.doctorId?._id || appointment.doctorId;
  if (!appointmentDoctorId || appointmentDoctorId.toString() !== doctor._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền kê đơn thuốc cho lịch hẹn này'
    });
  }

  // Validate medications
  if (!medications || medications.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Đơn thuốc phải có ít nhất 1 loại thuốc'
    });
  }

  // Start MongoDB transaction for stock management
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Prepare medication data and validate stock
    const medicationData = [];
    
    for (const med of medications) {
      const medication = await Medication.findById(med.medicationId).session(session);
      
      if (!medication) {
        throw new Error(`Không tìm thấy thuốc với ID: ${med.medicationId}`);
      }

      if (!medication.isActive) {
        throw new Error(`Thuốc ${medication.name} hiện không khả dụng`);
      }

      // Validate medication có hospitalId
      if (!medication.hospitalId) {
        throw new Error(`Thuốc ${medication.name} không có thông tin chi nhánh`);
      }

      // Lấy hospitalId từ appointment và medication (xử lý cả trường hợp populated)
      const appointmentHospitalId = appointment.hospitalId?._id || appointment.hospitalId;
      const medicationHospitalId = medication.hospitalId?._id || medication.hospitalId;

      if (!appointmentHospitalId || !medicationHospitalId) {
        throw new Error(`Không thể xác định chi nhánh cho thuốc ${medication.name}`);
      }

      // Validate medication belongs to the same hospital as appointment
      if (medicationHospitalId.toString() !== appointmentHospitalId.toString()) {
        throw new Error(
          `Thuốc ${medication.name} không thuộc chi nhánh của lịch hẹn này`
        );
      }

      // Check stock
      if (medication.stockQuantity < med.quantity) {
        throw new Error(
          `Thuốc ${medication.name} không đủ số lượng. Tồn kho: ${medication.stockQuantity} ${medication.unitTypeDisplay}`
        );
      }

      // Reduce stock
      medication.stockQuantity -= med.quantity;
      await medication.save({ session });

      // Prepare prescription medication data
      medicationData.push({
        medicationId: medication._id,
        medicationName: medication.name,
        quantity: med.quantity,
        dosage: med.dosage,
        usage: med.usage,
        duration: med.duration,
        unitPrice: medication.unitPrice,
        totalPrice: medication.unitPrice * med.quantity,
        notes: med.notes || ''
      });

      // Emit stock update event via Socket.io
      if (global.io) {
        global.io.to('inventory_updates').emit('stock_updated', {
          medicationId: medication._id,
          medicationName: medication.name,
          oldStock: medication.stockQuantity + med.quantity,
          newStock: medication.stockQuantity,
          action: 'prescription_created'
        });
      }
    }

    // Get template info if used
    let templateName = null;
    if (templateId) {
      const template = await PrescriptionTemplate.findById(templateId).session(session);
      if (template) {
        templateName = template.name;
        // Increment template usage count
        template.usageCount += 1;
        await template.save({ session });
      }
    }

    // Auto-determine prescriptionOrder if not provided and appointment is hospitalized
    let order = prescriptionOrder;
    if (!order && appointment.status === 'hospitalized') {
      // Find existing prescriptions for this appointment
      const existingPrescriptions = await Prescription.find({ appointmentId }).session(session);
      order = existingPrescriptions.length > 0 
        ? Math.max(...existingPrescriptions.map(p => p.prescriptionOrder || 1)) + 1
        : 1;
    } else if (!order) {
      order = 1;
    }

    // Determine if hospitalization prescription
    const isHosp = isHospitalization !== undefined ? isHospitalization : appointment.status === 'hospitalized';

    // Lấy hospitalId từ appointment (xử lý cả trường hợp populated)
    const appointmentHospitalIdForPrescription = appointment.hospitalId?._id || appointment.hospitalId;

    // Create prescription
    const prescription = await Prescription.create([{
      appointmentId,
      patientId: appointment.patientId,
      doctorId: doctor._id,
      hospitalId: appointmentHospitalIdForPrescription,
      medications: medicationData,
      templateId: templateId || undefined,
      templateName,
      notes,
      diagnosis,
      prescriptionOrder: order,
      isHospitalization: isHosp,
      status: 'approved'
    }], { session });

    await session.commitTransaction();

    // Tự động tạo MedicalRecord từ Prescription
    try {
      // Format prescription medications để lưu vào MedicalRecord
      const prescriptionData = medicationData.map(med => ({
        medicine: med.medicationName,
        dosage: med.dosage,
        usage: med.usage,
        duration: med.duration,
        notes: med.notes || '',
        quantity: med.quantity,
        medicationId: med.medicationId,
        frequency: med.dosage
      }));

      // Lấy specialty name từ populated appointment
      const specialtyName = appointment.specialtyId?.name || '';
      const specialtyId = appointment.specialtyId?._id || appointment.specialtyId;
      
      // Lấy hospitalId từ appointment (xử lý cả trường hợp populated)
      const appointmentHospitalId = appointment.hospitalId?._id || appointment.hospitalId;

      // Tạo MedicalRecord
      const medicalRecord = new MedicalRecord({
        patientId: appointment.patientId,
        doctorId: doctor._id,
        appointmentId: appointment._id,
        prescriptionId: prescription[0]._id, // Link với prescription
        diagnosis: diagnosis || appointment.diagnosis || '',
        symptoms: appointment.symptoms || '',
        treatment: appointment.treatment || '',
        prescription: prescriptionData,
        notes: notes || appointment.notes || '',
        specialty: specialtyId,
        specialtyName: specialtyName,
        status: 'completed',
        isActive: true
      });

      await medicalRecord.save();
    } catch (medicalRecordError) {
      console.error('Error creating medical record from prescription:', medicalRecordError);
      // Don't fail prescription creation if medical record creation fails
    }

    // Auto-update bill with new prescription
    try {
      const billingController = require('./billingController');
      await billingController.updateBillWithPrescription({
        body: {
          appointmentId,
          prescriptionId: prescription[0]._id
        },
        user: req.user
      }, {
        json: () => {},
        status: () => ({ json: () => {} })
      });
    } catch (billError) {
      console.error('Error updating bill with prescription:', billError);
      // Don't fail prescription creation if bill update fails
    }

    // Populate prescription data
    const populatedPrescription = await Prescription.findById(prescription[0]._id)
      .populate('medications.medicationId', 'name unitTypeDisplay')
      .populate('doctorId', 'title specialtyId')
      .populate({
        path: 'doctorId',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      })
      .populate('patientId', 'fullName email phoneNumber');

    // Emit real-time update to appointment participants
    if (global.io) {
      const patientUserId = appointment.patientId.toString();
      const doctorUserId = userId;
      
      global.io.to(patientUserId).emit('prescription_created', {
        appointmentId,
        prescription: populatedPrescription
      });
      global.io.to(doctorUserId).emit('prescription_created', {
        appointmentId,
        prescription: populatedPrescription
      });
    }

    res.status(201).json({
      success: true,
      message: 'Kê đơn thuốc thành công',
      data: populatedPrescription
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating prescription:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể kê đơn thuốc'
    });
  } finally {
    session.endSession();
  }
});

// Get prescriptions by appointment
exports.getPrescriptionsByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const prescriptions = await Prescription.find({ appointmentId })
    .populate('medications.medicationId', 'name unitTypeDisplay')
    .populate('doctorId', 'title specialtyId')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('templateId', 'name category')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: prescriptions
  });
});

// Doctor view: pending prescription summary grouped by specialty and doctor
exports.getDoctorApprovalSummary = asyncHandler(async (req, res) => {
  const doctorUserId = req.user.id;
  const doctor = await Doctor.findOne({ user: doctorUserId }).populate('hospitalId');

  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  if (!doctor.hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Bác sĩ chưa được gán vào chi nhánh'
    });
  }

  const query = {
    hospitalId: doctor.hospitalId,
    status: { $in: ['approved', 'verified'] }
  };

  const prescriptions = await Prescription.find(query)
    .populate({
      path: 'doctorId',
      select: 'user specialtyId',
      populate: [
        { path: 'user', select: 'fullName' },
        { path: 'specialtyId', select: 'name' }
      ]
    })
    .populate('patientId', 'fullName')
    .sort({ createdAt: -1 })
    .limit(200);

  const summary = {
    totalPending: prescriptions.length,
    bySpecialty: [],
    byDoctor: [],
    recent: []
  };

  const specialtyMap = new Map();
  const doctorMap = new Map();

  prescriptions.forEach((prescription) => {
    const doctorInfo = prescription.doctorId;
    const specialtyInfo = doctorInfo?.specialtyId;
    const specialtyId = specialtyInfo?._id?.toString() || doctorInfo?.specialtyId?.toString();
    const doctorId = doctorInfo?._id?.toString();

    if (specialtyId) {
      const current = specialtyMap.get(specialtyId) || {
        specialtyId,
        specialtyName: specialtyInfo?.name || 'Chưa xác định',
        total: 0
      };
      current.total += 1;
      specialtyMap.set(specialtyId, current);
    }

    if (doctorId) {
      const current = doctorMap.get(doctorId) || {
        doctorId,
        doctorName: doctorInfo?.user?.fullName || 'Bác sĩ',
        specialtyName: specialtyInfo?.name || 'Chưa xác định',
        total: 0
      };
      current.total += 1;
      doctorMap.set(doctorId, current);
    }
  });

  summary.bySpecialty = Array.from(specialtyMap.values()).sort((a, b) => b.total - a.total);
  summary.byDoctor = Array.from(doctorMap.values()).sort((a, b) => b.total - a.total);
  summary.recent = prescriptions.slice(0, 5).map((item) => ({
    id: item._id,
    patientName: item.patientId?.fullName || 'Bệnh nhân',
    doctorName: item.doctorId?.user?.fullName || 'Bác sĩ',
    specialtyName: item.doctorId?.specialtyId?.name || 'Chuyên khoa',
    status: item.status,
    createdAt: item.createdAt
  }));

  res.json({
    success: true,
    data: summary
  });
});

// Admin filter metadata for prescriptions
exports.getAdminPrescriptionFilters = asyncHandler(async (req, res) => {
  const doctors = await Doctor.find()
    .populate('user', 'fullName email')
    .populate('specialtyId', 'name');

  const specialtyMap = new Map();

  const doctorOptions = doctors.map((doctor) => {
    if (doctor.specialtyId) {
      const specialtyKey = doctor.specialtyId._id.toString();
      specialtyMap.set(specialtyKey, {
        id: specialtyKey,
        name: doctor.specialtyId.name
      });
    }

    return {
      id: doctor._id.toString(),
      name: doctor.user?.fullName || 'Bác sĩ',
      specialtyId: doctor.specialtyId ? doctor.specialtyId._id.toString() : null,
      specialtyName: doctor.specialtyId?.name || 'Chưa xác định'
    };
  });

  res.json({
    success: true,
    data: {
      specialties: Array.from(specialtyMap.values()),
      doctors: doctorOptions
    }
  });
});

// Get prescription by ID
exports.getPrescriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const prescription = await Prescription.findById(id)
    .populate('medications.medicationId', 'name unitTypeDisplay description')
    .populate('appointmentId')
    .populate('patientId', 'fullName email phoneNumber dateOfBirth gender')
    .populate('doctorId', 'title specialtyId')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate('templateId', 'name category')
    .populate('dispensedBy', 'fullName')
    .populate('cancelledBy', 'fullName')
    .populate('verifiedBy', 'fullName')
    .populate('hospitalId', 'name address');

  if (!prescription) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc'
    });
  }

  res.json({
    success: true,
    data: prescription
  });
});

// Update prescription (for inpatient - can add more medications)
exports.updatePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { medications, notes } = req.body;
  const userId = req.user.id;

  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  const prescription = await Prescription.findById(id).populate('appointmentId');

  if (!prescription) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc'
    });
  }

  // Check permission
  if (prescription.doctorId.toString() !== doctor._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền chỉnh sửa đơn thuốc này'
    });
  }

  // Cannot update completed or cancelled prescriptions
  if (['completed', 'cancelled'].includes(prescription.status)) {
    return res.status(400).json({
      success: false,
      message: 'Không thể chỉnh sửa đơn thuốc đã hoàn thành hoặc đã hủy'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Add new medications if provided
    if (medications && medications.length > 0) {
      const newMedicationData = [];

      for (const med of medications) {
        const medication = await Medication.findById(med.medicationId).session(session);
        
        if (!medication) {
          throw new Error(`Không tìm thấy thuốc với ID: ${med.medicationId}`);
        }

        if (medication.stockQuantity < med.quantity) {
          throw new Error(
            `Thuốc ${medication.name} không đủ số lượng. Tồn kho: ${medication.stockQuantity}`
          );
        }

        // Reduce stock
        medication.stockQuantity -= med.quantity;
        await medication.save({ session });

        newMedicationData.push({
          medicationId: medication._id,
          medicationName: medication.name,
          quantity: med.quantity,
          dosage: med.dosage,
          usage: med.usage,
          duration: med.duration,
          unitPrice: medication.unitPrice,
          totalPrice: medication.unitPrice * med.quantity,
          notes: med.notes || ''
        });

        // Emit stock update
        if (global.io) {
          global.io.to('inventory_updates').emit('stock_updated', {
            medicationId: medication._id,
            medicationName: medication.name,
            oldStock: medication.stockQuantity + med.quantity,
            newStock: medication.stockQuantity,
            action: 'prescription_updated'
          });
        }
      }

      prescription.medications.push(...newMedicationData);
    }

    if (notes !== undefined) {
      prescription.notes = notes;
    }

    await prescription.save({ session });
    await session.commitTransaction();

    const updatedPrescription = await Prescription.findById(id)
      .populate('medications.medicationId', 'name unitTypeDisplay')
      .populate('doctorId', 'title')
      .populate({
        path: 'doctorId',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      });

    res.json({
      success: true,
      message: 'Cập nhật đơn thuốc thành công',
      data: updatedPrescription
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating prescription:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể cập nhật đơn thuốc'
    });
  } finally {
    session.endSession();
  }
});

// Validate stock before creating prescription
exports.validateStock = asyncHandler(async (req, res) => {
  const { medications, appointmentId, hospitalId } = req.body;

  if (!medications || medications.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Danh sách thuốc không được để trống'
    });
  }

  // Get hospitalId from appointment if provided, otherwise use direct hospitalId
  let targetHospitalId = hospitalId;
  if (appointmentId && !targetHospitalId) {
    const appointment = await Appointment.findById(appointmentId);
    if (appointment && appointment.hospitalId) {
      targetHospitalId = appointment.hospitalId;
    }
  }

  // If still no hospitalId, try to get from user (doctor)
  if (!targetHospitalId && req.user) {
    const userRole = req.user.roleType || req.user.role;
    if (userRole === 'doctor') {
      const Doctor = require('../models/Doctor');
      const doctor = await Doctor.findOne({ user: req.user.id });
      if (doctor && doctor.hospitalId) {
        targetHospitalId = doctor.hospitalId;
      }
    }
  }

  if (!targetHospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Không xác định được chi nhánh. Vui lòng cung cấp appointmentId hoặc hospitalId.'
    });
  }

  const stockValidation = [];
  let allAvailable = true;

  for (const med of medications) {
    const medication = await Medication.findById(med.medicationId);
    
    if (!medication) {
      stockValidation.push({
        medicationId: med.medicationId,
        available: false,
        reason: 'Không tìm thấy thuốc'
      });
      allAvailable = false;
      continue;
    }

    // Validate medication belongs to same hospital
    if (medication.hospitalId.toString() !== targetHospitalId.toString()) {
      stockValidation.push({
        medicationId: med.medicationId,
        medicationName: medication.name,
        available: false,
        reason: `Thuốc không thuộc chi nhánh này. Thuốc thuộc chi nhánh khác.`
      });
      allAvailable = false;
      continue;
    }

    const isAvailable = medication.stockQuantity >= med.quantity;
    
    stockValidation.push({
      medicationId: med.medicationId,
      medicationName: medication.name,
      requestedQuantity: med.quantity,
      availableStock: medication.stockQuantity,
      available: isAvailable,
      unitTypeDisplay: medication.unitTypeDisplay,
      hospitalId: medication.hospitalId
    });

    if (!isAvailable) {
      allAvailable = false;
    }
  }

  res.json({
    success: true,
    allAvailable,
    data: stockValidation
  });
});

// Cancel prescription
exports.cancelPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  const prescription = await Prescription.findById(id);

  if (!prescription) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc'
    });
  }

  if (prescription.status === 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Đơn thuốc đã bị hủy'
    });
  }

  await prescription.cancel(userId, reason);

  res.json({
    success: true,
    message: 'Hủy đơn thuốc thành công'
  });
});

// Get user prescription history (for MedicalHistory page) - include drafts
exports.getUserPrescriptionHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status } = req.query;

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const limitNumber = Math.max(1, parseInt(limit, 10) || 10);
  const startIndex = (pageNumber - 1) * limitNumber;
  const endIndex = startIndex + limitNumber;

  const prescriptionQuery = { patientId: userId };
  const draftQuery = { patientId: userId };

  if (status) {
    prescriptionQuery.status = status;
    draftQuery.status = status;
  }

  const prescriptions = await Prescription.find(prescriptionQuery)
    .populate('medications.medicationId', 'name unitTypeDisplay')
    .populate('appointmentId', 'appointmentDate bookingCode specialtyId')
    .populate({
      path: 'appointmentId',
      populate: {
        path: 'specialtyId',
        select: 'name'
      }
    })
    .populate('doctorId', 'title specialtyId')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate({
      path: 'doctorId',
      populate: {
        path: 'specialtyId',
        select: 'name'
      }
    })
    .sort({ createdAt: -1 })
    .lean();

  const drafts = await PrescriptionDraft.find(draftQuery)
    .sort({ createdAt: -1 })
    .lean();

  // Map prescription payment statuses from Bill records
  const prescriptionIds = prescriptions.map((p) => p._id.toString());
  const paymentStatusMap = {};

  if (prescriptionIds.length > 0) {
    const billsWithPayments = await Bill.find({
      patientId: userId,
      'medicationBill.prescriptionPayments.prescriptionId': { $in: prescriptionIds }
    })
      .select('medicationBill.prescriptionPayments')
      .lean();

    billsWithPayments.forEach((bill) => {
      bill.medicationBill?.prescriptionPayments?.forEach((payment) => {
        const paymentPrescriptionId = payment.prescriptionId?.toString();
        if (paymentPrescriptionId && prescriptionIds.includes(paymentPrescriptionId)) {
          paymentStatusMap[paymentPrescriptionId] = payment.status || 'pending';
        }
      });
    });

    // Fallback: check BillPayment records (useful for MoMo payments)
    const completedPayments = await BillPayment.find({
      patientId: userId,
      billType: 'medication',
      paymentStatus: 'completed',
      'paymentDetails.prescriptionId': { $in: prescriptionIds }
    })
      .select('paymentDetails.prescriptionId paymentStatus')
      .lean();

    completedPayments.forEach(payment => {
      const prescriptionId = payment.paymentDetails?.prescriptionId?.toString();
      if (prescriptionId) {
        paymentStatusMap[prescriptionId] = 'paid';
      }
    });
  }

  // Group official prescriptions by appointment (hoặc theo prescription nếu không có appointment - đơn từ AI)
  const groupedByAppointment = {};
  prescriptions.forEach(prescription => {
    // Đơn thuốc từ AI không có appointmentId, group theo prescriptionId
    const appointmentId = prescription.appointmentId?._id?.toString() || 
                          (prescription.createdFromDraft ? `prescription_${prescription._id.toString()}` : 'unknown');
    
    if (!groupedByAppointment[appointmentId]) {
      groupedByAppointment[appointmentId] = {
        isDraft: false,
        type: 'official',
        appointmentId: prescription.appointmentId?._id || null,
        appointmentDate: prescription.appointmentId?.appointmentDate || prescription.createdAt,
        bookingCode: prescription.appointmentId?.bookingCode || null,
        specialty: prescription.appointmentId?.specialtyId?.name || prescription.doctorId?.specialtyId?.name,
        doctor: prescription.doctorId?.user?.fullName || 'Không xác định',
        prescriptions: [],
        createdAt: prescription.appointmentId?.appointmentDate || prescription.createdAt || new Date(),
        createdFromDraft: prescription.createdFromDraft || false
      };
    }

    groupedByAppointment[appointmentId].prescriptions.push({
      _id: prescription._id,
      diagnosis: prescription.diagnosis,
      prescriptionOrder: prescription.prescriptionOrder,
      isHospitalization: prescription.isHospitalization,
      status: prescription.status,
      totalAmount: prescription.totalAmount,
      createdAt: prescription.createdAt,
      medicationsCount: prescription.medications.length,
      createdFromDraft: prescription.createdFromDraft || false,
      paymentStatus: paymentStatusMap[prescription._id.toString()] || 'pending'
    });

    const currentCreatedAt = prescription.createdAt || prescription.appointmentId?.appointmentDate;
    if (currentCreatedAt && groupedByAppointment[appointmentId].createdAt < currentCreatedAt) {
      groupedByAppointment[appointmentId].createdAt = currentCreatedAt;
    }
  });

  const officialRecords = Object.values(groupedByAppointment);

  const draftRecords = drafts.map(draft => ({
    isDraft: true,
    type: 'draft',
    prescriptionCode: draft.prescriptionCode,
    symptom: draft.symptom,
    diagnosis: draft.diagnosis,
    status: draft.status,
    note: draft.note,
    keywords: draft.keywords || [],
    medicationsCount: draft.medications?.length || 0,
    medications: (draft.medications || []).map(med => ({
      name: med.name,
      quantity: med.quantity,
      price: med.price
    })),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  }));

  const combinedRecords = [...officialRecords, ...draftRecords].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });

  const totalCombined = combinedRecords.length;
  const paginatedRecords = combinedRecords.slice(startIndex, endIndex);

  res.json({
    success: true,
    records: paginatedRecords,
    pagination: {
      total: totalCombined,
      page: pageNumber,
      totalPages: Math.ceil(totalCombined / limitNumber)
    },
    stats: {
      officialTotal: officialRecords.length,
      draftTotal: draftRecords.length
    }
  });
});

// Get patient prescriptions
exports.getPatientPrescriptions = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { page = 1, limit = 10, status } = req.query;

  const query = { patientId };
  
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const prescriptions = await Prescription.find(query)
    .populate('medications.medicationId', 'name unitTypeDisplay')
    .populate('appointmentId', 'appointmentDate bookingCode')
    .populate('doctorId', 'title')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await Prescription.countDocuments(query);

  res.json({
    success: true,
    data: prescriptions,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get prescriptions for pharmacy (pending approval and verified)
exports.getPrescriptionsForPharmacy = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const userId = req.user.id;

  const pharmacist = await User.findById(userId);
  if (!pharmacist || !pharmacist.hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Dược sĩ chưa được gán vào chi nhánh'
    });
  }

  // Default to only 'approved' status if no status filter provided
  // This makes it clearer what prescriptions need pharmacist attention
  const query = {
    status: status ? status : 'approved',
    hospitalId: pharmacist.hospitalId
  };

  const skip = (page - 1) * limit;

  const prescriptions = await Prescription.find(query)
    .populate('medications.medicationId', 'name unitTypeDisplay')
    .populate('appointmentId', 'appointmentDate bookingCode')
    .populate('patientId', 'fullName email phoneNumber')
    .populate('doctorId', 'title specialtyId')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('verifiedBy', 'fullName')
    .populate('hospitalId', 'name address')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await Prescription.countDocuments(query);

  res.json({
    success: true,
    data: prescriptions,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get prescriptions overview for admin
exports.getPrescriptionsForAdmin = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, hospitalId, specialtyId, doctorId } = req.query;

  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  if (hospitalId) {
    query.hospitalId = hospitalId;
  }

  let specialtyDoctorIds = null;
  if (specialtyId) {
    const doctorsInSpecialty = await Doctor.find({ specialtyId }).select('_id');
    specialtyDoctorIds = doctorsInSpecialty.map(doc => doc._id);

    if (specialtyDoctorIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          pages: 0
        }
      });
    }
  }

  if (doctorId && specialtyDoctorIds) {
    const isDoctorInSpecialty = specialtyDoctorIds.some(id => id.toString() === doctorId);
    if (!isDoctorInSpecialty) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          pages: 0
        }
      });
    }
    query.doctorId = doctorId;
  } else if (doctorId) {
    query.doctorId = doctorId;
  } else if (specialtyDoctorIds) {
    query.doctorId = { $in: specialtyDoctorIds };
  }

  const numericLimit = parseInt(limit);
  const skip = (parseInt(page) - 1) * numericLimit;

  const prescriptions = await Prescription.find(query)
    .populate('medications.medicationId', 'name unitTypeDisplay')
    .populate('appointmentId', 'appointmentDate bookingCode')
    .populate('patientId', 'fullName email phoneNumber')
    .populate('doctorId', 'title specialtyId')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('verifiedBy', 'fullName')
    .populate('hospitalId', 'name address')
    .sort({ createdAt: -1 })
    .limit(numericLimit)
    .skip(skip);

  // Lấy cả PrescriptionDraft (đơn thuốc nháp từ AI)
  const draftQuery = {};
  if (status && status !== 'all') {
    // Map status: 'pending_approval' cho drafts
    if (status === 'pending_approval') {
      draftQuery.status = 'pending_approval';
    } else if (status === 'approved') {
      draftQuery.status = { $in: ['approved', 'rejected'] };
    }
  }
  if (hospitalId) {
    draftQuery.hospitalId = hospitalId;
  }
  if (specialtyId) {
    draftQuery.specialtyId = specialtyId;
  }
  if (doctorId) {
    draftQuery.doctorId = doctorId;
  } else if (specialtyDoctorIds) {
    draftQuery.doctorId = { $in: specialtyDoctorIds };
  }

  const drafts = await PrescriptionDraft.find(draftQuery)
    .populate('patientId', 'fullName email phoneNumber')
    .populate('hospitalId', 'name address')
    .populate('specialtyId', 'name')
    .populate({
      path: 'doctorId',
      select: 'title user',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .sort({ createdAt: -1 })
    .limit(numericLimit)
    .skip(skip)
    .lean();

  // Kết hợp prescriptions và drafts, đánh dấu loại
  const allPrescriptions = prescriptions.map(p => ({
    ...p.toObject(),
    isDraft: false,
    type: 'prescription'
  }));

  const allDrafts = drafts.map(d => ({
    ...d,
    isDraft: true,
    type: 'draft',
    _id: d._id,
    prescriptionCode: d.prescriptionCode,
    // Map fields để tương thích với Prescription format
    appointmentId: null, // Draft không có appointment
    medications: d.medications || [],
    totalAmount: (d.medications || []).reduce((sum, m) => sum + ((m.price || 0) * (m.quantity || 1)), 0),
    diagnosis: d.diagnosis || d.symptom,
    notes: d.note
  }));

  // Sắp xếp theo createdAt (mới nhất trước)
  const combined = [...allPrescriptions, ...allDrafts].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });

  // Tính tổng số (cả prescriptions và drafts)
  const totalPrescriptions = await Prescription.countDocuments(query);
  const totalDrafts = await PrescriptionDraft.countDocuments(draftQuery);
  const total = totalPrescriptions + totalDrafts;

  res.json({
    success: true,
    data: combined,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / numericLimit)
    }
  });
});

// Verify prescription (pharmacist approval)
exports.verifyPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const userId = req.user.id;
  const mongoose = require('mongoose');

  const staffUser = await User.findById(userId);
  if (!staffUser) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng'
    });
  }

  const isAdminActor = staffUser.roleType === 'admin' || staffUser.role === 'admin';

  if (!isAdminActor && !staffUser.hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Dược sĩ chưa được gán vào chi nhánh'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Reload prescription with session for transaction and optimistic locking
    const prescription = await Prescription.findById(id).session(session);

    if (!prescription) {
      throw new Error('Không tìm thấy đơn thuốc');
    }

    // Validate pharmacist's hospitalId matches prescription's hospitalId
    if (!isAdminActor && prescription.hospitalId.toString() !== staffUser.hospitalId.toString()) {
      throw new Error('Bạn chỉ có thể phê duyệt đơn thuốc của chi nhánh mình');
    }

    // Check status before update (concurrent operation protection)
    if (prescription.status !== 'approved') {
      throw new Error(`Chỉ có thể phê duyệt đơn thuốc ở trạng thái 'approved'. Trạng thái hiện tại: ${prescription.status}`);
    }

    await prescription.verify(userId, notes);
    await prescription.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('Verify prescription error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Không thể phê duyệt đơn thuốc'
    });
  } finally {
    session.endSession();
  }

  // Reload prescription after transaction
  const populatedPrescription = await Prescription.findById(id)
    .populate('medications.medicationId', 'name unitTypeDisplay')
    .populate('patientId', 'fullName email phoneNumber')
    .populate('doctorId', 'title')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('verifiedBy', 'fullName');

  // Emit real-time update
  if (global.io) {
    global.io.to('pharmacy_updates').emit('prescription_verified', {
      prescriptionId: id,
      prescription: populatedPrescription
    });
  }

  res.json({
    success: true,
    message: 'Phê duyệt đơn thuốc thành công',
    data: populatedPrescription
  });
});

// Reject prescription (pharmacist rejection)
exports.rejectPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;
  const mongoose = require('mongoose');

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp lý do từ chối đơn thuốc'
    });
  }

  const staffUser = await User.findById(userId);
  if (!staffUser) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy người dùng'
    });
  }

  const isAdminActor = staffUser.roleType === 'admin' || staffUser.role === 'admin';

  if (!isAdminActor && !staffUser.hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Dược sĩ chưa được gán vào chi nhánh'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Reload prescription with session for transaction and optimistic locking
    const prescription = await Prescription.findById(id).session(session);

    if (!prescription) {
      throw new Error('Không tìm thấy đơn thuốc');
    }

    // Validate pharmacist's hospitalId matches prescription's hospitalId
    if (!isAdminActor && prescription.hospitalId.toString() !== staffUser.hospitalId.toString()) {
      throw new Error('Bạn chỉ có thể từ chối đơn thuốc của chi nhánh mình');
    }

    // Check status before update (concurrent operation protection)
    if (prescription.status !== 'approved') {
      throw new Error(`Chỉ có thể từ chối đơn thuốc ở trạng thái 'approved'. Trạng thái hiện tại: ${prescription.status}`);
    }

    await prescription.cancel(userId, reason);
    await prescription.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error('Reject prescription error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Không thể từ chối đơn thuốc'
    });
  } finally {
    session.endSession();
  }

  // Reload prescription after transaction
  const populatedPrescription = await Prescription.findById(id)
    .populate('medications.medicationId', 'name unitTypeDisplay')
    .populate('patientId', 'fullName email phoneNumber')
    .populate('cancelledBy', 'fullName');

  // Emit real-time update
  if (global.io) {
    global.io.to('pharmacy_updates').emit('prescription_rejected', {
      prescriptionId: id,
      prescription: populatedPrescription
    });
  }

  res.json({
    success: true,
    message: 'Từ chối đơn thuốc thành công',
    data: populatedPrescription
  });
});

// Dispense prescription (pharmacist dispenses medication)
exports.dispensePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Get pharmacist's hospitalId
  const MedicationInventory = require('../models/MedicationInventory');
  const mongoose = require('mongoose');
  
  const pharmacist = await User.findById(userId);
  if (!pharmacist || !pharmacist.hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Dược sĩ chưa được gán vào chi nhánh'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Reload prescription with session for transaction
    const prescription = await Prescription.findById(id).session(session);

    if (!prescription) {
      throw new Error('Không tìm thấy đơn thuốc');
    }

    // Validate pharmacist's hospitalId matches prescription's hospitalId
    if (prescription.hospitalId.toString() !== pharmacist.hospitalId.toString()) {
      throw new Error('Bạn chỉ có thể cấp thuốc cho đơn thuốc của chi nhánh mình');
    }

    // Validate status
    if (prescription.status !== 'verified') {
      throw new Error(`Chỉ có thể cấp thuốc cho đơn thuốc ở trạng thái 'verified'. Trạng thái hiện tại: ${prescription.status}`);
    }

    // Validate stock availability for all medications
    const stockIssues = [];
    for (const medItem of prescription.medications) {
      const medication = await Medication.findById(medItem.medicationId).session(session);
      
      if (!medication) {
        stockIssues.push(`Thuốc ${medItem.medicationName} không tồn tại`);
        continue;
      }

      // Validate medication belongs to same hospital
      if (medication.hospitalId.toString() !== prescription.hospitalId.toString()) {
        stockIssues.push(`Thuốc ${medItem.medicationName} không thuộc chi nhánh này`);
        continue;
      }

      // Check stock availability
      if (medication.stockQuantity < medItem.quantity) {
        stockIssues.push(
          `Thuốc ${medItem.medicationName}: yêu cầu ${medItem.quantity} ${medication.unitTypeDisplay}, chỉ còn ${medication.stockQuantity} ${medication.unitTypeDisplay}`
        );
      }
    }

    if (stockIssues.length > 0) {
      throw new Error(`Không đủ tồn kho:\n${stockIssues.join('\n')}`);
    }

    // Reduce stock and create inventory records
    const inventoryRecords = [];
    for (const medItem of prescription.medications) {
      const medication = await Medication.findById(medItem.medicationId).session(session);
      
      const previousStock = medication.stockQuantity;
      const newStock = previousStock - medItem.quantity;
      
      // Update medication stock
      medication.stockQuantity = newStock;
      await medication.save({ session });

      // Create inventory record
      const inventoryRecord = {
        medicationId: medication._id,
        hospitalId: medication.hospitalId,
        transactionType: 'prescription',
        quantity: medItem.quantity,
        previousStock,
        newStock,
        unitPrice: medItem.unitPrice,
        totalCost: medItem.totalPrice,
        performedBy: userId,
        reason: 'Cấp thuốc theo đơn',
        referenceId: prescription._id,
        referenceType: 'Prescription',
        notes: `Đơn thuốc #${prescription.prescriptionOrder || ''} - ${prescription.diagnosis || ''}`
      };
      
      inventoryRecords.push(inventoryRecord);
    }

    // Create inventory records
    if (inventoryRecords.length > 0) {
      await MedicationInventory.create(inventoryRecords, { session });
    }

    // Update prescription status
    await prescription.dispense(userId);
    await prescription.save({ session });

    await session.commitTransaction();

    // Emit real-time stock updates
    if (global.io) {
      for (const medItem of prescription.medications) {
        const medication = await Medication.findById(medItem.medicationId);
        if (medication) {
          global.io.to('inventory_updates').emit('stock_updated', {
            medicationId: medication._id,
            medicationName: medication.name,
            oldStock: medication.stockQuantity + medItem.quantity,
            newStock: medication.stockQuantity,
            quantity: -medItem.quantity,
            action: 'dispense',
            performedBy: pharmacist.fullName || pharmacist.email
          });
        }
      }
    }

    const populatedPrescription = await Prescription.findById(id)
      .populate('medications.medicationId', 'name unitTypeDisplay')
      .populate('patientId', 'fullName email phoneNumber')
      .populate('doctorId', 'title')
      .populate({
        path: 'doctorId',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      })
      .populate('dispensedBy', 'fullName');

    // Emit real-time update for prescription
    if (global.io) {
      global.io.to('pharmacy_updates').emit('prescription_dispensed', {
        prescriptionId: id,
        prescription: populatedPrescription
      });
    }

    res.json({
      success: true,
      message: 'Cấp thuốc thành công',
      data: populatedPrescription
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Dispense prescription error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Không thể cấp thuốc'
    });
  } finally {
    session.endSession();
  }
});

// ============================================
// PRESCRIPTION DRAFT - DOCTOR APPROVAL APIs
// ============================================

// Get prescription drafts pending approval for doctor
exports.getPrescriptionDraftsForDoctor = asyncHandler(async (req, res) => {
  const doctorUserId = req.user.id;
  const doctor = await Doctor.findOne({ user: doctorUserId })
    .populate('hospitalId', '_id name')
    .populate('specialtyId', '_id name')
    .populate('user', 'fullName');

  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  if (!doctor.hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Bác sĩ chưa được gán vào chi nhánh'
    });
  }

  // Lấy các đơn thuốc nháp được gán cho bác sĩ này hoặc thuộc bệnh viện và chuyên khoa của bác sĩ
  // Xử lý hospitalId và specialtyId có thể là ObjectId hoặc populated object
  const doctorHospitalId = doctor.hospitalId?._id || doctor.hospitalId;
  const doctorSpecialtyId = doctor.specialtyId?._id || doctor.specialtyId;
  
  // Debug: Đếm tổng số PrescriptionDraft pending_approval
  const totalPending = await PrescriptionDraft.countDocuments({ status: 'pending_approval' });
  console.log('[getPrescriptionDraftsForDoctor] Total pending drafts in DB:', totalPending);
  
  const queryConditions = [];
  
  // Điều kiện 1: Được gán trực tiếp cho bác sĩ này
  if (doctor._id) {
    queryConditions.push({ doctorId: doctor._id });
  }
  
  // Điều kiện 2: Thuộc cùng bệnh viện và chuyên khoa (kể cả khi chưa gán doctorId)
  if (doctorHospitalId && doctorSpecialtyId) {
    // Match đơn thuốc có cùng hospitalId và specialtyId, và doctorId là null/undefined hoặc chính bác sĩ này
    queryConditions.push({
      hospitalId: doctorHospitalId,
      specialtyId: doctorSpecialtyId,
      $or: [
        { doctorId: null },
        { doctorId: { $exists: false } },
        { doctorId: doctor._id }
      ]
    });
  } else if (doctorHospitalId) {
    // Nếu chỉ có hospitalId, lấy tất cả đơn thuốc của bệnh viện này
    queryConditions.push({
      hospitalId: doctorHospitalId,
      $or: [
        { doctorId: null },
        { doctorId: { $exists: false } },
        { doctorId: doctor._id }
      ]
    });
  }

  const query = {
    status: 'pending_approval'
  };

  if (queryConditions.length > 0) {
    query.$or = queryConditions;
  } else if (doctor._id) {
    // Nếu không có điều kiện nào, chỉ lấy đơn được gán trực tiếp cho bác sĩ này
    query.doctorId = doctor._id;
  }

  const { page = 1, limit = 10, status } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (status && status !== 'all') {
    query.status = status;
  }

  console.log('[getPrescriptionDraftsForDoctor] Doctor info:', {
    doctorId: doctor._id?.toString(),
    doctorName: doctor.user?.fullName || 'N/A',
    hospitalId: doctorHospitalId?.toString(),
    hospitalName: doctor.hospitalId?.name || 'N/A',
    specialtyId: doctorSpecialtyId?.toString(),
    specialtyName: doctor.specialtyId?.name || 'N/A'
  });
  
  // Debug: Test query từng điều kiện
  if (doctor._id) {
    const countByDoctorId = await PrescriptionDraft.countDocuments({ 
      status: 'pending_approval',
      doctorId: doctor._id 
    });
    console.log('[getPrescriptionDraftsForDoctor] Drafts assigned to this doctor:', countByDoctorId);
  }
  
  if (doctorHospitalId && doctorSpecialtyId) {
    const countByHospitalSpecialty = await PrescriptionDraft.countDocuments({ 
      status: 'pending_approval',
      hospitalId: doctorHospitalId,
      specialtyId: doctorSpecialtyId
    });
    console.log('[getPrescriptionDraftsForDoctor] Drafts by hospital+specialty:', countByHospitalSpecialty);
    
    // Debug: Xem một vài draft mẫu
    const sampleDrafts = await PrescriptionDraft.find({ 
      status: 'pending_approval',
      hospitalId: doctorHospitalId,
      specialtyId: doctorSpecialtyId
    })
    .select('prescriptionCode hospitalId specialtyId doctorId createdAt')
    .limit(3)
    .lean();
    console.log('[getPrescriptionDraftsForDoctor] Sample drafts:', JSON.stringify(sampleDrafts, null, 2));
  }
  
  console.log('[getPrescriptionDraftsForDoctor] Final query:', JSON.stringify(query, null, 2));

  const drafts = await PrescriptionDraft.find(query)
    .populate('patientId', 'fullName email phoneNumber')
    .populate('hospitalId', 'name address')
    .populate('specialtyId', 'name')
    .populate({
      path: 'doctorId',
      select: 'title user',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .lean();

  const total = await PrescriptionDraft.countDocuments(query);

  res.json({
    success: true,
    data: drafts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    }
  });
});

// Get single prescription draft by ID
exports.getPrescriptionDraftById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doctorUserId = req.user.id;
  const doctor = await Doctor.findOne({ user: doctorUserId });

  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  const draft = await PrescriptionDraft.findById(id)
    .populate('patientId', 'fullName email phoneNumber dateOfBirth gender')
    .populate('hospitalId', 'name address')
    .populate('specialtyId', 'name')
    .populate({
      path: 'doctorId',
      select: 'title user specialtyId',
      populate: [
        {
          path: 'user',
          select: 'fullName'
        },
        {
          path: 'specialtyId',
          select: 'name'
        }
      ]
    })
    .populate('medications.medicationId', 'name unitTypeDisplay unitPrice stockQuantity')
    .lean();

  if (!draft) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc nháp'
    });
  }

  // Kiểm tra quyền: bác sĩ chỉ có thể xem đơn thuốc được gán cho mình hoặc thuộc bệnh viện và chuyên khoa của mình
  const canView = 
    (draft.doctorId && draft.doctorId._id?.toString() === doctor._id.toString()) ||
    (draft.hospitalId && draft.hospitalId._id?.toString() === doctor.hospitalId.toString() &&
     draft.specialtyId && draft.specialtyId._id?.toString() === doctor.specialtyId.toString());

  if (!canView) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xem đơn thuốc nháp này'
    });
  }

  res.json({
    success: true,
    data: draft
  });
});

// Approve prescription draft (create Prescription from Draft)
exports.approvePrescriptionDraft = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, medications } = req.body; // medications có thể được chỉnh sửa
  const doctorUserId = req.user.id;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const doctor = await Doctor.findOne({ user: doctorUserId }).session(session);
    if (!doctor) {
      throw new Error('Không tìm thấy thông tin bác sĩ');
    }

    // Load draft với session
    const draft = await PrescriptionDraft.findById(id).session(session);
    if (!draft) {
      throw new Error('Không tìm thấy đơn thuốc nháp');
    }

    // Kiểm tra quyền
    const canApprove = 
      (draft.doctorId && draft.doctorId.toString() === doctor._id.toString()) ||
      (draft.hospitalId && draft.hospitalId.toString() === doctor.hospitalId.toString() &&
       draft.specialtyId && draft.specialtyId.toString() === doctor.specialtyId.toString());

    if (!canApprove) {
      throw new Error('Bạn không có quyền duyệt đơn thuốc nháp này');
    }

    // Kiểm tra status
    if (draft.status !== 'pending_approval') {
      throw new Error(`Không thể duyệt đơn thuốc ở trạng thái '${draft.status}'. Chỉ có thể duyệt đơn thuốc ở trạng thái 'pending_approval'.`);
    }

    // Validate medications từ draft hoặc từ request body
    const finalMedications = medications || draft.medications;
    if (!finalMedications || finalMedications.length === 0) {
      throw new Error('Đơn thuốc phải có ít nhất 1 loại thuốc');
    }

    // Validate stock và tính tổng tiền
    let totalAmount = 0;
    const medicationData = [];

    for (const med of finalMedications) {
      const medicationId = med.medicationId || med.medicationId?._id || med.medicationId?.toString();
      const medication = await Medication.findById(medicationId).session(session);
      
      if (!medication) {
        throw new Error(`Không tìm thấy thuốc với ID: ${medicationId}`);
      }

      if (!medication.isActive) {
        throw new Error(`Thuốc ${medication.name} hiện không khả dụng`);
      }

      // Validate medication thuộc đúng bệnh viện
      const medicationHospitalId = medication.hospitalId?._id || medication.hospitalId;
      if (medicationHospitalId.toString() !== draft.hospitalId.toString()) {
        throw new Error(`Thuốc ${medication.name} không thuộc chi nhánh của đơn thuốc`);
      }

      // Check stock
      const quantity = med.quantity || 1;
      if (medication.stockQuantity < quantity) {
        throw new Error(`Thuốc ${medication.name} không đủ số lượng trong kho. Hiện có: ${medication.stockQuantity}, yêu cầu: ${quantity}`);
      }

      const unitPrice = medication.unitPrice || 0;
      const totalPrice = unitPrice * quantity;

      medicationData.push({
        medicationId: medication._id,
        medicationName: medication.name,
        quantity,
        dosage: med.dosage || 'Theo chỉ định của bác sĩ',
        usage: med.usage || 'Uống sau bữa ăn',
        duration: med.duration || '7 ngày',
        unitPrice,
        totalPrice,
        notes: med.notes || ''
      });

      totalAmount += totalPrice;
    }

    // Tạo Prescription từ Draft (KHÔNG tạo appointment ảo - đơn thuốc từ AI tách riêng khỏi hệ thống đặt lịch)
    const prescription = new Prescription({
      // appointmentId: null - đơn thuốc từ AI không cần appointment
      patientId: draft.patientId,
      doctorId: doctor._id,
      hospitalId: draft.hospitalId, // Thêm hospitalId từ draft
      medications: medicationData,
      diagnosis: draft.diagnosis || draft.symptom,
      notes: notes || draft.note,
      totalAmount,
      status: 'approved',
      prescriptionOrder: 1,
      isHospitalization: false,
      createdFromDraft: true,
      draftId: draft._id
    });

    await prescription.save({ session });

    // Cập nhật stock
    for (const med of medicationData) {
      const medication = await Medication.findById(med.medicationId).session(session);
      medication.stockQuantity -= med.quantity;
      await medication.save({ session });
    }

    // Cập nhật draft status
    draft.status = 'approved';
    draft.approvedBy = doctorUserId;
    draft.approvedByRole = 'doctor';
    draft.approvedAt = new Date();
    await draft.save({ session });

    await session.commitTransaction();

    // Populate và trả về
    const populatedPrescription = await Prescription.findById(prescription._id)
      .populate('patientId', 'fullName email phoneNumber')
      .populate({
        path: 'doctorId',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      })
      .populate('medications.medicationId', 'name unitTypeDisplay')
      .lean();

    res.json({
      success: true,
      message: 'Đã duyệt đơn thuốc nháp thành công',
      data: populatedPrescription
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Approve prescription draft error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Không thể duyệt đơn thuốc nháp'
    });
  } finally {
    session.endSession();
  }
});

// Reject prescription draft
exports.rejectPrescriptionDraft = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const doctorUserId = req.user.id;

  const doctor = await Doctor.findOne({ user: doctorUserId });
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  const draft = await PrescriptionDraft.findById(id);
  if (!draft) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc nháp'
    });
  }

  // Kiểm tra quyền
  const canReject = 
    (draft.doctorId && draft.doctorId.toString() === doctor._id.toString()) ||
    (draft.hospitalId && draft.hospitalId.toString() === doctor.hospitalId.toString() &&
     draft.specialtyId && draft.specialtyId.toString() === doctor.specialtyId.toString());

  if (!canReject) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền từ chối đơn thuốc nháp này'
    });
  }

  // Kiểm tra status
  if (draft.status !== 'pending_approval') {
    return res.status(400).json({
      success: false,
      message: `Không thể từ chối đơn thuốc ở trạng thái '${draft.status}'. Chỉ có thể từ chối đơn thuốc ở trạng thái 'pending_approval'.`
    });
  }

  // Cập nhật status
  draft.status = 'rejected';
  draft.approvedBy = doctorUserId;
  draft.approvedByRole = 'doctor';
  draft.approvedAt = new Date();
  if (reason) {
    draft.note = (draft.note ? draft.note + '\n' : '') + `Lý do từ chối: ${reason}`;
  }
  await draft.save();

  res.json({
    success: true,
    message: 'Đã từ chối đơn thuốc nháp thành công',
    data: draft
  });
});

