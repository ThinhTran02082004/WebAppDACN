// Import các module đã tách
const { model } = require('./aiConfig');
const { tools } = require('./aiToolsDefinitions');
const searchTools = require('./searchTools');
const appointmentTools = require('./appointmentTools');

/**
 * AI Service - Main file
 * Tập trung vào logic chạy chat và điều phối các tools
 */

// Tổng hợp tất cả available tools
const availableTools = {
    ...searchTools,
    ...appointmentTools
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
        
        toolCalled = true; 
        console.log(`[AI Request] Yêu cầu gọi hàm: ${call.name}`);
        
        // ⚠️ INTERCEPT: Nếu AI gọi findAvailableSlots nhưng user đang chọn slot (L01, L02, etc.)
        // thì redirect sang bookAppointment
        if (call.name === 'findAvailableSlots') {
            const slotPattern = /l\s*0?\d{1,2}/i;
            if (slotPattern.test(userPrompt)) {
                console.log(`[AI Service] INTERCEPT: User đang chọn slot "${userPrompt}" nhưng AI gọi findAvailableSlots. Tìm slotId từ cache...`);
                
                // Lấy availableSlots từ cache
                const cache = require('./cacheService');
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

        let toolResult;
        try {
            // Gắn 'sessionId' vào cho các tools cần authentication
            let args = call.args; // Tham số từ AI (vd: { query: "..." })

            if (call.name === 'bookAppointment' || 
                call.name === 'cancelAppointment' || 
                call.name === 'rescheduleAppointment' ||
                call.name === 'getMyAppointments' ||
                call.name === 'findAvailableSlots') {
                args.sessionId = sessionId; // Gắn ID tạm thời
            }

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
