const cron = require('node-cron');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const { sendAppointmentReminderEmail } = require('../services/emailService');

const execAsync = promisify(exec);

/**
 * Khởi tạo các tác vụ cron job
 */
const initCronJobs = () => {
  console.log('Khởi tạo các tác vụ cron job...');

  // Gửi email nhắc nhở lịch hẹn vào 8:00 AM mỗi ngày
  // Tìm tất cả lịch hẹn trong ngày mai và gửi nhắc nhở
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('Bắt đầu gửi email nhắc nhở lịch hẹn cho ngày mai...');
      
      // Tính toán ngày mai
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
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
      
      console.log(`Tìm thấy ${appointments.length} lịch hẹn cần gửi nhắc nhở cho ngày mai.`);
      
      // Gửi email nhắc nhở cho từng lịch hẹn
      for (const appointment of appointments) {
        try {
          if (!appointment.patientId || !appointment.patientId.email) {
            console.log(`Bỏ qua lịch hẹn ${appointment._id} vì không có thông tin email bệnh nhân`);
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
          
          console.log(`Đã gửi email nhắc nhở cho lịch hẹn ${appointment._id}`);
        } catch (emailError) {
          console.error(`Lỗi khi gửi email nhắc nhở cho lịch hẹn ${appointment._id}:`, emailError);
        }
      }
      
      console.log('Hoàn thành gửi email nhắc nhở lịch hẹn.');
    } catch (error) {
      console.error('Lỗi khi thực hiện tác vụ gửi email nhắc nhở:', error);
    }
  });

  // Tự động seed service và doctor mappings mỗi 6 giờ
  // Đảm bảo dữ liệu trong Qdrant luôn đồng bộ với database
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log('🔄 Bắt đầu tự động seed service và doctor mappings...');
      
      const scriptPath = path.join(__dirname, '../scripts/seedSpecialtyMapper.js');
      
      // Seed services
      try {
        console.log('📦 Đang seed services...');
        const { stdout: serviceStdout, stderr: serviceStderr } = await execAsync(
          `node "${scriptPath}" service`,
          { cwd: path.join(__dirname, '../..'), timeout: 600000 } // 10 phút timeout
        );
        if (serviceStdout) console.log(serviceStdout);
        if (serviceStderr) console.error('Service seed stderr:', serviceStderr);
        console.log('✅ Hoàn thành seed services');
      } catch (serviceError) {
        console.error('❌ Lỗi khi seed services:', serviceError.message);
      }
      
      // Seed doctors
      try {
        console.log('👨‍⚕️ Đang seed doctors...');
        const { stdout: doctorStdout, stderr: doctorStderr } = await execAsync(
          `node "${scriptPath}" doctor`,
          { cwd: path.join(__dirname, '../..'), timeout: 600000 } // 10 phút timeout
        );
        if (doctorStdout) console.log(doctorStdout);
        if (doctorStderr) console.error('Doctor seed stderr:', doctorStderr);
        console.log('✅ Hoàn thành seed doctors');
      } catch (doctorError) {
        console.error('❌ Lỗi khi seed doctors:', doctorError.message);
      }
      
      console.log('🎉 Hoàn thành tự động seed mappings');
    } catch (error) {
      console.error('❌ Lỗi khi thực hiện tự động seed mappings:', error);
    }
  });

  // Tự động seed specialty mappings mỗi ngày vào 2h sáng
  // (Ít thay đổi hơn nên không cần seed thường xuyên)
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🔄 Bắt đầu tự động seed specialty mappings...');
      
      const scriptPath = path.join(__dirname, '../scripts/seedSpecialtyMapper.js');
      
      const { stdout, stderr } = await execAsync(
        `node "${scriptPath}" specialty`,
        { cwd: path.join(__dirname, '../..'), timeout: 300000 } // 5 phút timeout
      );
      
      if (stdout) console.log(stdout);
      if (stderr) console.error('Specialty seed stderr:', stderr);
      console.log('✅ Hoàn thành seed specialty mappings');
    } catch (error) {
      console.error('❌ Lỗi khi seed specialty mappings:', error.message);
    }
  });

  console.log('Đã khởi tạo tất cả tác vụ cron job.');
};

/**
 * Hàm test để chạy thủ công (không cần đợi schedule)
 */
const testAppointmentReminder = async () => {
  try {
    console.log('Bắt đầu test gửi email nhắc nhở lịch hẹn...');
    
    // Tính toán ngày mai
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
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
    
    console.log(`Tìm thấy ${appointments.length} lịch hẹn cần gửi nhắc nhở cho ngày mai.`);
    
    const results = {
      total: appointments.length,
      success: 0,
      failed: 0,
      details: []
    };
    
    // Gửi email nhắc nhở cho từng lịch hẹn
    for (const appointment of appointments) {
      try {
        if (!appointment.patientId || !appointment.patientId.email) {
          console.log(`Bỏ qua lịch hẹn ${appointment._id} vì không có thông tin email bệnh nhân`);
          results.failed++;
          results.details.push({
            appointmentId: appointment._id,
            status: 'skipped',
            reason: 'No email'
          });
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
        
        console.log(`Đã gửi email nhắc nhở cho lịch hẹn ${appointment._id}`);
        results.success++;
        results.details.push({
          appointmentId: appointment._id,
          patientEmail: appointment.patientId.email,
          status: 'success'
        });
      } catch (emailError) {
        console.error(`Lỗi khi gửi email nhắc nhở cho lịch hẹn ${appointment._id}:`, emailError);
        results.failed++;
        results.details.push({
          appointmentId: appointment._id,
          status: 'failed',
          error: emailError.message
        });
      }
    }
    
    console.log('Hoàn thành test gửi email nhắc nhở lịch hẹn.');
    return results;
  } catch (error) {
    console.error('Lỗi khi thực hiện test gửi email nhắc nhở:', error);
    throw error;
  }
};

module.exports = {
  initCronJobs,
  testAppointmentReminder
}; 