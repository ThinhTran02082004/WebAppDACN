const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const Schedule = require('../models/Schedule');
const Service = require('../models/Service');
const { findSpecialtyMapping } = require('./qdrantService');

/**
 * Tools tìm kiếm: bệnh viện, bác sĩ, và lịch trống
 */

const searchTools = {
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

    "findAvailableSlots": async ({ query, city, date, sessionId }) => {
        try {
            console.log(`[Tool] Đang tìm lịch trống: Query "${query}", Ngày ${date || 'không chỉ định'}, Khu vực ${city || 'không chỉ định'}, Session: ${sessionId}`);

            // 1. ÁNH XẠ QUERY -> CHUYÊN KHOA
            let specialtyDoc = null;
            
            // Thử tìm chuyên khoa bằng tên chính xác trước
            specialtyDoc = await Specialty.findOne({ name: { $regex: query, $options: 'i' } });
            
            if (!specialtyDoc) {
                // Nếu không, dùng Qdrant Mapper để tìm
                console.log(`[Tool] Không tìm thấy chuyên khoa trực tiếp, đang dùng Qdrant Mapper...`);
                const mapping = await findSpecialtyMapping(query);
                console.log(`[Tool] Qdrant mapping result:`, mapping ? `Found specialtyId: ${mapping.specialtyId}` : 'No mapping found');
                if (mapping) {
                    specialtyDoc = await Specialty.findById(mapping.specialtyId);
                    if (specialtyDoc) {
                        console.log(`[Tool] Đã map thành công: "${query}" -> Chuyên khoa: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                    } else {
                        console.log(`[Tool] WARNING: Mapping trả về specialtyId ${mapping.specialtyId} nhưng không tìm thấy trong database`);
                    }
                }
            } else {
                console.log(`[Tool] Tìm thấy chuyên khoa trực tiếp: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
            }

            if (!specialtyDoc) {
                console.log(`[Tool] ERROR: Không tìm thấy chuyên khoa cho query "${query}"`);
                return { error: `Xin lỗi, hệ thống không thể xác định chuyên khoa cho "${query}". Vui lòng thử lại với từ khóa khác hoặc chỉ định rõ chuyên khoa bạn muốn khám.` };
            }

            console.log(`[Tool] Đã xác định chuyên khoa: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);

            // 2. Tìm service phù hợp với query (nếu có)
            let matchedService = null;
            console.log(`[Tool] Đang tìm service phù hợp với query "${query}"...`);
            
            // Tìm service có tên khớp với query
            const services = await Service.find({
                specialtyId: specialtyDoc._id,
                isActive: true,
                name: { $regex: query, $options: 'i' }
            }).limit(5);
            
            if (services.length > 0) {
                matchedService = services[0];
                console.log(`[Tool] Tìm thấy service phù hợp: "${matchedService.name}" (ID: ${matchedService._id})`);
            } else {
                // Nếu không tìm thấy service khớp tên, thử tìm service có tên gần giống
                const allServices = await Service.find({
                    specialtyId: specialtyDoc._id,
                    isActive: true
                });
                
                // Tìm service có tên chứa các từ khóa trong query
                const queryWords = query.toLowerCase().split(/\s+/);
                for (const service of allServices) {
                    const serviceNameLower = service.name.toLowerCase();
                    const matchCount = queryWords.filter(word => serviceNameLower.includes(word)).length;
                    if (matchCount >= queryWords.length * 0.5) { // Ít nhất 50% từ khóa khớp
                        matchedService = service;
                        console.log(`[Tool] Tìm thấy service gần khớp: "${matchedService.name}" (ID: ${matchedService._id})`);
                        break;
                    }
                }
            }

            // 3. Tìm bác sĩ thuộc chuyên khoa và có service phù hợp (nếu có)
            console.log(`[Tool] Đang tìm bác sĩ thuộc chuyên khoa ${specialtyDoc.name}...`);
            let doctors = await Doctor.find({ specialtyId: specialtyDoc._id }).populate('user', 'fullName');
            console.log(`[Tool] Tìm thấy ${doctors.length} bác sĩ thuộc chuyên khoa ${specialtyDoc.name}`);
            
            // Nếu có service phù hợp, filter bác sĩ có service đó
            if (matchedService) {
                const doctorsWithService = [];
                for (const doctor of doctors) {
                    // Populate services nếu chưa có
                    if (!doctor.services || doctor.services.length === 0) {
                        await doctor.populate('services');
                    }
                    
                    // Kiểm tra xem bác sĩ có service này không
                    const hasService = doctor.services && doctor.services.some(
                        s => s._id.toString() === matchedService._id.toString()
                    );
                    
                    if (hasService) {
                        doctorsWithService.push(doctor);
                        console.log(`[Tool] Bác sĩ ${doctor.user?.fullName || doctor._id} có service "${matchedService.name}"`);
                    }
                }
                
                // Nếu tìm thấy bác sĩ có service, ưu tiên họ
                if (doctorsWithService.length > 0) {
                    doctors = doctorsWithService;
                    console.log(`[Tool] Ưu tiên ${doctors.length} bác sĩ có service "${matchedService.name}"`);
                } else {
                    console.log(`[Tool] Không có bác sĩ nào có service "${matchedService.name}", sử dụng tất cả bác sĩ của chuyên khoa`);
                }
            }
            
            if (!doctors.length) {
                console.log(`[Tool] ERROR: Không có bác sĩ nào thuộc chuyên khoa ${specialtyDoc.name}`);
                return { error: `Không có bác sĩ nào thuộc chuyên khoa ${specialtyDoc.name}.` };
            }

            const doctorIds = doctors.map(d => d._id);
            console.log(`[Tool] Tìm thấy ${doctors.length} bác sĩ phù hợp, DoctorIds: ${doctorIds.map(id => id.toString()).join(', ')}`);

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
                    console.log(`[Tool] Parse ngày "mai": ${dateFilterGte.toISOString()} - ${dateFilterLte.toISOString()}`);
                    
                    // Nếu có "sáng mai", filter thêm theo buổi sáng (8:00 - 12:00)
                    // Nhưng vẫn tìm tất cả lịch trong ngày mai, filter theo timeSlot sau
                } else {
                    // Hỗ trợ format: "21/11/2025", "21-11-2025", "21/11/25", "21-11-25"
                    const m = date.match(/(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?/);
                    if (m) {
                        const day = parseInt(m[1]);
                        const month = parseInt(m[2]) - 1; // Month is 0-indexed
                        const year = m[3] ? parseInt(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getFullYear();
                        // Tạo date theo UTC để tránh vấn đề timezone
                        const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                        const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
                        dateFilterGte = start;
                        dateFilterLte = end;
                        console.log(`[Tool] Parse ngày từ "${date}": ${dateFilterGte.toISOString()} - ${dateFilterLte.toISOString()} (Day: ${day}, Month: ${month + 1}, Year: ${year}, UTC)`);
                    } else {
                        // Thử parse bằng Date constructor
                        const parsed = new Date(date);
                        if (!isNaN(parsed.getTime())) {
                            const start = new Date(parsed);
                            start.setHours(0, 0, 0, 0);
                            const end = new Date(parsed);
                            end.setHours(23, 59, 59, 999);
                            dateFilterGte = start;
                            dateFilterLte = end;
                            console.log(`[Tool] Parse ngày bằng Date constructor từ "${date}": ${dateFilterGte.toISOString()} - ${dateFilterLte.toISOString()}`);
                        } else {
                            console.warn(`[Tool] Không thể parse ngày "${date}", sử dụng ngày hiện tại trở đi`);
                        }
                    }
                }
            } else {
                console.log(`[Tool] Không có ngày chỉ định, tìm từ ngày hiện tại: ${dateFilterGte.toISOString()}`);
            }

            // 4. Tìm lịch trống
            // ⚠️ KHÔNG filter theo 'timeSlots.isBooked' vì logic đặt lịch dựa trên bookedCount < maxBookings
            // Một slot có thể có isBooked=false nhưng vẫn còn chỗ (bookedCount < maxBookings)
            // Mở rộng range một chút để tránh vấn đề timezone (trừ 1 ngày, cộng 1 ngày)
            let dateQueryStart = dateFilterGte;
            let dateQueryEnd = dateFilterLte;
            
            if (dateFilterLte) {
                // Nếu có ngày cụ thể, mở rộng range để đảm bảo không bỏ sót do timezone
                dateQueryStart = new Date(dateFilterGte);
                dateQueryStart.setDate(dateQueryStart.getDate() - 1);
                dateQueryStart.setHours(0, 0, 0, 0);
                
                dateQueryEnd = new Date(dateFilterLte);
                dateQueryEnd.setDate(dateQueryEnd.getDate() + 1);
                dateQueryEnd.setHours(23, 59, 59, 999);
            }
            
            const dateQuery = dateQueryEnd ? { $gte: dateQueryStart, $lte: dateQueryEnd } : { $gte: dateQueryStart };
            console.log(`[Tool] Query schedules với dateQuery:`, JSON.stringify({
                doctorId: { $in: doctorIds.map(id => id.toString()) },
                date: {
                    $gte: dateQueryStart.toISOString(),
                    $lte: dateQueryEnd ? dateQueryEnd.toISOString() : 'unlimited'
                }
            }));
            
            const schedules = await Schedule.find({
                doctorId: { $in: doctorIds },
                date: dateQuery
            }).limit(20).sort({ date: 1 }); // Tăng limit để có nhiều schedule để filter
            
            // Filter lại schedules theo ngày chính xác (sau khi query)
            let filteredSchedules = schedules;
            if (dateFilterLte) {
                filteredSchedules = schedules.filter(sched => {
                    const schedDate = new Date(sched.date);
                    return schedDate >= dateFilterGte && schedDate <= dateFilterLte;
                });
                console.log(`[Tool] Sau khi filter theo ngày chính xác: ${filteredSchedules.length}/${schedules.length} schedules`);
            }

            console.log(`[Tool] Tìm thấy ${filteredSchedules.length} schedules sau filter. Schedule IDs: ${filteredSchedules.map(s => s._id.toString()).join(', ')}`);
            
            if (!filteredSchedules.length) {
                // Thử tìm tất cả schedules của các bác sĩ này để debug
                const allSchedules = await Schedule.find({ doctorId: { $in: doctorIds } }).limit(5).sort({ date: 1 });
                console.log(`[Tool] DEBUG: Tổng số schedules của các bác sĩ này (không filter ngày): ${allSchedules.length}`);
                if (allSchedules.length > 0) {
                    console.log(`[Tool] DEBUG: Ví dụ schedule gần nhất: ID=${allSchedules[0]._id}, Date=${allSchedules[0].date.toISOString()}, TimeSlots=${allSchedules[0].timeSlots.length}`);
                }
                return { error: `Rất tiếc, không tìm thấy lịch cho chuyên khoa ${specialtyDoc.name} trong khoảng thời gian này.` };
            }

            // 5. Biên soạn danh sách slot - kiểm tra chính xác bookedCount < maxBookings
            const slots = [];
            let totalTimeSlotsChecked = 0;
            let totalTimeSlotsAvailable = 0;
            
            for (const sched of filteredSchedules) {
                const doctor = doctors.find(d => d._id.equals(sched.doctorId));
                if (!doctor) {
                    console.log(`[Tool] Không tìm thấy doctor cho schedule ${sched._id}`);
                    continue;
                }
                
                console.log(`[Tool] Xử lý schedule ${sched._id}, Date: ${sched.date.toISOString()}, TimeSlots: ${sched.timeSlots.length}`);
                
                for (const ts of sched.timeSlots) {
                    totalTimeSlotsChecked++;
                    // Kiểm tra chính xác: slot còn chỗ khi bookedCount < maxBookings
                    const bookedCount = ts.bookedCount || 0;
                    const maxBookings = ts.maxBookings || 3;
                    const isAvailable = bookedCount < maxBookings;
                    
                    if (!isAvailable) {
                        console.log(`[Tool] Slot ${ts._id} (${ts.startTime}) đã đầy: bookedCount=${bookedCount}, maxBookings=${maxBookings}`);
                        continue;
                    }
                    
                    totalTimeSlotsAvailable++;
                    const referenceCode = `L${String(slots.length + 1).padStart(2, '0')}`;
                    slots.push({
                        referenceCode,
                        slotId: `${sched._id}_${ts._id}`,
                        doctorName: doctor.user?.fullName || 'Bác sĩ',
                        date: sched.date.toLocaleDateString('vi-VN'),
                        time: ts.startTime,
                        serviceId: matchedService ? matchedService._id.toString() : null,
                        serviceName: matchedService ? matchedService.name : null
                    });
                    console.log(`[Tool] Thêm slot ${referenceCode}: ${doctor.user?.fullName || 'Bác sĩ'} - ${sched.date.toLocaleDateString('vi-VN')} ${ts.startTime} (bookedCount=${bookedCount}/${maxBookings})${matchedService ? ` - Service: ${matchedService.name}` : ''}`);
                    if (slots.length >= 10) break;
                }
                if (slots.length >= 10) break;
            }
            
            console.log(`[Tool] Tổng kết: Đã kiểm tra ${totalTimeSlotsChecked} timeSlots, tìm thấy ${totalTimeSlotsAvailable} slots trống, trả về ${slots.length} slots`);
            
            if (slots.length === 0) {
                return { error: `Rất tiếc, đã hết lịch trống cho chuyên khoa ${specialtyDoc.name} trong khoảng thời gian này. (Đã kiểm tra ${totalTimeSlotsChecked} khung giờ)` };
            }

            // Lưu slots vào cache để có thể lấy lại khi user chọn slot
            const cache = require('./cacheService');
            if (sessionId) {
                cache.setAvailableSlots(sessionId, slots);
            }

            return { availableSlots: slots };
        } catch (e) {
            console.error("[Tool] ERROR findAvailableSlots:", e);
            console.error("[Tool] ERROR stack:", e.stack);
            return { error: e.message || 'Có lỗi xảy ra khi tìm lịch trống. Vui lòng thử lại.' };
        }
    }
};

module.exports = searchTools;

