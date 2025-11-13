const mongoose = require('mongoose');

const medicationInventorySchema = new mongoose.Schema({
  medicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  transactionType: {
    type: String,
    enum: ['import', 'export', 'adjust', 'prescription'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true,
    min: 0
  },
  newStock: {
    type: Number,
    required: true,
    min: 0
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  totalCost: {
    type: Number,
    default: 0
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceType: {
    type: String,
    enum: ['Prescription', 'PurchaseOrder', 'Manual', 'Other']
  },
  notes: {
    type: String,
    trim: true
  },
  supplier: {
    type: String,
    trim: true
  },
  batchNumber: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
medicationInventorySchema.index({ medicationId: 1, createdAt: -1 });
medicationInventorySchema.index({ transactionType: 1 });
medicationInventorySchema.index({ performedBy: 1 });
medicationInventorySchema.index({ createdAt: -1 });
medicationInventorySchema.index({ referenceId: 1, referenceType: 1 });
medicationInventorySchema.index({ hospitalId: 1, createdAt: -1 });
medicationInventorySchema.index({ hospitalId: 1, medicationId: 1 });

// Virtual for transaction amount (positive for import, negative for export)
medicationInventorySchema.virtual('transactionAmount').get(function() {
  if (this.transactionType === 'import') {
    return this.quantity;
  } else if (this.transactionType === 'export' || this.transactionType === 'prescription') {
    return -this.quantity;
  }
  return this.newStock - this.previousStock;
});

const MedicationInventory = mongoose.model('MedicationInventory', medicationInventorySchema);

module.exports = MedicationInventory;

