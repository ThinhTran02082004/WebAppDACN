const Hospitalization = require('../models/Hospitalization');
const InpatientRoom = require('../models/InpatientRoom');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../middlewares/async');
const mongoose = require('mongoose');

// Assign inpatient room to patient
exports.assignInpatientRoom = asyncHandler(async (req, res) => {
  const { appointmentId, inpatientRoomId, admissionReason, notes } = req.body;
  const userId = req.user.id;

  // Find doctor
  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate appointment
    const appointment = await Appointment.findById(appointmentId).session(session);
    if (!appointment) {
      throw new Error('Không tìm thấy lịch hẹn');
    }

    if (appointment.doctorId.toString() !== doctor._id.toString()) {
      throw new Error('Bạn không có quyền phân phòng cho lịch hẹn này');
    }

    // Check if already hospitalized
    if (appointment.hospitalizationId) {
      throw new Error('Bệnh nhân đã được phân phòng nội trú');
    }

    // Validate and occupy room
    const room = await InpatientRoom.findById(inpatientRoomId).session(session);
    if (!room) {
      throw new Error('Không tìm thấy phòng');
    }

    // Check detailed availability reasons
    if (!room.isActive) {
      throw new Error('Phòng đang bị vô hiệu hóa (isActive: false). Vui lòng chọn phòng khác.');
    }

    if (room.status !== 'available') {
      const statusMessages = {
        'occupied': 'Phòng đã đầy',
        'maintenance': 'Phòng đang bảo trì',
        'cleaning': 'Phòng đang được vệ sinh'
      };
      throw new Error(`Phòng không khả dụng: ${statusMessages[room.status] || room.status}. Vui lòng chọn phòng khác.`);
    }

    if (room.currentOccupancy >= room.capacity) {
      throw new Error('Phòng đã đầy. Vui lòng chọn phòng khác.');
    }

    if (!room.canAccommodate(1)) {
      throw new Error('Phòng không khả dụng hoặc đã đầy');
    }

    if (appointment.hospitalId && room.hospitalId.toString() !== appointment.hospitalId.toString()) {
      throw new Error('Phong khong thuoc chi nhanh cua lich hen');
    }

    await room.occupy(1);

    // Create hospitalization record
    const hospitalization = await Hospitalization.create([{
      appointmentId,
      patientId: appointment.patientId,
      doctorId: doctor._id,
      inpatientRoomId,
      admissionDate: new Date(),
      hourlyRate: room.hourlyRate,
      status: 'admitted',
      admissionReason,
      notes,
      roomHistory: [{
        inpatientRoomId,
        roomNumber: room.roomNumber,
        roomType: room.type,
        checkInTime: new Date(),
        hourlyRate: room.hourlyRate
      }]
    }], { session });

    // Update appointment
    appointment.hospitalizationId = hospitalization[0]._id;
    appointment.status = 'hospitalized';
    await appointment.save({ session });

    await session.commitTransaction();

    // Emit real-time update
    if (global.io) {
      global.io.to('inventory_updates').emit('room_occupied', {
        roomId: room._id,
        roomNumber: room.roomNumber,
        status: room.status,
        currentOccupancy: room.currentOccupancy
      });
    }

    const populatedHospitalization = await Hospitalization.findById(hospitalization[0]._id)
      .populate('inpatientRoomId', 'roomNumber type floor hourlyRate')
      .populate('patientId', 'fullName email phoneNumber')
      .populate('doctorId', 'title')
      .populate({
        path: 'doctorId',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      });

    res.status(201).json({
      success: true,
      message: 'Phân phòng nội trú thành công',
      data: populatedHospitalization
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error assigning room:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể phân phòng nội trú'
    });
  } finally {
    session.endSession();
  }
});

