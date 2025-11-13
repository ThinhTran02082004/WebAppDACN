const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');
const Hospital = require('../models/Hospital'); 
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Specialty = require('../models/Specialty'); 
const Schedule = require('../models/Schedule'); // <-- Thêm model Schedule
const User = require('../models/User'); // <-- Thêm model User
const cache = require('./cacheService'); // Import cache để lấy userId từ sessionId

// 1. Khởi tạo AI (Giữ nguyên)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: 
`Role: You are a medical booking assistant.

CRITICAL RULE: NEVER book an appointment unless the user has explicitly confirmed a specific slot ID.

Flow (Luồng hoạt động BẮT BUỘC):
1. User asks to find appointments (ví dụ: "đặt lịch", "tìm bác sĩ").
2. Hành động ĐẦU TIÊN luôn là gọi tool findAvailableSlots để đưa ra các lựa chọn.
3. PHẢI hiển thị danh sách lựa chọn gồm bác sĩ, thời gian và slotId.
4. Chỉ khi người dùng xác nhận một slot cụ thể (ví dụ: "tôi chọn slot 123"), bạn mới được phép tiếp tục.
5. Lúc đó, gọi tool bookAppointment với slotId người dùng chọn và sessionId.
6. Tuyệt đối không gọi bookAppointment ngay từ yêu cầu đầu tiên.

Output format:
Viết tiếng Việt thân thiện, rõ ràng, không dùng Markdown (*, **), không dùng dấu đầu dòng. Trình bày danh sách bằng các dòng trống và xuống dòng rõ ràng.`
});

// 2. Định nghĩa Tools (Schema)
const tools = {
    functionDeclarations: [
        {
            name: "findHospitals",
            description: "Tìm kiếm bệnh viện dựa trên chuyên khoa, thành phố hoặc tên.",
            parameters: { 
                type: "OBJECT",
                properties: {
                    specialty: { type: "STRING", description: "Chuyên khoa người dùng muốn khám (ví dụ: 'tim mạch', 'tai mũi họng')" },
                    city: { type: "STRING", description: "Thành phố hoặc địa chỉ (ví dụ: 'TP.HCM', 'Hà Nội')" },
                    name: { type: "STRING", description: "Tên bệnh viện" }
                },
            }
        },
        {
            name: "findDoctors",
            description: "Tìm kiếm bác sĩ dựa trên chuyên khoa hoặc tên.",
            parameters: { 
                type: "OBJECT",
                properties: {
                    specialty: { type: "STRING", description: "Chuyên khoa người dùng muốn khám (ví dụ: 'tim mạch', 'tai mũi họng')" },
                    name: { type: "STRING", description: "Tên bác sĩ" }
                },
            }
        },
        {
            name: "getAppointmentHistory",
            description: "Lấy lịch sử 5 cuộc hẹn đã hoàn thành gần nhất của một bệnh nhân.",
            parameters: {
                type: "OBJECT",
                properties: {
                    patientId: { type: "STRING", description: "ID của bệnh nhân (User ID)." }
                },
                required: ["patientId"]
            }
        },
        // ⭐ Thêm tool tìm slot trống
        {
            name: "findAvailableSlots",
            description: "Tìm các lịch hẹn còn trống dựa trên yêu cầu của người dùng.",
            parameters: {
                type: "OBJECT",
                properties: {
                    specialty: { type: "STRING", description: "Chuyên khoa người dùng muốn khám" },
                    city: { type: "STRING", description: "Thành phố hoặc địa chỉ" },
                    date: { type: "STRING", description: "Ngày người dùng muốn khám (ví dụ: 'sáng mai', '20-12-2025')" }
                },
                required: ["specialty"]
            }
        },
        // ⭐ Thêm tool đặt lịch theo slot đã chọn
        {
            name: "bookAppointment",
            description: "Đặt lịch hẹn sau khi người dùng đã chọn một slotId cụ thể.",
            parameters: {
                type: "OBJECT",
                properties: {
                    slotId: { type: "STRING", description: "ID của lịch hẹn (slot) cụ thể mà người dùng đã chọn từ danh sách." },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại (bắt buộc)." }
                },
                required: ["slotId", "sessionId"]
            }
        },
        {
            name: "cancelAppointment",
            description: "Hủy một lịch hẹn đã đặt bằng cách sử dụng mã đặt lịch.",
            parameters: {
                type: "OBJECT",
                properties: {
                    bookingCode: { 
                        type: "STRING", 
                        description: "Mã đặt lịch của người dùng (ví dụ: APT-12345)" 
                    },
                    reason: {
                        type: "STRING",
                        description: "Lý do hủy lịch (ví dụ: 'tôi bận', 'đổi ý')"
                    },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại. Bạn PHẢI truyền nó." }
                },
                required: ["bookingCode", "reason", "sessionId"]
            }
        },
        {
            name: "rescheduleAppointment",
            description: "Tìm một lịch trống mới và dời lịch hẹn cũ sang lịch mới đó.",
            parameters: {
                type: "OBJECT",
                properties: {
                    bookingCode: { 
                        type: "STRING", 
                        description: "Mã đặt lịch của lịch hẹn CŨ (ví dụ: APT-12345)" 
                    },
                    preferredDate: {
                        type: "STRING",
                        description: "Ngày MỚI mà user muốn dời đến (ví dụ: 'sáng mai', 'ngày 20-12')"
                    },
                    preferredTime: {
                        type: "STRING",
                        description: "Giờ MỚI mà user muốn (ví dụ: '9:00', 'buổi chiều')"
                    },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại. Bạn PHẢI truyền nó." }
                },
                required: ["bookingCode", "preferredDate", "sessionId"]
            }
        }
    ]
};

