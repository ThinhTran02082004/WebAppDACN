/**
 * Web Search Service - Sử dụng GPT-4o-mini để search web và trả về kết quả
 * Dùng cho Gemini 2.5 Pro để trả lời câu hỏi thông tin
 */

const OpenAI = require("openai");

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Tìm kiếm thông tin trên web về một chủ đề y khoa
 * @param {string} query - Câu hỏi hoặc chủ đề cần tìm kiếm
 * @returns {Promise<string>} - Thông tin tìm được từ web
 */
async function searchWeb(query) {
    try {
        console.log(`[Web Search] Đang tìm kiếm: "${query}"`);
        
        // GPT-4o-mini có khả năng tìm kiếm thông tin từ knowledge base của nó
        // Nếu cần web search thực sự, có thể tích hợp Bing/Google Search API sau
        const response = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Bạn là một chuyên gia y khoa với kiến thức sâu rộng. Hãy cung cấp thông tin chính xác, cập nhật về các vấn đề y tế dựa trên kiến thức y khoa hiện đại. Trả về thông tin ngắn gọn, dễ hiểu, bằng tiếng Việt. Luôn nhắc nhở rằng thông tin chỉ mang tính tham khảo."
                },
                {
                    role: "user",
                    content: `Hãy cung cấp thông tin y khoa về: "${query}". Bao gồm: triệu chứng (nếu là bệnh), nguyên nhân, cách điều trị hoặc phòng ngừa (nếu có), và các lưu ý quan trọng. Trả về thông tin ngắn gọn, chính xác, dễ hiểu.`
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        });

        const result = response.choices[0]?.message?.content || '';
        console.log(`[Web Search] Tìm thấy thông tin (${result.length} ký tự)`);
        return result;
    } catch (error) {
        console.error("[Web Search] Lỗi khi tìm kiếm:", error);
        // Fallback: retry với cùng model
        return await searchWebFallback(query);
    }
}

/**
 * Fallback: Tìm kiếm bằng GPT-4o-mini (retry)
 */
async function searchWebFallback(query) {
    try {
        const response = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Bạn là một chuyên gia y khoa. Hãy cung cấp thông tin chính xác, cập nhật về các vấn đề y tế. Trả về thông tin ngắn gọn, dễ hiểu, bằng tiếng Việt."
                },
                {
                    role: "user",
                    content: `Hãy cung cấp thông tin y khoa về: "${query}". Bao gồm: triệu chứng, nguyên nhân, cách điều trị (nếu có), và các lưu ý quan trọng.`
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        });

        const result = response.choices[0]?.message?.content || '';
        console.log(`[Web Search Fallback] Kết quả: ${result.substring(0, 200)}...`);
        return result;
    } catch (error) {
        console.error("[Web Search Fallback] Lỗi:", error);
        return "";
    }
}

module.exports = {
    searchWeb,
    searchWebFallback
};

