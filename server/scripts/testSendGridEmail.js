/**
 * Script để test các hàm gửi email với SendGrid
 * Chạy: node server/scripts/testSendGridEmail.js
 */

require('dotenv').config();

const {
  sendOtpEmail,
  sendVerificationEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
  sendAppointmentRescheduleEmail,
  sendDoctorAppointmentNotificationEmail
} = require('../services/emailService');

// Email test - thay bằng email thật của bạn
const TEST_EMAIL = process.env.TEST_EMAIL || 'your-email@example.com';

console.log('🧪 Bắt đầu test SendGrid Email Service\n');
console.log('📧 Email test:', TEST_EMAIL);
console.log('🔑 SendGrid API Key:', process.env.SENDGRID_API_KEY ? 'Đã cấu hình' : '❌ CHƯA CẤU HÌNH');
console.log('👤 Email người gửi:', process.env.EMAIL_USER);
console.log('\n' + '='.repeat(60) + '\n');

// Test 1: Send OTP Email
const testOtpEmail = async () => {
  console.log('1️⃣  Testing sendOtpEmail...');
  try {
    await sendOtpEmail(TEST_EMAIL, '123456');
    console.log('✅ sendOtpEmail: PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ sendOtpEmail: FAILED');
    console.error('Error:', error.message);
    console.log('');
    return false;
  }
};

// Test 2: Send Verification Email
const testVerificationEmail = async () => {
  console.log('2️⃣  Testing sendVerificationEmail...');
  try {
    await sendVerificationEmail(TEST_EMAIL, 'test-token-123', 'Nguyễn Văn A');
    console.log('✅ sendVerificationEmail: PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ sendVerificationEmail: FAILED');
    console.error('Error:', error.message);
    console.log('');
    return false;
  }
};

// Test 3: Send Appointment Confirmation Email
const testAppointmentConfirmationEmail = async () => {
  console.log('3️⃣  Testing sendAppointmentConfirmationEmail...');
  try {
    const appointmentInfo = {
      bookingCode: 'BK123456',
      doctorName: 'BS. Trần Thị B',
      hospitalName: 'Bệnh viện Đa khoa Trung ương',
      appointmentDate: '15/11/2025',
      startTime: '09:00',
      endTime: '09:30',
      roomName: 'Phòng khám 101',
      queueNumber: 5,
      specialtyName: 'Nội khoa',
      serviceName: 'Khám tổng quát'
    };
    
    await sendAppointmentConfirmationEmail(TEST_EMAIL, 'Nguyễn Văn A', appointmentInfo);
    console.log('✅ sendAppointmentConfirmationEmail: PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ sendAppointmentConfirmationEmail: FAILED');
    console.error('Error:', error.message);
    console.log('');
    return false;
  }
};

// Test 4: Send Appointment Reminder Email
const testAppointmentReminderEmail = async () => {
  console.log('4️⃣  Testing sendAppointmentReminderEmail...');
  try {
    const appointmentInfo = {
      bookingCode: 'BK123456',
      doctorName: 'BS. Trần Thị B',
      hospitalName: 'Bệnh viện Đa khoa Trung ương',
      appointmentDate: '15/11/2025',
      startTime: '09:00',
      endTime: '09:30',
      hospitalAddress: '123 Đường ABC, Quận 1, TP.HCM'
    };
    
    await sendAppointmentReminderEmail(TEST_EMAIL, 'Nguyễn Văn A', appointmentInfo);
    console.log('✅ sendAppointmentReminderEmail: PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ sendAppointmentReminderEmail: FAILED');
    console.error('Error:', error.message);
    console.log('');
    return false;
  }
};

// Test 5: Send Appointment Reschedule Email
const testAppointmentRescheduleEmail = async () => {
  console.log('5️⃣  Testing sendAppointmentRescheduleEmail...');
  try {
    const appointmentInfo = {
      bookingCode: 'BK123456',
      doctorName: 'BS. Trần Thị B',
      hospitalName: 'Bệnh viện Đa khoa Trung ương',
      appointmentDate: '16/11/2025',
      startTime: '10:00',
      endTime: '10:30',
      roomName: 'Phòng khám 102',
      queueNumber: 3,
      specialtyName: 'Nội khoa',
      serviceName: 'Khám tổng quát'
    };
    
    const oldAppointmentInfo = {
      appointmentDate: '15/11/2025',
      startTime: '09:00',
      endTime: '09:30',
      roomName: 'Phòng khám 101',
      queueNumber: 5
    };
    
    await sendAppointmentRescheduleEmail(TEST_EMAIL, 'Nguyễn Văn A', appointmentInfo, oldAppointmentInfo);
    console.log('✅ sendAppointmentRescheduleEmail: PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ sendAppointmentRescheduleEmail: FAILED');
    console.error('Error:', error.message);
    console.log('');
    return false;
  }
};

