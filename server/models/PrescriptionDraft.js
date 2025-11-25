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
  doctorName: {
    type: String,
    trim: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital'
  },
  hospitalName: {
    type: String,
    trim: true
  },
  specialtyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialty'
  },
  specialtyName: {
    type: String,
    trim: true
  },
  medications: {
    type: [medicationEntrySchema],
    default: []
  },
  hospitalAvailability: [{
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    hospitalName: String,
    address: String,
    totalInStock: Number,
    inStock: [{
      medicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medication'
      },
      name: String,
      unitTypeDisplay: String,
      unitPrice: Number,
      stockQuantity: Number
    }],
    outOfStock: [{
      medicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medication'
      },
      name: String,
      unitTypeDisplay: String
    }]
  }],
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
    enum: ['pending_approval', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending_approval'
  },
  note: {
    type: String,
    trim: true
  },
  prescriptionCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedByRole: {
    type: String,
    enum: ['doctor', 'pharmacist', 'admin']
  },
  approvedAt: {
    type: Date
  }
}, { timestamps: true });

// Tạo prescriptionCode duy nhất trước khi lưu
prescriptionDraftSchema.pre('save', async function(next) {
  try {
    if (!this.prescriptionCode) {
      const session = this.$session();
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let prescriptionCode;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        prescriptionCode = 'PRS-';
        for (let i = 0; i < 8; i++) {
          prescriptionCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const query = this.constructor.findOne({ prescriptionCode });
        if (session) {
          query.session(session);
        }
        
        const existing = await query;
        
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return next(new Error('Không thể tạo mã đơn thuốc duy nhất sau nhiều lần thử.'));
      }

      this.prescriptionCode = prescriptionCode;
      console.log(`[PrescriptionDraft Model] Đã tạo prescriptionCode: ${prescriptionCode} cho prescription ID: ${this._id}`);
    }
    next();
  } catch (error) {
    console.error('Error generating prescription code:', error);
    next(error);
  }
});

prescriptionDraftSchema.index({ patientId: 1, createdAt: -1 });
prescriptionDraftSchema.index({ prescriptionCode: 1 });
prescriptionDraftSchema.index({ hospitalId: 1 });

module.exports = mongoose.model('PrescriptionDraft', prescriptionDraftSchema);

