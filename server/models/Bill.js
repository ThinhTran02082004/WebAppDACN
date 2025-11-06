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
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
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
    originalAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon'
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled', 'refunded', 'failed'],
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
    },
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    refundReason: {
      type: String,
      trim: true
    },
    refundDate: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
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
    },
    prescriptionPayments: [{
      prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription',
        required: true
      },
      amount: {
        type: Number,
        required: true,
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
    }]
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

// Pre-validate: ensure billNumber exists before required validation
billSchema.pre('validate', async function(next) {
  if (!this.billNumber) {
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
  next();
});

// Pre-save: compute totals and statuses before persisting
billSchema.pre('save', async function(next) {
  // Calculate totals - use amount (after discount) for consultation, fallback to originalAmount for backward compatibility
  // Priority: amount (discounted) > originalAmount > 0
  const consultationAmount = (this.consultationBill.amount !== undefined && this.consultationBill.amount !== null && this.consultationBill.amount > 0)
    ? this.consultationBill.amount 
    : (this.consultationBill.originalAmount || 0);
  
  this.totalAmount = 
    consultationAmount +
    (this.medicationBill.amount || 0) +
    (this.hospitalizationBill.amount || 0);
  
  // Calculate paid amount
  let paidAmount = 0;
  if (this.consultationBill.status === 'paid') {
    // Use amount (after discount) for paid amount calculation
    paidAmount += this.consultationBill.amount || 0;
  }
  // For medication: sum up all paid prescriptions
  if (this.medicationBill.prescriptionPayments && this.medicationBill.prescriptionPayments.length > 0) {
    const paidPrescriptions = this.medicationBill.prescriptionPayments.filter(p => p.status === 'paid');
    paidAmount += paidPrescriptions.reduce((sum, p) => sum + (p.amount || 0), 0);
  } else if (this.medicationBill.status === 'paid') {
    // Fallback for old bills
    paidAmount += this.medicationBill.amount || 0;
  }
  if (this.hospitalizationBill.status === 'paid') {
    paidAmount += this.hospitalizationBill.amount || 0;
  }
  
  // Update medicationBill.status based on prescriptionPayments
  if (this.medicationBill.prescriptionPayments && this.medicationBill.prescriptionPayments.length > 0) {
    const allPaid = this.medicationBill.prescriptionPayments.every(p => p.status === 'paid');
    const hasPending = this.medicationBill.prescriptionPayments.some(p => p.status === 'pending');
    if (allPaid && this.medicationBill.prescriptionPayments.length > 0) {
      this.medicationBill.status = 'paid';
    } else if (hasPending && paidAmount > 0) {
      this.medicationBill.status = 'pending'; // Partial payment
    }
  }
  
  this.paidAmount = paidAmount;
  this.remainingAmount = this.totalAmount - this.paidAmount;
  
  // Store previous overallStatus to check if it changed
  const previousOverallStatus = this.overallStatus;
  
  // Update overall status
  if (this.paidAmount === 0) {
    this.overallStatus = 'unpaid';
  } else if (this.paidAmount < this.totalAmount) {
    this.overallStatus = 'partial';
  } else {
    this.overallStatus = 'paid';
  }
  
  // Store flag for post-save hook to update appointment
  if (this.overallStatus === 'paid' && previousOverallStatus !== 'paid') {
    this._shouldUpdateAppointment = true;
  }
  
  next();
});

// Post-save hook to update appointment status when bill is fully paid
billSchema.post('save', async function() {
  if (this._shouldUpdateAppointment && this.appointmentId) {
    try {
      const Appointment = mongoose.model('Appointment');
      
      // Check if any payment was made via online methods (momo/paypal)
      // If so, only update to 'confirmed', not 'completed'
      const hasOnlinePayment = 
        (this.consultationBill?.paymentMethod && ['momo', 'paypal'].includes(this.consultationBill.paymentMethod)) ||
        (this.medicationBill?.paymentMethod && ['momo', 'paypal'].includes(this.medicationBill.paymentMethod)) ||
        (this.hospitalizationBill?.paymentMethod && ['momo', 'paypal'].includes(this.hospitalizationBill.paymentMethod)) ||
        // Check prescriptionPayments
        (this.medicationBill?.prescriptionPayments?.some(pp => 
          pp.paymentMethod && ['momo', 'paypal'].includes(pp.paymentMethod)
        ));
      
      // Only update to 'completed' if all payments are cash or admin-confirmed
      // Otherwise, keep status as 'confirmed' for online payments
      const updateData = {
        paymentStatus: 'completed'
      };
      
      if (!hasOnlinePayment) {
        // All payments are cash, can update to completed
        updateData.status = 'completed';
      } else {
        // Has online payment, only update to confirmed if currently pending
        const currentAppointment = await Appointment.findById(this.appointmentId);
        if (currentAppointment && currentAppointment.status === 'pending') {
          updateData.status = 'confirmed';
        }
        // If already confirmed, keep it as confirmed (don't change to completed)
      }
      
      await Appointment.findByIdAndUpdate(
        this.appointmentId,
        updateData
      );
    } catch (error) {
      console.error('Error updating appointment status:', error);
      // Don't fail bill save if appointment update fails
    }
    // Clear flag
    this._shouldUpdateAppointment = false;
  }
});

const Bill = mongoose.model('Bill', billSchema);

module.exports = Bill;