// Test 6: Send Doctor Appointment Notification Email
const testDoctorAppointmentNotificationEmail = async () => {
  console.log('6️⃣  Testing sendDoctorAppointmentNotificationEmail...');
  try {
    const appointmentInfo = {
      bookingCode: 'BK123456',
      appointmentDate: '15/11/2025',
      startTime: '09:00',
      endTime: '09:30',
      hospitalName: 'Bệnh viện Đa khoa Trung ương',
      roomName: 'Phòng khám 101',
      specialtyName: 'Nội khoa',
      serviceName: 'Khám tổng quát',
      isRescheduled: false
    };
    
    const patientInfo = {
      name: 'Nguyễn Văn A',
      email: TEST_EMAIL,
      phone: '0901234567'
    };
    
    const result = await sendDoctorAppointmentNotificationEmail(TEST_EMAIL, 'Trần Thị B', appointmentInfo, patientInfo);
    
    if (result.success) {
      console.log('✅ sendDoctorAppointmentNotificationEmail: PASSED\n');
      return true;
    } else {
      console.error('❌ sendDoctorAppointmentNotificationEmail: FAILED');
      console.error('Error:', result.error);
      console.log('');
      return false;
    }
  } catch (error) {
    console.error('❌ sendDoctorAppointmentNotificationEmail: FAILED');
    console.error('Error:', error.message);
    console.log('');
    return false;
  }
};

// Run all tests
const runAllTests = async () => {
  const results = {
    passed: 0,
    failed: 0,
    total: 6
  };
  
  // Kiểm tra cấu hình trước khi test
  if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'your_sendgrid_api_key_here') {
    console.error('❌ SENDGRID_API_KEY chưa được cấu hình!');
    console.error('Vui lòng thêm SENDGRID_API_KEY vào file .env');
    console.error('\nHướng dẫn:');
    console.error('1. Đăng ký tài khoản tại https://sendgrid.com');
    console.error('2. Vào Settings > API Keys');
    console.error('3. Tạo API key mới với quyền "Mail Send"');
    console.error('4. Copy API key và thêm vào file .env');
    process.exit(1);
  }
  
  if (TEST_EMAIL === 'your-email@example.com') {
    console.error('❌ TEST_EMAIL chưa được cấu hình!');
    console.error('Vui lòng thêm TEST_EMAIL vào file .env hoặc thay đổi trong script này');
    process.exit(1);
  }
  
  console.log('⏳ Đang chạy tests... (có thể mất vài giây)\n');
  
  // Run tests with delay to avoid rate limiting
  if (await testOtpEmail()) results.passed++;
  else results.failed++;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (await testVerificationEmail()) results.passed++;
  else results.failed++;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (await testAppointmentConfirmationEmail()) results.passed++;
  else results.failed++;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (await testAppointmentReminderEmail()) results.passed++;
  else results.failed++;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (await testAppointmentRescheduleEmail()) results.passed++;
  else results.failed++;
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (await testDoctorAppointmentNotificationEmail()) results.passed++;
  else results.failed++;
  
  // Print summary
  console.log('='.repeat(60));
  console.log('📊 KẾT QUẢ TEST');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}/${results.total}`);
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    console.log('\n🎉 TẤT CẢ TESTS ĐỀU PASSED!');
    console.log('✅ SendGrid email service hoạt động hoàn hảo!');
    console.log('\n📧 Kiểm tra inbox của bạn tại:', TEST_EMAIL);
  } else {
    console.log('\n⚠️  MỘT SỐ TESTS FAILED!');
    console.log('Vui lòng kiểm tra lại cấu hình và error messages ở trên.');
  }
  
  process.exit(results.failed === 0 ? 0 : 1);
};

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Lỗi không mong đợi:', error);
  process.exit(1);
});