// Transfer to another room
exports.transferRoom = asyncHandler(async (req, res) => {
  const { hospitalizationId } = req.params;
  const { newRoomId, reason } = req.body;
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const hospitalization = await Hospitalization.findById(hospitalizationId).session(session);
    if (!hospitalization) {
      throw new Error('Không tìm thấy thông tin nằm viện');
    }

    if (hospitalization.status === 'discharged') {
      throw new Error('Bệnh nhân đã xuất viện, không thể chuyển phòng');
    }

    // Get old and new rooms
    const oldRoom = await InpatientRoom.findById(hospitalization.inpatientRoomId).session(session);
    const newRoom = await InpatientRoom.findById(newRoomId).session(session);

    if (!newRoom) {
      throw new Error('Không tìm thấy phòng mới');
    }

    if (!newRoom.canAccommodate(1)) {
      throw new Error('Phòng mới không khả dụng');
    }


    const appointmentDoc = await Appointment.findById(hospitalization.appointmentId).session(session);
    if (!appointmentDoc) {
      throw new Error('Khong tim thay lich hen lien quan');
    }

    if (appointmentDoc.hospitalId && newRoom.hospitalId.toString() !== appointmentDoc.hospitalId.toString()) {
      throw new Error('Phong moi khong thuoc chi nhanh cua lich hen');
    }

    // Release old room
    if (oldRoom) {
      await oldRoom.release(1);
    }

    // Occupy new room
    await newRoom.occupy(1);

    // Update hospitalization
    await hospitalization.transferRoom(newRoomId, newRoom.hourlyRate);

    // Calculate current cost from roomHistory and update Bill
    const currentHours = hospitalization.roomHistory.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    const currentAmount = hospitalization.roomHistory.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    
    // Update Bill with current hospitalization cost (even if not discharged yet)
    const Bill = require('../models/Bill');
    if (appointmentDoc) {
      let bill = await Bill.findOne({ appointmentId: appointmentDoc._id }).session(session);
      
      if (!bill) {
        // Create bill if not exists
        bill = await Bill.create([{
          appointmentId: appointmentDoc._id,
          patientId: appointmentDoc.patientId,
          consultationBill: {
            amount: appointmentDoc.fee?.totalAmount || 0,
            status: 'pending'
          },
          hospitalizationBill: {
            hospitalizationId: hospitalization._id,
            amount: currentAmount,
            status: 'pending'
          }
        }], { session });
        bill = bill[0];
      } else {
        // Update hospitalization bill amount
        bill.hospitalizationBill.hospitalizationId = hospitalization._id;
        bill.hospitalizationBill.amount = currentAmount;
        await bill.save({ session });
      }
    }

    await session.commitTransaction();

    // Emit real-time updates
    if (global.io) {
      if (oldRoom) {
        global.io.to('inventory_updates').emit('room_available', {
          roomId: oldRoom._id,
          roomNumber: oldRoom.roomNumber,
          status: oldRoom.status,
          currentOccupancy: oldRoom.currentOccupancy
        });
      }
      global.io.to('inventory_updates').emit('room_occupied', {
        roomId: newRoom._id,
        roomNumber: newRoom.roomNumber,
        status: newRoom.status,
        currentOccupancy: newRoom.currentOccupancy
      });
    }

    const updatedHospitalizationPopulated = await Hospitalization.findById(hospitalizationId)
      .populate('inpatientRoomId', 'roomNumber type floor hourlyRate')
      .populate('roomHistory.inpatientRoomId', 'roomNumber type');

    res.json({
      success: true,
      message: 'Chuyển phòng thành công',
      data: updatedHospitalizationPopulated
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error transferring room:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể chuyển phòng'
    });
  } finally {
    session.endSession();
  }
});

