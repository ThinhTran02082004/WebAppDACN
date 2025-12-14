const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  readAt: {
    type: Date,
    default: null
  },
  attachments: [{
    url: String,
    secureUrl: String,
    publicId: String,
    resourceType: String, // 'image' or 'video'
    format: String,
    size: Number,
    width: Number,
    height: Number,
    duration: Number, // for video
    originalName: String
  }],
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video', 'system', 'video_call_start', 'video_call_end', 'appointment'],
    default: 'text'
  },
  videoCallData: {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VideoRoom'
    },
    roomName: String,
    duration: Number, // in minutes
    startTime: Date,
    endTime: Date
  },
  appointmentData: {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    bookingCode: String,
    doctorName: String,
    patientName: String,
    appointmentDate: Date,
    timeSlot: {
      startTime: String,
      endTime: String
    },
    serviceName: String,
    hospitalName: String,
    status: String
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Create indexes for faster queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ readAt: 1 }); // Index for unread messages queries

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 