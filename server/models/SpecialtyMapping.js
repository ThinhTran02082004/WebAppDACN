const mongoose = require('mongoose');

const specialtyMappingSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Từ khóa là bắt buộc'],
    trim: true,
    unique: true, // Mỗi từ khóa chỉ map đến 1 specialty
    index: true
  },
  specialtyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialty',
    required: [true, 'Chuyên khoa là bắt buộc']
  },
  specialtyName: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    // Priority cao hơn sẽ được ưu tiên khi có nhiều mapping khớp
  },
  note: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
specialtyMappingSchema.index({ specialtyId: 1, isActive: 1 });
specialtyMappingSchema.index({ text: 1, isActive: 1 });

// Pre-save: Update specialtyName from specialtyId if not provided
specialtyMappingSchema.pre('save', async function(next) {
  if (this.isModified('specialtyId') && !this.specialtyName) {
    try {
      const Specialty = mongoose.model('Specialty');
      const specialty = await Specialty.findById(this.specialtyId);
      if (specialty) {
        this.specialtyName = specialty.name;
      }
    } catch (error) {
      console.error('Error fetching specialty name:', error);
    }
  }
  next();
});

const SpecialtyMapping = mongoose.model('SpecialtyMapping', specialtyMappingSchema);

module.exports = SpecialtyMapping;

