const DoctorMeeting = require('../models/DoctorMeeting');
const Doctor = require('../models/Doctor');
const livekitService = require('../services/livekitService');
const asyncHandler = require('../middlewares/async');

const meetingPopulateOptions = [
  {
    path: 'organizer',
    populate: {
      path: 'user',
      select: 'fullName email avatarUrl'
    }
  },
  {
    path: 'createdBy',
    populate: {
      path: 'user',
      select: 'fullName email avatarUrl'
    }
  },
  {
    path: 'hospitals',
    select: 'name address'
  },
  {
    path: 'primaryHospital',
    select: 'name address'
  },
  {
    path: 'participants.doctorId',
    populate: {
      path: 'user',
      select: 'fullName avatarUrl'
    }
  }
];

const resolveId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  if (value.toString) return value.toString();
  return null;
};

const normalizeHospitalEntry = (hospital) => {
  if (!hospital) return hospital;
  if (typeof hospital === 'string') {
    return hospital;
  }
  if (hospital._id) {
    return {
      ...hospital,
      _id: hospital._id.toString()
    };
  }
  return hospital;
};

const buildMeetingPayload = async (meetingOrId) => {
  if (!meetingOrId) return null;

  let meetingData = meetingOrId;

  if (meetingData && typeof meetingData.toObject === 'function') {
    await meetingData.populate(meetingPopulateOptions);
    meetingData = meetingData.toObject();
  } else if (meetingData && typeof meetingData === 'object' && meetingData._id) {
    const hasHospitalDetails =
      Array.isArray(meetingData.hospitals) &&
      meetingData.hospitals.some(
        (hospital) => hospital && typeof hospital === 'object' && hospital.name
      );

    if (!hasHospitalDetails) {
      meetingData = await DoctorMeeting.findById(meetingData._id)
        .populate(meetingPopulateOptions)
        .lean();
    } else {
      meetingData = { ...meetingData };
    }
  } else {
    meetingData = await DoctorMeeting.findById(meetingOrId)
      .populate(meetingPopulateOptions)
      .lean();
  }

  if (!meetingData) return null;

  const normalizedHospitals = Array.isArray(meetingData.hospitals)
    ? meetingData.hospitals.map(normalizeHospitalEntry)
    : [];

  const hospitalIds = normalizedHospitals
    .map(resolveId)
    .filter(Boolean);

  const normalizedPrimaryHospital = meetingData.primaryHospital
    ? normalizeHospitalEntry(meetingData.primaryHospital)
    : null;

  const participants = Array.isArray(meetingData.participants)
    ? meetingData.participants
    : [];

  const meetingId = resolveId(meetingData._id) || meetingData._id;

  return {
    ...meetingData,
    _id: meetingId,
    hospitals: normalizedHospitals,
    primaryHospital: normalizedPrimaryHospital,
    hospitalIds,
    primaryHospitalId: resolveId(normalizedPrimaryHospital),
    participants,
    activeParticipantCount: participants.filter((participant) => !participant.leftAt).length
  };
};

const broadcastMeetingEvent = (eventName, meetingPayload, extra = {}, options = {}) => {
  if (!global.io || !meetingPayload) return;

  const payload = { ...extra, meeting: meetingPayload };
  const meetingId = resolveId(meetingPayload._id);

  // Emit to meeting room (participants who are in video call)
  if (meetingId) {
    global.io.to(`meeting:${meetingId}`).emit(eventName, payload);
  }

  // Emit to hospital rooms (for general meeting updates)
  // Skip if onlyParticipants is true (e.g., when ending meeting)
  if (!options.onlyParticipants && Array.isArray(meetingPayload.hospitalIds)) {
    meetingPayload.hospitalIds.forEach((hospitalId) => {
      if (hospitalId) {
        global.io.to(`hospital:${hospitalId}`).emit(eventName, payload);
      }
    });
  }

  // Emit to individual participants via their personal rooms
  if (options.onlyParticipants && Array.isArray(meetingPayload.participants)) {
    meetingPayload.participants.forEach((participant) => {
      const doctorId = resolveId(participant.doctorId);
      if (doctorId) {
        // Find user ID from doctor ID and emit to their personal room
        Doctor.findById(doctorId).then(doctor => {
          if (doctor && doctor.user) {
            const userId = resolveId(doctor.user);
            if (userId) {
              global.io.to(userId).emit(eventName, payload);
            }
          }
        }).catch(err => console.error('Error finding doctor for notification:', err));
      }
    });
  }
};

