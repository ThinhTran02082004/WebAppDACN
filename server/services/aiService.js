const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const mongoose = require('mongoose');
const Medication = require('../models/Medication');
const PrescriptionDraft = require('../models/PrescriptionDraft');
const cache = require('./cacheService');
const searchTools = require('./searchTools');
const appointmentTools = require('./appointmentTools');
const { SYSTEM_INSTRUCTION } = require('./aiConfig');

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

const toolDeclarations = {
    functionDeclarations: [
        {
            name: "findAvailableSlots",
            description: "Tìm lịch khám còn trống dựa trên nhu cầu người dùng.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: { type: "STRING" },
                    city: { type: "STRING" },
                    date: { type: "STRING" },
                    sessionId: { type: "STRING" }
                },
                required: ["query", "sessionId"]
            }
        },
        {
            name: "bookAppointment",
            description: "Đặt lịch dựa trên mã slot (L01, L02) hoặc chỉ số slot.",
            parameters: {
                type: "OBJECT",
                properties: {
                    slotIndex: { type: "STRING", description: "Mã slot (L01) hoặc số thứ tự (1)" },
                    sessionId: { type: "STRING" }
                },
                required: ["slotIndex", "sessionId"]
            }
        },
        {
            name: "checkInventoryAndPrescribe",
            description: "Hỏi dược sĩ AI, kiểm tra kho và tạo đơn thuốc nháp.",
            parameters: {
                type: "OBJECT",
                properties: {
                    symptom: { type: "STRING" },
                    sessionId: { type: "STRING" }
                },
                required: ["symptom", "sessionId"]
            }
        }
    ]
};

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

            let medications = [];
            if (textSearch) {
                medications = await Medication.find({
                    $text: { $search: textSearch },
                    stockQuantity: { $gt: 0 },
                    isActive: true
                }).limit(3);
            }

            if (medications.length === 0 && keywords.length) {
                const regexConditions = keywords.map(kw => ({ name: { $regex: kw, $options: 'i' } }));
                medications = await Medication.find({
                    stockQuantity: { $gt: 0 },
                    isActive: true,
                    $or: regexConditions
                }).limit(3);
            }

            if (medications.length === 0) {
                return {
                    advice: medicalAdvice || 'Không tìm thấy thông tin y khoa đáng tin cậy.',
                    message: 'Kho thuốc hiện không có mặt hàng phù hợp với lời khuyên y khoa vừa tra cứu.'
                };
            }

            const draft = await PrescriptionDraft.create({
                patientId: userId,
                diagnosis: symptom,
                symptom,
                keywords,
                medications: medications.map(m => ({
                    medicationId: m._id,
                    name: m.name,
                    quantity: 1,
                    price: m.unitPrice || 0
                })),
                note: medicalAdvice ? `Dựa trên khuyến nghị: ${medicalAdvice.slice(0, 120)}...` : undefined
            });

            return {
                success: true,
                advice: medicalAdvice,
                medicinesFound: medications.map(m => m.name),
                prescriptionId: draft._id,
                message: 'Đơn thuốc nháp đã được tạo và chờ dược sĩ/bác sĩ duyệt.',
                disclaimer: 'Thông tin chỉ mang tính tham khảo. Cần bác sĩ/dược sĩ xác nhận trước khi dùng thuốc.'
            };
        } catch (error) {
            console.error('Lỗi checkInventoryAndPrescribe:', error);
            return { error: error.message };
        }
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
        if (['findAvailableSlots', 'bookAppointment', 'checkInventoryAndPrescribe'].includes(call.name)) {
            args.sessionId = sessionId;
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
