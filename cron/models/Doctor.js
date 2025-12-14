const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  specialtyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialty',
    required: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  title: {
    type: String,
    required: [true, 'Chức danh là bắt buộc'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  education: {
    type: String,
    trim: true,
    required: [true, 'Thông tin học vấn là bắt buộc']
  },
  experience: {
    type: Number,
    default: 0
  },
  certifications: [{
    type: String,
    trim: true
  }],
  languages: [{
    type: String,
    trim: true
  }],
  consultationFee: {
    type: Number,
    required: true,
    default: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  ratings: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  averageRating: {
    type: Number,
    default: 0
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }]
}, {
  timestamps: true
});

doctorSchema.virtual('fullInfo').get(function() {
  if (!this.user) return this.title || '';
  return `${this.title} ${this.user.fullName}`;
});

doctorSchema.set('toJSON', { virtuals: true });
doctorSchema.set('toObject', { virtuals: true });

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;

