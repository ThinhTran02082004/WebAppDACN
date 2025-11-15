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
