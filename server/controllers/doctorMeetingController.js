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

const broadcastMeetingEvent = (eventName, meetingPayload, extra = {}) => {
  if (!global.io || !meetingPayload) return;

  const payload = { ...extra, meeting: meetingPayload };
  const meetingId = resolveId(meetingPayload._id);

  if (meetingId) {
    global.io.to(`meeting:${meetingId}`).emit(eventName, payload);
  }

  if (Array.isArray(meetingPayload.hospitalIds)) {
    meetingPayload.hospitalIds.forEach((hospitalId) => {
      if (hospitalId) {
        global.io.to(`hospital:${hospitalId}`).emit(eventName, payload);
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

    if (global.io && meetingPayload) {
      const participantInfo = {
        doctorId: doctor._id,
        doctorName: req.user.fullName,
        joinedAt
      };

      global.io.to(`meeting:${meetingPayload._id}`).emit('participant_joined', {
        meetingId: meetingPayload._id,
        participant: participantInfo,
        activeCount: meetingPayload.activeParticipantCount,
        meeting: meetingPayload
      });
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

  // Build query: meetings at doctor's hospital OR meetings doctor participated in
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
      }
    ]
  };

  // Additional status filter if provided
  if (status) {
    if (status === 'ended') {
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
          status: status
        }
      ];
    }
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
    .populate('hospitals', 'name address')
    .populate('primaryHospital', 'name address')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await DoctorMeeting.countDocuments(query);

  res.json({
    success: true,
    data: meetings,
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

  const meetingPayload = await emitMeetingUpdated(meeting._id, {
    status: meeting.status
  });

  if (meetingPayload) {
    await emitMeetingEnded(meetingPayload, {
      reason: 'manual_end',
      endTime: meetingPayload.endTime,
      duration: meetingPayload.duration
    });
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
    });

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

  res.json({
    success: true,
    data: meeting
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

  if (global.io && participantMarked && meetingPayload) {
    global.io.to(`meeting:${meetingPayload._id}`).emit('participant_left', {
      meetingId: meetingPayload._id,
      doctorId: doctor._id,
      doctorName: req.user.fullName,
      leftAt: now,
      activeCount: meetingPayload.activeParticipantCount,
      meeting: meetingPayload
    });
  }

  res.json({
    success: true,
    autoEnded: false,
    message: '?? r?i kh?i cu?c h?p'
  });
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

