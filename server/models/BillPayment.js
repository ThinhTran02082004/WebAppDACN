const mongoose = require('mongoose');

const billPaymentSchema = new mongoose.Schema({
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

const BillPayment = mongoose.model('BillPayment', billPaymentSchema);

module.exports = BillPayment;