// 3. HÀM THỰC THI (Available Tools)
const availableTools = {
    
    "findHospitals": async ({ specialty, city, name }) => {
        try {
            let filter = {};
            if (city) filter.address = { $regex: city, $options: 'i' }; 
            if (name) filter.name = { $regex: name, $options: 'i' };

            if (specialty) {
                const specialtyDoc = await Specialty.findOne({ name: { $regex: specialty, $options: 'i' } });
                if (specialtyDoc) {
                    filter.specialties = { $in: [specialtyDoc._id] };
                } else {
                    return { hospitals: [] };
                }
            }
            // Lọc kết quả trả về cho gọn
            const hospitals = await Hospital.find(filter).limit(3).select('name address').exec();
            return { hospitals };
        } catch (e) { 
            console.error("Lỗi findHospitals:", e);
            return { error: e.message }; 
        }
    },

    "findDoctors": async ({ specialty, name }) => {
        try {
            let filter = {};
            if (specialty) {
                const specialtyDoc = await Specialty.findOne({ name: { $regex: specialty, $options: 'i' } });
                if (specialtyDoc) {
                    filter.specialtyId = specialtyDoc._id; 
                } else {
                    return { doctors: [] };
                }
            }
            // Lọc kết quả trả về cho gọn
            const doctors = await Doctor.find(filter)
                .populate('user', 'fullName')
                .limit(3)
                .select('user consultationFee')
                .exec();
            return { doctors };
        } catch (e) { 
            console.error("Lỗi findDoctors:", e);
            return { error: e.message }; 
        }   
    },

    "getAppointmentHistory": async ({ patientId }) => {
        try {
            const appointments = await Appointment.find({ patientId: patientId, status: 'completed' })
                                                  .populate('doctorId') 
                                                  .sort({ appointmentDate: -1 })
                                                  .limit(5)
                                                  .exec();
            return { appointments };
        } catch (e) { 
            console.error("Lỗi getAppointmentHistory:", e);
            return { error: e.message }; 
        }
    },

    // ⭐ Tool: Tìm các slot trống theo chuyên khoa/bác sĩ
    "findAvailableSlots": async ({ specialty, city, date }) => {
        try {
            console.log(`[Tool] Đang tìm lịch trống: Chuyên khoa ${specialty}, Ngày ${date || 'không chỉ định'}, Khu vực ${city || 'không chỉ định'}`);

            // 1. Tìm chuyên khoa
            const specialtyDoc = await Specialty.findOne({ name: { $regex: specialty, $options: 'i' } });
            if (!specialtyDoc) return { error: `Không tìm thấy chuyên khoa ${specialty}` };

            // 2. Tìm bác sĩ thuộc chuyên khoa (có thể lọc theo city sau nếu có quan hệ)
            const doctors = await Doctor.find({ specialtyId: specialtyDoc._id }).populate('user', 'fullName');
            if (!doctors.length) return { error: `Không có bác sĩ nào thuộc chuyên khoa ${specialty}` };

            const doctorIds = doctors.map(d => d._id);

            // 3. Parse ngày nếu có cung cấp
            const now = new Date();
            let dateFilterGte = now;
            let dateFilterLte = null;
            if (date) {
                const lower = date.toLowerCase();
                if (lower.includes('mai') || lower.includes('tomorrow')) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(0, 0, 0, 0);
                    const end = new Date(tomorrow);
                    end.setHours(23, 59, 59, 999);
                    dateFilterGte = tomorrow;
                    dateFilterLte = end;
                } else {
                    const m = date.match(/(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?/);
                    if (m) {
                        const day = parseInt(m[1]);
                        const month = parseInt(m[2]) - 1;
                        const year = m[3] ? parseInt(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getFullYear();
                        const start = new Date(year, month, day, 0, 0, 0, 0);
                        const end = new Date(year, month, day, 23, 59, 59, 999);
                        dateFilterGte = start;
                        dateFilterLte = end;
                    } else {
                        const parsed = new Date(date);
                        if (!isNaN(parsed.getTime())) {
                            const start = new Date(parsed);
                            start.setHours(0, 0, 0, 0);
                            const end = new Date(parsed);
                            end.setHours(23, 59, 59, 999);
                            dateFilterGte = start;
                            dateFilterLte = end;
                        }
                    }
                }
            }

            // 4. Tìm lịch trống
            const dateQuery = dateFilterLte ? { $gte: dateFilterGte, $lte: dateFilterLte } : { $gte: dateFilterGte };
            const schedules = await Schedule.find({
                doctorId: { $in: doctorIds },
                date: dateQuery,
                'timeSlots.isBooked': false
            }).limit(10).sort({ date: 1 });

            if (!schedules.length) {
                return { error: `Rất tiếc, đã hết lịch trống cho chuyên khoa ${specialty}.` };
            }

            // 5. Biên soạn danh sách slot
            const slots = [];
            for (const sched of schedules) {
                const doctor = doctors.find(d => d._id.equals(sched.doctorId));
                if (!doctor) continue;
                for (const ts of sched.timeSlots) {
                    if (ts.isBooked) continue;
                    slots.push({
                        slotId: `${sched._id}_${ts._id}`,
                        doctorName: doctor.user?.fullName || 'Bác sĩ',
                        date: sched.date.toLocaleDateString('vi-VN'),
                        time: ts.startTime
                    });
                    if (slots.length >= 10) break;
                }
                if (slots.length >= 10) break;
            }

            return { availableSlots: slots };
        } catch (e) {
            console.error("Lỗi findAvailableSlots:", e);
            return { error: e.message };
        }
    },

    // ⭐ Tool: Đặt lịch theo slot đã chọn (transaction)
    "bookAppointment": async ({ slotId, sessionId }) => {
        const session = await mongoose.startSession();
        try {
            console.log(`[Tool] Đang đặt lịch cho slot: ${slotId}`);

            // 1. Giải mã sessionId -> userId
            const realUserId = cache.getUserId(sessionId);
            if (!realUserId || !mongoose.Types.ObjectId.isValid(realUserId)) {
                return { error: 'Lỗi xác thực: Không tìm thấy ID người dùng. Vui lòng đăng nhập và thử lại.' };
            }

            // 2. Tách slotId
            const [scheduleId, timeSlotId] = (slotId || '').split('_');
            if (!scheduleId || !timeSlotId) {
                return { error: 'Mã lịch hẹn (slotId) không hợp lệ.' };
            }

            // 3. Transaction
            session.startTransaction();

            // 4. Tìm và khóa lịch
            const schedule = await Schedule.findById(scheduleId).session(session);
            if (!schedule) throw new Error("Lịch hẹn không còn tồn tại.");

            const timeSlot = schedule.timeSlots.id(timeSlotId);
            if (!timeSlot) throw new Error("Giờ hẹn không còn tồn tại.");
            if (timeSlot.isBooked) throw new Error("Rất tiếc, giờ hẹn này vừa có người khác đặt mất.");

            // 5. Đánh dấu đã đặt
            timeSlot.isBooked = true;
            await schedule.save({ session });

            // 6. Lấy thông tin
            const doctor = await Doctor.findById(schedule.doctorId)
                .populate('hospitalId')
                .populate('user', 'fullName')
                .session(session);

            // 7. Tạo Appointment
            const newAppointment = new Appointment({
                patientId: realUserId,
                doctorId: doctor._id,
                hospitalId: doctor.hospitalId._id,
                specialtyId: doctor.specialtyId,
                scheduleId: schedule._id,
                appointmentDate: schedule.date,
                timeSlot: { startTime: timeSlot.startTime, endTime: timeSlot.endTime },
                status: 'confirmed'
            });
            await newAppointment.save({ session });

            // 8. Commit
            await session.commitTransaction();

            return {
                success: true,
                bookingCode: newAppointment.bookingCode,
                doctorName: doctor.user?.fullName || 'Bác sĩ',
                hospitalName: doctor.hospitalId.name,
                date: schedule.date.toLocaleDateString('vi-VN'),
                time: timeSlot.startTime
            };
        } catch (e) {
            await session.abortTransaction();
            console.error("Lỗi bookAppointment:", e);
            return { error: e.message };
        } finally {
            session.endSession();
        }
    },

    // ⭐ Tool hủy lịch hẹn
    "cancelAppointment": async ({ bookingCode, reason, sessionId }) => {
        try {
            // 1. Giải mã 'sessionId' để lấy 'realUserId' từ cache
            const realUserId = cache.getUserId(sessionId);

            // 2. Kiểm tra (Validation)
            if (!realUserId || !mongoose.Types.ObjectId.isValid(realUserId)) {
                console.warn(`[Cancel Tool] Thất bại: Yêu cầu hủy lịch bị từ chối vì sessionId không hợp lệ hoặc đã hết hạn.`);
                return { 
                    error: 'Lỗi xác thực: Không tìm thấy ID người dùng. Bạn cần yêu cầu người dùng đăng nhập (hoặc làm mới trang) và thử lại.' 
                };
            }

            if (!bookingCode) {
                return { error: 'Vui lòng cung cấp mã đặt lịch để hủy.' };
            }

            if (!reason) {
                return { error: 'Vui lòng cung cấp lý do hủy lịch.' };
            }

            console.log(`[Cancel Tool] Đang hủy lịch với mã ${bookingCode} cho User ${realUserId}`);

            // 3. Tìm lịch hẹn bằng bookingCode và kiểm tra quyền sở hữu
            const appointment = await Appointment.findOne({ 
                bookingCode: bookingCode,
                patientId: realUserId 
            }).populate('scheduleId');

            if (!appointment) {
                return { 
                    error: `Không tìm thấy lịch hẹn với mã ${bookingCode} hoặc bạn không có quyền hủy lịch này.` 
                };
            }

            // 4. Kiểm tra trạng thái hiện tại
            if (appointment.status === 'cancelled') {
                return { 
                    error: `Lịch hẹn với mã ${bookingCode} đã được hủy trước đó.` 
                };
            }

            if (appointment.status === 'completed') {
                return { 
                    error: `Không thể hủy lịch hẹn đã hoàn thành với mã ${bookingCode}.` 
                };
            }

            // 5. Cập nhật trạng thái lịch hẹn
            appointment.status = 'cancelled';
            appointment.cancellationReason = reason;
            appointment.cancelledBy = 'patient';
            appointment.isCancelled = true;
            await appointment.save();

            // 6. Giải phóng khung giờ trong lịch
            const scheduleId = appointment.scheduleId._id || appointment.scheduleId;
            const schedule = await Schedule.findById(scheduleId);
            
            if (schedule && appointment.timeSlot) {
                const timeSlotIndex = schedule.timeSlots.findIndex(
                    ts => ts.startTime === appointment.timeSlot.startTime && 
                          ts.endTime === appointment.timeSlot.endTime
                );

                if (timeSlotIndex !== -1) {
                    const timeSlot = schedule.timeSlots[timeSlotIndex];
                    // Giảm số lượng đặt chỗ
                    if (timeSlot.bookedCount > 0) {
                        timeSlot.bookedCount -= 1;
                    }
                    // Nếu không còn đặt chỗ nào, đánh dấu là chưa được đặt
                    if (timeSlot.bookedCount === 0) {
                        timeSlot.isBooked = false;
                    }
                    // Xóa appointmentId khỏi danh sách
                    timeSlot.appointmentIds = timeSlot.appointmentIds.filter(
                        id => id.toString() !== appointment._id.toString()
                    );
                    await schedule.save();
                }
            }

            console.log(`[Cancel Tool] Đã hủy lịch hẹn thành công với mã ${bookingCode}`);

            // 7. Trả về kết quả
            return {
                success: true,
                message: `Đã hủy lịch hẹn với mã ${bookingCode} thành công.`,
                bookingCode: bookingCode,
                reason: reason
            };

        } catch (e) { 
            console.error("Lỗi Smart Tool cancelAppointment:", e);
            return { error: e.message }; 
        }
    },

    // ⭐ Tool dời lịch hẹn
    "rescheduleAppointment": async ({ bookingCode, preferredDate, preferredTime, sessionId }) => {
        try {
            // 1. Giải mã 'sessionId' để lấy 'realUserId' từ cache
            const realUserId = cache.getUserId(sessionId);

            // 2. Kiểm tra (Validation)
            if (!realUserId || !mongoose.Types.ObjectId.isValid(realUserId)) {
                console.warn(`[Reschedule Tool] Thất bại: Yêu cầu dời lịch bị từ chối vì sessionId không hợp lệ hoặc đã hết hạn.`);
                return { 
                    error: 'Lỗi xác thực: Không tìm thấy ID người dùng. Bạn cần yêu cầu người dùng đăng nhập (hoặc làm mới trang) và thử lại.' 
                };
            }

            if (!bookingCode) {
                return { error: 'Vui lòng cung cấp mã đặt lịch để dời lịch.' };
            }

            if (!preferredDate) {
                return { error: 'Vui lòng cung cấp ngày mới mà bạn muốn dời đến.' };
            }

            console.log(`[Reschedule Tool] Đang dời lịch với mã ${bookingCode} cho User ${realUserId}`);

            // 3. Tìm lịch hẹn bằng bookingCode và kiểm tra quyền sở hữu
            const appointment = await Appointment.findOne({ 
                bookingCode: bookingCode,
                patientId: realUserId 
            })
            .populate('doctorId')
            .populate('scheduleId')
            .populate('specialtyId');

            if (!appointment) {
                return { 
                    error: `Không tìm thấy lịch hẹn với mã ${bookingCode} hoặc bạn không có quyền dời lịch này.` 
                };
            }

            // 4. Kiểm tra trạng thái hiện tại
            if (appointment.status === 'cancelled') {
                return { 
                    error: `Không thể dời lịch hẹn đã bị hủy với mã ${bookingCode}.` 
                };
            }

            if (appointment.status === 'completed') {
                return { 
                    error: `Không thể dời lịch hẹn đã hoàn thành với mã ${bookingCode}.` 
                };
            }

            // 5. Parse preferredDate (hỗ trợ các định dạng cơ bản)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const parseDate = (dateStr) => {
                // "sáng mai" hoặc "mai" = tomorrow
                if (dateStr.toLowerCase().includes('mai') || dateStr.toLowerCase().includes('tomorrow')) {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return tomorrow;
                }
                
                // "ngày X-Y" hoặc "X/Y" (ví dụ: "20-12", "20/12")
                const dateMatch = dateStr.match(/(\d{1,2})[-\/](\d{1,2})/);
                if (dateMatch) {
                    const day = parseInt(dateMatch[1]);
                    const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
                    const year = today.getFullYear();
                    const parsedDate = new Date(year, month, day);
                    // Nếu ngày đã qua trong năm này, thì tính năm sau
                    if (parsedDate < today) {
                        parsedDate.setFullYear(year + 1);
                    }
                    return parsedDate;
                }
                
                // Thử parse ISO date hoặc standard format
                const parsed = new Date(dateStr);
                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
                
                return null;
            };

            const targetDate = parseDate(preferredDate);
            if (!targetDate || targetDate < today) {
                return { 
                    error: `Không thể parse ngày "${preferredDate}" hoặc ngày đã qua. Vui lòng cung cấp ngày hợp lệ (ví dụ: "ngày 20-12", "sáng mai").` 
                };
            }

            // 6. Tìm lịch trống mới cho cùng bác sĩ
            const doctorId = appointment.doctorId._id || appointment.doctorId;
            const specialtyId = appointment.specialtyId._id || appointment.specialtyId;

            // Tìm schedule có ngày >= targetDate
            const targetDateStart = new Date(targetDate);
            targetDateStart.setHours(0, 0, 0, 0);
            const targetDateEnd = new Date(targetDate);
            targetDateEnd.setHours(23, 59, 59, 999);

            let schedules = await Schedule.find({
                doctorId: doctorId,
                date: { 
                    $gte: targetDateStart,
                    $lte: targetDateEnd
                }
            }).sort({ date: 1 });

            // Nếu không tìm thấy schedule trong ngày đó, tìm schedule gần nhất sau ngày đó
            if (schedules.length === 0) {
                schedules = await Schedule.find({
                    doctorId: doctorId,
                    date: { $gte: targetDateStart }
                }).sort({ date: 1 }).limit(5);
            }

            if (schedules.length === 0) {
                return { 
                    error: `Không tìm thấy lịch trống cho bác sĩ này từ ngày ${targetDate.toLocaleDateString('vi-VN')}.` 
                };
            }

            // 7. Tìm time slot trống phù hợp
            let foundSchedule = null;
            let foundTimeSlot = null;

            for (const schedule of schedules) {
                for (const timeSlot of schedule.timeSlots) {
                    // Kiểm tra nếu time slot còn chỗ
                    const maxBookings = timeSlot.maxBookings || 3;
                    const bookedCount = timeSlot.bookedCount || 0;
                    const isAvailable = !timeSlot.isBooked || (bookedCount < maxBookings);

                    // Nếu có preferredTime, kiểm tra xem có khớp không
                    if (preferredTime) {
                        const timeMatch = preferredTime.match(/(\d{1,2}):?(\d{0,2})/);
                        if (timeMatch) {
                            const hour = parseInt(timeMatch[1]);
                            const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
                            const slotStart = timeSlot.startTime.split(':');
                            const slotHour = parseInt(slotStart[0]);
                            const slotMinute = parseInt(slotStart[1] || 0);
                            
                            // Cho phép sai lệch ±1 giờ
                            if (Math.abs(hour - slotHour) <= 1) {
                                if (isAvailable) {
                                    foundSchedule = schedule;
                                    foundTimeSlot = timeSlot;
                                    break;
                                }
                            }
                        } else if (preferredTime.toLowerCase().includes('sáng') || preferredTime.toLowerCase().includes('morning')) {
                            // Buổi sáng: 8:00 - 12:00
                            const slotHour = parseInt(timeSlot.startTime.split(':')[0]);
                            if (slotHour >= 8 && slotHour < 12 && isAvailable) {
                                foundSchedule = schedule;
                                foundTimeSlot = timeSlot;
                                break;
                            }
                        } else if (preferredTime.toLowerCase().includes('chiều') || preferredTime.toLowerCase().includes('afternoon')) {
                            // Buổi chiều: 13:00 - 17:00
                            const slotHour = parseInt(timeSlot.startTime.split(':')[0]);
                            if (slotHour >= 13 && slotHour < 17 && isAvailable) {
                                foundSchedule = schedule;
                                foundTimeSlot = timeSlot;
                                break;
                            }
                        } else if (preferredTime.toLowerCase().includes('tối') || preferredTime.toLowerCase().includes('evening')) {
                            // Buổi tối: 17:00 - 20:00
                            const slotHour = parseInt(timeSlot.startTime.split(':')[0]);
                            if (slotHour >= 17 && slotHour < 20 && isAvailable) {
                                foundSchedule = schedule;
                                foundTimeSlot = timeSlot;
                                break;
                            }
                        }
                    } else if (isAvailable) {
                        // Nếu không có preferredTime, lấy slot đầu tiên trống
                        foundSchedule = schedule;
                        foundTimeSlot = timeSlot;
                        break;
                    }
                }
                if (foundSchedule) break;
            }

            if (!foundSchedule || !foundTimeSlot) {
                return { 
                    error: `Không tìm thấy lịch trống phù hợp với yêu cầu của bạn. Vui lòng thử ngày hoặc giờ khác.` 
                };
            }

            // 8. Lưu thông tin cũ trước khi cập nhật
            const oldScheduleId = appointment.scheduleId._id || appointment.scheduleId;
            const oldTimeSlot = { ...appointment.timeSlot };
            const oldAppointmentDate = appointment.appointmentDate;

            // 9. Giải phóng time slot cũ
            const oldSchedule = await Schedule.findById(oldScheduleId);
            if (oldSchedule) {
                const oldTimeSlotIndex = oldSchedule.timeSlots.findIndex(
                    ts => ts.startTime === oldTimeSlot.startTime && 
                          ts.endTime === oldTimeSlot.endTime
                );

                if (oldTimeSlotIndex !== -1) {
                    const oldSlot = oldSchedule.timeSlots[oldTimeSlotIndex];
                    if (oldSlot.bookedCount > 0) {
                        oldSlot.bookedCount -= 1;
                    }
                    if (oldSlot.bookedCount === 0) {
                        oldSlot.isBooked = false;
                    }
                    oldSlot.appointmentIds = oldSlot.appointmentIds.filter(
                        id => id.toString() !== appointment._id.toString()
                    );
                    await oldSchedule.save();
                }
            }

            // 10. Đặt chỗ time slot mới
            foundTimeSlot.isBooked = true;
            foundTimeSlot.bookedCount = (foundTimeSlot.bookedCount || 0) + 1;
            if (!foundTimeSlot.appointmentIds) {
                foundTimeSlot.appointmentIds = [];
            }
            foundTimeSlot.appointmentIds.push(appointment._id);
            await foundSchedule.save();

            // 11. Cập nhật appointment
            appointment.rescheduleHistory.push({
                oldScheduleId: oldScheduleId,
                oldTimeSlot: oldTimeSlot,
                oldAppointmentDate: oldAppointmentDate,
                newScheduleId: foundSchedule._id,
                newTimeSlot: { startTime: foundTimeSlot.startTime, endTime: foundTimeSlot.endTime },
                newAppointmentDate: foundSchedule.date,
                rescheduleBy: realUserId,
                rescheduleAt: new Date(),
                notes: `Dời lịch đến ngày ${foundSchedule.date.toLocaleDateString('vi-VN')} lúc ${foundTimeSlot.startTime}`
            });

            appointment.scheduleId = foundSchedule._id;
            appointment.timeSlot = { startTime: foundTimeSlot.startTime, endTime: foundTimeSlot.endTime };
            appointment.appointmentDate = foundSchedule.date;
            appointment.status = 'rescheduled';
            appointment.isRescheduled = true;
            appointment.rescheduleCount = (appointment.rescheduleCount || 0) + 1;
            await appointment.save();

            console.log(`[Reschedule Tool] Đã dời lịch hẹn thành công với mã ${bookingCode}`);

            // 12. Trả về kết quả
            return {
                success: true,
                message: `Đã dời lịch hẹn với mã ${bookingCode} thành công.`,
                bookingCode: bookingCode,
                newDate: foundSchedule.date.toLocaleDateString('vi-VN'),
                newTime: foundTimeSlot.startTime,
                oldDate: oldAppointmentDate.toLocaleDateString('vi-VN'),
                oldTime: oldTimeSlot.startTime
            };

        } catch (e) { 
            console.error("Lỗi Smart Tool rescheduleAppointment:", e);
            return { error: e.message }; 
        }
    }
};

