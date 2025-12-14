const aiService = require('../services/aiService'); // Lớp 3 (Bộ não)
const qdrantService = require('../services/qdrantService'); // Lớp 1 & 2 (Gác cổng & Bộ đệm)
const ChatHistory = require('../models/ChatHistory');

exports.geminiChat = async (req, res) => {
    try {
        const { messages = [], prompt } = req.body;
        const userPrompt = prompt || messages.findLast(m => m.role === 'user')?.content;
        
        if (!userPrompt) {
            return res.status(400).json({ success: false, message: 'Missing user prompt' });
        }

        // Lấy userId thật (có thể là null nếu là khách)
        const userId = req.user?.id || null; 

        // -------------------------------------
        // LỚP 1: LỌC LẠC ĐỀ (GÁC CỔNG)
        // -------------------------------------
        const isSpam = await qdrantService.isIrrelevant(userPrompt);
        if (isSpam) {
            console.log(`[Blocked] Câu hỏi lạc đề bị chặn (Qdrant): "${userPrompt}"`);
            const cannedResponse = "Xin lỗi, tôi chỉ có thể hỗ trợ các câu hỏi liên quan đến việc tìm kiếm và đặt lịch y tế.";
            
            if (userId) { // Chỉ lưu nếu là user đã đăng nhập
                await saveChat(userId, userPrompt, cannedResponse, false);
            }
            return res.json({ success: true, data: { text: cannedResponse } });
        }

        // -------------------------------------
        // LỚP 2: LỌC CACHE (BỘ ĐỆM)
        // -------------------------------------
        const cachedAnswer = await qdrantService.findCachedAnswer(userPrompt);
        if (cachedAnswer) {
            if (userId) {
                await saveChat(userId, userPrompt, cachedAnswer, true); 
            }
            return res.json({ success: true, data: { text: cachedAnswer } });
        }

        // -------------------------------------
        // LỚP 3: GỌI AI (BỘ NÃO - TỐN TIỀN)
        // -------------------------------------
        let history = messages.slice(0, -1);
        
        // ... (Code dọn dẹp 'role' và 'parts' của bạn) ...
        const firstUserIndex = history.findIndex(msg => msg.role === 'user');
        if (firstUserIndex > 0) history = history.slice(firstUserIndex);
        else if (firstUserIndex === -1 && history.length > 0) history = [];
        
        const formattedHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : msg.role, 
            parts: [{ text: msg.content || "" }] 
        }));
        
        // ⭐ SỬA LỖI Ở ĐÂY: Truyền đầy đủ parameters
        // Tạo sessionId tạm thời cho admin (hoặc dùng userId làm sessionId)
        const adminSessionId = userId || `admin_${Date.now()}`;
        const { text: aiResponseText, usedTool } = await aiService.runChatWithTools(
            userPrompt, 
            formattedHistory,
            adminSessionId, // sessionId
            null, // medicalContext
            userPrompt, // originalPrompt
            userId // userId
        );

        // Lưu lịch sử (hợp lệ)
        if (userId) {
            await saveChat(userId, userPrompt, aiResponseText, usedTool);
        }
        
        // Lưu vào cache (cho lần sau) nếu là câu hỏi nghiệp vụ
        if (usedTool) {
            await qdrantService.cacheAnswer(userPrompt, aiResponseText);
        }

        // Trả về cho Client
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

/**
 * Hàm trợ giúp (helper) để lưu chat
 */
const saveChat = async (userId, userPrompt, aiResponse, usedTool) => {
  try {
    const newChat = new ChatHistory({
        userId: userId,
        userPrompt: userPrompt,
        aiResponse: aiResponse,
        usedTool: usedTool
    });
    await newChat.save();
  } catch (saveError) {
    console.error("Lỗi khi lưu lịch sử chat:", saveError);
  }
};

// Lấy lịch sử chat cho admin (có phân trang và lọc cơ bản)
exports.getChatHistory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);

    const filter = {};
    if (typeof req.query.usedTool !== 'undefined') {
      filter.usedTool = String(req.query.usedTool).toLowerCase() === 'true';
    }

    const [items, total] = await Promise.all([
      ChatHistory.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'fullName email'),
      ChatHistory.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử chat:', error);
    return res.status(500).json({ success: false, message: 'Không thể lấy lịch sử chat' });
  }
};

// Thêm câu hỏi lạc đề vào Qdrant (để cải thiện bộ lọc)
exports.addIrrelevantQuestion = async (req, res) => {
  try {
    const { question, questions } = req.body || {};

    let list = [];
    if (Array.isArray(questions)) list = questions.filter(q => typeof q === 'string' && q.trim());
    else if (typeof question === 'string' && question.trim()) list = [question.trim()];

    if (list.length === 0) {
      return res.status(400).json({ success: false, message: 'Thiếu câu hỏi hợp lệ' });
    }

    await qdrantService.addQuestionsToQdrant(list);

    return res.json({ success: true, message: 'Đã thêm câu hỏi lạc đề vào Qdrant', count: list.length });
  } catch (error) {
    console.error('Lỗi khi thêm câu hỏi lạc đề:', error);
    return res.status(500).json({ success: false, message: 'Không thể thêm câu hỏi lạc đề' });
  }
};