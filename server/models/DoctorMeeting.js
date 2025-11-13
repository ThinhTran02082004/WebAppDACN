const mongoose = require('mongoose');

const doctorMeetingSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    unique: true,
    sparse: true, // Allow null for pre-save generation
    uppercase: true,
    trim: true
  },
  roomName: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: [true, 'Tiêu đề cuộc họp là bắt buộc'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  hospitals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  }],
  primaryHospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital'
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended', 'cancelled'],
    default: 'waiting'
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },
  participants: [{
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date
    }
  }],
  maxParticipants: {
    type: Number,
    default: 20
  },
  invitedDoctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  }],
  metadata: {
    enableRecording: {
      type: Boolean,
      default: false
    },
    enableScreenShare: {
      type: Boolean,
      default: true
    },
    enableChat: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
// Note: roomCode already has unique index from field definition
doctorMeetingSchema.index({ createdBy: 1 });
doctorMeetingSchema.index({ organizer: 1 });
doctorMeetingSchema.index({ status: 1 });
doctorMeetingSchema.index({ createdAt: -1 });
doctorMeetingSchema.index({ hospitals: 1 });
doctorMeetingSchema.index({ primaryHospital: 1 });
doctorMeetingSchema.index({ hospitals: 1, status: 1 });

// Static method to generate unique room code
doctorMeetingSchema.statics.generateRoomCode = async function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomCode;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Generate 6-character code
    roomCode = 'M-'; // M for Meeting
    for (let i = 0; i < 6; i++) {
      roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists
    const existing = await this.findOne({ roomCode });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Could not generate unique meeting code');
  }

  return roomCode;
};

// Pre-save hook to generate room code if not present
doctorMeetingSchema.pre('save', async function(next) {
  if (!this.roomCode && this.isNew) {
    try {
      this.roomCode = await this.constructor.generateRoomCode();
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Methods
doctorMeetingSchema.methods.startMeeting = function() {
  this.status = 'active';
  this.startTime = new Date();
  return this.save();
};

doctorMeetingSchema.methods.endMeeting = function() {
  this.status = 'ended';
  this.endTime = new Date();
  if (this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60));
  }
  return this.save();
};

const DoctorMeeting = mongoose.model('DoctorMeeting', doctorMeetingSchema);

module.exports = DoctorMeeting;

