const aiService = require('../services/aiService'); // Import "bộ não"

exports.geminiChat = async (req, res) => {
    try {
        const { messages = [], prompt } = req.body;
        
        const userPrompt = prompt || messages.findLast(m => m.role === 'user')?.content;

        if (!userPrompt) {
            return res.status(400).json({ success: false, message: 'Missing user prompt' });
        }

        let history = messages.slice(0, -1);

        // --- BƯỚC 1: Dọn dẹp 'role' (Đã chạy tốt) ---
        const firstUserIndex = history.findIndex(msg => msg.role === 'user');

        if (firstUserIndex > 0) {
            history = history.slice(firstUserIndex);
        } else if (firstUserIndex === -1 && history.length > 0) {
            history = [];
        }
        
        // --- BƯỚC 2: Chuyển đổi định dạng cho SDK ---
        const formattedHistory = history.map(msg => {
            const messageContent = msg.content || ""; 
            
            return {
                // ⭐ SỬA LỖI Ở ĐÂY: Chuyển 'assistant' (từ client) thành 'model' (cho SDK)
                role: msg.role === 'assistant' ? 'model' : msg.role, 
                parts: [{ text: messageContent }] 
            };
        });
        // --- KẾT THÚC BƯỚC 2 ---

        // Giao cho service xử lý
        const aiResponseText = await aiService.runChatWithTools(userPrompt, formattedHistory);

        res.json({
            success: true,
            data: {
                text: aiResponseText
            }
        });

    } catch (error) {
        console.error('Gemini chat error in controller:', error);
        
        const errorMessage = error.message || 'Gemini request failed';
        res.status(500).json({ 
            success: false, 
            message: errorMessage.includes("Error]:") ? "Gemini request failed" : errorMessage,
            error: errorMessage 
        });
    }
};