const mongoose = require('mongoose');

const hospitalizationSchema = new mongoose.Schema({
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
  inpatientRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InpatientRoom',
    required: true
  },
  admissionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dischargeDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['admitted', 'transferred', 'discharged', 'cancelled'],
    default: 'admitted'
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  totalHours: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  roomHistory: [{
    inpatientRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InpatientRoom',
      required: true
    },
    roomNumber: {
      type: String
    },
    roomType: {
      type: String
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now
    },
    checkOutTime: {
      type: Date
    },
    hourlyRate: {
      type: Number,
      required: true
    },
    hours: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number,
      default: 0
    }
  }],
  notes: {
    type: String,
    trim: true
  },
  admissionReason: {
    type: String,
    trim: true
  },
  dischargeReason: {
    type: String,
    trim: true
  },
  dischargedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  }
}, {
  timestamps: true
});

// Indexes
hospitalizationSchema.index({ appointmentId: 1 }, { unique: true });
hospitalizationSchema.index({ patientId: 1, status: 1 });
hospitalizationSchema.index({ doctorId: 1 });
hospitalizationSchema.index({ inpatientRoomId: 1, status: 1 });
hospitalizationSchema.index({ admissionDate: 1 });

// Method to calculate current duration in hours
hospitalizationSchema.methods.getCurrentDuration = function() {
  if (this.status === 'discharged') {
    return this.totalHours;
  }
  
  const now = new Date();
  const admissionTime = new Date(this.admissionDate);
  const diffMs = now - admissionTime;
  const hours = diffMs / (1000 * 60 * 60);
  
  return Math.max(0, Math.ceil(hours)); // Round up to next hour
};

// Method to calculate current cost
hospitalizationSchema.methods.getCurrentCost = function() {
  if (this.status === 'discharged') {
    return this.totalAmount;
  }
  
  const hours = this.getCurrentDuration();
  return hours * this.hourlyRate;
};

// Method to transfer to another room
hospitalizationSchema.methods.transferRoom = async function(newRoomId, newHourlyRate) {
  const InpatientRoom = mongoose.model('InpatientRoom');
  
  // Close current room history entry
  if (this.roomHistory.length > 0) {
    const currentEntry = this.roomHistory[this.roomHistory.length - 1];
    if (!currentEntry.checkOutTime) {
      currentEntry.checkOutTime = new Date();
      const checkInTime = new Date(currentEntry.checkInTime);
      const diffMs = currentEntry.checkOutTime - checkInTime;
      currentEntry.hours = Math.ceil(diffMs / (1000 * 60 * 60));
      currentEntry.amount = currentEntry.hours * currentEntry.hourlyRate;
    }
  }
  
  // Get new room info
  const newRoom = await InpatientRoom.findById(newRoomId);
  if (!newRoom) {
    throw new Error('Không tìm thấy phòng mới');
  }
  
  // Add new room history entry
  this.roomHistory.push({
    inpatientRoomId: newRoomId,
    roomNumber: newRoom.roomNumber,
    roomType: newRoom.type,
    checkInTime: new Date(),
    hourlyRate: newHourlyRate
  });
  
  // Update current room
  this.inpatientRoomId = newRoomId;
  this.hourlyRate = newHourlyRate;
  this.status = 'transferred';
  
  return this.save();
};

// Method to discharge patient
hospitalizationSchema.methods.discharge = async function(dischargedBy, reason) {
  if (this.status === 'discharged') {
    throw new Error('Bệnh nhân đã được xuất viện');
  }
  
  this.dischargeDate = new Date();
  this.status = 'discharged';
  this.dischargedBy = dischargedBy;
  this.dischargeReason = reason;
  
  // Close last room history entry
  if (this.roomHistory.length > 0) {
    const lastEntry = this.roomHistory[this.roomHistory.length - 1];
    if (!lastEntry.checkOutTime) {
      lastEntry.checkOutTime = this.dischargeDate;
      const checkInTime = new Date(lastEntry.checkInTime);
      const diffMs = lastEntry.checkOutTime - checkInTime;
      lastEntry.hours = Math.ceil(diffMs / (1000 * 60 * 60));
      lastEntry.amount = lastEntry.hours * lastEntry.hourlyRate;
    }
  }
  
  // Calculate total hours and amount
  let totalHours = 0;
  let totalAmount = 0;
  
  this.roomHistory.forEach(entry => {
    totalHours += entry.hours || 0;
    totalAmount += entry.amount || 0;
  });
  
  this.totalHours = totalHours;
  this.totalAmount = totalAmount;
  
  return this.save();
};

const Hospitalization = mongoose.model('Hospitalization', hospitalizationSchema);

module.exports = Hospitalization;