// Discharge patient
exports.dischargePatient = asyncHandler(async (req, res) => {
  const { hospitalizationId } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const hospitalization = await Hospitalization.findById(hospitalizationId)
      .populate('inpatientRoomId')
      .session(session);

    if (!hospitalization) {
      throw new Error('Không tìm thấy thông tin nằm viện');
    }

    if (hospitalization.status === 'discharged') {
      throw new Error('Bệnh nhân đã được xuất viện');
    }

    // Release room
    const room = await InpatientRoom.findById(hospitalization.inpatientRoomId).session(session);
    if (room) {
      await room.release(1);
    }

    // Close current room history entry before discharge
    if (hospitalization.roomHistory.length > 0) {
      const currentEntry = hospitalization.roomHistory[hospitalization.roomHistory.length - 1];
      if (!currentEntry.checkOutTime) {
        currentEntry.checkOutTime = new Date();
        const checkInTime = new Date(currentEntry.checkInTime);
        const diffMs = currentEntry.checkOutTime - checkInTime;
        currentEntry.hours = Math.ceil(diffMs / (1000 * 60 * 60));
        currentEntry.amount = currentEntry.hours * currentEntry.hourlyRate;
      }
    }
    
    // Calculate total cost from roomHistory
    hospitalization.totalHours = hospitalization.roomHistory.reduce((sum, entry) => sum + (entry.hours || 0), 0);
    hospitalization.totalAmount = hospitalization.roomHistory.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    
    // Discharge patient
    await hospitalization.discharge(doctor._id, reason);

    // Update appointment status (không set completed, chỉ remove hospitalized)
    const appointment = await Appointment.findById(hospitalization.appointmentId).session(session);
    if (appointment) {
      // Chỉ cập nhật status nếu đang hospitalized
      if (appointment.status === 'hospitalized') {
        appointment.status = 'pending_payment'; // Chờ thanh toán, không complete ngay
      }
      await appointment.save({ session });
    }
    
    // Update Bill with hospitalization cost (finalize amount for payment after discharge)
    const Bill = require('../models/Bill');
    let bill = await Bill.findOne({ appointmentId: hospitalization.appointmentId }).session(session);
    
    if (!bill) {
      // Tạo bill nếu chưa có
      bill = await Bill.create([{
        appointmentId: hospitalization.appointmentId,
        patientId: appointment.patientId,
        consultationBill: {
          amount: appointment.fee?.totalAmount || 0,
          status: 'pending'
        },
        hospitalizationBill: {
          hospitalizationId: hospitalization._id,
          amount: hospitalization.totalAmount,
          status: 'pending'
        }
      }], { session });
      bill = bill[0];
    } else {
      // Cập nhật hospitalization bill amount
      bill.hospitalizationBill.hospitalizationId = hospitalization._id;
      bill.hospitalizationBill.amount = hospitalization.totalAmount;
      await bill.save({ session });
    }

    await session.commitTransaction();

    // Emit real-time update
    if (global.io && room) {
      global.io.to('inventory_updates').emit('room_available', {
        roomId: room._id,
        roomNumber: room.roomNumber,
        status: room.status,
        currentOccupancy: room.currentOccupancy
      });
    }

    const dischargedHospitalization = await Hospitalization.findById(hospitalizationId)
      .populate('inpatientRoomId', 'roomNumber type floor')
      .populate('patientId', 'fullName email phoneNumber')
      .populate('doctorId', 'title')
      .populate({
        path: 'doctorId',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      })
      .populate('dischargedBy', 'title')
      .populate({
        path: 'dischargedBy',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      })
      .populate('roomHistory.inpatientRoomId', 'roomNumber type');

    res.json({
      success: true,
      message: 'Xuất viện thành công',
      data: dischargedHospitalization
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error discharging patient:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể xuất viện'
    });
  } finally {
    session.endSession();
  }
});

