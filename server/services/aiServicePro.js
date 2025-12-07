/**
 * AI Service cho Gemini 2.5 Pro
 * Xử lý các câu hỏi thông tin, tư vấn (KHÔNG phải đặt lịch)
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');
const { SYSTEM_INSTRUCTION_PRO } = require('./aiConfigPro');
const { tools } = require('./aiToolsDefinitions');
const searchTools = require('./searchTools');
const prescriptionTools = require('./prescriptionTools');
const cache = require('./cacheService');
const { searchWeb } = require('./webSearchService');
const Medication = require('../models/Medication');
const PrescriptionDraft = require('../models/PrescriptionDraft');
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const { findSpecialtyMapping } = require('./qdrantService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini 2.5 Pro model
const proModel = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: SYSTEM_INSTRUCTION_PRO
});

// Tools chỉ dùng cho Pro model (không có appointment tools)
const proTools = {
    functionDeclarations: tools.functionDeclarations.filter(tool => 
        !['findAvailableSlots', 'bookAppointment', 'cancelAppointment', 'rescheduleAppointment', 'getMyAppointments'].includes(tool.name)
    )
};

// Helper function để extract keywords từ medical advice
const extractKeywords = (advice, symptom) => {
    if (!advice) return symptom ? [symptom] : [];
    const candidates = advice
        .replace(/[\n\r]+/g, '\n')
        .split(/[,.;•\-–\n]/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.replace(/[^a-zA-ZÀ-ỹ0-9\s]/g, '').trim())
        .filter(s => s.length >= 3)
        .slice(0, 5);
    if (symptom) candidates.push(symptom);
    return [...new Set(candidates)];
};

const availableTools = {
    findHospitals: async ({ specialty, city, name }) => {
        return await searchTools.findHospitals({ specialty, city, name });
    },

    findDoctors: async ({ specialty, name }) => {
        return await searchTools.findDoctors({ specialty, name });
    },

    checkInventoryAndPrescribe: async ({ symptom, sessionId }) => {
        try {
            const userId = cache.getUserId(sessionId);
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { error: 'Vui lòng đăng nhập để chúng tôi có thể kê đơn.' };
            }

            // Kiểm tra giới hạn: mỗi ngày chỉ được tạo tối đa 2 đơn thuốc
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const prescriptionsToday = await PrescriptionDraft.countDocuments({
                patientId: userId,
                createdAt: {
                    $gte: today,
                    $lt: tomorrow
                },
                status: { $ne: 'cancelled' }
            });

            if (prescriptionsToday >= 2) {
                return {
                    error: 'Bạn đã tạo đủ 2 đơn thuốc trong ngày hôm nay. Vui lòng quay lại vào ngày mai để tạo đơn mới.',
                    limitReached: true,
                    prescriptionsToday: prescriptionsToday,
                    limit: 2
                };
            }

            // Sử dụng webSearch thay vì callSearchAgent (GPT-4o thay vì GPT-4o-mini)
            const medicalAdvice = await searchWeb(symptom);
            const keywords = extractKeywords(medicalAdvice, symptom);
            const textSearch = keywords.slice(0, 3).join(' ');

            const baseQuery = {
                isActive: true
            };

            if (textSearch) {
                baseQuery.$text = { $search: textSearch };
            } else if (keywords.length) {
                baseQuery.$or = keywords.map(kw => ({ name: { $regex: kw, $options: 'i' } }));
            } else {
                return {
                    advice: medicalAdvice || 'Không tìm thấy thông tin y khoa đáng tin cậy.',
                    message: 'Hệ thống chưa đủ dữ liệu để gợi ý thuốc cho triệu chứng này. Bạn vui lòng mô tả chi tiết hơn.'
                };
            }

            const allMedications = await Medication.find(baseQuery)
                .populate('hospitalId', 'name address')
                .lean();

            if (!allMedications.length) {
                return {
                    advice: medicalAdvice || 'Không tìm thấy thông tin y khoa đáng tin cậy.',
                    message: 'Kho thuốc hiện không có mặt hàng phù hợp với lời khuyên y khoa vừa tra cứu.'
                };
            }

            const groupedByHospital = {};
            allMedications.forEach(med => {
                const hospitalRef = med.hospitalId || {};
                const hospitalId = hospitalRef._id?.toString() || med.hospitalId?.toString();
                if (!hospitalId) return;

                if (!groupedByHospital[hospitalId]) {
                    groupedByHospital[hospitalId] = {
                        hospitalId: hospitalRef._id || med.hospitalId,
                        hospitalName: hospitalRef.name || 'Chi nhánh không xác định',
                        address: hospitalRef.address,
                        inStock: [],
                        outOfStock: []
                    };
                }

                const medInfo = {
                    medicationId: med._id,
                    name: med.name,
                    unitTypeDisplay: med.unitTypeDisplay,
                    unitPrice: med.unitPrice,
                    stockQuantity: med.stockQuantity
                };

                if (med.stockQuantity > 0) {
                    groupedByHospital[hospitalId].inStock.push(medInfo);
                } else {
                    groupedByHospital[hospitalId].outOfStock.push(medInfo);
                }
            });

            const hospitalAvailability = Object.values(groupedByHospital).sort((a, b) => {
                return b.inStock.length - a.inStock.length;
            });

            if (!hospitalAvailability.length) {
                return {
                    advice: medicalAdvice || 'Không tìm thấy thông tin y khoa đáng tin cậy.',
                    message: 'Hiện không có chi nhánh nào còn thuốc phù hợp.'
                };
            }

            // Chọn bệnh viện có nhiều thuốc nhất
            let preferredHospitalEntry = hospitalAvailability.find(entry => entry.inStock.length > 0) || hospitalAvailability[0];
            let preferredMedications = (preferredHospitalEntry.inStock || []).slice(0, 3);

            if (!preferredMedications.length) {
                return {
                    advice: medicalAdvice || 'Không tìm thấy thông tin y khoa đáng tin cậy.',
                    message: 'Các chi nhánh hiện đều hết thuốc phù hợp. Bạn vui lòng chọn bệnh viện khác hoặc đợi kho cập nhật.'
                };
            }

            // Xác định chuyên khoa từ triệu chứng
            let specialtyInfo = null;
            try {
                const mapping = await findSpecialtyMapping(symptom);
                if (mapping) {
                    const specialtyDoc = await Specialty.findById(mapping.specialtyId).select('name').lean();
                    specialtyInfo = {
                        id: mapping.specialtyId,
                        name: specialtyDoc?.name || mapping.specialtyName
                    };
                }
            } catch (error) {
                console.error('[Pro Model] Lỗi khi xác định chuyên khoa cho đơn thuốc:', error);
            }

            // Tìm bác sĩ phù hợp
            let doctorInfo = null;
            let assignedHospital = preferredHospitalEntry;
            
            if (specialtyInfo?.id) {
                // Ưu tiên 1: Tìm bác sĩ ở bệnh viện có nhiều thuốc nhất
                if (preferredHospitalEntry?.hospitalId) {
                    const doctor = await Doctor.findOne({
                        hospitalId: preferredHospitalEntry.hospitalId,
                        specialtyId: specialtyInfo.id,
                        isAvailable: { $ne: false }
                    })
                        .populate('user', 'fullName')
                        .select('title hospitalId specialtyId user')
                        .lean();

                    if (doctor) {
                        doctorInfo = {
                            id: doctor._id,
                            name: doctor.user?.fullName || doctor.title || 'Bác sĩ chuyên khoa',
                            title: doctor.title
                        };
                        console.log(`[Pro Model] Đã tìm thấy bác sĩ ${doctorInfo.name} ở bệnh viện ${preferredHospitalEntry.hospitalName}`);
                    }
                }
                
                // Ưu tiên 2: Tìm ở các bệnh viện khác có thuốc
                if (!doctorInfo && hospitalAvailability.length > 0) {
                    for (const hospitalEntry of hospitalAvailability) {
                        if (hospitalEntry.hospitalId.toString() === preferredHospitalEntry.hospitalId.toString()) {
                            continue;
                        }
                        
                        if (hospitalEntry.inStock.length > 0) {
                            const doctor = await Doctor.findOne({
                                hospitalId: hospitalEntry.hospitalId,
                                specialtyId: specialtyInfo.id,
                                isAvailable: { $ne: false }
                            })
                                .populate('user', 'fullName')
                                .select('title hospitalId specialtyId user')
                                .lean();

                            if (doctor) {
                                doctorInfo = {
                                    id: doctor._id,
                                    name: doctor.user?.fullName || doctor.title || 'Bác sĩ chuyên khoa',
                                    title: doctor.title
                                };
                                assignedHospital = hospitalEntry;
                                console.log(`[Pro Model] Đã tìm thấy bác sĩ ${doctorInfo.name} ở bệnh viện ${hospitalEntry.hospitalName}`);
                                break;
                            }
                        }
                    }
                }
                
                // Ưu tiên 3: Tìm bất kỳ bác sĩ nào thuộc chuyên khoa
                if (!doctorInfo) {
                    const doctor = await Doctor.findOne({
                        specialtyId: specialtyInfo.id,
                        isAvailable: { $ne: false }
                    })
                        .populate('user', 'fullName')
                        .populate('hospitalId', 'name')
                        .select('title hospitalId specialtyId user')
                        .lean();

                    if (doctor) {
                        doctorInfo = {
                            id: doctor._id,
                            name: doctor.user?.fullName || doctor.title || 'Bác sĩ chuyên khoa',
                            title: doctor.title
                        };
                        const doctorHospital = hospitalAvailability.find(h => 
                            h.hospitalId.toString() === (doctor.hospitalId?._id || doctor.hospitalId)?.toString()
                        );
                        if (doctorHospital && doctorHospital.inStock.length > 0) {
                            assignedHospital = doctorHospital;
                        }
                        console.log(`[Pro Model] Đã tìm thấy bác sĩ ${doctorInfo.name} thuộc chuyên khoa ${specialtyInfo.name}`);
                    }
                }
            }
            
            if (!doctorInfo) {
                console.warn(`[Pro Model] Không tìm thấy bác sĩ thuộc chuyên khoa ${specialtyInfo?.name || 'không xác định'}`);
            }

            // Cập nhật lại preferredMedications nếu assignedHospital khác
            if (assignedHospital && assignedHospital.hospitalId.toString() !== preferredHospitalEntry.hospitalId.toString()) {
                preferredMedications = (assignedHospital.inStock || []).slice(0, 3);
                preferredHospitalEntry = assignedHospital;
            }
            
            if (!preferredMedications.length && assignedHospital) {
                preferredMedications = (assignedHospital.inStock || []).slice(0, 3);
            }
            
            // Tạo đơn thuốc
            const draft = await PrescriptionDraft.create({
                patientId: userId,
                diagnosis: symptom,
                symptom,
                keywords,
                hospitalId: assignedHospital?.hospitalId || preferredHospitalEntry.hospitalId,
                hospitalName: assignedHospital?.hospitalName || preferredHospitalEntry.hospitalName,
                specialtyId: specialtyInfo?.id,
                specialtyName: specialtyInfo?.name,
                doctorId: doctorInfo?.id,
                doctorName: doctorInfo?.name,
                medications: preferredMedications.map(m => ({
                    medicationId: m.medicationId,
                    name: m.name,
                    quantity: 1,
                    price: m.unitPrice || 0
                })),
                hospitalAvailability: hospitalAvailability.slice(0, 3).map(entry => ({
                    hospitalId: entry.hospitalId,
                    hospitalName: entry.hospitalName,
                    address: entry.address,
                    totalInStock: entry.inStock.length,
                    inStock: entry.inStock.slice(0, 5),
                    outOfStock: entry.outOfStock.slice(0, 5)
                })),
                note: medicalAdvice ? `Dựa trên khuyến nghị: ${medicalAdvice.slice(0, 120)}...` : undefined
            });
            
            console.log(`[Pro Model] Đã tạo đơn thuốc ${draft.prescriptionCode} cho bệnh viện ${draft.hospitalName}, chuyên khoa ${draft.specialtyName}, bác sĩ ${draft.doctorName || 'chưa gán'}`);

            const hospitalContext = {
                assignedHospital: assignedHospital || preferredHospitalEntry
                    ? {
                        id: (assignedHospital || preferredHospitalEntry).hospitalId,
                        name: (assignedHospital || preferredHospitalEntry).hospitalName,
                        address: (assignedHospital || preferredHospitalEntry).address,
                        availableMedications: (assignedHospital || preferredHospitalEntry).inStock.length,
                        outOfStockMedications: (assignedHospital || preferredHospitalEntry).outOfStock.length
                    }
                    : null,
                specialty: specialtyInfo,
                doctor: doctorInfo ? {
                    id: doctorInfo.id,
                    name: doctorInfo.name,
                    title: doctorInfo.title,
                    hospitalId: assignedHospital?.hospitalId || preferredHospitalEntry?.hospitalId,
                    hospitalName: assignedHospital?.hospitalName || preferredHospitalEntry?.hospitalName,
                    specialtyId: specialtyInfo?.id,
                    specialtyName: specialtyInfo?.name
                } : null,
                branches: hospitalAvailability.slice(0, 3)
            };

            return {
                success: true,
                advice: medicalAdvice,
                medicinesFound: preferredMedications.map(m => m.name),
                prescriptionCode: draft.prescriptionCode,
                hospitalContext,
                message: `Đơn thuốc nháp đã được tạo với mã ${draft.prescriptionCode}. Bạn có thể dùng mã này để kiểm tra trạng thái đơn thuốc.`,
                disclaimer: 'Thông tin chỉ mang tính tham khảo. Cần bác sĩ/dược sĩ xác nhận trước khi dùng thuốc.'
            };
        } catch (error) {
            console.error('[Pro Model] Lỗi checkInventoryAndPrescribe:', error);
            return { error: error.message };
        }
    },

    getMyPrescriptions: async ({ status, includeDrafts, limit, sessionId }) => {
        return await prescriptionTools.getMyPrescriptions({ status, includeDrafts, limit, sessionId });
    },

    cancelPrescription: async ({ prescriptionCode, prescriptionId, reason, sessionId }) => {
        return await prescriptionTools.cancelPrescription({ prescriptionCode, prescriptionId, reason, sessionId });
    }
};

/**
 * Chạy chat với Gemini 2.5 Pro + Web Search
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @param {Array} history - Lịch sử chat
 * @param {string} sessionId - Session ID
 * @returns {Promise<{text: string, usedTool: boolean}>}
 */
async function runProChatWithTools(userPrompt, history, sessionId) {
    // Bước 1: Lấy danh sách chuyên khoa có sẵn trong hệ thống
    const availableSpecialties = await Specialty.find({}).select('name description').lean();
    const specialtyList = availableSpecialties.map(s => `- ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n');
    
    // Bước 2: Tìm chuyên khoa phù hợp nếu người dùng hỏi về triệu chứng
    let matchedSpecialty = null;
    const isSymptomQuestion = /đau|sốt|triệu chứng|bệnh|bệnh lý|ho|khó thở|đau đầu|đau bụng|mệt mỏi/i.test(userPrompt);
    
    if (isSymptomQuestion) {
        console.log('[Pro Model] Đang tìm chuyên khoa phù hợp cho triệu chứng...');
        try {
            const mapping = await findSpecialtyMapping(userPrompt);
            if (mapping) {
                const specialtyDoc = await Specialty.findById(mapping.specialtyId).select('name description').lean();
                if (specialtyDoc) {
                    matchedSpecialty = {
                        id: mapping.specialtyId,
                        name: specialtyDoc.name,
                        description: specialtyDoc.description
                    };
                    console.log(`[Pro Model] Tìm thấy chuyên khoa phù hợp: ${matchedSpecialty.name}`);
                }
            }
        } catch (error) {
            console.error('[Pro Model] Lỗi khi tìm chuyên khoa:', error);
        }
    }
    
    // Bước 3: Tìm kiếm web nếu cần (cho câu hỏi y khoa) - NHƯNG KHÔNG search khi hỏi về chuyên khoa
    let webSearchResult = "";
    const isSpecialtyQuestion = /khám chuyên khoa nào|chuyên khoa nào|nên khám|khám ở đâu|khám khoa nào/i.test(userPrompt);
    const isMedicalQuestion = /đau|sốt|triệu chứng|bệnh|bệnh lý|điều trị|cách chữa/i.test(userPrompt);
    
    // KHÔNG search web nếu câu hỏi liên quan đến chuyên khoa - chỉ dùng database
    if (isMedicalQuestion && !isSpecialtyQuestion) {
        console.log('[Pro Model] Đang tìm kiếm thông tin trên web (tham khảo)...');
        webSearchResult = await searchWeb(userPrompt);
    } else if (isSpecialtyQuestion) {
        console.log('[Pro Model] Câu hỏi về chuyên khoa - KHÔNG search web, chỉ dùng database');
    }

    // Bước 4: Tạo context với thông tin chuyên khoa
    let contextInfo = `\n\n=== THÔNG TIN HỆ THỐNG (BẮT BUỘC PHẢI TUÂN THEO) ===\n`;
    contextInfo += `Danh sách chuyên khoa có sẵn trong hệ thống:\n${specialtyList}\n\n`;
    contextInfo += `QUY TẮC QUAN TRỌNG:\n`;
    contextInfo += `1. Bạn CHỈ được tư vấn và đề xuất các chuyên khoa có TRONG danh sách trên.\n`;
    contextInfo += `2. TUYỆT ĐỐI KHÔNG được đề xuất bất kỳ chuyên khoa nào KHÔNG có trong danh sách trên.\n`;
    contextInfo += `3. Nếu người dùng hỏi về triệu chứng, bạn PHẢI tìm chuyên khoa phù hợp TRONG danh sách trên.\n`;
    contextInfo += `4. Ví dụ: Nếu danh sách có "Nội khoa" nhưng KHÔNG có "Khoa Hô hấp", bạn PHẢI đề xuất "Nội khoa", KHÔNG được đề xuất "Khoa Hô hấp".\n`;
    contextInfo += `5. Nếu danh sách có "Nhi khoa" nhưng KHÔNG có "Khoa Tai Mũi Họng", bạn PHẢI đề xuất "Nhi khoa" hoặc chuyên khoa khác có trong danh sách.\n\n`;
    
    if (matchedSpecialty) {
        contextInfo += `=== CHUYÊN KHOA PHÙ HỢP (TỪ HỆ THỐNG) ===\n`;
        contextInfo += `Hệ thống đã tìm thấy chuyên khoa phù hợp với triệu chứng: "${matchedSpecialty.name}"${matchedSpecialty.description ? ` - ${matchedSpecialty.description}` : ''}\n`;
        contextInfo += `Bạn PHẢI đề xuất chuyên khoa "${matchedSpecialty.name}" cho người dùng.\n`;
        contextInfo += `Sau đó hướng dẫn họ nói "tôi muốn đặt lịch" để đặt lịch khám.\n\n`;
    } else if (isSpecialtyQuestion) {
        contextInfo += `=== HƯỚNG DẪN ===\n`;
        contextInfo += `Người dùng đang hỏi về chuyên khoa phù hợp. Bạn PHẢI:\n`;
        contextInfo += `1. Chỉ đề xuất các chuyên khoa có trong danh sách trên.\n`;
        contextInfo += `2. Nếu không tìm thấy chuyên khoa phù hợp trong danh sách, đề xuất chuyên khoa gần nhất có trong danh sách.\n`;
        contextInfo += `3. TUYỆT ĐỐI KHÔNG được đề xuất chuyên khoa không có trong danh sách.\n\n`;
    }
    
    if (webSearchResult && !isSpecialtyQuestion) {
        contextInfo += `=== THÔNG TIN THAM KHẢO TỪ WEB (CHỈ ĐỂ THAM KHẢO) ===\n`;
        contextInfo += `${webSearchResult}\n\n`;
        contextInfo += `Lưu ý: Thông tin từ web chỉ để tham khảo về triệu chứng/bệnh lý. Bạn PHẢI ưu tiên đề xuất các chuyên khoa có trong hệ thống.\n\n`;
    }
    
    const enhancedPrompt = `${userPrompt}${contextInfo}`;

    const chat = proModel.startChat({
        tools: proTools,
        history
    });

    let result;
    let toolCalled = false;
    
    try {
        result = await chat.sendMessage(enhancedPrompt);
    } catch (error) {
        console.error('[Pro Model] Lỗi khi gửi tin nhắn:', error);
        throw error;
    }

    while (true) {
        const call = result.response.functionCalls()?.[0];
        if (!call) {
            const responseText = result.response.text() || 'Xin lỗi, tôi không thể xử lý yêu cầu này. Vui lòng thử lại.';
            return {
                text: responseText,
                usedTool: toolCalled 
            };
        }
        
        console.log(`[Pro Model] Tool call: ${call.name}`);
        
        const toolImpl = availableTools[call.name];
        if (!toolImpl) {
            console.error(`[Pro Model] Tool ${call.name} không tồn tại.`);
            result = await chat.sendMessage(JSON.stringify({
                functionResponse: { name: call.name, response: { error: `Tool ${call.name} không tồn tại.` } }
            }));
            continue; 
        }

        let args = call.args || {};
        if (['checkInventoryAndPrescribe', 'getMyPrescriptions', 'cancelPrescription'].includes(call.name)) {
            args.sessionId = sessionId;
        }

        let toolResult;
        try {
            toolCalled = true;
            toolResult = await toolImpl(args);
        } catch (error) {
            console.error(`[Pro Model] Lỗi khi thực thi tool ${call.name}:`, error);
            toolResult = { error: error.message };
        }

        try {
            result = await chat.sendMessage(JSON.stringify({
                functionResponse: { name: call.name, response: toolResult }
            }));
        } catch (error) {
            console.error('[Pro Model] Lỗi khi gửi kết quả tool:', error);
            throw error;
        }
    }
}

module.exports = {
    runProChatWithTools
};

