const mongoose = require('mongoose');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const Schedule = require('../models/Schedule');
const Service = require('../models/Service');
const { findSpecialtyMapping, findServiceMapping, findDoctorMapping } = require('./qdrantService');

/**
 * Tools tìm kiếm: bệnh viện, bác sĩ, và lịch trống
 */

/**
 * Kiểm tra xem query có phải là tên bác sĩ không
 * @param {string} query - Query cần kiểm tra
 * @returns {Object|null} - Object chứa tên bác sĩ nếu tìm thấy, null nếu không
 */
const extractDoctorName = (query) => {
    if (!query || typeof query !== 'string') return null;
    
    // Pattern: "bác sĩ" hoặc "bs" hoặc "doctor" + tên (2-4 từ tiếng Việt, bắt đầu bằng chữ hoa)
    // Ví dụ: "bác sĩ Vũ Thị Hà", "khám bác sĩ Vũ Thị Hà", "Bác sĩ Vũ Thị Hà"
    const patterns = [
        /(?:^|\s)(?:bác\s*sĩ|bs|doctor)\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]{2,30})/i,
        /(?:^|\s)(?:khám|đặt\s*lịch|tìm)\s+(?:bác\s*sĩ|bs|doctor)\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]{2,30})/i
    ];
    
    for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match && match[1]) {
            const doctorName = match[1].trim();
            // Kiểm tra tên có ít nhất 2 từ (họ và tên)
            const words = doctorName.split(/\s+/).filter(w => w.length > 0);
            if (words.length >= 2 && words.length <= 4) {
                return { doctorName, fullMatch: match[0].trim() };
            }
        }
    }
    
    return null;
};

