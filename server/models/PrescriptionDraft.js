const mongoose = require('mongoose');

const medicationEntrySchema = new mongoose.Schema({
  medicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false });

const prescriptionDraftSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  medications: {
    type: [medicationEntrySchema],
    default: []
  },
  symptom: {
    type: String,
    trim: true
  },
  keywords: {
    type: [String],
    default: []
  },
  diagnosis: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected', 'completed'],
    default: 'pending_approval'
  },
  note: {
    type: String,
    trim: true
  }
}, { timestamps: true });

prescriptionDraftSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('PrescriptionDraft', prescriptionDraftSchema);

