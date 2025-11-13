const aiService = require('../services/aiService'); // Lớp 3 (Bộ não)
const qdrantService = require('../services/qdrantService'); // Lớp 1 & 2 (Gác cổng & Bộ đệm)
const ChatHistory = require('../models/ChatHistory');
const { v4: uuidv4 } = require('uuid'); // Import UUID
const cache = require('../services/cacheService'); // Import cache

exports.geminiChat = async (req, res) => {
    try {
        const { messages = [], prompt, sessionId } = req.body;
        
        const userPrompt = prompt || messages.findLast(m => m.role === 'user')?.content;
        if (!userPrompt) {
            return res.status(400).json({ success: false, message: 'Missing user prompt' });
        }

        // Lấy userId từ req.user (hỗ trợ cả id và _id)
        const realUserId = req.user?.id || req.user?._id || null;
        let newSessionId = sessionId; // Lấy sessionId từ client (nếu có)

        // Nếu client chưa có sessionId, hãy tạo mới
        if (!newSessionId) {
            newSessionId = uuidv4(); // Tạo ID tạm thời
            
            // Nếu user đã đăng nhập, map ID tạm thời với ID thật
            if (realUserId) {
                cache.setUserId(newSessionId, realUserId);
            }
            // Nếu là khách (guest), cache sẽ không lưu gì, và 'getUserId' sẽ trả về 'undefined'
        } else {
            // Nếu sessionId đã tồn tại nhưng user vừa mới đăng nhập, cập nhật mapping
            // (Trường hợp user bắt đầu là guest, sau đó đăng nhập)
            if (realUserId && !cache.getUserId(newSessionId)) {
                cache.setUserId(newSessionId, realUserId);
            }
        }

        // -------------------------------------
        // ⭐ LỚP 1: LỌC LẠC ĐỀ (GÁC CỔNG)
        // -------------------------------------
        const isSpam = await qdrantService.isIrrelevant(userPrompt);
        if (isSpam) {
            console.log(`[Blocked] Câu hỏi lạc đề bị chặn (Qdrant): "${userPrompt}"`);
            const cannedResponse = "Xin lỗi, tôi chỉ có thể hỗ trợ các câu hỏi liên quan đến việc tìm kiếm và đặt lịch y tế.";
            
            // (Vẫn lưu nếu user đã đăng nhập)
            if (realUserId) {
                await saveChat(realUserId, userPrompt, cannedResponse, false);
            }
            
            // Trả về cả 'newSessionId' để client lưu lại
            return res.json({ 
                success: true, 
                data: { text: cannedResponse },
                sessionId: newSessionId // Gửi lại session ID
            });
        }

        // -------------------------------------
        // ⭐ LỚP 2: LỌC CACHE (BỘ ĐỆM)
        // -------------------------------------
        const cachedAnswer = await qdrantService.findCachedAnswer(userPrompt);
        if (cachedAnswer) {
            // (Vẫn lưu nếu user đã đăng nhập)
            if (realUserId) {
                await saveChat(realUserId, userPrompt, cachedAnswer, true); // (Cache là nghiệp vụ)
            }
            
            return res.json({ 
                success: true, 
                data: { text: cachedAnswer },
                sessionId: newSessionId // Gửi lại session ID
            });
        }

        // -------------------------------------
        // ⭐ LỚP 3: GỌI AI (BỘ NÃO - TỐN TIỀN)
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
        
        // ⭐ SỬA LỖI: Truyền 'newSessionId' (ID tạm thời) vào
        const { text: aiResponseText, usedTool } = await aiService.runChatWithTools(
            userPrompt, 
            formattedHistory,
            newSessionId // <-- Truyền ID tạm thời
        );

        // Lưu lịch sử (hợp lệ)
        if (realUserId) { // Vẫn dùng 'realUserId' để lưu CSDL
            await saveChat(realUserId, userPrompt, aiResponseText, usedTool);
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
            },
            sessionId: newSessionId // Luôn gửi lại sessionId cho client
        });

    } catch (error) {
        console.error("Lỗi khi xử lý chat:", error);
        return res.status(500).json({ success: false, message: 'Lỗi server khi xử lý chat' });
    }
};

/**
 * Lấy lịch sử chat của user hiện tại
 * @route   GET /api/ai/chat-history
 * @access  Private (Optional - nếu có token thì lấy lịch sử, không có thì trả về rỗng)
 */
exports.getChatHistory = async (req, res) => {
  try {
    // Lấy userId từ req.user (hỗ trợ cả id và _id)
    const userId = req.user?.id || req.user?._id || null;
    
    // Nếu không có userId, trả về mảng rỗng
    if (!userId) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Lấy số lượng tin nhắn (mặc định 50, tối đa 100)
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

    // Lấy lịch sử chat của user:
    // - Sắp xếp mới nhất trước để đảm bảo 'limit' lấy đúng các tin mới nhất
    // - Sau đó đảo ngược trên server để trả về theo thứ tự thời gian (cũ -> mới)
    const newestFirst = await ChatHistory.find({ userId })
      .sort({ createdAt: -1 }) // Mới nhất trước
      .limit(limit)
      .select('userPrompt aiResponse createdAt')
      .lean();
    const chatHistory = newestFirst.reverse(); // Trả về theo thứ tự cũ -> mới

    // Chuyển đổi format từ ChatHistory sang format messages
    const messages = [];
    
    // Thêm tin nhắn chào mừng đầu tiên nếu chưa có tin nhắn nào
    if (chatHistory.length === 0) {
      messages.push({
        role: 'assistant',
        content: 'Xin chào! Tôi có thể giúp gì cho bạn?',
        createdAt: new Date().toISOString()
      });
    } else {
      // Duyệt qua từng cặp userPrompt và aiResponse
      chatHistory.forEach((chat) => {
        messages.push({
          role: 'user',
          content: chat.userPrompt,
          createdAt: chat.createdAt
        });
        messages.push({
          role: 'assistant',
          content: chat.aiResponse,
          createdAt: chat.createdAt
        });
      });
    }

    return res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy lịch sử chat',
      error: error.message
    });
  }
};

/**
 * Hàm trợ giúp (helper) để lưu chat, tránh lặp code
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