const sendMeetingEvent = async (meetingOrId, eventName, extra = {}) => {
  if (!global.io) return null;
  const meetingPayload = await buildMeetingPayload(meetingOrId);
  if (!meetingPayload) return null;
  broadcastMeetingEvent(eventName, meetingPayload, extra);
  return meetingPayload;
};

const emitMeetingCreated = async (meetingOrId, extra = {}) =>
  sendMeetingEvent(meetingOrId, 'meeting_created', extra);

const emitMeetingUpdated = async (meetingOrId, extra = {}) =>
  sendMeetingEvent(meetingOrId, 'meeting_updated', extra);

const emitMeetingEnded = async (meetingOrId, extra = {}) =>
  sendMeetingEvent(meetingOrId, 'meeting_ended', extra);

// Create a new doctor meeting
exports.createMeeting = asyncHandler(async (req, res) => {
  const { title, description, invitedDoctors, hospitals } = req.body;
  const userId = req.user.id;

  // Find doctor record with hospital info
  const doctor = await Doctor.findOne({ user: userId }).populate('hospitalId');
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  // Validate hospitals array
  if (!hospitals || !Array.isArray(hospitals) || hospitals.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng chọn ít nhất một chi nhánh bệnh viện'
    });
  }

  // Verify doctor's hospital is included in the list
  const doctorHospitalId = doctor.hospitalId._id.toString();
  if (!hospitals.includes(doctorHospitalId)) {
    return res.status(400).json({
      success: false,
      message: 'Danh sách chi nhánh phải bao gồm chi nhánh bác sĩ đang làm việc'
    });
  }

  // Generate unique room name
  const roomName = `meeting_${doctor._id}_${Date.now()}`;

  try {
    // Create meeting record
    const meeting = await DoctorMeeting.create({
      roomName,
      title,
      description,
      createdBy: doctor._id,
      organizer: doctor._id,
      hospitals: hospitals,
      primaryHospital: doctor.hospitalId._id,
      invitedDoctors: invitedDoctors || [],
      status: 'waiting',
      metadata: {
        enableRecording: false,
        enableScreenShare: true,
        enableChat: true
      }
    });

    // Create LiveKit room
    await livekitService.createRoom(roomName, {
      maxParticipants: meeting.maxParticipants,
      emptyTimeout: 3600, // 1 hour
      metadata: {
        meetingId: meeting._id.toString(),
        meetingType: 'internal',
        roomCode: meeting.roomCode,
        organizer: doctor._id.toString()
      }
    });

    // Populate meeting data
    const populatedMeeting = await DoctorMeeting.findById(meeting._id)
      .populate('createdBy', 'title specialtyId hospitalId')
      .populate({
        path: 'createdBy',
        populate: {
          path: 'user',
          select: 'fullName email'
        }
      })
      .populate('hospitals', 'name address')
      .populate('primaryHospital', 'name address');

    const meetingPayload = await buildMeetingPayload(populatedMeeting);
    await emitMeetingCreated(meetingPayload, {
      message: 'Có cuộc họp mới được tạo'
    });

    res.status(201).json({
      success: true,
      message: 'Tạo cuộc họp thành công',
      data: meetingPayload
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo cuộc họp',
      error: error.message
    });
  }
});