const searchTools = {
    "findHospitals": async ({ specialty, city, name }) => {
        try {
            let filter = {};
            if (city) filter.address = { $regex: city, $options: 'i' }; 
            if (name) filter.name = { $regex: name, $options: 'i' };

            if (specialty) {
                let specialtyDoc = null;
                
                // ƯU TIÊN 1: Dùng Qdrant Mapper trước (chính xác hơn, tránh false positive)
                const mapping = await findSpecialtyMapping(specialty);
                if (mapping) {
                    specialtyDoc = await Specialty.findById(mapping.specialtyId);
                }
                
                // FALLBACK: Nếu Qdrant không tìm thấy, thử tìm bằng tên chính xác với word boundaries
                if (!specialtyDoc) {
                    let regexPattern = specialty;
                    if (specialty.length <= 3) {
                        regexPattern = `\\b${specialty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
                    } else {
                        regexPattern = specialty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    }
                    specialtyDoc = await Specialty.findOne({ name: { $regex: regexPattern, $options: 'i' } });
                }
                
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
            
            // ƯU TIÊN: Nếu có tên bác sĩ, tìm trực tiếp bằng Qdrant doctor_mapper trước
            if (name) {
                console.log(`[Tool] Đang tìm bác sĩ với tên: "${name}"`);
                
                // Thử tìm bằng Qdrant doctor_mapper trước (chính xác hơn)
                const qdrantDoctors = await findDoctorMapping(name);
                
                if (qdrantDoctors && qdrantDoctors.length > 0) {
                    console.log(`[Tool] ✅ Tìm thấy ${qdrantDoctors.length} bác sĩ bằng Qdrant doctor_mapper`);
                    
                    // Lấy danh sách doctor IDs
                    const doctorIds = qdrantDoctors.map(d => d.doctorId);
                    
                    // Nếu có specialty, filter thêm theo specialty
                    if (specialty) {
                        const specialtyMapping = await findSpecialtyMapping(specialty);
                        if (specialtyMapping) {
                            const specialtyDoc = await Specialty.findById(specialtyMapping.specialtyId);
                            if (specialtyDoc) {
                                // Filter doctors có chuyên khoa này
                                const filteredDoctors = qdrantDoctors.filter(d => 
                                    d.specialtyId === specialtyDoc._id.toString()
                                );
                                
                                if (filteredDoctors.length > 0) {
                                    const filteredIds = filteredDoctors.map(d => d.doctorId);
                                    filter._id = { $in: filteredIds };
                                    console.log(`[Tool] ✅ Sau khi filter theo specialty "${specialtyDoc.name}": còn ${filteredDoctors.length} bác sĩ`);
                                } else {
                                    console.log(`[Tool] ⚠️ Không có bác sĩ "${name}" thuộc chuyên khoa "${specialtyDoc.name}"`);
                                    return { doctors: [] };
                                }
                            } else {
                                filter._id = { $in: doctorIds };
                            }
                        } else {
                            filter._id = { $in: doctorIds };
                        }
                    } else {
                        filter._id = { $in: doctorIds };
                    }
                    
                    // Lấy thông tin bác sĩ từ database
                    const limit = 20;
                    let doctors = await Doctor.find(filter)
                        .populate('user', 'fullName')
                        .limit(limit)
                        .select('user consultationFee specialtyId')
                        .exec();
                    
                    console.log(`[Tool] Tìm thấy ${doctors.length} bác sĩ cho name: "${name}"${specialty ? `, specialty: "${specialty}"` : ''} (limit: ${limit})`);
                    return { doctors };
                } else {
                    console.log(`[Tool] ⚠️ Qdrant doctor_mapper không tìm thấy, sẽ tìm bằng database thông thường`);
                }
            }
            
            // Xử lý filter theo chuyên khoa (nếu có)
            if (specialty) {
                let specialtyDoc = null;
                
                // ƯU TIÊN 1: Dùng Qdrant Mapper trước (chính xác hơn, tránh false positive)
                console.log(`[Tool] Đang dùng Qdrant Mapper để tìm chuyên khoa cho "${specialty}"...`);
                const mapping = await findSpecialtyMapping(specialty);
                if (mapping) {
                    specialtyDoc = await Specialty.findById(mapping.specialtyId);
                    if (specialtyDoc) {
                        console.log(`[Tool] Đã map thành công (Qdrant): "${specialty}" -> Chuyên khoa: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                    }
                }
                
                // FALLBACK: Nếu Qdrant không tìm thấy, thử tìm bằng tên chính xác với word boundaries
                // (tránh trường hợp "ho" match với "Khoa" trong "Nam Khoa")
                if (!specialtyDoc) {
                    console.log(`[Tool] Qdrant không tìm thấy, đang thử tìm chuyên khoa bằng tên chính xác...`);
                    
                    // Với query ngắn (<= 3 ký tự), dùng word boundaries để tránh false positive
                    let regexPattern = specialty;
                    if (specialty.length <= 3) {
                        // Thêm word boundaries để chỉ match từ hoàn chỉnh
                        regexPattern = `\\b${specialty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
                    } else {
                        // Với query dài hơn, escape special characters
                        regexPattern = specialty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    }
                    
                    specialtyDoc = await Specialty.findOne({ name: { $regex: regexPattern, $options: 'i' } });
                    
                    if (specialtyDoc) {
                        console.log(`[Tool] Tìm thấy chuyên khoa trực tiếp: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                    }
                }
                
                if (!specialtyDoc) {
                    console.log(`[Tool] ERROR: Không tìm thấy chuyên khoa cho "${specialty}"`);
                    return { doctors: [] };
                }
                
                filter.specialtyId = specialtyDoc._id;
            }
            
            // Lọc kết quả trả về
            // Nếu không có specialty (lấy tất cả), tăng limit lên 20
            // Nếu có specialty, giới hạn 10 để không quá nhiều
            const limit = specialty ? 10 : 20;
            
            let doctors = await Doctor.find(filter)
                .populate('user', 'fullName')
                .limit(limit * 2) // Lấy nhiều hơn để filter theo tên sau
                .select('user consultationFee specialtyId')
                .exec();
            
            // Filter theo tên bác sĩ sau khi populate (nếu có)
            if (name) {
                const nameLower = name.toLowerCase().trim();
                doctors = doctors.filter(doctor => {
                    const doctorName = doctor.user?.fullName || '';
                    return doctorName.toLowerCase().includes(nameLower);
                });
                console.log(`[Tool] Sau khi filter theo tên "${name}": còn ${doctors.length} bác sĩ`);
            }
            
            // Giới hạn lại sau khi filter
            doctors = doctors.slice(0, limit);
            
            console.log(`[Tool] Tìm thấy ${doctors.length} bác sĩ cho specialty: ${specialty || 'all'}, name: ${name || 'all'} (limit: ${limit})`);
            return { doctors };
        } catch (e) { 
            console.error("Lỗi findDoctors:", e);
            return { error: e.message }; 
        }   
    },

    "findAvailableSlots": async ({ query, city, date, sessionId, specialty }) => {
        try {
            console.log(`[Tool] Đang tìm lịch trống: Query "${query || 'không có'}", Specialty "${specialty || 'không có'}", Ngày ${date || 'không chỉ định'}, Khu vực ${city || 'không chỉ định'}, Session: ${sessionId}`);

            // 1. ÁNH XẠ QUERY -> CHUYÊN KHOA
            let specialtyDoc = null;
            
            // ƯU TIÊN 0: Nếu có specialty từ medicalContext, sử dụng trực tiếp (chính xác nhất)
            if (specialty) {
                console.log(`[Tool] 🎯 Ưu tiên sử dụng specialty từ medicalContext: "${specialty}"`);
                
                // Thử tìm bằng Qdrant Mapper trước
                const mapping = await findSpecialtyMapping(specialty);
                if (mapping) {
                    specialtyDoc = await Specialty.findById(mapping.specialtyId);
                    if (specialtyDoc) {
                        console.log(`[Tool] ✅ Đã map thành công (Qdrant từ specialty): "${specialty}" -> Chuyên khoa: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                    }
                }
                
                // FALLBACK: Nếu Qdrant không tìm thấy, thử tìm bằng tên chính xác
                if (!specialtyDoc) {
                    let regexPattern = specialty;
                    if (specialty.length <= 3) {
                        regexPattern = `\\b${specialty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
                    } else {
                        regexPattern = specialty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    }
                    specialtyDoc = await Specialty.findOne({ name: { $regex: regexPattern, $options: 'i' } });
                    if (specialtyDoc) {
                        console.log(`[Tool] ✅ Tìm thấy chuyên khoa trực tiếp từ specialty: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                    }
                }
            }
            
            // ƯU TIÊN 1: Kiểm tra xem query có phải là tên bác sĩ không
            // Nếu là tên bác sĩ, không map thành chuyên khoa, sẽ tìm bác sĩ trực tiếp ở bước sau
            let isDoctorNameQuery = false;
            let extractedDoctorName = null;
            
            if (!specialtyDoc && query) {
                extractedDoctorName = extractDoctorName(query);
                if (extractedDoctorName) {
                    isDoctorNameQuery = true;
                    console.log(`[Tool] 🔍 Phát hiện query là tên bác sĩ: "${extractedDoctorName.doctorName}" (từ "${extractedDoctorName.fullMatch}")`);
                    console.log(`[Tool] ⏭️ Bỏ qua mapping thành chuyên khoa, sẽ tìm bác sĩ trực tiếp ở bước sau`);
                }
            }
            
            // ƯU TIÊN 2: Nếu chưa có specialtyDoc và có query và KHÔNG phải là tên bác sĩ, dùng Qdrant Mapper với query
            if (!specialtyDoc && query && !isDoctorNameQuery) {
                console.log(`[Tool] Đang dùng Qdrant Mapper để tìm chuyên khoa cho query "${query}"...`);
                try {
                    const mapping = await findSpecialtyMapping(query);
                    console.log(`[Tool] Qdrant mapping result:`, mapping ? `Found specialtyId: ${mapping.specialtyId}, specialtyName: ${mapping.specialtyName}` : 'No mapping found');
                    if (mapping) {
                        specialtyDoc = await Specialty.findById(mapping.specialtyId);
                        if (specialtyDoc) {
                            console.log(`[Tool] ✅ Đã map thành công (Qdrant từ query): "${query}" -> Chuyên khoa: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                        } else {
                            console.log(`[Tool] ⚠️ WARNING: Mapping trả về specialtyId ${mapping.specialtyId} nhưng không tìm thấy trong database`);
                        }
                    } else {
                        console.log(`[Tool] ⚠️ Qdrant mapping không tìm thấy cho "${query}"`);
                    }
                } catch (error) {
                    console.error(`[Tool] ❌ Lỗi khi gọi Qdrant mapping:`, error);
                }
            }
            
            // FALLBACK: Nếu Qdrant không tìm thấy và có query và KHÔNG phải là tên bác sĩ, thử tìm bằng tên chính xác với word boundaries
            // (tránh trường hợp "ho" match với "Khoa" trong "Nam Khoa")
            if (!specialtyDoc && query && !isDoctorNameQuery) {
                console.log(`[Tool] ⚠️ Qdrant không tìm thấy, đang thử tìm chuyên khoa bằng tên chính xác (FALLBACK)...`);
                
                // Với query ngắn (<= 3 ký tự), dùng exact match hoặc word boundaries
                // Ví dụ: "ho" không nên match "Khoa" trong "Nam Khoa"
                let regexPattern = query;
                if (query.length <= 3) {
                    // Với query ngắn, chỉ match từ hoàn chỉnh (word boundary)
                    // MongoDB regex word boundary: \b không hoạt động tốt, dùng ^ hoặc \s
                    regexPattern = `(^|\\s)${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`;
                } else {
                    // Với query dài hơn, escape special characters
                    regexPattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }
                
                console.log(`[Tool] Đang tìm với regex pattern: "${regexPattern}"`);
                specialtyDoc = await Specialty.findOne({ name: { $regex: regexPattern, $options: 'i' } });
                
                if (specialtyDoc) {
                    console.log(`[Tool] ⚠️ Tìm thấy chuyên khoa trực tiếp (FALLBACK - có thể không chính xác): ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                } else {
                    console.log(`[Tool] Không tìm thấy chuyên khoa với regex pattern "${regexPattern}"`);
                }
            }

            // Nếu query là tên bác sĩ, không cần specialtyDoc (sẽ tìm bác sĩ trực tiếp)
            // Nếu không phải tên bác sĩ và không có specialtyDoc, trả về lỗi
            if (!specialtyDoc && !isDoctorNameQuery) {
                const searchTerm = specialty || query || 'không xác định';
                console.log(`[Tool] ERROR: Không tìm thấy chuyên khoa cho "${searchTerm}"`);
                return { error: `Xin lỗi, hệ thống không thể xác định chuyên khoa cho "${searchTerm}". Vui lòng thử lại với từ khóa khác hoặc chỉ định rõ chuyên khoa bạn muốn khám.` };
            }

            // Nếu query là tên bác sĩ, tìm bác sĩ trực tiếp trước
            let doctors = [];
            let foundDoctorByName = false;
            
            if (isDoctorNameQuery && extractedDoctorName) {
                console.log(`[Tool] 🔍 Đang tìm bác sĩ trực tiếp theo tên: "${extractedDoctorName.doctorName}"`);
                
                // Tìm bác sĩ theo tên (không cần specialty)
                const doctorNameLower = extractedDoctorName.doctorName.toLowerCase();
                const allDoctors = await Doctor.find({ isAvailable: { $ne: false } })
                    .populate('user', 'fullName')
                    .populate('specialtyId', 'name')
                    .populate('services');
                
                // Filter bác sĩ có tên khớp
                doctors = allDoctors.filter(doctor => {
                    const doctorName = doctor.user?.fullName || '';
                    return doctorName.toLowerCase().includes(doctorNameLower);
                });
                
                if (doctors.length > 0) {
                    foundDoctorByName = true;
                    console.log(`[Tool] ✅ Tìm thấy ${doctors.length} bác sĩ với tên "${extractedDoctorName.doctorName}"`);
                    
                    // Lấy specialty từ bác sĩ đầu tiên (nếu có)
                    if (doctors[0].specialtyId) {
                        specialtyDoc = doctors[0].specialtyId;
                        console.log(`[Tool] ✅ Đã xác định chuyên khoa từ bác sĩ: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
                    } else {
                        console.log(`[Tool] ⚠️ Bác sĩ "${extractedDoctorName.doctorName}" không có chuyên khoa`);
                    }
                } else {
                    console.log(`[Tool] ⚠️ Không tìm thấy bác sĩ với tên "${extractedDoctorName.doctorName}"`);
                }
            }
            
            // Nếu không tìm thấy bác sĩ theo tên hoặc không phải query tên bác sĩ, cần có specialtyDoc
            if (!foundDoctorByName && !specialtyDoc) {
                const searchTerm = specialty || query || 'không xác định';
                console.log(`[Tool] ERROR: Không tìm thấy chuyên khoa cho "${searchTerm}"`);
                return { error: `Xin lỗi, hệ thống không thể xác định chuyên khoa cho "${searchTerm}". Vui lòng thử lại với từ khóa khác hoặc chỉ định rõ chuyên khoa bạn muốn khám.` };
            }
            
            if (specialtyDoc) {
                console.log(`[Tool] Đã xác định chuyên khoa: ${specialtyDoc.name} (ID: ${specialtyDoc._id})`);
            }

            // 2. Tìm service phù hợp với query (nếu có) - SỬ DỤNG QDRANT MAPPER
            // Chỉ tìm service nếu đã có specialtyDoc
            let matchedService = null;
            if (specialtyDoc) {
                console.log(`[Tool] Đang tìm service phù hợp với query "${query}"...`);
                
                // Ưu tiên 1: Sử dụng Qdrant Service Mapper để tìm service phù hợp nhất
                const qdrantServices = await findServiceMapping(query, specialtyDoc._id.toString());
            
                if (qdrantServices.length > 0) {
                    // Lấy service có score cao nhất từ Qdrant
                    const topService = qdrantServices[0];
                    console.log(`[Tool] Qdrant tìm thấy service: "${topService.serviceName}" (Score: ${topService.score.toFixed(3)})`);
                    
                    // Query từ MongoDB để lấy dữ liệu mới nhất (đảm bảo dữ liệu không bị lỗi thời)
                    const serviceFromDB = await Service.findById(topService.serviceId)
                        .where({ isActive: true, specialtyId: specialtyDoc._id });
                    
                    if (serviceFromDB) {
                        matchedService = serviceFromDB;
                        console.log(`[Tool] ✅ Đã xác nhận service từ DB: "${matchedService.name}" (ID: ${matchedService._id})`);
                    } else {
                        console.log(`[Tool] ⚠️ Service từ Qdrant không còn tồn tại trong DB, tìm kiếm fallback...`);
                    }
                }
                
                // Fallback: Nếu Qdrant không tìm thấy hoặc service không còn tồn tại, tìm trực tiếp từ MongoDB
                if (!matchedService) {
                    console.log(`[Tool] Fallback: Tìm service trực tiếp từ MongoDB...`);
                    
                    // Tìm service có tên khớp với query
                    const services = await Service.find({
                        specialtyId: specialtyDoc._id,
                        isActive: true,
                        name: { $regex: query, $options: 'i' }
                    }).limit(5);
                    
                    if (services.length > 0) {
                        matchedService = services[0];
                        console.log(`[Tool] Tìm thấy service phù hợp (MongoDB): "${matchedService.name}" (ID: ${matchedService._id})`);
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
                                console.log(`[Tool] Tìm thấy service gần khớp (MongoDB): "${matchedService.name}" (ID: ${matchedService._id})`);
                                break;
                            }
                        }
                    }
                }
            }

            // 3. Tìm bác sĩ thuộc chuyên khoa và có service phù hợp (nếu có) - SỬ DỤNG QDRANT MAPPER
            // Nếu đã tìm thấy bác sĩ theo tên, bỏ qua bước này
            if (!foundDoctorByName) {
                console.log(`[Tool] Đang tìm bác sĩ thuộc chuyên khoa ${specialtyDoc.name}...`);
            } else {
                console.log(`[Tool] ⏭️ Đã tìm thấy bác sĩ theo tên, bỏ qua bước tìm bác sĩ theo chuyên khoa`);
            }
            
            // Ưu tiên 1: Sử dụng Qdrant Doctor Mapper nếu có service và chưa tìm thấy bác sĩ theo tên
            if (!foundDoctorByName && matchedService) {
                const qdrantDoctors = await findDoctorMapping(
                    query, 
                    specialtyDoc._id.toString(), 
                    matchedService._id.toString()
                );
                
                if (qdrantDoctors.length > 0) {
                    console.log(`[Tool] Qdrant tìm thấy ${qdrantDoctors.length} doctors phù hợp`);
                    
                    // Query từ MongoDB để lấy dữ liệu mới nhất và filter theo service
                    const doctorIds = qdrantDoctors.map(d => new mongoose.Types.ObjectId(d.doctorId));
                    doctors = await Doctor.find({ 
                        _id: { $in: doctorIds },
                        specialtyId: specialtyDoc._id,
                        isAvailable: { $ne: false }
                    }).populate('user', 'fullName').populate('services');
                    
                    // Filter bác sĩ có service này
                    const doctorsWithService = [];
                    for (const doctor of doctors) {
                        const hasService = doctor.services && doctor.services.some(
                            s => s._id.toString() === matchedService._id.toString()
                        );
                        
                        if (hasService) {
                            doctorsWithService.push(doctor);
                            console.log(`[Tool] ✅ Bác sĩ ${doctor.user?.fullName || doctor._id} có service "${matchedService.name}" (từ Qdrant)`);
                        }
                    }
                    
                    if (doctorsWithService.length > 0) {
                        doctors = doctorsWithService;
                        console.log(`[Tool] Ưu tiên ${doctors.length} bác sĩ có service "${matchedService.name}" (từ Qdrant)`);
                    }
                }
            }
            
            // Fallback: Nếu Qdrant không tìm thấy hoặc không có service, tìm trực tiếp từ MongoDB
            // Chỉ tìm nếu chưa tìm thấy bác sĩ theo tên
            if (!foundDoctorByName && doctors.length === 0) {
                console.log(`[Tool] Fallback: Tìm bác sĩ trực tiếp từ MongoDB...`);
                doctors = await Doctor.find({ 
                    specialtyId: specialtyDoc._id,
                    isAvailable: { $ne: false }
                }).populate('user', 'fullName');
                console.log(`[Tool] Tìm thấy ${doctors.length} bác sĩ thuộc chuyên khoa ${specialtyDoc.name} (MongoDB)`);
                
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
                            console.log(`[Tool] Bác sĩ ${doctor.user?.fullName || doctor._id} có service "${matchedService.name}" (MongoDB)`);
                        }
                    }
                    
                    // Nếu tìm thấy bác sĩ có service, ưu tiên họ
                    if (doctorsWithService.length > 0) {
                        doctors = doctorsWithService;
                        console.log(`[Tool] Ưu tiên ${doctors.length} bác sĩ có service "${matchedService.name}" (MongoDB)`);
                    } else {
                        console.log(`[Tool] Không có bác sĩ nào có service "${matchedService.name}", sử dụng tất cả bác sĩ của chuyên khoa`);
                    }
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

