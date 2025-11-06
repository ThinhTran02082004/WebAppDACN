const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  medications: [{
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: true
    },
    medicationName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Số lượng phải lớn hơn 0']
    },
    dosage: {
      type: String,
      required: true,
      trim: true
    },
    usage: {
      type: String,
      required: true,
      trim: true
    },
    duration: {
      type: String,
      required: true,
      trim: true
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PrescriptionTemplate'
  },
  templateName: {
    type: String,
    trim: true
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'verified', 'dispensed', 'completed', 'cancelled'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  diagnosis: {
    type: String,
    trim: true
  },
  prescriptionOrder: {
    type: Number,
    default: 1,
    min: 1
  },
  isHospitalization: {
    type: Boolean,
    default: false
  },
  dispensedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dispensedAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    trim: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
prescriptionSchema.index({ appointmentId: 1 });
prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1 });
prescriptionSchema.index({ status: 1 });
prescriptionSchema.index({ hospitalId: 1, status: 1 });
prescriptionSchema.index({ hospitalId: 1, createdAt: -1 });

// Pre-save middleware to calculate total amount
prescriptionSchema.pre('save', function(next) {
  if (this.isModified('medications')) {
    let total = 0;
    this.medications.forEach(med => {
      med.totalPrice = med.unitPrice * med.quantity;
      total += med.totalPrice;
    });
    this.totalAmount = total;
  }
  next();
});

// Method to approve prescription
prescriptionSchema.methods.approve = function() {
  this.status = 'approved';
  return this.save();
};

// Method to verify prescription (pharmacist approval)
prescriptionSchema.methods.verify = function(userId, notes) {
  this.status = 'verified';
  this.verifiedBy = userId;
  this.verifiedAt = new Date();
  if (notes) {
    this.verificationNotes = notes;
  }
  return this.save();
};

// Method to dispense prescription
prescriptionSchema.methods.dispense = function(userId) {
  this.status = 'dispensed';
  this.dispensedBy = userId;
  this.dispensedAt = new Date();
  return this.save();
};

// Method to complete prescription
prescriptionSchema.methods.complete = function() {
  this.status = 'completed';
  return this.save();
};

// Method to cancel prescription
prescriptionSchema.methods.cancel = function(userId, reason) {
  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;