// Join meeting by code
exports.joinMeetingByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const userId = req.user.id;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp mã cuộc họp'
    });
  }

  // Find doctor record with hospital info
  const doctor = await Doctor.findOne({ user: userId }).populate('hospitalId');
  if (!doctor) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ bác sĩ mới có thể tham gia cuộc họp nội bộ'
    });
  }

  // Find meeting
  const meeting = await DoctorMeeting.findOne({
    roomCode: code.toUpperCase(),
    status: { $in: ['waiting', 'active'] }
  })
    .populate('organizer')
    .populate({
      path: 'organizer',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    });

  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy cuộc họp hoạt động với mã này'
    });
  }

  // Verify doctor's hospital matches meeting hospitals
  const doctorHospitalId = doctor.hospitalId._id.toString();
  const meetingHospitalIds = meeting.hospitals.map(h => h.toString());
  
  if (!meetingHospitalIds.includes(doctorHospitalId)) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền tham gia cuộc họp này. Cuộc họp chỉ dành cho các bác sĩ thuộc chi nhánh được chọn.'
    });
  }

  // Check if meeting is full
  const activeParticipants = meeting.participants.filter(p => !p.leftAt);
  if (activeParticipants.length >= meeting.maxParticipants) {
    return res.status(400).json({
      success: false,
      message: 'Cuộc họp đã đầy'
    });
  }

  // Generate LiveKit token
  const participantName = `Bác sĩ ${req.user.fullName}`;
  const token = await livekitService.generateToken(
    meeting.roomName,
    participantName,
    userId,
    {
      role: 'doctor',
      doctorId: doctor._id.toString(),
      meetingId: meeting._id.toString()
    }
  );

  // Add participant record
  const existingParticipant = meeting.participants.find(
    p => p.doctorId.toString() === doctor._id.toString() && !p.leftAt
  );

  let meetingPayload;

  if (!existingParticipant) {
    const joinedAt = new Date();
    meeting.participants.push({
      doctorId: doctor._id,
      joinedAt
    });

    if (meeting.status === 'waiting') {
      meeting.status = 'active';
      meeting.startTime = joinedAt;
    }

    await meeting.save();

    meetingPayload = await emitMeetingUpdated(meeting._id, {
      participantJoined: {
        doctorId: doctor._id.toString(),
        doctorName: req.user.fullName,
        joinedAt
      }
    });

    // Emit participant_joined event to meeting and hospital rooms
    if (global.io && meetingPayload) {
      const participantInfo = {
        doctorId: doctor._id,
        doctorName: req.user.fullName,
        joinedAt
      };

      const participantPayload = {
        meetingId: meetingPayload._id,
        participant: participantInfo,
        activeCount: meetingPayload.activeParticipantCount,
        meeting: meetingPayload
      };

      // Broadcast to all relevant rooms
      broadcastMeetingEvent('participant_joined', meetingPayload, participantPayload);
    }
  } else {
    meetingPayload = await buildMeetingPayload(meeting);
  }

  const responseMeetingPayload = meetingPayload || (await buildMeetingPayload(meeting));

  res.json({
    success: true,
    message: 'Tham gia cuộc họp thành công',
    data: {
      token,
      wsUrl: process.env.LIVEKIT_WS_URL,
      roomName: meeting.roomName,
      roomCode: meeting.roomCode,
      meetingId: meeting._id,
      title: meeting.title,
      organizer: meeting.organizer?.user?.fullName || 'N/A',
      hospitals: responseMeetingPayload?.hospitals || [],
      primaryHospital: responseMeetingPayload?.primaryHospital || null,
      hospitalIds: responseMeetingPayload?.hospitalIds || [],
      activeParticipantCount:
        responseMeetingPayload?.activeParticipantCount ??
        meeting.participants.filter(p => !p.leftAt).length
    }
  });
});

