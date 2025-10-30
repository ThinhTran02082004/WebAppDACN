const Prescription = require('../models/Prescription');
const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const Medication = require('../models/Medication');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../middlewares/async');
const mongoose = require('mongoose');

// Create new prescription
exports.createPrescription = asyncHandler(async (req, res) => {
  const { appointmentId, medications, templateId, notes, diagnosis } = req.body;
  const userId = req.user.id;

  // Find doctor
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  // Validate appointment
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy lịch hẹn'
    });
  }

  // Check if doctor owns this appointment
  if (appointment.doctorId.toString() !== doctor._id.toString()) {
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

    // Create prescription
    const prescription = await Prescription.create([{
      appointmentId,
      patientId: appointment.patientId,
      doctorId: doctor._id,
      medications: medicationData,
      templateId: templateId || undefined,
      templateName,
      notes,
      diagnosis,
      status: 'pending'
    }], { session });

    await session.commitTransaction();

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
    .populate('cancelledBy', 'fullName');

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
  const { medications } = req.body;

  if (!medications || medications.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Danh sách thuốc không được để trống'
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

    const isAvailable = medication.stockQuantity >= med.quantity;
    
    stockValidation.push({
      medicationId: med.medicationId,
      medicationName: medication.name,
      requestedQuantity: med.quantity,
      availableStock: medication.stockQuantity,
      available: isAvailable,
      unitTypeDisplay: medication.unitTypeDisplay
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

