const InpatientRoom = require('../models/InpatientRoom');
const asyncHandler = require('../middlewares/async');

// List all inpatient rooms
exports.listRooms = asyncHandler(async (req, res) => {
  const { type, floor, status, available, hospitalId, page = 1, limit = 50 } = req.query;

  const query = { isActive: true };

  if (type) {
    query.type = type;
  }

  if (floor) {
    query.floor = floor;
  }

  if (status) {
    query.status = status;
  }

  if (hospitalId) {
    query.hospitalId = hospitalId;
  }

  // Filter by availability
  if (available === 'true') {
    query.$expr = { $lt: ['$currentOccupancy', '$capacity'] };
  }

  const skip = (page - 1) * limit;

  const rooms = await InpatientRoom.find(query)
    .populate('hospitalId', 'name address')
    .sort({ type: 1, floor: 1, roomNumber: 1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await InpatientRoom.countDocuments(query);

  // Add availability info
  const roomsWithAvailability = rooms.map(room => ({
    ...room.toObject(),
    isAvailable: room.canAccommodate(1),
    availableCapacity: room.capacity - room.currentOccupancy
  }));

  res.json({
    success: true,
    data: roomsWithAvailability,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Create new inpatient room (admin only)
exports.createRoom = asyncHandler(async (req, res) => {
  const {
    roomNumber,
    roomName,
    floor,
    type,
    hourlyRate,
    capacity,
    amenities,
    equipment,
    description,
    hospitalId
  } = req.body;

  const userRole = req.user.roleType || req.user.role;

  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin mới có quyền tạo phòng nội trú'
    });
  }

  // Get hospitalId: from request body or from first hospital in system
  let roomHospitalId = hospitalId;
  
  if (!roomHospitalId) {
    // If no hospitalId provided, get the first hospital
    const Hospital = require('../models/Hospital');
    const firstHospital = await Hospital.findOne().sort({ createdAt: 1 });
    
    if (!firstHospital) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tạo bệnh viện trước khi tạo phòng nội trú'
      });
    }
    
    roomHospitalId = firstHospital._id;
  }

  try {
    const room = await InpatientRoom.create({
      roomNumber,
      roomName,
      floor,
      type,
      hourlyRate,
      capacity: capacity || 1,
      amenities: amenities || [],
      equipment: equipment || [],
      description,
      hospitalId: roomHospitalId,
      status: 'available',
      currentOccupancy: 0
    });

    res.status(201).json({
      success: true,
      message: 'Tạo phòng nội trú thành công',
      data: room
    });
  } catch (error) {
    console.error('Error creating room:', error);
    // Handle duplicate key error (e.g., unique index on hospitalId + roomNumber)
    if (error && (error.code === 11000 || error.name === 'MongoServerError')) {
      const duplicateKey = error?.keyValue?.roomNumber || error?.keyValue?.hospitalId;
      return res.status(409).json({
        success: false,
        message:
          duplicateKey
            ? `Số phòng "${duplicateKey}" đã tồn tại trong bệnh viện này. Vui lòng chọn số phòng khác.`
            : 'Số phòng đã tồn tại trong bệnh viện này. Vui lòng chọn số phòng khác.'
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Không thể tạo phòng nội trú'
    });
  }
});

// Update inpatient room (admin only)
exports.updateRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    roomNumber,
    roomName,
    floor,
    type,
    hourlyRate,
    capacity,
    amenities,
    equipment,
    description,
    status,
    isActive
  } = req.body;

  const userRole = req.user.roleType || req.user.role;

  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin mới có quyền cập nhật phòng nội trú'
    });
  }

  const room = await InpatientRoom.findById(id);

  if (!room) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy phòng'
    });
  }

  // Update fields
  if (roomNumber) room.roomNumber = roomNumber;
  if (roomName !== undefined) room.roomName = roomName;
  if (floor !== undefined) room.floor = floor;
  if (type) room.type = type;
  if (hourlyRate !== undefined) room.hourlyRate = hourlyRate;
  if (capacity !== undefined) {
    // Ensure new capacity is not less than current occupancy
    if (capacity < room.currentOccupancy) {
      return res.status(400).json({
        success: false,
        message: 'Sức chứa mới không thể nhỏ hơn số bệnh nhân hiện tại'
      });
    }
    room.capacity = capacity;
  }
  if (amenities !== undefined) room.amenities = amenities;
  if (equipment !== undefined) room.equipment = equipment;
  if (description !== undefined) room.description = description;
  if (status) room.status = status;
  if (isActive !== undefined) room.isActive = isActive;

  await room.save();

  // Emit real-time update
  if (global.io) {
    global.io.to('inventory_updates').emit('room_updated', {
      roomId: room._id,
      roomNumber: room.roomNumber,
      status: room.status,
      isActive: room.isActive,
      currentOccupancy: room.currentOccupancy,
      capacity: room.capacity
    });
  }

  res.json({
    success: true,
    message: 'Cập nhật phòng thành công',
    data: room
  });
});

// Delete inpatient room (soft delete - admin only)
exports.deleteRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const userRole = req.user.roleType || req.user.role;

  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin mới có quyền xóa phòng nội trú'
    });
  }

  const room = await InpatientRoom.findById(id);

  if (!room) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy phòng'
    });
  }

  // Cannot delete if room is occupied
  if (room.currentOccupancy > 0) {
    return res.status(400).json({
      success: false,
      message: 'Không thể xóa phòng đang có bệnh nhân'
    });
  }

  room.isActive = false;
  room.status = 'maintenance';
  await room.save();

  res.json({
    success: true,
    message: 'Xóa phòng thành công'
  });
});

// Get room status (real-time)
exports.getRoomStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const room = await InpatientRoom.findById(id)
    .populate('hospitalId', 'name');

  if (!room) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy phòng'
    });
  }

  res.json({
    success: true,
    data: {
      _id: room._id,
      roomNumber: room.roomNumber,
      roomName: room.roomName,
      type: room.type,
      floor: room.floor,
      status: room.status,
      currentOccupancy: room.currentOccupancy,
      capacity: room.capacity,
      availableCapacity: room.capacity - room.currentOccupancy,
      isAvailable: room.canAccommodate(1),
      hourlyRate: room.hourlyRate,
      amenities: room.amenities,
      equipment: room.equipment
    }
  });
});

// Get room statistics
exports.getRoomStatistics = asyncHandler(async (req, res) => {
  const stats = await InpatientRoom.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$type',
        totalRooms: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        currentOccupancy: { $sum: '$currentOccupancy' },
        availableRooms: {
          $sum: {
            $cond: [
              { $lt: ['$currentOccupancy', '$capacity'] },
              1,
              0
            ]
          }
        },
        averageRate: { $avg: '$hourlyRate' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Get overall stats
  const overall = await InpatientRoom.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalRooms: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        currentOccupancy: { $sum: '$currentOccupancy' },
        occupiedRooms: {
          $sum: {
            $cond: [
              { $gte: ['$currentOccupancy', '$capacity'] },
              1,
              0
            ]
          }
        },
        availableRooms: {
          $sum: {
            $cond: [
              { $lt: ['$currentOccupancy', '$capacity'] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      byType: stats,
      overall: overall[0] || {
        totalRooms: 0,
        totalCapacity: 0,
        currentOccupancy: 0,
        occupiedRooms: 0,
        availableRooms: 0
      }
    }
  });
});