// Get available rooms
exports.getAvailableRooms = asyncHandler(async (req, res) => {
  const { type, floor, hospitalId: hospitalIdQuery } = req.query;

  let hospitalId = hospitalIdQuery;

  if (!hospitalId && req.user) {
    const role = req.user.roleType || req.user.role;
    if (role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user.id }).select('hospitalId');
      hospitalId = doctor?.hospitalId;
    } else if (role === 'admin' && req.user.hospitalId) {
      hospitalId = req.user.hospitalId;
    }
  }

  if (!hospitalId) {
    return res.status(400).json({
      success: false,
      message: 'Chi nhanh benh vien la bat buoc'
    });
  }

  const query = {
    isActive: true,
    status: 'available',
    hospitalId,
    $expr: { $lt: ['$currentOccupancy', '$capacity'] }
  };

  if (type) {
    query.type = type;
  }

  if (floor) {
    query.floor = floor;
  }

  const rooms = await InpatientRoom.find(query)
    .select('roomNumber roomName type floor hourlyRate capacity currentOccupancy amenities equipment')
    .sort({ type: 1, roomNumber: 1 });

  res.json({
    success: true,
    data: rooms,
    count: rooms.length
  });
});
// Get hospitalization by appointment
exports.getHospitalizationByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  const hospitalization = await Hospitalization.findOne({ appointmentId })
    .populate('inpatientRoomId', 'roomNumber type floor hourlyRate amenities')
    .populate('patientId', 'fullName email phoneNumber dateOfBirth gender')
    .populate('doctorId', 'title')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('dischargedBy', 'title')
    .populate({
      path: 'dischargedBy',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('roomHistory.inpatientRoomId', 'roomNumber type hourlyRate');

  if (!hospitalization) {
    return res.json({
      success: true,
      data: null,
      message: 'Bệnh nhân chưa được phân phòng nội trú'
    });
  }

  // Calculate current duration/cost (current room) and cumulative totals if not discharged
  let currentInfo = null;
  if (hospitalization.status !== 'discharged') {
    const history = hospitalization.roomHistory || [];
    const latestEntry = history.length > 0 ? history[history.length - 1] : null;

    const now = new Date();
    const currentRoomStart = latestEntry?.checkInTime ? new Date(latestEntry.checkInTime) : new Date(hospitalization.admissionDate);
    const currentRate = latestEntry?.hourlyRate || hospitalization.hourlyRate || 0;

    const currentRoomHours = Math.max(0, Math.ceil((now - currentRoomStart) / (1000 * 60 * 60)));
    const currentRoomCost = currentRoomHours * currentRate;

    const finalizedEntries = history.filter(e => !!e.checkOutTime);
    const finalizedHours = finalizedEntries.reduce((s, e) => s + (e.hours || 0), 0);
    const finalizedAmount = finalizedEntries.reduce((s, e) => s + (e.amount || 0), 0);

    currentInfo = {
      currentHours: currentRoomHours, // backward compatibility
      currentCost: currentRoomCost,   // backward compatibility
      currentRoomStart,
      currentRoomHours,
      currentRoomCost,
      totalSoFarHours: finalizedHours + currentRoomHours,
      totalSoFarAmount: finalizedAmount + currentRoomCost
    };
  }

  res.json({
    success: true,
    data: {
      ...hospitalization.toObject(),
      currentInfo
    }
  });
});

// Get patient hospitalizations
exports.getPatientHospitalizations = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;

  const query = { patientId };

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const hospitalizations = await Hospitalization.find(query)
    .populate('inpatientRoomId', 'roomNumber type')
    .populate('appointmentId', 'appointmentDate bookingCode')
    .populate('doctorId', 'title')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .sort({ admissionDate: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await Hospitalization.countDocuments(query);

  res.json({
    success: true,
    data: hospitalizations,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get hospitalization details
exports.getHospitalizationDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hospitalization = await Hospitalization.findById(id)
    .populate('inpatientRoomId', 'roomNumber roomName type floor hourlyRate amenities equipment')
    .populate('appointmentId')
    .populate('patientId', 'fullName email phoneNumber dateOfBirth gender address')
    .populate('doctorId', 'title specialtyId')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate('dischargedBy', 'title')
    .populate({
      path: 'dischargedBy',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('roomHistory.inpatientRoomId', 'roomNumber type hourlyRate');

  if (!hospitalization) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin nằm viện'
    });
  }

  // Calculate current info if not discharged (current room + cumulative totals)
  let currentInfo = null;
  if (hospitalization.status !== 'discharged') {
    const history = hospitalization.roomHistory || [];
    const latestEntry = history.length > 0 ? history[history.length - 1] : null;

    const now = new Date();
    const currentRoomStart = latestEntry?.checkInTime ? new Date(latestEntry.checkInTime) : new Date(hospitalization.admissionDate);
    const currentRate = latestEntry?.hourlyRate || hospitalization.hourlyRate || 0;

    const currentRoomHours = Math.max(0, Math.ceil((now - currentRoomStart) / (1000 * 60 * 60)));
    const currentRoomCost = currentRoomHours * currentRate;

    const finalizedEntries = history.filter(e => !!e.checkOutTime);
    const finalizedHours = finalizedEntries.reduce((s, e) => s + (e.hours || 0), 0);
    const finalizedAmount = finalizedEntries.reduce((s, e) => s + (e.amount || 0), 0);

    currentInfo = {
      currentHours: currentRoomHours,
      currentCost: currentRoomCost,
      currentRoomStart,
      currentRoomHours,
      currentRoomCost,
      totalSoFarHours: finalizedHours + currentRoomHours,
      totalSoFarAmount: finalizedAmount + currentRoomCost
    };
  }

  res.json({
    success: true,
    data: {
      ...hospitalization.toObject(),
      currentInfo
    }
  });
});


