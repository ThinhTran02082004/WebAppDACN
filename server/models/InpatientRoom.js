const mongoose = require('mongoose');

const inpatientRoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, 'Số phòng là bắt buộc'],
    trim: true
  },
  roomName: {
    type: String,
    trim: true
  },
  floor: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['standard', 'vip', 'icu', 'isolation'],
    default: 'standard',
    required: true
  },
  hourlyRate: {
    type: Number,
    required: [true, 'Giá theo giờ là bắt buộc'],
    min: [0, 'Giá không thể âm']
  },
  capacity: {
    type: Number,
    default: 1,
    min: 1
  },
  currentOccupancy: {
    type: Number,
    default: 0,
    min: 0
  },
  amenities: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'cleaning'],
    default: 'available'
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true
  },
  equipment: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Compound index for unique room per hospital
inpatientRoomSchema.index({ hospitalId: 1, roomNumber: 1 }, { unique: true });
inpatientRoomSchema.index({ status: 1, type: 1 });
inpatientRoomSchema.index({ hospitalId: 1, status: 1 });

// Virtual for availability
inpatientRoomSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && this.currentOccupancy < this.capacity && this.isActive;
});

// Method to check if room can accommodate more patients
inpatientRoomSchema.methods.canAccommodate = function(count = 1) {
  return this.isActive && 
         this.status === 'available' && 
         (this.currentOccupancy + count) <= this.capacity;
};

// Method to occupy room
inpatientRoomSchema.methods.occupy = function(count = 1) {
  if (!this.canAccommodate(count)) {
    throw new Error('Phòng không thể nhận thêm bệnh nhân');
  }
  
  this.currentOccupancy += count;
  if (this.currentOccupancy >= this.capacity) {
    this.status = 'occupied';
  }
  
  return this.save();
};

// Method to release room
inpatientRoomSchema.methods.release = function(count = 1) {
  this.currentOccupancy = Math.max(0, this.currentOccupancy - count);
  
  if (this.currentOccupancy === 0) {
    this.status = 'cleaning';
  } else if (this.currentOccupancy < this.capacity) {
    this.status = 'available';
  }
  
  return this.save();
};

const InpatientRoom = mongoose.model('InpatientRoom', inpatientRoomSchema);

module.exports = InpatientRoom;

