const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  billNumber: {
    type: String,
    unique: true,
    required: true
  },
  // Consultation fee bill
  consultationBill: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'momo', 'paypal']
    },
    paymentDate: {
      type: Date
    },
    transactionId: {
      type: String
    }
  },
  // Medication bill
  medicationBill: {
    prescriptionIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription'
    }],
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'momo', 'paypal']
    },
    paymentDate: {
      type: Date
    },
    transactionId: {
      type: String
    }
  },
  // Hospitalization bill
  hospitalizationBill: {
    hospitalizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospitalization'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'momo', 'paypal']
    },
    paymentDate: {
      type: Date
    },
    transactionId: {
      type: String
    }
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  overallStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  }
}, {
  timestamps: true
});

// Indexes
// Note: appointmentId and billNumber already have unique indexes from field definitions
billSchema.index({ patientId: 1 });
billSchema.index({ overallStatus: 1 });

// Pre-save hook to auto-generate bill number
billSchema.pre('save', async function(next) {
  if (!this.billNumber && this.isNew) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Count bills this month
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, new Date().getMonth(), 1),
        $lt: new Date(year, new Date().getMonth() + 1, 1)
      }
    });
    
    this.billNumber = `BILL-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
  
  // Calculate totals
  this.totalAmount = 
    (this.consultationBill.amount || 0) +
    (this.medicationBill.amount || 0) +
    (this.hospitalizationBill.amount || 0);
  
  // Calculate paid amount
  let paidAmount = 0;
  if (this.consultationBill.status === 'paid') {
    paidAmount += this.consultationBill.amount || 0;
  }
  if (this.medicationBill.status === 'paid') {
    paidAmount += this.medicationBill.amount || 0;
  }
  if (this.hospitalizationBill.status === 'paid') {
    paidAmount += this.hospitalizationBill.amount || 0;
  }
  
  this.paidAmount = paidAmount;
  this.remainingAmount = this.totalAmount - this.paidAmount;
  
  // Update overall status
  if (this.paidAmount === 0) {
    this.overallStatus = 'unpaid';
  } else if (this.paidAmount < this.totalAmount) {
    this.overallStatus = 'partial';
  } else {
    this.overallStatus = 'paid';
  }
  
  next();
});

const Bill = mongoose.model('Bill', billSchema);

module.exports = Bill;

