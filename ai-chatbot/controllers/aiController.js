const aiService = require('../services/aiService'); // Appointment Agent (Gemini 2.5 Flash)
const aiServicePro = require('../services/aiServicePro'); // Information Agent (Gemini 2.5 Pro)
const intentRouter = require('../services/intentRouter'); // Intent Router
const qdrantService = require('../services/qdrantService'); // Lớp 1 & 2 (Gác cổng & Bộ đệm)
const spamFilterService = require('../services/spamFilterService'); // Enhanced spam filter
const ChatHistory = require('../models/ChatHistory');
const { v4: uuidv4 } = require('uuid'); // Import UUID
const cache = require('../services/cacheService'); // Import cache
const { extractMedicalContext } = require('../utils/chatHelpers'); // Helper để extract triệu chứng từ lịch sử

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
        // ⭐ LỚP 1: LỌC SPAM (Enhanced Spam Filter)
        // -------------------------------------
        const spamCheck = await spamFilterService.checkSpam(userPrompt, newSessionId);
        if (spamCheck) {
            if (spamCheck.blocked) {
                // Zone 3: Spam rõ ràng - Block
                console.log(`[Blocked] Câu hỏi spam bị chặn (spamScore: ${spamCheck.spamScore.toFixed(3)}): "${userPrompt}"`);
                
                // (Vẫn lưu nếu user đã đăng nhập)
                if (realUserId) {
                    await saveChat(realUserId, userPrompt, spamCheck.message, false, newSessionId);
                }
                
                return res.json({ 
                    success: true, 
                    data: { text: spamCheck.message },
                    sessionId: newSessionId
                });
            } else {
                // Zone 2: Nghi ngờ - Gửi câu hỏi xác nhận
                console.log(`[Suspicious] Câu hỏi nghi ngờ (spamScore: ${spamCheck.spamScore.toFixed(3)}): "${userPrompt}"`);
                
                // (Vẫn lưu nếu user đã đăng nhập)
                if (realUserId) {
                    await saveChat(realUserId, userPrompt, spamCheck.message, false, newSessionId);
                }
                
                return res.json({ 
                    success: true, 
                    data: { text: spamCheck.message },
                    sessionId: newSessionId
                });
            }
        }

        // -------------------------------------
        // ⭐ LỚP 2: LỌC CACHE (BỘ ĐỆM)
        // -------------------------------------
        const cachedAnswer = await qdrantService.findCachedAnswer(userPrompt);
        if (cachedAnswer) {
            // (Vẫn lưu nếu user đã đăng nhập)
            if (realUserId) {
                await saveChat(realUserId, userPrompt, cachedAnswer, true, newSessionId); // (Cache là nghiệp vụ)
            }
            
            return res.json({ 
                success: true, 
                data: { text: cachedAnswer },
                sessionId: newSessionId // Gửi lại session ID
            });
        }

        // -------------------------------------
        // ⭐ LỚP 3: PHÂN LOẠI INTENT VÀ ROUTE ĐẾN ĐÚNG MODEL
        // -------------------------------------
        const intent = await intentRouter.classifyIntent(userPrompt);
        console.log(`[Intent Router] Intent: ${intent} cho prompt: "${userPrompt.substring(0, 50)}..."`);
        
        let history = messages.slice(0, -1);
        
        // ... (Code dọn dẹp 'role' và 'parts' của bạn) ...
        const firstUserIndex = history.findIndex(msg => msg.role === 'user');
        if (firstUserIndex > 0) history = history.slice(firstUserIndex);
        else if (firstUserIndex === -1 && history.length > 0) history = [];
        
        // QUAN TRỌNG: Giới hạn số lượng messages để tránh nhầm lẫn giữa các cuộc hội thoại
        // Chỉ đọc tối đa 30 messages gần nhất (15 cặp user-assistant)
        // Điều này đảm bảo chỉ đọc lịch sử trong cùng một session/hộp thoại hiện tại
        const MAX_HISTORY_MESSAGES = 30;
        if (history.length > MAX_HISTORY_MESSAGES) {
            console.log(`[History] Giới hạn lịch sử từ ${history.length} xuống ${MAX_HISTORY_MESSAGES} messages để tránh nhầm lẫn giữa các cuộc hội thoại`);
            history = history.slice(-MAX_HISTORY_MESSAGES); // Lấy 30 messages gần nhất
        }
        
        const formattedHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : msg.role, 
            parts: [{ text: msg.content || "" }] 
        }));
        
        console.log(`[History] Sử dụng ${formattedHistory.length} messages trong lịch sử (sessionId: ${newSessionId?.substring(0, 8)}...)`);
        
        // Route đến đúng model dựa trên intent
        let aiResponseText, usedTool;
        
        if (intent === 'APPOINTMENT') {
            // Gemini 2.5 Flash - Đặt lịch, hủy lịch, đổi lịch
            console.log('[Model Router] → Gemini 2.5 Flash (Appointment)');
            
            // Extract triệu chứng và thông tin y tế từ lịch sử hội thoại
            const medicalContext = extractMedicalContext(formattedHistory);
            
            // Kiểm tra nếu user muốn hủy/đổi lịch - không tạo enhanced prompt cho các trường hợp này
            const isCancelOrRescheduleIntent = /hủy|làm lại|đổi|thay đổi|hoãn/i.test(userPrompt);
            
            if (medicalContext && medicalContext.primaryQuery && !isCancelOrRescheduleIntent) {
                console.log(`[Medical Context] Đã tìm thấy triệu chứng từ lịch sử: "${medicalContext.primaryQuery.substring(0, 100)}..."`);
                console.log(`[Medical Context] Chuyên khoa: ${medicalContext.specialty || 'không xác định'}`);
                console.log(`[Medical Context] Địa điểm: ${medicalContext.location || 'không xác định'}`);
                
                // Nếu user chỉ nói "đặt lịch" hoặc câu ngắn, thêm context vào prompt
                if (userPrompt.length < 50 && medicalContext.primaryQuery) {
                    // Tạo enhanced prompt với context từ lịch sử
                    const enhancedPrompt = `${userPrompt}\n\n[Lưu ý: Trong lịch sử hội thoại trước đó, người dùng đã mô tả triệu chứng: "${medicalContext.primaryQuery}". Hãy sử dụng thông tin này để tìm lịch khám phù hợp.]`;
                    console.log(`[Enhanced Prompt] Đã thêm context từ lịch sử vào prompt`);
                    
                    const result = await aiService.runAppointmentChatWithTools(
                        enhancedPrompt, 
                        formattedHistory,
                        newSessionId,
                        medicalContext, // Truyền medical context vào service
                        userPrompt, // Truyền prompt gốc để kiểm tra intent
                        realUserId // Truyền userId để cập nhật conversation state
                    );
                    aiResponseText = result.text;
                    usedTool = result.usedTool;
                } else {
                    // Nếu user đã cung cấp đủ thông tin, chỉ truyền medical context
                    const result = await aiService.runAppointmentChatWithTools(
                        userPrompt, 
                        formattedHistory,
                        newSessionId,
                        medicalContext, // Truyền medical context vào service
                        userPrompt, // Truyền prompt gốc (giống nhau trong trường hợp này)
                        realUserId // Truyền userId để cập nhật conversation state
                    );
                    aiResponseText = result.text;
                    usedTool = result.usedTool;
                }
            } else {
                // Không tìm thấy triệu chứng trong lịch sử hoặc user muốn hủy/đổi lịch, xử lý bình thường
                const result = await aiService.runAppointmentChatWithTools(
                    userPrompt, 
                    formattedHistory,
                    newSessionId,
                    medicalContext, // Vẫn truyền medicalContext nếu có (có thể hữu ích cho cancel/reschedule)
                    userPrompt, // Truyền prompt gốc
                    realUserId // Truyền userId để cập nhật conversation state
                );
                aiResponseText = result.text;
                usedTool = result.usedTool;
            }
        } else {
            // Gemini 2.5 Pro - Thông tin, tư vấn, tìm bác sĩ
            console.log('[Model Router] → Gemini 2.5 Pro (Information)');
            const result = await aiServicePro.runProChatWithTools(
                userPrompt, 
                formattedHistory,
                newSessionId
            );
            aiResponseText = result.text;
            usedTool = result.usedTool;
        }

        // Lưu lịch sử (hợp lệ)
        if (realUserId) { // Vẫn dùng 'realUserId' để lưu CSDL
            await saveChat(realUserId, userPrompt, aiResponseText, usedTool, newSessionId);
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

    // Lấy sessionId từ query parameter (nếu có)
    const sessionId = req.query.sessionId || null;

    // Xây dựng filter: luôn filter theo userId, và filter theo sessionId nếu có
    const filter = { userId };
    if (sessionId) {
      filter.sessionId = sessionId; // Chỉ lấy lịch sử của session cụ thể
    }

    // Lấy lịch sử chat của user:
    // - Sắp xếp mới nhất trước để đảm bảo 'limit' lấy đúng các tin mới nhất
    // - Sau đó đảo ngược trên server để trả về theo thứ tự thời gian (cũ -> mới)
    const newestFirst = await ChatHistory.find(filter)
      .sort({ createdAt: -1 }) // Mới nhất trước
      .limit(limit)
      .select('userPrompt aiResponse createdAt sessionId')
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
const saveChat = async (userId, userPrompt, aiResponse, usedTool, sessionId = null) => {
  try {
    // Kiểm tra aiResponse không được rỗng hoặc undefined
    // Nếu rỗng, không lưu để tránh lỗi validation
    if (!aiResponse || (typeof aiResponse === 'string' && aiResponse.trim() === '')) {
      console.warn("Bỏ qua lưu lịch sử chat vì aiResponse rỗng hoặc không hợp lệ");
      return;
    }

    const newChat = new ChatHistory({
        userId: userId,
        sessionId: sessionId, // Lưu sessionId để phân biệt các session
        userPrompt: userPrompt,
        aiResponse: aiResponse,
        usedTool: usedTool
    });
    await newChat.save();
  } catch (saveError) {
    console.error("Lỗi khi lưu lịch sử chat:", saveError);
  }
};