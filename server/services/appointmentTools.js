const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Schedule = require('../models/Schedule');
const Service = require('../models/Service');
const Room = require('../models/Room');
const cache = require('./cacheService');
const { broadcastTimeSlotUpdate } = require('../config/socketConfig');

/**
 * Tools quản lý appointment: lịch sử, lấy danh sách, đặt, hủy, đổi lịch
 */

const appointmentTools = {
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

    "getMyAppointments": async ({ sessionId }) => {
        try {
            // 1. Giải mã sessionId -> userId
            const realUserId = cache.getUserId(sessionId);
            console.log(`[Tool] getMyAppointments - SessionId: ${sessionId}, RealUserId: ${realUserId}`);
            
            if (!realUserId || !mongoose.Types.ObjectId.isValid(realUserId)) {
                console.warn(`[Tool] Không tìm thấy userId từ sessionId: ${sessionId}`);
                return { 
                    error: 'AUTHENTICATION_REQUIRED: Người dùng chưa đăng nhập. Để xem lịch hẹn, người dùng cần đăng nhập vào hệ thống trước. Vui lòng hướng dẫn họ đăng nhập, KHÔNG yêu cầu họ cung cấp ID.' 
                };
            }
            
            const patientId = new mongoose.Types.ObjectId(realUserId);
            
            // 2. Lấy tất cả lịch hẹn hiện tại (pending, confirmed, rescheduled, pending_payment)
            const appointments = await Appointment.find({ 
                patientId: patientId,
                status: { $in: ['pending', 'confirmed', 'rescheduled', 'pending_payment'] }
            })
            .populate({
                path: 'doctorId',
                select: 'consultationFee',
                populate: { path: 'user', select: 'fullName' }
            })
            .populate('hospitalId', 'name address')
            .populate('specialtyId', 'name')
            .populate('serviceId', 'name')
            .sort({ appointmentDate: 1, 'timeSlot.startTime': 1 })
            .exec();

            // 3. Format dữ liệu để trả về
            const formattedAppointments = appointments.map(apt => ({
                bookingCode: apt.bookingCode,
                doctorName: apt.doctorId?.user?.fullName || 'Chưa có thông tin',
                hospitalName: apt.hospitalId?.name || 'Chưa có thông tin',
                specialtyName: apt.specialtyId?.name || 'Chưa có thông tin',
                serviceName: apt.serviceId?.name || 'Dịch vụ khám bệnh',
                date: apt.appointmentDate.toLocaleDateString('vi-VN'),
                time: `${apt.timeSlot?.startTime || ''} - ${apt.timeSlot?.endTime || ''}`,
                status: apt.status,
                statusLabel: {
                    'pending': 'Chờ xác nhận',
                    'confirmed': 'Đã xác nhận',
                    'rescheduled': 'Đã đổi lịch',
                    'pending_payment': 'Chờ thanh toán'
                }[apt.status] || apt.status,
                totalAmount: apt.fee?.totalAmount || apt.consultationFee || 0,
                queueNumber: apt.queueNumber || null
            }));

            console.log(`[Tool] Đã tìm thấy ${formattedAppointments.length} lịch hẹn cho user ${realUserId}`);

            return {
                success: true,
                appointments: formattedAppointments,
                count: formattedAppointments.length
            };
        } catch (e) {
            console.error("Lỗi getMyAppointments:", e);
            return { error: e.message };
        }
    },

    "bookAppointment": async ({ slotId, serviceId, sessionId }) => {
        const session = await mongoose.startSession();
        let broadcastPayload = null;
        try {
            console.log(`[Tool] Đang đặt lịch cho slot: ${slotId}`);

            // 1. Giải mã sessionId -> userId
            const realUserId = cache.getUserId(sessionId);
            console.log(`[Tool] SessionId: ${sessionId}, RealUserId: ${realUserId}`);
            if (!realUserId || !mongoose.Types.ObjectId.isValid(realUserId)) {
                console.warn(`[Tool] Không tìm thấy userId từ sessionId: ${sessionId}`);
                return { 
                    error: 'AUTHENTICATION_REQUIRED: Người dùng chưa đăng nhập. Để đặt lịch, người dùng cần đăng nhập vào hệ thống trước. Vui lòng hướng dẫn họ đăng nhập, KHÔNG yêu cầu họ cung cấp ID.' 
                };
            }
            
            // Đảm bảo realUserId là ObjectId
            const patientId = new mongoose.Types.ObjectId(realUserId);
            console.log(`[Tool] PatientId hợp lệ: ${patientId}`);

            // 2. Tách slotId và validate format
            if (!slotId || typeof slotId !== 'string') {
                return { error: 'Mã lịch hẹn (slotId) không hợp lệ. Vui lòng chọn lại từ danh sách.' };
            }
            
            // Kiểm tra format: phải có dấu gạch dưới (_) và có 2 phần
            if (!slotId.includes('_')) {
                console.error(`[Tool] slotId không đúng format: ${slotId}. Format đúng: scheduleId_timeSlotId`);
                return { error: 'Mã lịch hẹn (slotId) không đúng định dạng. Vui lòng chọn lại từ danh sách.' };
            }
            
            const [scheduleId, timeSlotId] = slotId.split('_');
            if (!scheduleId || !timeSlotId) {
                console.error(`[Tool] slotId không đủ phần: ${slotId}`);
                return { error: 'Mã lịch hẹn (slotId) không hợp lệ. Vui lòng chọn lại từ danh sách.' };
            }
            
            // Kiểm tra scheduleId có phải là ObjectId hợp lệ không (có thể là ObjectId hoặc UUID)
            // timeSlotId có thể là ObjectId hoặc UUID (subdocument _id)
            let scheduleQuery;
            if (mongoose.Types.ObjectId.isValid(scheduleId)) {
                scheduleQuery = { _id: scheduleId };
            } else {
                // Nếu không phải ObjectId, có thể là UUID hoặc string khác
                // Thử tìm bằng cách khác hoặc báo lỗi
                console.error(`[Tool] scheduleId không phải ObjectId hợp lệ: ${scheduleId}`);
                return { error: 'Mã lịch hẹn (slotId) không hợp lệ. Vui lòng chọn lại từ danh sách.' };
            }

            // 3. Transaction
            session.startTransaction();

            // 4. Tìm và khóa lịch
            const schedule = await Schedule.findOne(scheduleQuery).session(session);
            if (!schedule) {
                await session.abortTransaction();
                throw new Error("Lịch hẹn không còn tồn tại.");
            }

            // Tìm timeSlot - có thể là ObjectId hoặc string/UUID
            let timeSlot = null;
            
            // Thử tìm bằng ObjectId trước
            if (mongoose.Types.ObjectId.isValid(timeSlotId)) {
                timeSlot = schedule.timeSlots.id(timeSlotId);
            }
            
            // Nếu không tìm thấy, thử tìm bằng string comparison
            if (!timeSlot) {
                timeSlot = schedule.timeSlots.find(ts => {
                    if (!ts._id) return false;
                    const tsIdStr = ts._id.toString();
                    // So sánh chính xác hoặc partial match
                    return tsIdStr === timeSlotId || 
                           tsIdStr.includes(timeSlotId) || 
                           timeSlotId.includes(tsIdStr);
                });
            }
            
            if (!timeSlot) {
                await session.abortTransaction();
                console.error(`[Tool] Không tìm thấy timeSlot với ID: ${timeSlotId} trong schedule ${scheduleId}`);
                console.error(`[Tool] Schedule có ${schedule.timeSlots.length} timeSlots. IDs: ${schedule.timeSlots.map(ts => ts._id?.toString()).join(', ')}`);
                throw new Error("Giờ hẹn không còn tồn tại.");
            }
            
            console.log(`[Tool] Đã tìm thấy timeSlot: ${timeSlot.startTime} - ${timeSlot.endTime} (ID: ${timeSlot._id})`);

            const currentBookedCount = timeSlot.bookedCount || 0;
            const maxBookings = timeSlot.maxBookings || 3;
            if (currentBookedCount >= maxBookings) {
                throw new Error("Rất tiếc, giờ hẹn này vừa có người khác đặt mất.");
            }

            // 5. Lấy thông tin
            const doctor = await Doctor.findById(schedule.doctorId)
                .populate('hospitalId')
                .populate('user', 'fullName')
                .populate('services')
                .session(session);

            if (!doctor) throw new Error("Không tìm thấy bác sĩ.");

            // 5.1. Tìm phòng khám (nếu có trong timeSlot)
            let roomId = null;
            if (timeSlot.roomId && mongoose.Types.ObjectId.isValid(timeSlot.roomId)) {
                const room = await Room.findById(timeSlot.roomId).session(session);
                if (room && room.status === 'active' && room.isActive) {
                    roomId = room._id;
                }
            }

            // 5.2. Tính phí khám và tìm service phù hợp
            let consultationFee = doctor.consultationFee || 0;
            let additionalFees = 0;
            let finalServiceId = null;

            // Ưu tiên sử dụng serviceId từ slot đã chọn (nếu có)
            if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
                const selectedService = await Service.findOne({
                    _id: serviceId,
                    specialtyId: doctor.specialtyId,
                    isActive: true
                }).session(session);
                
                if (selectedService) {
                    // Kiểm tra xem bác sĩ có service này không
                    const doctorHasService = doctor.services && doctor.services.some(
                        s => {
                            const serviceObjId = s._id ? s._id.toString() : s.toString();
                            return serviceObjId === serviceId;
                        }
                    );
                    
                    if (doctorHasService) {
                        finalServiceId = selectedService._id;
                        additionalFees = selectedService.price || 0;
                        console.log(`[Tool] Sử dụng service đã chọn từ slot: ${selectedService.name} (ID: ${finalServiceId}, Price: ${additionalFees})`);
                    } else {
                        console.log(`[Tool] WARNING: Service ${serviceId} không thuộc bác sĩ này, sẽ tìm service khác`);
                    }
                } else {
                    console.log(`[Tool] WARNING: Service ${serviceId} không tồn tại hoặc không active, sẽ tìm service khác`);
                }
            }
            
            // Nếu không có serviceId từ slot hoặc service không hợp lệ, tìm service phù hợp
            if (!finalServiceId) {
                // Tìm service phù hợp theo thứ tự ưu tiên:
                // 1. Service của doctor (nếu có và active)
                // 2. Service của specialty (nếu không có service của doctor)
                if (doctor.services && doctor.services.length > 0) {
                    // Tìm service đầu tiên của doctor mà active và thuộc đúng specialty
                    for (const docServiceId of doctor.services) {
                        const service = await Service.findOne({
                            _id: docServiceId,
                            specialtyId: doctor.specialtyId,
                            isActive: true
                        }).session(session);
                        
                        if (service) {
                            finalServiceId = service._id;
                            additionalFees = service.price || 0;
                            console.log(`[Tool] Đã chọn service của doctor: ${service.name} (ID: ${finalServiceId}, Price: ${additionalFees})`);
                            break;
                        }
                    }
                }
                
                // Nếu không tìm thấy service của doctor, tìm service theo specialtyId
                if (!finalServiceId) {
                    const specialtyService = await Service.findOne({
                        specialtyId: doctor.specialtyId,
                        isActive: true,
                        type: 'examination' // Ưu tiên dịch vụ khám bệnh
                    })
                    .sort({ price: 1 }) // Ưu tiên giá thấp nhất
                    .session(session);
                    
                    if (specialtyService) {
                        finalServiceId = specialtyService._id;
                        additionalFees = specialtyService.price || 0;
                        console.log(`[Tool] Đã chọn service theo specialty: ${specialtyService.name} (ID: ${finalServiceId}, Price: ${additionalFees})`);
                    } else {
                        // Nếu không tìm thấy service examination, tìm bất kỳ service nào của specialty
                        const anyService = await Service.findOne({
                            specialtyId: doctor.specialtyId,
                            isActive: true
                        })
                        .sort({ price: 1 })
                        .session(session);
                        
                        if (anyService) {
                            finalServiceId = anyService._id;
                            additionalFees = anyService.price || 0;
                            console.log(`[Tool] Đã chọn service bất kỳ của specialty: ${anyService.name} (ID: ${finalServiceId}, Price: ${additionalFees})`);
                        } else {
                            console.log(`[Tool] Không tìm thấy service nào cho specialty ${doctor.specialtyId}, appointment sẽ không có serviceId`);
                        }
                    }
                }
            }

            const discount = 0; // Chatbot không hỗ trợ coupon
            const totalAmount = consultationFee + additionalFees - discount;

            // 5.3. Tính queue number
            const appointmentDateStart = new Date(schedule.date);
            appointmentDateStart.setHours(0, 0, 0, 0);
            const appointmentDateEnd = new Date(schedule.date);
            appointmentDateEnd.setHours(23, 59, 59, 999);

            const latestAppointment = await Appointment.findOne({
                doctorId: doctor._id,
                appointmentDate: {
                    $gte: appointmentDateStart,
                    $lte: appointmentDateEnd
                },
                status: { $nin: ['cancelled', 'rejected'] }
            }).sort({ queueNumber: -1 }).session(session);

            const queueNumber = latestAppointment ? latestAppointment.queueNumber + 1 : 1;

            // 6. Tạo Appointment (theo logic trong appointmentController)
            const appointmentData = {
                patientId: patientId,
                doctorId: doctor._id,
                hospitalId: doctor.hospitalId._id,
                specialtyId: doctor.specialtyId,
                scheduleId: schedule._id,
                appointmentDate: schedule.date,
                timeSlot: { startTime: timeSlot.startTime, endTime: timeSlot.endTime },
                appointmentType: 'first-visit', // Mặc định cho chatbot
                fee: {
                    consultationFee,
                    additionalFees,
                    discount,
                    totalAmount
                },
                paymentStatus: 'pending',
                paymentMethod: 'cash', // Mặc định là cash cho chatbot
                queueNumber,
                status: 'pending' // Status mặc định là pending, không phải confirmed
            };

            // Thêm serviceId nếu có
            if (finalServiceId) {
                appointmentData.serviceId = finalServiceId;
            }

            // Thêm roomId nếu có
            if (roomId) {
                appointmentData.roomId = roomId;
            }

            const newAppointment = new Appointment(appointmentData);
            await newAppointment.save({ session });

            console.log(`[Tool] Đã tạo appointment với ID: ${newAppointment._id}, bookingCode: ${newAppointment.bookingCode}`);

            // 7. Cập nhật slot sau khi đã có appointmentId
            const updatedBookedCount = currentBookedCount + 1;
            timeSlot.bookedCount = updatedBookedCount;
            timeSlot.isBooked = updatedBookedCount >= maxBookings;
            if (!Array.isArray(timeSlot.appointmentIds)) {
                timeSlot.appointmentIds = [];
            }
            timeSlot.appointmentIds.push(newAppointment._id);
            
            // Thêm roomId vào timeSlot nếu có (theo logic trong controller)
            if (roomId) {
                timeSlot.roomId = roomId;
            }
            
            await schedule.save({ session });

            const formattedDate = new Date(schedule.date).toISOString().split('T')[0];
            broadcastPayload = {
                scheduleId: schedule._id,
                doctorId: doctor._id,
                date: formattedDate,
                timeSlotInfo: {
                    _id: timeSlot._id,
                    startTime: timeSlot.startTime,
                    endTime: timeSlot.endTime,
                    isBooked: timeSlot.isBooked,
                    bookedCount: timeSlot.bookedCount,
                    maxBookings: timeSlot.maxBookings || 3
                }
            };

            // 8. Commit transaction
            await session.commitTransaction();
            console.log(`[Tool] Transaction đã commit thành công cho appointment ID: ${newAppointment._id}`);

            // 9. Refresh appointment để đảm bảo có đầy đủ thông tin (bao gồm bookingCode)
            const savedAppointment = await Appointment.findById(newAppointment._id);
            if (!savedAppointment) {
                throw new Error("Không tìm thấy appointment sau khi lưu.");
            }

            console.log(`[Tool] Appointment đã được lưu: ID=${savedAppointment._id}, bookingCode=${savedAppointment.bookingCode}, patientId=${savedAppointment.patientId}, status=${savedAppointment.status}`);

            if (broadcastPayload) {
                broadcastTimeSlotUpdate(
                    broadcastPayload.scheduleId,
                    broadcastPayload.timeSlotInfo,
                    broadcastPayload.doctorId,
                    broadcastPayload.date
                );
            }

            cache.clearAvailableSlots(sessionId);

            return {
                success: true,
                bookingCode: savedAppointment.bookingCode,
                appointmentId: savedAppointment._id.toString(),
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

    "cancelAppointment": async ({ bookingCode, reason, sessionId }) => {
        const session = await mongoose.startSession();
        let broadcastPayload = null;
        try {
            // 1. Giải mã 'sessionId' để lấy 'realUserId' từ cache
            const realUserId = cache.getUserId(sessionId);

            // 2. Kiểm tra (Validation)
            if (!realUserId || !mongoose.Types.ObjectId.isValid(realUserId)) {
                console.warn(`[Cancel Tool] Thất bại: Yêu cầu hủy lịch bị từ chối vì sessionId không hợp lệ hoặc đã hết hạn.`);
                return { 
                    error: 'AUTHENTICATION_REQUIRED: Người dùng chưa đăng nhập. Để hủy lịch, người dùng cần đăng nhập vào hệ thống trước. Vui lòng hướng dẫn họ đăng nhập, KHÔNG yêu cầu họ cung cấp ID.' 
                };
            }

            if (!bookingCode) {
                return { error: 'Vui lòng cung cấp mã đặt lịch để hủy.' };
            }

            if (!reason) {
                return { error: 'Vui lòng cung cấp lý do hủy lịch.' };
            }

            console.log(`[Cancel Tool] Đang hủy lịch với mã ${bookingCode} cho User ${realUserId}`);

            // 3. Transaction
            session.startTransaction();

            // 4. Tìm lịch hẹn bằng bookingCode và kiểm tra quyền sở hữu
            const appointment = await Appointment.findOne({ 
                bookingCode: bookingCode,
                patientId: realUserId 
            }).populate('scheduleId').session(session);

            if (!appointment) {
                await session.abortTransaction();
                return { 
                    error: `Không tìm thấy lịch hẹn với mã ${bookingCode} hoặc bạn không có quyền hủy lịch này.` 
                };
            }

            // 5. Kiểm tra trạng thái hiện tại
            if (appointment.status === 'cancelled') {
                await session.abortTransaction();
                return { 
                    error: `Lịch hẹn với mã ${bookingCode} đã được hủy trước đó.` 
                };
            }

            if (appointment.status === 'completed') {
                await session.abortTransaction();
                return { 
                    error: `Không thể hủy lịch hẹn đã hoàn thành với mã ${bookingCode}.` 
                };
            }

            // 6. Cập nhật trạng thái lịch hẹn
            appointment.status = 'cancelled';
            appointment.cancellationReason = reason;
            appointment.cancelledBy = 'patient';
            appointment.isCancelled = true;
            await appointment.save({ session });

            // 7. Giải phóng khung giờ trong lịch
            const scheduleId = appointment.scheduleId._id || appointment.scheduleId;
            const schedule = await Schedule.findById(scheduleId).session(session);
            
            if (schedule && appointment.timeSlot) {
                // Tìm timeSlot bằng cách so sánh với appointmentIds (chính xác hơn)
                let timeSlotIndex = -1;
                let timeSlot = null;

                for (let i = 0; i < schedule.timeSlots.length; i++) {
                    const ts = schedule.timeSlots[i];
                    // Kiểm tra xem appointmentId có trong danh sách không
                    if (Array.isArray(ts.appointmentIds) && 
                        ts.appointmentIds.some(id => id.toString() === appointment._id.toString())) {
                        timeSlotIndex = i;
                        timeSlot = ts;
                        break;
                    }
                    // Fallback: so sánh thời gian nếu không tìm thấy bằng appointmentIds
                    if (ts.startTime === appointment.timeSlot.startTime && 
                        ts.endTime === appointment.timeSlot.endTime) {
                        timeSlotIndex = i;
                        timeSlot = ts;
                    }
                }

                if (timeSlotIndex !== -1 && timeSlot) {
                    // Giảm số lượng đặt chỗ
                    if (timeSlot.bookedCount > 0) {
                        timeSlot.bookedCount -= 1;
                    }
                    // Nếu không còn đặt chỗ nào, đánh dấu là chưa được đặt
                    if (timeSlot.bookedCount === 0) {
                        timeSlot.isBooked = false;
                    }
                    // Xóa appointmentId khỏi danh sách
                    if (Array.isArray(timeSlot.appointmentIds)) {
                        timeSlot.appointmentIds = timeSlot.appointmentIds.filter(
                            id => id.toString() !== appointment._id.toString()
                        );
                    }
                    await schedule.save({ session });

                    // Chuẩn bị broadcast payload
                    const doctor = await Doctor.findById(schedule.doctorId).session(session);
                    if (doctor) {
                        const formattedDate = new Date(schedule.date).toISOString().split('T')[0];
                        broadcastPayload = {
                            scheduleId: schedule._id,
                            doctorId: doctor._id,
                            date: formattedDate,
                            timeSlotInfo: {
                                _id: timeSlot._id,
                                startTime: timeSlot.startTime,
                                endTime: timeSlot.endTime,
                                isBooked: timeSlot.isBooked,
                                bookedCount: timeSlot.bookedCount,
                                maxBookings: timeSlot.maxBookings || 3
                            }
                        };
                    }
                }
            }

            // 8. Commit transaction
            await session.commitTransaction();
            console.log(`[Cancel Tool] Đã hủy lịch hẹn thành công với mã ${bookingCode}`);

            // 9. Broadcast update sau khi commit
            if (broadcastPayload) {
                broadcastTimeSlotUpdate(
                    broadcastPayload.scheduleId,
                    broadcastPayload.timeSlotInfo,
                    broadcastPayload.doctorId,
                    broadcastPayload.date
                );
            }

            // 10. Trả về kết quả
            return {
                success: true,
                message: `Đã hủy lịch hẹn với mã ${bookingCode} thành công.`,
                bookingCode: bookingCode,
                reason: reason
            };

        } catch (e) {
            await session.abortTransaction();
            console.error("Lỗi Smart Tool cancelAppointment:", e);
            return { error: e.message }; 
        } finally {
            session.endSession();
        }
    },

    "rescheduleAppointment": async ({ bookingCode, preferredDate, preferredTime, sessionId }) => {
        const session = await mongoose.startSession();
        let broadcastPayloads = [];
        try {
            // 1. Giải mã 'sessionId' để lấy 'realUserId' từ cache
            const realUserId = cache.getUserId(sessionId);

            // 2. Kiểm tra (Validation)
            if (!realUserId || !mongoose.Types.ObjectId.isValid(realUserId)) {
                console.warn(`[Reschedule Tool] Thất bại: Yêu cầu dời lịch bị từ chối vì sessionId không hợp lệ hoặc đã hết hạn.`);
                return { 
                    error: 'AUTHENTICATION_REQUIRED: Người dùng chưa đăng nhập. Để dời lịch, người dùng cần đăng nhập vào hệ thống trước. Vui lòng hướng dẫn họ đăng nhập, KHÔNG yêu cầu họ cung cấp ID.' 
                };
            }

            if (!bookingCode) {
                return { error: 'Vui lòng cung cấp mã đặt lịch để dời lịch.' };
            }

            if (!preferredDate) {
                return { error: 'Vui lòng cung cấp ngày mới mà bạn muốn dời đến.' };
            }

            console.log(`[Reschedule Tool] Đang dời lịch với mã ${bookingCode} cho User ${realUserId}`);

            // 3. Transaction
            session.startTransaction();

            // 4. Tìm lịch hẹn bằng bookingCode và kiểm tra quyền sở hữu
            const appointment = await Appointment.findOne({ 
                bookingCode: bookingCode,
                patientId: realUserId 
            })
            .populate('doctorId')
            .populate('scheduleId')
            .populate('specialtyId')
            .session(session);

            if (!appointment) {
                await session.abortTransaction();
                return { 
                    error: `Không tìm thấy lịch hẹn với mã ${bookingCode} hoặc bạn không có quyền dời lịch này.` 
                };
            }

            // 5. Kiểm tra trạng thái hiện tại (chỉ pending hoặc rescheduled mới được đổi)
            if (!['pending', 'rescheduled'].includes(appointment.status)) {
                await session.abortTransaction();
                return { 
                    error: `Không thể dời lịch hẹn có trạng thái '${appointment.status}'. Chỉ có thể dời lịch đang chờ xác nhận hoặc đã được dời trước đó.` 
                };
            }

            // 6. Kiểm tra số lần đổi lịch tối đa (2 lần)
            if (appointment.rescheduleCount >= 2) {
                await session.abortTransaction();
                return { 
                    error: 'Lịch hẹn này đã được đổi 2 lần, không thể đổi thêm.' 
                };
            }

            // 7. Kiểm tra thời gian (không thể đổi trong vòng 4 giờ trước cuộc hẹn)
            const currentTime = new Date();
            const appointmentTime = new Date(appointment.appointmentDate);
            const [hours, minutes] = appointment.timeSlot.startTime.split(':').map(Number);
            appointmentTime.setHours(hours, minutes, 0, 0);

            const timeDiffInHours = (appointmentTime - currentTime) / (1000 * 60 * 60);
            if (timeDiffInHours < 4) {
                await session.abortTransaction();
                return { 
                    error: 'Không thể đổi lịch trong vòng 4 giờ trước thời gian hẹn.' 
                };
            }

            // 8. Parse preferredDate (hỗ trợ các định dạng cơ bản)
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
                await session.abortTransaction();
                return { 
                    error: `Không thể parse ngày "${preferredDate}" hoặc ngày đã qua. Vui lòng cung cấp ngày hợp lệ (ví dụ: "ngày 20-12", "sáng mai").` 
                };
            }

            // 9. Tìm lịch trống mới cho cùng bác sĩ
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
            }).sort({ date: 1 }).session(session);

            // Nếu không tìm thấy schedule trong ngày đó, tìm schedule gần nhất sau ngày đó
            if (schedules.length === 0) {
                schedules = await Schedule.find({
                    doctorId: doctorId,
                    date: { $gte: targetDateStart }
                }).sort({ date: 1 }).limit(5).session(session);
            }

            if (schedules.length === 0) {
                await session.abortTransaction();
                return { 
                    error: `Không tìm thấy lịch trống cho bác sĩ này từ ngày ${targetDate.toLocaleDateString('vi-VN')}.` 
                };
            }

            // 10. Tìm time slot trống phù hợp
            let foundSchedule = null;
            let foundTimeSlot = null;

            for (const schedule of schedules) {
                for (const timeSlot of schedule.timeSlots) {
                    // Kiểm tra nếu time slot còn chỗ - logic chính xác: bookedCount < maxBookings
                    const maxBookings = timeSlot.maxBookings || 3;
                    const bookedCount = timeSlot.bookedCount || 0;
                    const isAvailable = bookedCount < maxBookings;

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
                await session.abortTransaction();
                return { 
                    error: `Không tìm thấy lịch trống phù hợp với yêu cầu của bạn. Vui lòng thử ngày hoặc giờ khác.` 
                };
            }

            // 11. Lưu thông tin cũ trước khi cập nhật
            const oldScheduleId = appointment.scheduleId._id || appointment.scheduleId;
            const oldTimeSlot = { ...appointment.timeSlot };
            const oldAppointmentDate = appointment.appointmentDate;

            // 12. Giải phóng time slot cũ
            const oldSchedule = await Schedule.findById(oldScheduleId).session(session);
            if (oldSchedule) {
                // Tìm timeSlot bằng appointmentIds (chính xác hơn)
                let oldTimeSlotIndex = -1;
                let oldSlot = null;

                for (let i = 0; i < oldSchedule.timeSlots.length; i++) {
                    const ts = oldSchedule.timeSlots[i];
                    // Kiểm tra xem appointmentId có trong danh sách không
                    if (Array.isArray(ts.appointmentIds) && 
                        ts.appointmentIds.some(id => id.toString() === appointment._id.toString())) {
                        oldTimeSlotIndex = i;
                        oldSlot = ts;
                        break;
                    }
                }

                if (oldTimeSlotIndex !== -1 && oldSlot) {
                    if (oldSlot.bookedCount > 0) {
                        oldSlot.bookedCount -= 1;
                    }
                    if (oldSlot.bookedCount === 0) {
                        oldSlot.isBooked = false;
                    }
                    if (Array.isArray(oldSlot.appointmentIds)) {
                        oldSlot.appointmentIds = oldSlot.appointmentIds.filter(
                            id => id.toString() !== appointment._id.toString()
                        );
                    }
                    await oldSchedule.save({ session });

                    // Chuẩn bị broadcast payload cho schedule cũ
                    const doctor = await Doctor.findById(oldSchedule.doctorId).session(session);
                    if (doctor) {
                        const formattedDate = new Date(oldSchedule.date).toISOString().split('T')[0];
                        broadcastPayloads.push({
                            scheduleId: oldSchedule._id,
                            doctorId: doctor._id,
                            date: formattedDate,
                            timeSlotInfo: {
                                _id: oldSlot._id,
                                startTime: oldSlot.startTime,
                                endTime: oldSlot.endTime,
                                isBooked: oldSlot.isBooked,
                                bookedCount: oldSlot.bookedCount,
                                maxBookings: oldSlot.maxBookings || 3
                            }
                        });
                    }
                }
            }

            // 13. Đặt chỗ time slot mới
            const currentBookedCount = foundTimeSlot.bookedCount || 0;
            const maxBookings = foundTimeSlot.maxBookings || 3;
            
            if (currentBookedCount >= maxBookings) {
                await session.abortTransaction();
                return { 
                    error: 'Rất tiếc, giờ hẹn này vừa có người khác đặt mất.' 
                };
            }

            foundTimeSlot.bookedCount = currentBookedCount + 1;
            foundTimeSlot.isBooked = foundTimeSlot.bookedCount >= maxBookings;
            if (!Array.isArray(foundTimeSlot.appointmentIds)) {
                foundTimeSlot.appointmentIds = [];
            }
            foundTimeSlot.appointmentIds.push(appointment._id);
            await foundSchedule.save({ session });

            // Chuẩn bị broadcast payload cho schedule mới
            const doctor = await Doctor.findById(foundSchedule.doctorId).session(session);
            if (doctor) {
                const formattedDate = new Date(foundSchedule.date).toISOString().split('T')[0];
                broadcastPayloads.push({
                    scheduleId: foundSchedule._id,
                    doctorId: doctor._id,
                    date: formattedDate,
                    timeSlotInfo: {
                        _id: foundTimeSlot._id,
                        startTime: foundTimeSlot.startTime,
                        endTime: foundTimeSlot.endTime,
                        isBooked: foundTimeSlot.isBooked,
                        bookedCount: foundTimeSlot.bookedCount,
                        maxBookings: foundTimeSlot.maxBookings || 3
                    }
                });
            }

            // 14. Cập nhật appointment
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
            await appointment.save({ session });

            // 15. Commit transaction
            await session.commitTransaction();
            console.log(`[Reschedule Tool] Đã dời lịch hẹn thành công với mã ${bookingCode}`);

            // 16. Broadcast update sau khi commit
            for (const payload of broadcastPayloads) {
                broadcastTimeSlotUpdate(
                    payload.scheduleId,
                    payload.timeSlotInfo,
                    payload.doctorId,
                    payload.date
                );
            }

            // 17. Trả về kết quả
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
            await session.abortTransaction();
            console.error("Lỗi Smart Tool rescheduleAppointment:", e);
            return { error: e.message }; 
        } finally {
            session.endSession();
        }
    }
};

module.exports = appointmentTools;

