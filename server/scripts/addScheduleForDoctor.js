const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Schedule = require('../models/Schedule');
const Hospital = require('../models/Hospital');
const Room = require('../models/Room');
const Specialty = require('../models/Specialty');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalweb';

// Hàm tạo lịch khám cho một bác sĩ
const addScheduleForSingleDoctor = async (doctorNamePattern) => {
  // Tìm bác sĩ theo tên (tìm không phân biệt hoa thường)
  const doctorUser = await User.findOne({
    fullName: { $regex: new RegExp(doctorNamePattern, 'i') },
    roleType: 'doctor'
  });

  if (!doctorUser) {
    throw new Error(`Không tìm thấy bác sĩ "${doctorNamePattern}"`);
  }

  console.log(`\n=== Xử lý bác sĩ: ${doctorUser.fullName} ===`);
  console.log(`ID: ${doctorUser._id}`);

  // Tìm thông tin Doctor record
  const doctor = await Doctor.findOne({ user: doctorUser._id })
    .populate('hospitalId')
    .populate('specialtyId');

  if (!doctor) {
    throw new Error(`Không tìm thấy thông tin bác sĩ trong bảng Doctor cho ${doctorUser.fullName}`);
  }

  console.log(`Bệnh viện: ${doctor.hospitalId?.name || 'N/A'}`);
  console.log(`Chuyên khoa: ${doctor.specialtyId?.name || 'N/A'}`);

  // Lấy bệnh viện của bác sĩ
  const hospital = doctor.hospitalId;
  if (!hospital) {
    throw new Error(`Bác sĩ ${doctorUser.fullName} không có bệnh viện được gán`);
  }

  // Tìm phòng khám trong bệnh viện này (ưu tiên phòng có cùng chuyên khoa)
  let room = await Room.findOne({
    hospitalId: hospital._id,
    status: 'active',
    isActive: true,
    ...(doctor.specialtyId ? { specialtyId: doctor.specialtyId._id } : {})
  });

  // Nếu không tìm thấy phòng cùng chuyên khoa, tìm bất kỳ phòng nào
  if (!room) {
    room = await Room.findOne({
      hospitalId: hospital._id,
      status: 'active',
      isActive: true
    });
  }

  if (!room) {
    throw new Error(`Không tìm thấy phòng khám nào trong bệnh viện ${hospital.name}`);
  }

  console.log(`Phòng khám: ${room.name} (${room.number}) - Tầng ${room.floor}`);

  // Tạo lịch khám cho 7 ngày tiếp theo
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedulesCreated = [];

  for (let day = 0; day < 7; day++) {
    const scheduleDate = new Date(today);
    scheduleDate.setDate(scheduleDate.getDate() + day);

    // Bỏ qua cuối tuần (thứ 7 và chủ nhật)
    const dayOfWeek = scheduleDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log(`  Bỏ qua ${scheduleDate.toLocaleDateString('vi-VN')} (cuối tuần)`);
      continue;
    }

    // Kiểm tra xem đã có lịch cho ngày này chưa
    const scheduleDateStart = new Date(scheduleDate);
    scheduleDateStart.setHours(0, 0, 0, 0);
    const scheduleDateEnd = new Date(scheduleDate);
    scheduleDateEnd.setHours(23, 59, 59, 999);

    const existingSchedule = await Schedule.findOne({
      doctorId: doctor._id,
      date: {
        $gte: scheduleDateStart,
        $lt: scheduleDateEnd
      }
    });

    if (existingSchedule) {
      console.log(`  Đã có lịch cho ngày ${scheduleDate.toLocaleDateString('vi-VN')}, bỏ qua...`);
      continue;
    }

    // Tạo các khung giờ cho ca sáng (8:00 - 12:00)
    const morningTimeSlots = [
      {
        startTime: '08:00',
        endTime: '09:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      },
      {
        startTime: '09:00',
        endTime: '10:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      },
      {
        startTime: '10:00',
        endTime: '11:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      },
      {
        startTime: '11:00',
        endTime: '12:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      }
    ];

    // Tạo lịch ca sáng
    const morningSchedule = await Schedule.create({
      doctorId: doctor._id,
      hospitalId: hospital._id,
      date: scheduleDate,
      timeSlots: morningTimeSlots,
      isActive: true,
      notes: 'Lịch khám buổi sáng'
    });

    schedulesCreated.push(morningSchedule);
    console.log(`  ✓ Đã tạo lịch ca sáng cho ngày ${scheduleDate.toLocaleDateString('vi-VN')}`);

    // Tạo các khung giờ cho ca chiều (13:00 - 17:00)
    const afternoonTimeSlots = [
      {
        startTime: '13:00',
        endTime: '14:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      },
      {
        startTime: '14:00',
        endTime: '15:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      },
      {
        startTime: '15:00',
        endTime: '16:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      },
      {
        startTime: '16:00',
        endTime: '17:00',
        isBooked: false,
        bookedCount: 0,
        maxBookings: 3,
        appointmentIds: [],
        roomId: room._id
      }
    ];

    // Tạo lịch ca chiều
    const afternoonSchedule = await Schedule.create({
      doctorId: doctor._id,
      hospitalId: hospital._id,
      date: scheduleDate,
      timeSlots: afternoonTimeSlots,
      isActive: true,
      notes: 'Lịch khám buổi chiều'
    });

    schedulesCreated.push(afternoonSchedule);
    console.log(`  ✓ Đã tạo lịch ca chiều cho ngày ${scheduleDate.toLocaleDateString('vi-VN')}`);
  }

  return {
    doctorName: doctorUser.fullName,
    hospitalName: hospital.name,
    roomName: `${room.name} (${room.number}) - Tầng ${room.floor}`,
    schedulesCreated
  };
};

// Hàm chính để thêm lịch cho nhiều bác sĩ
const addScheduleForDoctors = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully\n');

    // Danh sách các bác sĩ cần thêm lịch
    const doctorNames = [
      'Nguyễn.*văn.*a',
      'Trần.*thị.*b',
      'Phạm.*văn.*c',
      'Lê.*thị.*d'
    ];

    const results = [];

    for (const doctorNamePattern of doctorNames) {
      try {
        const result = await addScheduleForSingleDoctor(doctorNamePattern);
        results.push(result);
      } catch (error) {
        console.error(`\n❌ Lỗi khi xử lý bác sĩ "${doctorNamePattern}": ${error.message}`);
        // Tiếp tục xử lý các bác sĩ khác
      }
    }

    // Tổng kết kết quả
    console.log('\n\n=== TỔNG KẾT ===');
    let totalSchedules = 0;
    
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. Bác sĩ: ${result.doctorName}`);
      console.log(`   Bệnh viện: ${result.hospitalName}`);
      console.log(`   Phòng khám: ${result.roomName}`);
      console.log(`   Số lịch đã tạo: ${result.schedulesCreated.length}`);
      totalSchedules += result.schedulesCreated.length;

      // Hiển thị chi tiết các lịch đã tạo
      if (result.schedulesCreated.length > 0) {
        console.log(`   Chi tiết:`);
        result.schedulesCreated.forEach((schedule, idx) => {
          const dateStr = new Date(schedule.date).toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const timeSlotsStr = schedule.timeSlots.map(ts => `${ts.startTime}-${ts.endTime}`).join(', ');
          console.log(`     - ${dateStr}: ${timeSlotsStr}`);
        });
      }
    });

    console.log(`\n\n✅ Tổng cộng đã tạo ${totalSchedules} lịch khám cho ${results.length} bác sĩ`);

  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nĐã đóng kết nối MongoDB');
  }
};

// Chạy script
addScheduleForDoctors();

