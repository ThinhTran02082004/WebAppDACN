const mongoose = require('mongoose');

const conversationStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    sparse: true // Cho phép null (guest users)
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  summary: {
    type: String,
    default: ''
  },
  structuredState: {
    patientInfo: {
      name: { type: String },
      age: { type: Number },
      gender: { 
        type: String, 
        enum: ['male', 'female', 'other'],
        default: null
      }
    },
    symptoms: [{
      type: String
    }],
    duration: { type: String },
    riskFactors: [{
      type: String
    }],
    provisionalDepartment: { type: String },
    triageLocked: {
      type: Boolean,
      default: false
    },
    triageReason: { type: String },
    riskLevel: {
      type: String,
      enum: ['normal', 'urgent', 'emergency'],
      default: 'normal'
    },
    bookingIntent: {
      type: Boolean,
      default: false
    },
    bookingLocation: { type: String },
    bookingDate: { type: String },
    bookingRequest: {
      hospitalId: { type: String },
      departmentId: { type: String },
      doctorId: { type: String },
      preferredTime: { type: String },
      status: {
        type: String,
        enum: ['pending', 'confirmed'],
        default: 'pending'
      }
    },
    drugQueries: {
      symptomBased: { type: Boolean, default: false },
      drugs: [{ type: String }],
      activeIngredients: [{ type: String }]
    },
    currentState: {
      type: String,
      enum: ['GREETING', 'COLLECTING_SYMPTOMS', 'TRIAGE_DEPARTMENT', 'BACK_TO_TRIAGE', 'BOOKING_OPTIONS', 'CONFIRM_BOOKING', 'DONE'],
      default: 'GREETING'
    }
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
conversationStateSchema.index({ sessionId: 1 });
conversationStateSchema.index({ userId: 1, lastUpdatedAt: -1 });
conversationStateSchema.index({ 'structuredState.currentState': 1 });

const ConversationState = mongoose.model('ConversationState', conversationStateSchema);

module.exports = ConversationState;

