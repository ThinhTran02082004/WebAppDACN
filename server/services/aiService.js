// Import các module đã tách
const { model } = require('./aiConfig');
const { tools } = require('./aiToolsDefinitions');
const searchTools = require('./searchTools');
const appointmentTools = require('./appointmentTools');
const cache = require('./cacheService');

/**
 * AI Service - Main file
 * Tập trung vào logic chạy chat và điều phối các tools
 */

// Tổng hợp tất cả available tools
const availableTools = {
    ...searchTools,
    ...appointmentTools
};

const isValidSlotId = (slotId) => typeof slotId === 'string' && slotId.includes('_');

const normalizeReferenceCode = (text) => {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/l\s*0?(\d{1,2})/i);
    if (!match) return null;
    const slotNum = parseInt(match[1], 10);
    if (Number.isNaN(slotNum)) return null;
    return `L${String(slotNum).padStart(2, '0')}`;
};

const hydrateSlotSelection = (rawArgs = {}, sessionId, userPrompt) => {
    const args = { ...rawArgs };
    let referenceCode = null;

    if (isValidSlotId(args.slotId)) {
        return { args, isValid: true, referenceCode: referenceCode };
    }

    const availableSlots = cache.getAvailableSlots(sessionId);
    if (!availableSlots || !Array.isArray(availableSlots) || availableSlots.length === 0) {
        return { args, isValid: false, reason: 'NO_SLOTS_IN_CACHE', referenceCode };
    }

    const candidateTexts = [
        args.slotId,
        args.referenceCode,
        args.selectedSlot,
        userPrompt
    ].filter(Boolean);

    for (const text of candidateTexts) {
        const code = normalizeReferenceCode(text);
        if (code) {
            referenceCode = code;
            break;
        }
    }

    if (!referenceCode) {
        return { args, isValid: false, reason: 'NO_REFERENCE_CODE', referenceCode };
    }

    const foundSlot = availableSlots.find(slot => slot.referenceCode?.toUpperCase() === referenceCode.toUpperCase());
    if (!foundSlot) {
        return { args, isValid: false, reason: 'REFERENCE_NOT_FOUND', referenceCode };
    }

    args.slotId = foundSlot.slotId;
    if (!args.serviceId && foundSlot.serviceId) {
        args.serviceId = foundSlot.serviceId;
    }

    return { args, isValid: isValidSlotId(args.slotId), referenceCode };
};

/**
 * Logic chạy chat chính với AI
 * @param {string} userPrompt - Câu hỏi/request của người dùng
 * @param {Array} history - Lịch sử cuộc trò chuyện
 * @param {string} sessionId - ID của phiên chat (để lấy userId từ cache)
 * @returns {Promise<{text: string, usedTool: boolean}>}
 */
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
        
        console.log(`[AI Request] Yêu cầu gọi hàm: ${call.name}`);
        
        // ⚠️ INTERCEPT: Nếu AI gọi findAvailableSlots nhưng user đang chọn slot (L01, L02, etc.)
        // thì redirect sang bookAppointment
        if (call.name === 'findAvailableSlots') {
            const slotPattern = /l\s*0?\d{1,2}/i;
            if (slotPattern.test(userPrompt)) {
                console.log(`[AI Service] INTERCEPT: User đang chọn slot "${userPrompt}" nhưng AI gọi findAvailableSlots. Tìm slotId từ cache...`);
                
                // Lấy availableSlots từ cache
                const availableSlots = cache.getAvailableSlots(sessionId);
                
                if (availableSlots && Array.isArray(availableSlots) && availableSlots.length > 0) {
                    // Extract reference code từ userPrompt (L01, L1, L02, etc.)
                    const refMatch = userPrompt.match(/l\s*0?(\d{1,2})/i);
                    if (refMatch) {
                        const slotNum = parseInt(refMatch[1]);
                        const refCode = `L${String(slotNum).padStart(2, '0')}`;
                        
                        const foundSlot = availableSlots.find(s => s.referenceCode === refCode);
                        if (foundSlot) {
                            // Redirect sang bookAppointment
                            console.log(`[AI Service] Tìm thấy slot ${refCode} trong cache: slotId=${foundSlot.slotId}, serviceId=${foundSlot.serviceId || 'null'}`);
                            console.log(`[AI Service] Redirect sang bookAppointment`);
                            const bookArgs = {
                                slotId: foundSlot.slotId,
                                serviceId: foundSlot.serviceId || undefined,
                                sessionId: sessionId
                            };
                            
                            try {
                                const bookResult = await availableTools.bookAppointment(bookArgs);
                                // Nếu book thành công, trả về ngay cho người dùng với thông điệp xác nhận
                                if (bookResult && bookResult.success) {
                                    toolCalled = true;
                                    const confirmationMessage = `Tôi đã đặt lịch ${refCode} (${bookResult.date} lúc ${bookResult.time}) thành công cho bạn. Mã đặt lịch của bạn là ${bookResult.bookingCode}. Bạn có thể kiểm tra mục "Lịch hẹn của tôi" để theo dõi trạng thái.`;
                                    return {
                                        text: confirmationMessage,
                                        usedTool: toolCalled
                                    };
                                }

                                // Nếu book không thành công, tiếp tục luồng bình thường để AI xử lý thông báo lỗi
                                result = await chat.sendMessage(
                                    JSON.stringify({
                                        functionResponse: { name: 'bookAppointment', response: bookResult }
                                    })
                                );
                                continue;
                            } catch (e) {
                                console.error(`[AI Service] Lỗi khi redirect sang bookAppointment:`, e);
                                // Fallback: tiếp tục với findAvailableSlots như bình thường
                            }
                        } else {
                            console.log(`[AI Service] Không tìm thấy slot ${refCode} trong cache, tiếp tục với findAvailableSlots`);
                        }
                    }
                } else {
                    console.log(`[AI Service] Không có slots trong cache, tiếp tục với findAvailableSlots`);
                }
            }
        }
        
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

        let args = call.args || {};

        // Bổ sung sessionId cho các tool cần auth
        if (call.name === 'bookAppointment' || 
            call.name === 'cancelAppointment' || 
            call.name === 'rescheduleAppointment' ||
            call.name === 'getMyAppointments' ||
            call.name === 'findAvailableSlots') {
            args.sessionId = sessionId;
        }

        if (call.name === 'bookAppointment') {
            const hydratedResult = hydrateSlotSelection(args, sessionId, userPrompt);
            args = hydratedResult.args;

            if (!hydratedResult.isValid) {
                console.warn(`[AI Service] Không thể xác định slotId hợp lệ cho yêu cầu bookAppointment. Reason=${hydratedResult.reason || 'unknown'}`);
                const slotLabel = hydratedResult.referenceCode || 'lịch bạn vừa chọn';
                return {
                    text: `Rất tiếc, danh sách lịch trống trước đó đã hết hạn nên tôi chưa thể đặt lại ${slotLabel}. Bạn vui lòng yêu cầu tôi tìm các lịch khám mới, sau đó chọn mã lịch để đặt nhé.`,
                    usedTool: toolCalled
                };
            }
        }

        let toolResult;
        try {
            toolCalled = true;
            toolResult = await tool(args); // Thực thi hàm với (args + sessionId)

        } catch(e) {
            console.error(`Lỗi khi thực thi tool ${call.name}:`, e);
            toolResult = { error: e.message };
        }

        try {
            // Gửi kết quả (toolResult) lại cho AI
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