// Get my meetings
exports.listMyMeetings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const userId = req.user.id;

  // Find doctor record with hospital info
  const doctor = await Doctor.findOne({ user: userId }).populate('hospitalId');
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thông tin bác sĩ'
    });
  }

  const doctorHospitalId = doctor.hospitalId._id;

  // Build query: meetings at doctor's hospital OR meetings doctor participated in OR created
  const query = {
    $or: [
      // Active meetings at doctor's hospital
      {
        hospitals: doctorHospitalId,
        status: { $in: ['waiting', 'active'] }
      },
      // Ended meetings where doctor participated
      {
        status: 'ended',
        'participants.doctorId': doctor._id
      },
      // Ended meetings created by doctor (even if didn't participate)
      {
        status: 'ended',
        createdBy: doctor._id
      }
    ]
  };

  // Additional status filter if provided
  if (status) {
    // Handle comma-separated statuses (e.g., "active,waiting")
    const statuses = status.split(',').map(s => s.trim());
    
    if (statuses.includes('ended')) {
      // For ended meetings, only show those doctor participated in
      query.$or = [
        {
          status: 'ended',
          'participants.doctorId': doctor._id
        }
      ];
    } else {
      // For active/waiting, show all at doctor's hospital
      query.$or = [
        {
          hospitals: doctorHospitalId,
          status: { $in: statuses }
        }
      ];
    }
  }

  const skip = (page - 1) * limit;

  // Debug logging
  console.log('[listMyMeetings] Doctor:', doctor._id, 'Hospital:', doctorHospitalId);
  console.log('[listMyMeetings] Query:', JSON.stringify(query, null, 2));

  const meetings = await DoctorMeeting.find(query)
    .populate({
      path: 'createdBy',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate({
      path: 'organizer',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate('hospitals', 'name address')
    .populate('primaryHospital', 'name address')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await DoctorMeeting.countDocuments(query);

  // Format meetings with buildMeetingPayload
  const formattedMeetings = await Promise.all(
    meetings.map(meeting => buildMeetingPayload(meeting))
  );

  console.log('[listMyMeetings] Found', formattedMeetings.length, 'meetings');
  formattedMeetings.forEach(m => {
    console.log('  -', m.title, 'Status:', m.status, 'Hospitals:', m.hospitalIds);
  });

  res.json({
    success: true,
    data: formattedMeetings.filter(Boolean),
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// End meeting
exports.endMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const meeting = await DoctorMeeting.findById(id)
    .populate('createdBy')
    .populate('organizer');

  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy cuộc họp'
    });
  }

  // Find doctor record
  const doctor = await Doctor.findOne({ user: userId });

  // Check if user is organizer or admin
  const isOrganizer = meeting.organizer._id.toString() === doctor?._id.toString();
  const isAdmin = req.user.role === 'admin' || req.user.roleType === 'admin';

  if (!isOrganizer && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ người tổ chức hoặc admin mới có thể kết thúc cuộc họp'
    });
  }

  // End meeting
  meeting.status = 'ended';
  meeting.endTime = new Date();
  if (meeting.startTime) {
    meeting.duration = Math.round((meeting.endTime - meeting.startTime) / (1000 * 60));
  }

  // Mark all participants as left
  meeting.participants.forEach(p => {
    if (!p.leftAt) {
      p.leftAt = new Date();
    }
  });

  await meeting.save();

  // Delete LiveKit room
  try {
    await livekitService.deleteRoom(meeting.roomName);
  } catch (error) {
    console.error('Error deleting LiveKit room:', error);
  }

  const meetingPayload = await buildMeetingPayload(meeting);

  // Emit meeting_ended ONLY to participants (not to hospital rooms)
  if (meetingPayload && global.io) {
    const payload = {
      meeting: meetingPayload,
      reason: 'manual_end',
      endTime: meetingPayload.endTime,
      duration: meetingPayload.duration
    };

    // Broadcast only to participants who joined
    broadcastMeetingEvent('meeting_ended', meetingPayload, payload, { onlyParticipants: true });
    
    console.log(`[endMeeting] Notified ${meetingPayload.participants.length} participants about meeting end`);
  }

  res.json({
    success: true,
    message: 'Kết thúc cuộc họp thành công',
    data: {
      meetingId: meeting._id,
      duration: meeting.duration
    }
  });
});

