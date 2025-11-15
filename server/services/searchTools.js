const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const Schedule = require('../models/Schedule');
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
                if (mapping) {
                    specialtyDoc = await Specialty.findById(mapping.specialtyId);
                    if (specialtyDoc) {
                        console.log(`[Tool] Đã map thành công: "${query}" -> Chuyên khoa: ${specialtyDoc.name}`);
                    }
                }
            } else {
                console.log(`[Tool] Tìm thấy chuyên khoa trực tiếp: ${specialtyDoc.name}`);
            }

            if (!specialtyDoc) {
                return { error: `Xin lỗi, hệ thống không thể xác định chuyên khoa cho "${query}". Vui lòng thử lại với từ khóa khác hoặc chỉ định rõ chuyên khoa bạn muốn khám.` };
            }

            // 2. Tìm bác sĩ thuộc chuyên khoa (có thể lọc theo city sau nếu có quan hệ)
            const doctors = await Doctor.find({ specialtyId: specialtyDoc._id }).populate('user', 'fullName');
            if (!doctors.length) {
                return { error: `Không có bác sĩ nào thuộc chuyên khoa ${specialtyDoc.name}.` };
            }

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
                return { error: `Rất tiếc, đã hết lịch trống cho chuyên khoa ${specialtyDoc.name}.` };
            }

            // 5. Biên soạn danh sách slot
            const slots = [];
            for (const sched of schedules) {
                const doctor = doctors.find(d => d._id.equals(sched.doctorId));
                if (!doctor) continue;
                for (const ts of sched.timeSlots) {
                    if (ts.isBooked) continue;
                    const referenceCode = `L${String(slots.length + 1).padStart(2, '0')}`;
                    slots.push({
                        referenceCode,
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
    }
};

module.exports = searchTools;

