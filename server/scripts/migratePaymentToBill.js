/**
 * Migration Script: Payment to Bill
 * 
 * This script migrates all Payment records to Bill.consultationBill
 * 
 * Usage: node server/scripts/migratePaymentToBill.js
 * 
 * WARNING: Backup your database before running this script!
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const BillPayment = require('../models/BillPayment');
const Appointment = require('../models/Appointment');

async function migratePaymentsToBills() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all payments
    const payments = await Payment.find({}).populate('appointmentId');
    console.log(`Found ${payments.length} payments to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const payment of payments) {
      try {
        // Check if appointment exists
        if (!payment.appointmentId) {
          console.log(`Skipping payment ${payment._id}: No appointment found`);
          skipped++;
          continue;
        }

        // Check if bill already exists for this appointment
        let bill = await Bill.findOne({ appointmentId: payment.appointmentId._id });
        
        if (bill) {
          // Update existing bill's consultationBill with payment data
          console.log(`Updating existing bill ${bill._id} for payment ${payment._id}`);
          
          bill.consultationBill = {
            amount: payment.amount || 0,
            originalAmount: payment.originalAmount || payment.amount || 0,
            discount: payment.discount || 0,
            couponId: payment.couponId || null,
            status: mapPaymentStatusToBillStatus(payment.paymentStatus),
            paymentMethod: payment.paymentMethod || 'cash',
            paymentDate: payment.paidAt ? new Date(payment.paidAt) : payment.createdAt,
            transactionId: payment.transactionId || null,
            paymentDetails: payment.paymentDetails || null,
            refundAmount: payment.refundAmount || 0,
            refundReason: payment.refundReason || null,
            refundDate: payment.refundDate || null,
            notes: payment.notes || null
          };

          // Set doctorId and serviceId if not already set
          if (!bill.doctorId && payment.doctorId) {
            bill.doctorId = payment.doctorId;
          }
          if (!bill.serviceId && payment.serviceId) {
            bill.serviceId = payment.serviceId;
          }

          await bill.save();
        } else {
          // Create new bill
          console.log(`Creating new bill for payment ${payment._id}`);
          
          bill = await Bill.create({
            appointmentId: payment.appointmentId._id,
            patientId: payment.userId,
            doctorId: payment.doctorId,
            serviceId: payment.serviceId,
            consultationBill: {
              amount: payment.amount || 0,
              originalAmount: payment.originalAmount || payment.amount || 0,
              discount: payment.discount || 0,
              couponId: payment.couponId || null,
              status: mapPaymentStatusToBillStatus(payment.paymentStatus),
              paymentMethod: payment.paymentMethod || 'cash',
              paymentDate: payment.paidAt ? new Date(payment.paidAt) : payment.createdAt,
              transactionId: payment.transactionId || null,
              paymentDetails: payment.paymentDetails || null,
              refundAmount: payment.refundAmount || 0,
              refundReason: payment.refundReason || null,
              refundDate: payment.refundDate || null,
              notes: payment.notes || null
            }
          });
        }

        // Create BillPayment record for history
        if (payment.paymentStatus === 'completed' || payment.paymentStatus === 'paid') {
          await BillPayment.create({
            billId: bill._id,
            appointmentId: payment.appointmentId._id,
            patientId: payment.userId,
            billType: 'consultation',
            amount: payment.amount || 0,
            paymentMethod: payment.paymentMethod || 'cash',
            paymentStatus: 'completed',
            transactionId: payment.transactionId || null,
            paymentDetails: payment.paymentDetails || null,
            notes: `Migrated from Payment ${payment._id}`
          });
        }

        migrated++;
        console.log(`✓ Migrated payment ${payment._id} -> bill ${bill._id}`);
      } catch (error) {
        errors++;
        console.error(`✗ Error migrating payment ${payment._id}:`, error.message);
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total payments: ${payments.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

    // Close connection
    await mongoose.connection.close();
    console.log('\nMigration completed. Database connection closed.');
  } catch (error) {
    console.error('Migration error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

/**
 * Map Payment.paymentStatus to Bill.consultationBill.status
 */
function mapPaymentStatusToBillStatus(paymentStatus) {
  const statusMap = {
    'pending': 'pending',
    'completed': 'paid',
    'paid': 'paid',
    'failed': 'failed',
    'refunded': 'refunded',
    'cancelled': 'cancelled'
  };
  
  return statusMap[paymentStatus?.toLowerCase()] || 'pending';
}

// Run migration
if (require.main === module) {
  migratePaymentsToBills()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePaymentsToBills };

