const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const mongoose = require('mongoose');
const Medication = require('../models/Medication');
const PrescriptionDraft = require('../models/PrescriptionDraft');
const Doctor = require('../models/Doctor');
const Specialty = require('../models/Specialty');
const cache = require('./cacheService');
const searchTools = require('./searchTools');
const appointmentTools = require('./appointmentTools');
const { SYSTEM_INSTRUCTION } = require('./aiConfig');
const prescriptionTools = require('./prescriptionTools');
const { findSpecialtyMapping } = require('./qdrantService');
const { tools } = require('./aiToolsDefinitions');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ========================================================================
// 🤖 MODEL 2: Search Agent (Dược sĩ AI) - OpenAI
// ========================================================================
const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const callSearchAgent = async (query) => {
    try {
        const prompt = `Hãy tìm kiếm thông tin y khoa chính xác về: "${query}".
Trả về danh sách ngắn các hoạt chất hoặc nhóm thuốc phổ biến để điều trị, cách nhau bởi dấu phẩy.`;

        const response = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Bạn là một dược sĩ AI chuyên tư vấn về thuốc và hoạt chất y khoa. Hãy trả lời ngắn gọn, chính xác."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 200,
            temperature: 0.7
        });

        const result = response.choices[0]?.message?.content || '';
        console.log(`[Search Agent] Kết quả: ${result?.slice(0, 120) || ''}`);
        return result;
    } catch (error) {
        console.error("Lỗi Search Agent (OpenAI):", error);
        return "";
    }
};

// ========================================================================
// 🤖 MODEL 1: Main Agent (Lễ tân AI)
// ========================================================================
const mainModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION
});

// Sử dụng tool declarations từ aiToolsDefinitions.js
const toolDeclarations = tools;

const normalizeReferenceCode = (text) => {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/l\s*0?(\d{1,2})/i);
    if (!match) return null;
    const slotNum = parseInt(match[1], 10);
    if (Number.isNaN(slotNum)) return null;
    return {
        code: `L${String(slotNum).padStart(2, '0')}`,
        index: slotNum
    };
};

const resolveSlotFromCache = (sessionId, slotIdentifier, userPrompt) => {
    const slots = cache.getAvailableSlots(sessionId);
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
        return { error: 'Danh sách lịch trước đó đã hết hạn. Vui lòng yêu cầu tìm lịch lại.' };
    }

    if (typeof slotIdentifier === 'object' && slotIdentifier !== null) {
        slotIdentifier = slotIdentifier.slotIndex || slotIdentifier.referenceCode || slotIdentifier.slotId;
    }

    let targetIndex = null;
    let slotId = null;

    if (typeof slotIdentifier === 'number' && !Number.isNaN(slotIdentifier)) {
        targetIndex = slotIdentifier;
    } else if (typeof slotIdentifier === 'string') {
        if (slotIdentifier.includes('_')) {
            slotId = slotIdentifier;
        } else {
            const parsedNumber = parseInt(slotIdentifier, 10);
            if (!Number.isNaN(parsedNumber)) {
                targetIndex = parsedNumber;
            } else {
                const ref = normalizeReferenceCode(slotIdentifier);
                if (ref) {
                    targetIndex = ref.index;
                }
            }
        }
    }

    if (targetIndex === null && userPrompt) {
        const ref = normalizeReferenceCode(userPrompt);
        if (ref) targetIndex = ref.index;
    }

    let selectedSlot;

    if (slotId) {
        selectedSlot = slots.find(slot => slot.slotId === slotId);
    } else if (targetIndex) {
        const index = targetIndex - 1;
        if (index >= 0 && index < slots.length) {
            selectedSlot = slots[index];
        }
    }

    if (!selectedSlot) {
        return { error: 'Không tìm thấy mã slot bạn đã chọn. Vui lòng yêu cầu danh sách lịch mới.', slots };
    }

    return { slot: selectedSlot, referenceCode: selectedSlot.referenceCode || normalizeReferenceCode(selectedSlot.referenceCode || '')?.code };
};

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

    findAvailableSlots: async ({ query, city, date, sessionId }) => {
        const response = await searchTools.findAvailableSlots({ query, city, date, sessionId });
        if (response?.availableSlots?.length && sessionId) {
            cache.setAvailableSlots(sessionId, response.availableSlots);
        }
        return response;
    },

    bookAppointment: async ({ slotIndex, sessionId, userPrompt }) => {
        const resolution = resolveSlotFromCache(sessionId, slotIndex, userPrompt);
        if (resolution.error) {
            return { error: resolution.error };
        }

        const { slot } = resolution;
        if (!slot?.slotId) {
            return { error: 'Không tìm thấy thông tin slot hợp lệ để đặt lịch.' };
        }

        return appointmentTools.bookAppointment({
            slotId: slot.slotId,
            serviceId: slot.serviceId,
            sessionId
        });
    },

    checkInventoryAndPrescribe: async ({ symptom, sessionId }) => {
        try {
            const userId = cache.getUserId(sessionId);
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { error: 'Vui lòng đăng nhập để chúng tôi có thể kê đơn.' };
    }

            const medicalAdvice = await callSearchAgent(symptom);
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

            // Chọn bệnh viện có nhiều thuốc nhất (sẽ được cập nhật lại nếu tìm thấy bác sĩ ở bệnh viện khác)
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
                console.error('Lỗi khi xác định chuyên khoa cho đơn thuốc:', error);
            }

            // Tìm bác sĩ phù hợp: thuộc chuyên khoa và bệnh viện có thuốc
            let doctorInfo = null;
            let assignedHospital = preferredHospitalEntry;
            
            if (specialtyInfo?.id) {
                // Ưu tiên 1: Tìm bác sĩ ở bệnh viện có nhiều thuốc nhất và thuộc chuyên khoa phù hợp
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
                        console.log(`[Prescription] Đã tìm thấy bác sĩ ${doctorInfo.name} ở bệnh viện ${preferredHospitalEntry.hospitalName} thuộc chuyên khoa ${specialtyInfo.name}`);
                    }
                }
                
                // Ưu tiên 2: Nếu không tìm thấy ở bệnh viện có nhiều thuốc nhất, tìm ở các bệnh viện khác có thuốc
                if (!doctorInfo && hospitalAvailability.length > 0) {
                    for (const hospitalEntry of hospitalAvailability) {
                        if (hospitalEntry.hospitalId.toString() === preferredHospitalEntry.hospitalId.toString()) {
                            continue; // Đã tìm ở bệnh viện này rồi
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
                                assignedHospital = hospitalEntry; // Gán lại bệnh viện cho bác sĩ này
                                console.log(`[Prescription] Đã tìm thấy bác sĩ ${doctorInfo.name} ở bệnh viện ${hospitalEntry.hospitalName} thuộc chuyên khoa ${specialtyInfo.name}`);
                                break;
                            }
                        }
                    }
                }
                
                // Ưu tiên 3: Nếu vẫn không tìm thấy, tìm bất kỳ bác sĩ nào thuộc chuyên khoa (không quan trọng bệnh viện)
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
                        // Cập nhật assignedHospital với bệnh viện của bác sĩ (nếu có thuốc ở đó)
                        const doctorHospital = hospitalAvailability.find(h => 
                            h.hospitalId.toString() === (doctor.hospitalId?._id || doctor.hospitalId)?.toString()
                        );
                        if (doctorHospital && doctorHospital.inStock.length > 0) {
                            assignedHospital = doctorHospital;
                        }
                        console.log(`[Prescription] Đã tìm thấy bác sĩ ${doctorInfo.name} thuộc chuyên khoa ${specialtyInfo.name} (có thể ở bệnh viện khác)`);
                    }
                }
            }
            
            // Nếu không tìm thấy bác sĩ, vẫn tạo đơn nhưng không gán bác sĩ (sẽ được gán sau khi duyệt)
            if (!doctorInfo) {
                console.warn(`[Prescription] Không tìm thấy bác sĩ thuộc chuyên khoa ${specialtyInfo?.name || 'không xác định'} để gán cho đơn thuốc. Đơn thuốc sẽ được gán sau khi duyệt.`);
            }

            // Cập nhật lại preferredMedications nếu assignedHospital khác preferredHospitalEntry
            if (assignedHospital && assignedHospital.hospitalId.toString() !== preferredHospitalEntry.hospitalId.toString()) {
                preferredMedications = (assignedHospital.inStock || []).slice(0, 3);
                preferredHospitalEntry = assignedHospital;
                console.log(`[Prescription] Đã chuyển sang bệnh viện ${assignedHospital.hospitalName} vì có bác sĩ phù hợp`);
            }
            
            // Đảm bảo có thuốc ở bệnh viện được gán
            if (!preferredMedications.length && assignedHospital) {
                preferredMedications = (assignedHospital.inStock || []).slice(0, 3);
            }
            
            // Tạo đơn thuốc với thông tin đã được xác định
            const draft = await PrescriptionDraft.create({
                patientId: userId,
                diagnosis: symptom,
                symptom,
                keywords,
                hospitalId: assignedHospital?.hospitalId || preferredHospitalEntry.hospitalId,
                hospitalName: assignedHospital?.hospitalName || preferredHospitalEntry.hospitalName,
                specialtyId: specialtyInfo?.id,
                specialtyName: specialtyInfo?.name,
                doctorId: doctorInfo?.id, // Gán bác sĩ thuộc đúng bệnh viện và chuyên khoa
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
            
            console.log(`[Prescription] Đã tạo đơn thuốc ${draft.prescriptionCode} cho bệnh viện ${draft.hospitalName}, chuyên khoa ${draft.specialtyName}, bác sĩ ${draft.doctorName || 'chưa gán'}`);

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
                message: 'Đơn thuốc nháp đã được tạo và chờ dược sĩ/bác sĩ duyệt.',
                disclaimer: 'Thông tin chỉ mang tính tham khảo. Cần bác sĩ/dược sĩ xác nhận trước khi dùng thuốc.'
            };
        } catch (error) {
            console.error('Lỗi checkInventoryAndPrescribe:', error);
            return { error: error.message };
        }
    },

    // Thêm các tool quản lý lịch hẹn
    getAppointmentHistory: async ({ patientId }) => {
        return appointmentTools.getAppointmentHistory({ patientId });
    },

    getMyAppointments: async ({ sessionId }) => {
        return appointmentTools.getMyAppointments({ sessionId });
    },

    cancelAppointment: async ({ bookingCode, reason, sessionId }) => {
        return appointmentTools.cancelAppointment({ bookingCode, reason, sessionId });
    },

    rescheduleAppointment: async ({ bookingCode, preferredDate, preferredTime, sessionId }) => {
        return appointmentTools.rescheduleAppointment({ bookingCode, preferredDate, preferredTime, sessionId });
    },

    getMyPrescriptions: async ({ status, includeDrafts, limit, sessionId }) => {
        return prescriptionTools.getMyPrescriptions({ status, includeDrafts, limit, sessionId });
    },

    cancelPrescription: async ({ prescriptionCode, prescriptionId, reason, sessionId }) => {
        return prescriptionTools.cancelPrescription({ prescriptionCode, prescriptionId, reason, sessionId });
    }
};

const runChatWithTools = async (userPrompt, history, sessionId) => {
    const chat = mainModel.startChat({
        tools: toolDeclarations,
        history
    });

    let result;
    let toolCalled = false;
    
    try {
        result = await chat.sendMessage(userPrompt);
    } catch (error) {
        console.error('Lỗi khi gửi tin nhắn ban đầu:', error);
        throw error;
    }

    while (true) {
        const call = result.response.functionCalls()?.[0];
        if (!call) {
            return {
                text: result.response.text(),
                usedTool: toolCalled 
            };
        }
        
        console.log(`[AI Request] ${call.name}`);
        
        if (call.name === 'findAvailableSlots') {
            const ref = normalizeReferenceCode(userPrompt);
            if (ref) {
                console.log('[AI Service] Phát hiện người dùng đang chọn slot, chuyển sang bookAppointment.');
                const directResult = await availableTools.bookAppointment({
                    slotIndex: ref.code,
                    sessionId,
                    userPrompt
                });

                                    toolCalled = true;
                if (directResult.success) {
                                    return {
                        text: `Tôi đã đặt lịch ${ref.code} thành công. Mã đặt lịch của bạn là ${directResult.bookingCode}.`,
                        usedTool: true
                    };
                }

                return {
                    text: directResult.error || 'Không thể đặt lịch cho mã bạn chọn. Vui lòng yêu cầu tôi tìm lịch mới.',
                    usedTool: true
                };
            }
        }
        
        const toolImpl = availableTools[call.name];
        if (!toolImpl) {
            console.error(`Tool ${call.name} không tồn tại.`);
            result = await chat.sendMessage(JSON.stringify({
                    functionResponse: { name: call.name, response: { error: `Tool ${call.name} không tồn tại.` } }
            }));
            continue; 
        }

        let args = call.args || {};
        if ([
            'findAvailableSlots',
            'bookAppointment',
            'checkInventoryAndPrescribe',
            'getMyAppointments',
            'cancelAppointment',
            'rescheduleAppointment',
            'getMyPrescriptions',
            'cancelPrescription'
        ].includes(call.name)) {
            args.sessionId = sessionId;
        }
        // getAppointmentHistory requires patientId from sessionId
        if (call.name === 'getAppointmentHistory') {
            const userId = cache.getUserId(sessionId);
            if (userId) {
                args.patientId = userId;
            }
        }
        if (call.name === 'bookAppointment') {
            args.userPrompt = userPrompt;
        }

        let toolResult;
        try {
            toolCalled = true;
            toolResult = await toolImpl(args);
        } catch (error) {
            console.error(`Lỗi khi thực thi tool ${call.name}:`, error);
            toolResult = { error: error.message };
        }

        try {
            result = await chat.sendMessage(JSON.stringify({
                    functionResponse: { name: call.name, response: toolResult }
            }));
        } catch (error) {
            console.error('Lỗi khi gửi kết quả tool:', error);
            throw error;
        }
    }
};

module.exports = {
    runChatWithTools
};