// Get meeting details
exports.getMeetingDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const meeting = await DoctorMeeting.findById(id)
    .populate({
      path: 'createdBy',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate({
      path: 'organizer',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate({
      path: 'participants.doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('hospitals', 'name address')
    .populate('primaryHospital', 'name address');

  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy cuộc họp'
    });
  }

  // Check if user is authorized (doctor or admin)
  const doctor = await Doctor.findOne({ user: userId });
  const isParticipant = meeting.participants.some(
    p => p.doctorId._id.toString() === doctor?._id.toString()
  );
  const isOrganizer = meeting.organizer._id.toString() === doctor?._id.toString();
  const isAdmin = req.user.role === 'admin' || req.user.roleType === 'admin';

  if (!isParticipant && !isOrganizer && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xem thông tin cuộc họp này'
    });
  }

  // Format meeting with buildMeetingPayload
  const meetingPayload = await buildMeetingPayload(meeting);

  res.json({
    success: true,
    data: meetingPayload
  });
});

// Leave meeting
exports.leaveMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const meeting = await DoctorMeeting.findById(id);

  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Kh?ng t?m th?y cu?c h?p'
    });
  }

  const doctor = await Doctor.findOne({ user: userId });
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: 'Kh?ng t?m th?y th?ng tin b?c s?'
    });
  }

  const now = new Date();
  let participantMarked = false;

  meeting.participants.forEach((participant) => {
    if (participant.doctorId.toString() === doctor._id.toString() && !participant.leftAt) {
      participant.leftAt = now;
      participantMarked = true;
    }
  });

  if (!participantMarked) {
    meeting.participants.push({
      doctorId: doctor._id,
      joinedAt: now,
      leftAt: now
    });
  }

  await meeting.save();

  const activeParticipants = meeting.participants.filter((participant) => !participant.leftAt);

  if (activeParticipants.length === 0 && meeting.status === 'active') {
    meeting.status = 'ended';
    meeting.endTime = new Date();
    if (meeting.startTime) {
      meeting.duration = Math.round((meeting.endTime - meeting.startTime) / (1000 * 60));
    }
    await meeting.save();

    const endedPayload = await emitMeetingUpdated(meeting._id, {
      status: meeting.status
    });

    if (endedPayload) {
      await emitMeetingEnded(endedPayload, {
        reason: 'auto_end',
        endTime: endedPayload.endTime,
        duration: endedPayload.duration
      });
    }

    try {
      await livekitService.deleteRoom(meeting.roomName);
    } catch (error) {
      console.error('Error deleting LiveKit room:', error);
    }

    return res.json({
      success: true,
      autoEnded: true,
      message: 'Cu?c h?p ?? k?t th?c v? kh?ng c?n ng??i tham gia'
    });
  }

  const meetingPayload = await emitMeetingUpdated(meeting._id, {
    participantLeft: participantMarked
      ? {
          doctorId: doctor._id.toString(),
          doctorName: req.user.fullName,
          leftAt: now
        }
      : null
  });

  // Emit participant_left event to meeting and hospital rooms
  if (global.io && participantMarked && meetingPayload) {
    const leftPayload = {
      meetingId: meetingPayload._id,
      doctorId: doctor._id,
      doctorName: req.user.fullName,
      leftAt: now,
      activeCount: meetingPayload.activeParticipantCount,
      meeting: meetingPayload
    };

    // Broadcast to all relevant rooms
    broadcastMeetingEvent('participant_left', meetingPayload, leftPayload);
  }

  res.json({
    success: true,
    autoEnded: false,
    message: '?? r?i kh?i cu?c h?p'
  });
});
// List all meetings (Admin only)
exports.listAllMeetings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;

  // Build query
  const query = {};
  
  if (status) {
    const statuses = status.split(',').map(s => s.trim());
    query.status = { $in: statuses };
  }

  const skip = (page - 1) * limit;

  const meetings = await DoctorMeeting.find(query)
    .populate({
      path: 'createdBy',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate({
      path: 'organizer',
      populate: {
        path: 'user',
        select: 'fullName email'
      }
    })
    .populate({
      path: 'participants.doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('hospitals', 'name address')
    .populate('primaryHospital', 'name address')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await DoctorMeeting.countDocuments(query);

  // Format meetings with buildMeetingPayload
  const formattedMeetings = await Promise.all(
    meetings.map(meeting => buildMeetingPayload(meeting))
  );

  res.json({
    success: true,
    data: formattedMeetings.filter(Boolean),
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get active LiveKit rooms for meetings (Admin only)
exports.getActiveRooms = asyncHandler(async (req, res) => {
  try {
    const rooms = await livekitService.listRooms();
    
    // Filter only internal meeting rooms (not appointment rooms)
    const meetingRooms = [];
    
    for (const room of rooms) {
      try {
        const metadata = room.metadata ? JSON.parse(room.metadata) : {};
        if (metadata.meetingType === 'internal') {
          // Get meeting details from database
          const meetingId = metadata.meetingId;
          if (meetingId) {
            const meeting = await DoctorMeeting.findById(meetingId)
              .populate('createdBy', 'title')
              .populate({
                path: 'createdBy',
                populate: { path: 'user', select: 'fullName' }
              })
              .populate('hospitals', 'name');
            
            if (meeting) {
              // Get participants from LiveKit
              const participants = await livekitService.listParticipants(room.name);
              
              meetingRooms.push({
                sid: room.sid,
                name: room.name,
                roomCode: metadata.roomCode || meeting.roomCode,
                title: meeting.title,
                _id: meeting._id,
                meetingId: meeting._id,
                creationTime: room.creationTime,
                numParticipants: room.numParticipants,
                participants: participants.map(p => ({
                  sid: p.sid,
                  identity: p.identity,
                  name: p.name,
                  joinedAt: p.joinedAt
                })),
                hospitals: meeting.hospitals
              });
            }
          }
        }
      } catch (error) {
        console.error('Error processing room:', error);
      }
    }
    
    res.json({
      success: true,
      data: meetingRooms
    });
  } catch (error) {
    console.error('Error fetching active rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách phòng hoạt động',
      error: error.message
    });
  }
});

// Remove participant from meeting (Admin only)
exports.removeParticipant = asyncHandler(async (req, res) => {
  const { roomName, participantIdentity } = req.body;

  if (!roomName || !participantIdentity) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin roomName hoặc participantIdentity'
    });
  }

  try {
    await livekitService.removeParticipant(roomName, participantIdentity);
    
    res.json({
      success: true,
      message: 'Đã kick người tham gia khỏi phòng'
    });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể kick người tham gia',
      error: error.message
    });
  }
});

// Validate meeting code (for admin management)
exports.validateMeetingCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const meeting = await DoctorMeeting.findOne({
    roomCode: code.toUpperCase(),
    status: { $in: ['waiting', 'active'] }
  })
    .populate({
      path: 'organizer',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    });

  if (!meeting) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy cuộc họp hoạt động với mã này'
    });
  }

  res.json({
    success: true,
    data: {
      meetingId: meeting._id,
      roomCode: meeting.roomCode,
      title: meeting.title,
      status: meeting.status,
      participantCount: meeting.participants.filter(p => !p.leftAt).length,
      maxParticipants: meeting.maxParticipants,
      organizer: meeting.organizer?.user?.fullName || 'N/A'
    }
  });
});

