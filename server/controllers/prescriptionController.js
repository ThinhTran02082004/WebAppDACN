const Prescription = require('../models/Prescription');
const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const Medication = require('../models/Medication');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const MedicalRecord = require('../models/MedicalRecord');
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

// Get user prescription history (for MedicalHistory page)
exports.getUserPrescriptionHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status } = req.query;

  const query = { patientId: userId };
  
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const prescriptions = await Prescription.find(query)
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
    .limit(limit * 1)
    .skip(skip);

  const total = await Prescription.countDocuments(query);

  // Group by appointment for display
  const groupedByAppointment = {};
  prescriptions.forEach(prescription => {
    const appointmentId = prescription.appointmentId?._id?.toString() || 'unknown';
    if (!groupedByAppointment[appointmentId]) {
      groupedByAppointment[appointmentId] = {
        appointmentId: prescription.appointmentId?._id,
        appointmentDate: prescription.appointmentId?.appointmentDate,
        bookingCode: prescription.appointmentId?.bookingCode,
        specialty: prescription.appointmentId?.specialtyId?.name || prescription.doctorId?.specialtyId?.name,
        doctor: prescription.doctorId?.user?.fullName || 'Không xác định',
        prescriptions: []
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
      medicationsCount: prescription.medications.length
    });
  });

  res.json({
    success: true,
    records: Object.values(groupedByAppointment),
    pagination: {
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
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

  // Get pharmacist's hospitalId
  const User = require('../models/User');
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

// Verify prescription (pharmacist approval)
exports.verifyPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const userId = req.user.id;
  const mongoose = require('mongoose');

  // Get pharmacist's hospitalId
  const User = require('../models/User');
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
    // Reload prescription with session for transaction and optimistic locking
    const prescription = await Prescription.findById(id).session(session);

    if (!prescription) {
      throw new Error('Không tìm thấy đơn thuốc');
    }

    // Validate pharmacist's hospitalId matches prescription's hospitalId
    if (prescription.hospitalId.toString() !== pharmacist.hospitalId.toString()) {
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

  // Get pharmacist's hospitalId
  const User = require('../models/User');
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
    // Reload prescription with session for transaction and optimistic locking
    const prescription = await Prescription.findById(id).session(session);

    if (!prescription) {
      throw new Error('Không tìm thấy đơn thuốc');
    }

    // Validate pharmacist's hospitalId matches prescription's hospitalId
    if (prescription.hospitalId.toString() !== pharmacist.hospitalId.toString()) {
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
  const User = require('../models/User');
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