// 4. Logic chạy chat chính
// ⭐ SỬA LỖI: 'runChatWithTools' sẽ nhận 'sessionId'
const runChatWithTools = async (userPrompt, history, sessionId) => {
    
    const chat = model.startChat({
        tools: tools,
        history: history
    });

    let result;
    let toolCalled = false;
    
    try {
        result = await chat.sendMessage(userPrompt);
    } catch (e) {
        console.error("Lỗi khi sendMessage lần đầu:", e);
        throw e;
    }

    while (true) {
        const call = result.response.functionCalls()?.[0];

        if (!call) {
            // KHÔNG CÒN GỌI HÀM NỮA -> Trả về kết quả
            return {
                text: result.response.text(),
                usedTool: toolCalled 
            };
        }
        
        // --- ĐÂY LÀ PHẦN LOGIC BẠN BỊ THIẾU ---
        toolCalled = true; 
        console.log(`[AI Request] Yêu cầu gọi hàm: ${call.name}`);
        
        const tool = availableTools[call.name];
        
        if (!tool) {
            console.error(`Tool ${call.name} không tồn tại.`);
            result = await chat.sendMessage(
                JSON.stringify({
                    functionResponse: { name: call.name, response: { error: `Tool ${call.name} không tồn tại.` } }
                })
            );
            continue; 
        }

        let toolResult;
        try {
            // ⭐ SỬA LỖI: Gắn 'sessionId' vào cho AI
            let args = call.args; // Tham số từ AI (vd: { specialty: "..." })

            if (call.name === 'bookAppointment' || call.name === 'cancelAppointment' || call.name === 'rescheduleAppointment') {
                args.sessionId = sessionId; // Gắn ID tạm thời
            }
            // (Không cần 'args.userId' nữa)

            toolResult = await tool(args); // Thực thi hàm với (args + sessionId)

        } catch(e) {
            console.error(`Lỗi khi thực thi tool ${call.name}:`, e);
            toolResult = { error: e.message };
        }

        try {
            // 3. Gửi kết quả (toolResult) lại cho AI
            result = await chat.sendMessage(
                JSON.stringify({
                    functionResponse: { name: call.name, response: toolResult }
                })
            );
        } catch (e) {
            console.error("Lỗi khi sendMessage (gửi kết quả tool):", e);
            throw e;
        }
    }
};

module.exports = {
    runChatWithTools
};



