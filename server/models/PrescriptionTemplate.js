const mongoose = require('mongoose');

const prescriptionTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên đơn thuốc mẫu là bắt buộc'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    // Accept broader set of categories; keep backward compatible aliases
    enum: [
      'respiratory',
      'digestive',
      'cardiovascular',
      'neurological',
      'dermatology',
      'endocrine',
      'infection',
      'pain-management',
      'common',         // alias accepted by frontend
      'general',        // alias for common/general illnesses
      'other'
    ],
    required: [true, 'Danh mục là bắt buộc']
  },
  diseaseType: {
    type: String,
    trim: true
  },
  medications: [{
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
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
    notes: {
      type: String,
      trim: true
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdByRole: {
    type: String,
    enum: ['admin', 'doctor'],
    required: true
  },
  creatorName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true // Tất cả bác sĩ có thể dùng
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
prescriptionTemplateSchema.index({ category: 1, isActive: 1 });
prescriptionTemplateSchema.index({ createdBy: 1 });
prescriptionTemplateSchema.index({ isPublic: 1, isActive: 1 });
prescriptionTemplateSchema.index({ name: 'text', description: 'text' });

// Pre-save middleware to calculate total price
prescriptionTemplateSchema.pre('save', async function(next) {
  if (this.isModified('medications')) {
    try {
      const Medication = mongoose.model('Medication');
      let total = 0;

      for (const med of this.medications) {
        const medication = await Medication.findById(med.medicationId);
        if (medication && medication.unitPrice) {
          total += medication.unitPrice * med.quantity;
        }
      }

      this.totalPrice = total;
    } catch (error) {
      console.error('Error calculating total price:', error);
    }
  }
  next();
});

// Method to increment usage count
prescriptionTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

const PrescriptionTemplate = mongoose.model('PrescriptionTemplate', prescriptionTemplateSchema);

module.exports = PrescriptionTemplate;

