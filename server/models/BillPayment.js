const mongoose = require('mongoose');

const billPaymentSchema = new mongoose.Schema({
  paymentNumber: {
    type: String,
    unique: true,
    required: true
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: true
  },
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
  billType: {
    type: String,
    enum: ['consultation', 'medication', 'hospitalization'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'momo', 'paypal'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    trim: true
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
billPaymentSchema.index({ billId: 1, billType: 1 });
billPaymentSchema.index({ patientId: 1, createdAt: -1 });
billPaymentSchema.index({ appointmentId: 1 });
billPaymentSchema.index({ paymentStatus: 1 });
billPaymentSchema.index({ transactionId: 1 });

// Pre-validate: ensure unique paymentNumber exists
billPaymentSchema.pre('validate', async function(next) {
  if (!this.paymentNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const day = String(new Date().getDate()).padStart(2, '0');

    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, new Date().getMonth(), new Date().getDate()),
        $lt: new Date(year, new Date().getMonth(), new Date().getDate() + 1)
      }
    });

    this.paymentNumber = `PAY-${year}${month}${day}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

const BillPayment = mongoose.model('BillPayment', billPaymentSchema);

module.exports = BillPayment;

