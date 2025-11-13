/**
 * Script để test cron jobs
 * 
 * Cách sử dụng:
 * 1. Chạy trực tiếp: node server/scripts/testCron.js
 * 2. Hoặc với nodemon: nodemon server/scripts/testCron.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const { sendAppointmentReminderEmail } = require('../services/emailService');

// Kết nối database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB');
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error);
    process.exit(1);
  }
};

// Test function gửi email nhắc nhở
const testAppointmentReminder = async () => {
  try {
    console.log('\n📧 Bắt đầu test gửi email nhắc nhở lịch hẹn...\n');
    
    // Tính toán ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    console.log(`📅 Tìm lịch hẹn từ: ${tomorrow.toLocaleString('vi-VN')}`);
    console.log(`📅 Đến: ${dayAfterTomorrow.toLocaleString('vi-VN')}\n`);
    
    // Tìm tất cả lịch hẹn trong ngày mai
    const appointments = await Appointment.find({
      appointmentDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow
      },
      status: { $nin: ['cancelled', 'completed'] }
    })
    .populate('patientId', 'fullName email')
    .populate({
      path: 'doctorId',
      populate: {
        path: 'user',
        select: 'fullName'
      }
    })
    .populate('hospitalId');
    
    console.log(`📋 Tìm thấy ${appointments.length} lịch hẹn cần gửi nhắc nhở\n`);
    
    if (appointments.length === 0) {
      console.log('⚠️  Không có lịch hẹn nào để test. Bạn có thể:');
      console.log('   1. Tạo lịch hẹn mới với appointmentDate là ngày mai');
      console.log('   2. Hoặc test với lịch hẹn hiện tại bằng cách sửa code\n');
      return;
    }
    
    // Hiển thị danh sách lịch hẹn
    console.log('📝 Danh sách lịch hẹn:');
    appointments.forEach((apt, index) => {
      console.log(`   ${index + 1}. ID: ${apt._id}`);
      console.log(`      Bệnh nhân: ${apt.patientId?.fullName || 'N/A'} (${apt.patientId?.email || 'N/A'})`);
      console.log(`      Bác sĩ: ${apt.doctorId?.user?.fullName || 'N/A'}`);
      console.log(`      Ngày: ${apt.appointmentDate.toLocaleDateString('vi-VN')}`);
      console.log(`      Giờ: ${apt.timeSlot?.startTime || 'N/A'} - ${apt.timeSlot?.endTime || 'N/A'}`);
      console.log('');
    });
    
    // Hỏi xác nhận trước khi gửi email
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('❓ Bạn có muốn gửi email nhắc nhở cho các lịch hẹn này? (y/n): ', async (answer) => {
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Đã hủy. Không gửi email.');
        rl.close();
        await mongoose.connection.close();
        process.exit(0);
      }
      
      // Gửi email nhắc nhở cho từng lịch hẹn
      let successCount = 0;
      let failCount = 0;
      
      for (const appointment of appointments) {
        try {
          if (!appointment.patientId || !appointment.patientId.email) {
            console.log(`⚠️  Bỏ qua lịch hẹn ${appointment._id} vì không có thông tin email bệnh nhân`);
            failCount++;
            continue;
          }
          
          // Tạo địa chỉ bệnh viện
          let hospitalAddress = '';
          if (appointment.hospitalId && appointment.hospitalId.address) {
            const address = appointment.hospitalId.address;
            const addressParts = [];
            
            if (address.street) addressParts.push(address.street);
            if (address.district) addressParts.push(address.district);
            if (address.city) addressParts.push(address.city);
            if (address.country) addressParts.push(address.country);
            
            hospitalAddress = addressParts.join(', ');
          }
          
          await sendAppointmentReminderEmail(
            appointment.patientId.email,
            appointment.patientId.fullName,
            {
              bookingCode: appointment.bookingCode || appointment._id.toString().substring(0, 8).toUpperCase(),
              doctorName: appointment.doctorId.user.fullName,
              hospitalName: appointment.hospitalId.name,
              appointmentDate: appointment.appointmentDate.toLocaleDateString('vi-VN'),
              startTime: appointment.timeSlot.startTime,
              endTime: appointment.timeSlot.endTime,
              hospitalAddress
            }
          );
          
          console.log(`✅ Đã gửi email nhắc nhở cho lịch hẹn ${appointment._id} đến ${appointment.patientId.email}`);
          successCount++;
        } catch (emailError) {
          console.error(`❌ Lỗi khi gửi email nhắc nhở cho lịch hẹn ${appointment._id}:`, emailError.message);
          failCount++;
        }
      }
      
      console.log(`\n📊 Kết quả:`);
      console.log(`   ✅ Thành công: ${successCount}`);
      console.log(`   ❌ Thất bại: ${failCount}`);
      console.log(`   📧 Tổng cộng: ${appointments.length}\n`);
      
      rl.close();
      await mongoose.connection.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Lỗi khi thực hiện test:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Main function
const main = async () => {
  console.log('🚀 Bắt đầu test cron jobs...\n');
  
  // Email service (SendGrid) is initialized automatically when imported
  console.log('✅ Email service (SendGrid) đã sẵn sàng\n');
  
  // Kết nối database
  await connectDB();
  
  // Test gửi email nhắc nhở
  await testAppointmentReminder();
};

// Chạy script
main().catch(error => {
  console.error('❌ Lỗi không mong đợi:', error);
  process.exit(1);
});


