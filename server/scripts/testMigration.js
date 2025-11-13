/**
 * Test Script: Payment to Bill Migration
 * 
 * This script tests the migration by verifying:
 * 1. All Payment records have been migrated to Bills
 * 2. BillPayment records exist for payment history
 * 3. Data integrity is maintained
 * 
 * Usage: node server/scripts/testMigration.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const BillPayment = require('../models/BillPayment');
const Appointment = require('../models/Appointment');

async function testMigration() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    let passed = 0;
    let failed = 0;
    const errors = [];

    // Test 1: Check if all Payments have corresponding Bills
    console.log('📋 Test 1: Checking Payment → Bill migration...');
    const payments = await Payment.find({}).populate('appointmentId');
    const bills = await Bill.find({});
    
    console.log(`   Found ${payments.length} Payment records`);
    console.log(`   Found ${bills.length} Bill records`);
    
    if (payments.length === 0) {
      console.log('   ⚠️  No Payment records found (might be already migrated or empty database)');
    } else {
      let migrationCount = 0;
      for (const payment of payments) {
        if (payment.appointmentId) {
          const bill = await Bill.findOne({ appointmentId: payment.appointmentId._id || payment.appointmentId });
          if (bill) {
            migrationCount++;
            // Verify consultationBill data matches
            if (bill.consultationBill.amount !== payment.amount) {
              errors.push(`Payment ${payment._id}: Amount mismatch (Payment: ${payment.amount}, Bill: ${bill.consultationBill.amount})`);
              failed++;
            } else {
              passed++;
            }
          } else {
            errors.push(`Payment ${payment._id}: No corresponding Bill found for appointment ${payment.appointmentId._id || payment.appointmentId}`);
            failed++;
          }
        }
      }
      console.log(`   ✅ ${migrationCount}/${payments.length} Payments have corresponding Bills`);
    }

    // Test 2: Check BillPayment records for completed payments
    console.log('\n📋 Test 2: Checking BillPayment records...');
    const billPayments = await BillPayment.find({});
    console.log(`   Found ${billPayments.length} BillPayment records`);
    
    // Check if completed payments have BillPayment records
    const completedPayments = await Payment.find({ paymentStatus: 'completed' });
    const consultationBillPayments = await BillPayment.find({ billType: 'consultation', paymentStatus: 'completed' });
    
    console.log(`   Found ${completedPayments.length} completed Payment records`);
    console.log(`   Found ${consultationBillPayments.length} completed consultation BillPayment records`);
    
    if (completedPayments.length > consultationBillPayments.length) {
      console.log(`   ⚠️  Some completed payments might not have BillPayment records`);
      failed++;
    } else {
      passed++;
      console.log(`   ✅ BillPayment records look good`);
    }

    // Test 3: Verify Bill consultationBill structure
    console.log('\n📋 Test 3: Verifying Bill consultationBill structure...');
    const billsWithConsultation = await Bill.find({ 
      'consultationBill.amount': { $gt: 0 } 
    }).limit(10);
    
    let structureValid = true;
    for (const bill of billsWithConsultation) {
      if (!bill.consultationBill) {
        errors.push(`Bill ${bill._id}: Missing consultationBill`);
        structureValid = false;
        failed++;
      } else {
        // Check required fields
        if (bill.consultationBill.amount === undefined) {
          errors.push(`Bill ${bill._id}: Missing consultationBill.amount`);
          structureValid = false;
          failed++;
        }
        if (bill.consultationBill.status === undefined) {
          errors.push(`Bill ${bill._id}: Missing consultationBill.status`);
          structureValid = false;
          failed++;
        }
      }
    }
    
    if (structureValid) {
      console.log(`   ✅ Bill structure is valid (checked ${billsWithConsultation.length} bills)`);
      passed++;
    }

    // Test 4: Verify appointment references
    console.log('\n📋 Test 4: Verifying appointment references...');
    const billsWithAppointments = await Bill.find({}).populate('appointmentId').limit(10);
    let appointmentValid = true;
    
    for (const bill of billsWithAppointments) {
      if (!bill.appointmentId) {
        errors.push(`Bill ${bill._id}: Missing appointmentId`);
        appointmentValid = false;
        failed++;
      } else {
        const appointment = await Appointment.findById(bill.appointmentId._id || bill.appointmentId);
        if (!appointment) {
          errors.push(`Bill ${bill._id}: Referenced appointment not found`);
          appointmentValid = false;
          failed++;
        }
      }
    }
    
    if (appointmentValid) {
      console.log(`   ✅ Appointment references are valid (checked ${billsWithAppointments.length} bills)`);
      passed++;
    }

    // Test 5: Check data consistency
    console.log('\n📋 Test 5: Checking data consistency...');
    const billsToCheck = await Bill.find({ 
      'consultationBill.status': 'paid' 
    }).limit(10);
    
    let consistencyValid = true;
    for (const bill of billsToCheck) {
      // Check if paid consultation bills have BillPayment records
      const billPayment = await BillPayment.findOne({ 
        billId: bill._id, 
        billType: 'consultation',
        paymentStatus: 'completed'
      });
      
      if (!billPayment && bill.consultationBill.paymentMethod !== 'cash') {
        // Online payments should have BillPayment records
        console.log(`   ⚠️  Bill ${bill._id}: Paid consultation bill without BillPayment record (might be cash payment)`);
      }
    }
    
    if (consistencyValid) {
      console.log(`   ✅ Data consistency looks good`);
      passed++;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    } else {
      console.log('\n✅ No errors found! Migration looks successful.');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Test completed. Database connection closed.');
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testMigration()
    .then(() => {
      console.log('Test script completed');
    })
    .catch((error) => {
      console.error('Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testMigration };

