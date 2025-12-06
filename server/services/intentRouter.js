/**
 * Intent Router - Phân loại intent của user để route đến đúng model
 * 
 * Intent types:
 * - APPOINTMENT: Đặt lịch, hủy lịch, đổi lịch, xem lịch -> Gemini 2.5 Flash
 * - INFORMATION: Tìm bác sĩ, hỏi thông tin, tư vấn -> Gemini 2.5 Pro + GPT-4o (search)
 * - MEDICATION: Tư vấn thuốc -> Gemini 2.5 Pro + GPT-4o (search)
 * - GENERAL: Câu hỏi chung -> Gemini 2.5 Pro
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Intent classifier model (dùng Flash để nhanh và rẻ)
const intentClassifier = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `Bạn là một intent classifier. Nhiệm vụ của bạn là phân loại câu hỏi của người dùng vào một trong các intent sau:

1. APPOINTMENT - Khi người dùng muốn:
   - Đặt lịch khám (ví dụ: "đặt lịch", "tôi muốn khám", "tìm lịch trống")
   - Hủy lịch (ví dụ: "hủy lịch", "cancel appointment")
   - Đổi lịch (ví dụ: "đổi lịch", "reschedule")
   - Xem lịch của mình (ví dụ: "lịch của tôi", "xem lịch hẹn")
   - Chọn slot (ví dụ: "chọn L01", "tôi chọn số 1")

2. INFORMATION - Khi người dùng muốn:
   - Tìm bác sĩ (ví dụ: "tìm bác sĩ", "có bác sĩ nào", "bác sĩ A chuyên khoa gì")
   - Hỏi thông tin về bác sĩ, bệnh viện, chuyên khoa
   - Tư vấn sức khỏe (ví dụ: "đau đầu là bệnh gì", "triệu chứng cảm cúm")
   - Hỏi về dịch vụ y tế

3. MEDICATION - Khi người dùng muốn:
   - Tư vấn thuốc (ví dụ: "có thuốc nào không", "tư vấn thuốc", "kê đơn")
   - Hỏi về đơn thuốc (ví dụ: "đơn thuốc của tôi", "xem đơn thuốc")

4. GENERAL - Các câu hỏi chung khác

Trả về CHỈ một từ: APPOINTMENT, INFORMATION, MEDICATION, hoặc GENERAL.`
});

/**
 * Phân loại intent của user prompt
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @returns {Promise<string>} - Intent type: APPOINTMENT, INFORMATION, MEDICATION, hoặc GENERAL
 */
async function classifyIntent(userPrompt) {
    try {
        const result = await intentClassifier.generateContent(userPrompt);
        const intent = result.response.text().trim().toUpperCase();
        
        // Validate intent
        const validIntents = ['APPOINTMENT', 'INFORMATION', 'MEDICATION', 'GENERAL'];
        if (validIntents.includes(intent)) {
            console.log(`[Intent Router] "${userPrompt.substring(0, 50)}..." -> ${intent}`);
            return intent;
        } else {
            // Fallback: dùng keyword matching
            console.warn(`[Intent Router] Invalid intent "${intent}", using keyword matching`);
            return classifyIntentByKeywords(userPrompt);
        }
    } catch (error) {
        console.error('[Intent Router] Lỗi khi classify intent:', error);
        // Fallback: dùng keyword matching
        return classifyIntentByKeywords(userPrompt);
    }
}

/**
 * Phân loại intent bằng keyword matching (fallback)
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @returns {string} - Intent type
 */
function classifyIntentByKeywords(userPrompt) {
    const lower = userPrompt.toLowerCase();
    
    // APPOINTMENT keywords
    const appointmentKeywords = [
        'đặt lịch', 'đặt hẹn', 'book appointment', 'tìm lịch', 'lịch trống',
        'hủy lịch', 'cancel', 'xóa lịch',
        'đổi lịch', 'reschedule', 'dời lịch',
        'lịch của tôi', 'lịch hẹn của tôi', 'xem lịch',
        'chọn l', 'l01', 'l02', 'slot'
    ];
    
    // MEDICATION keywords
    const medicationKeywords = [
        'thuốc', 'kê đơn', 'đơn thuốc', 'toa thuốc', 'prescription',
        'tư vấn thuốc', 'có thuốc nào', 'uống thuốc'
    ];
    
    // INFORMATION keywords
    const informationKeywords = [
        'bác sĩ', 'doctor', 'tìm bác sĩ', 'có bác sĩ nào',
        'bệnh viện', 'hospital', 'chuyên khoa', 'specialty',
        'đau đầu', 'triệu chứng', 'bệnh gì', 'tư vấn sức khỏe'
    ];
    
    if (appointmentKeywords.some(keyword => lower.includes(keyword))) {
        return 'APPOINTMENT';
    }
    
    if (medicationKeywords.some(keyword => lower.includes(keyword))) {
        return 'MEDICATION';
    }
    
    if (informationKeywords.some(keyword => lower.includes(keyword))) {
        return 'INFORMATION';
    }
    
    return 'GENERAL';
}

module.exports = {
    classifyIntent,
    classifyIntentByKeywords
};

