const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { createNotification } = require('../controllers/notificationController');

/**
 * Extract symptoms and medical information from conversation history
 * Tìm và trích xuất triệu chứng, bệnh lý từ lịch sử hội thoại
 * CHỈ đọc lịch sử trong cùng một session/hộp thoại hiện tại để tránh nhầm lẫn
 * @param {Array} history - Lịch sử hội thoại (array of messages) - đã được giới hạn bởi controller
 * @returns {Object} - Object chứa triệu chứng, chuyên khoa, và các thông tin y tế khác
 */
exports.extractMedicalContext = (history) => {
    if (!history || !Array.isArray(history) || history.length === 0) {
        return null;
    }
    
    // Đảm bảo chỉ xử lý lịch sử hợp lệ (có role và content)
    const validHistory = history.filter(msg => {
        const content = msg.parts?.[0]?.text || msg.content || '';
        const role = msg.role || '';
        return role && content.trim().length > 0;
    });
    
    if (validHistory.length === 0) {
        return null;
    }
    
    console.log(`[Medical Context] Đang extract từ ${validHistory.length} messages hợp lệ trong lịch sử hiện tại`);

    const medicalContext = {
        symptoms: [],
        specialty: null,
        specialtySource: null, // 'user' hoặc 'assistant' - để biết nguồn gốc
        doctor: null,
        location: null,
        date: null,
        fullSymptomDescription: null
    };

    // Các từ khóa triệu chứng phổ biến
    const symptomKeywords = [
        'đau', 'sốt', 'ho', 'khó thở', 'buồn nôn', 'nôn', 'chóng mặt', 'mệt mỏi',
        'cứng cổ', 'nhạy cảm với ánh sáng', 'đau đầu', 'đau bụng', 'tiêu chảy',
        'táo bón', 'phát ban', 'ngứa', 'sưng', 'viêm', 'chảy máu', 'khó nuốt',
        'đau ngực', 'đau lưng', 'đau khớp', 'suy nhược', 'mất ngủ', 'lo âu'
    ];

    // Các từ khóa chuyên khoa - SẮP XẾP THEO ĐỘ DÀI (dài trước, ngắn sau) để tránh match sai
    // Ví dụ: "ngoại thần kinh" phải match trước "ngoại khoa"
    const specialtyKeywords = {
        'ngoại thần kinh': ['ngoại thần kinh', 'khoa ngoại thần kinh', 'ngoại thần kinh học'],
        'nội khoa': ['nội khoa', 'khoa nội'],
        'ngoại khoa': ['ngoại khoa', 'khoa ngoại'],
        'sản khoa': ['sản khoa', 'phụ khoa', 'mang thai', 'thai kỳ'],
        'nhi khoa': ['nhi khoa', 'trẻ em', 'trẻ nhỏ'],
        'tim mạch': ['tim mạch', 'tim', 'huyết áp'],
        'thần kinh': ['thần kinh', 'não', 'đau đầu'],
        'tiêu hóa': ['tiêu hóa', 'dạ dày', 'ruột'],
        'tai mũi họng': ['tai mũi họng', 'tai', 'mũi', 'họng'],
        'mắt': ['mắt', 'nhãn khoa'],
        'da liễu': ['da liễu', 'da', 'phát ban']
    };

    // Duyệt qua lịch sử từ cũ đến mới để tìm thông tin y tế
    // Ưu tiên tìm trong các lượt đầu (nơi người dùng thường mô tả triệu chứng)
    // Nhưng cũng kiểm tra các lượt gần đây để cập nhật thông tin
    // LƯU Ý: history đã được giới hạn bởi controller, chỉ chứa messages trong cùng session
    
    // Tìm triệu chứng trong toàn bộ lịch sử, ưu tiên lượt đầu tiên có mô tả chi tiết
    let bestSymptomDescription = null;
    let bestSymptomIndex = -1;
    
    for (let i = 0; i < validHistory.length; i++) {
        const msg = validHistory[i];
        const content = msg.parts?.[0]?.text || msg.content || '';
        const role = msg.role || '';
        
        if (!content || !role) continue; // Bỏ qua messages không hợp lệ
        
        const lowerContent = content.toLowerCase();
        
        // Xử lý cả user và assistant messages
        // User messages: tìm triệu chứng và chuyên khoa từ mô tả của người dùng
        // Assistant messages: tìm chuyên khoa đã được gợi ý (quan trọng!)
        
        if (role === 'user') {
            // Xử lý tin nhắn từ user

        // Tìm triệu chứng
        for (const keyword of symptomKeywords) {
            if (lowerContent.includes(keyword.toLowerCase())) {
                // Tìm câu hoặc đoạn chứa từ khóa
                const sentences = content.split(/[.!?。！？]/);
                for (const sentence of sentences) {
                    if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
                        const symptomText = sentence.trim();
                        if (symptomText && !medicalContext.symptoms.includes(symptomText)) {
                            medicalContext.symptoms.push(symptomText);
                        }
                    }
                }
            }
        }

        // Nếu có mô tả triệu chứng dài (câu có nhiều từ khóa triệu chứng), lưu làm mô tả đầy đủ
        const symptomCount = symptomKeywords.filter(kw => lowerContent.includes(kw.toLowerCase())).length;
        if (symptomCount >= 2 && content.length > 20) {
            // Ưu tiên mô tả đầu tiên (thường là mô tả đầy đủ nhất)
            if (!bestSymptomDescription || i < bestSymptomIndex || content.length > bestSymptomDescription.length) {
                bestSymptomDescription = content;
                bestSymptomIndex = i;
                medicalContext.fullSymptomDescription = content;
            }
        }

            // Tìm chuyên khoa - ưu tiên match từ khóa dài nhất trước
            // Sắp xếp theo độ dài từ khóa (dài nhất trước) để tránh match sai
            const sortedSpecialties = Object.entries(specialtyKeywords).sort((a, b) => {
                const maxLenA = Math.max(...a[1].map(k => k.length));
                const maxLenB = Math.max(...b[1].map(k => k.length));
                return maxLenB - maxLenA; // Dài nhất trước
            });
            
            for (const [specialty, keywords] of sortedSpecialties) {
                for (const keyword of keywords) {
                    if (lowerContent.includes(keyword.toLowerCase())) {
                        // Chỉ set nếu chưa có hoặc nếu từ khóa này dài hơn (ưu tiên cụ thể hơn)
                        // Nhưng không ghi đè nếu đã có specialty từ assistant (ưu tiên assistant hơn)
                        if ((!medicalContext.specialty || medicalContext.specialtySource !== 'assistant') && 
                            (keyword.length > (specialtyKeywords[medicalContext.specialty]?.[0]?.length || 0) || !medicalContext.specialty)) {
                            medicalContext.specialty = specialty;
                            medicalContext.specialtySource = 'user';
                            break;
                        }
                    }
                }
                if (medicalContext.specialty) break;
            }
        } else if (role === 'assistant' || role === 'model') {
            // Xử lý tin nhắn từ assistant - tìm chuyên khoa đã được gợi ý
            // Đây là thông tin quan trọng vì Pro model đã gợi ý chuyên khoa phù hợp
            // ƯU TIÊN chuyên khoa từ assistant response hơn là từ user message
            const sortedSpecialties = Object.entries(specialtyKeywords).sort((a, b) => {
                const maxLenA = Math.max(...a[1].map(k => k.length));
                const maxLenB = Math.max(...b[1].map(k => k.length));
                return maxLenB - maxLenA;
            });
            
            for (const [specialty, keywords] of sortedSpecialties) {
                for (const keyword of keywords) {
                    if (lowerContent.includes(keyword.toLowerCase())) {
                        // Ưu tiên chuyên khoa từ assistant response (đã được Pro model gợi ý)
                        // Vì đây là thông tin chính xác hơn từ AI model, luôn ghi đè chuyên khoa từ user
                        medicalContext.specialty = specialty;
                        medicalContext.specialtySource = 'assistant'; // Đánh dấu nguồn gốc
                        console.log(`[Medical Context] ✅ Đã tìm thấy chuyên khoa "${specialty}" từ assistant response: "${content.substring(0, 100)}..."`);
                        break;
                    }
                }
                if (medicalContext.specialty && medicalContext.specialtySource === 'assistant') break;
            }
        }

        // Tìm tên bác sĩ (pattern: "bác sĩ" + tên)
        const doctorMatch = content.match(/bác\s*sĩ\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+)/i);
        if (doctorMatch) {
            medicalContext.doctor = doctorMatch[1].trim();
        }

        // Tìm địa điểm (Hà Nội, TP.HCM, thành phố)
        const locationMatch = content.match(/(hà\s*nội|tp\.?\s*hcm|thành\s*phố\s*hồ\s*chí\s*minh|đà\s*nẵng|hải\s*phòng)/i);
        if (locationMatch) {
            medicalContext.location = locationMatch[1];
        }

        // Tìm ngày (ngày mai, tuần sau, tháng sau, hoặc ngày cụ thể)
        if (lowerContent.includes('ngày mai') || lowerContent.includes('mai')) {
            medicalContext.date = 'tomorrow';
        } else if (lowerContent.includes('tuần sau') || lowerContent.includes('tuần tới')) {
            medicalContext.date = 'next_week';
        } else if (lowerContent.includes('tháng sau')) {
            medicalContext.date = 'next_month';
        }
    }

    // Nếu có mô tả triệu chứng đầy đủ, ưu tiên dùng nó
    if (medicalContext.fullSymptomDescription) {
        return {
            ...medicalContext,
            primaryQuery: medicalContext.fullSymptomDescription,
            foundAt: 'full_description'
        };
    }

    // Nếu có nhiều triệu chứng, kết hợp chúng (lấy các triệu chứng đầu tiên, thường là mô tả đầy đủ nhất)
    if (medicalContext.symptoms.length > 0) {
        // Lấy tối đa 3 triệu chứng đầu tiên (thường là mô tả đầy đủ nhất)
        const primarySymptoms = medicalContext.symptoms.slice(0, 3);
        return {
            ...medicalContext,
            primaryQuery: primarySymptoms.join('. '),
            foundAt: 'multiple_symptoms'
        };
    }

    // Nếu không tìm thấy triệu chứng rõ ràng, nhưng có chuyên khoa, vẫn trả về context
    if (medicalContext.specialty) {
        return {
            ...medicalContext,
            primaryQuery: medicalContext.specialty,
            foundAt: 'specialty_only'
        };
    }

    return medicalContext;
};

/**
 * Create a system message for video call start/end
 * @param {Object} params
 * @param {String} params.doctorUserId - Doctor's user ID
 * @param {String} params.patientUserId - Patient's user ID  
 * @param {String} params.type - 'video_call_start' or 'video_call_end'
 * @param {Object} params.videoCallData - Video call details
 * @returns {Promise<Message>}
 */
exports.createVideoCallMessage = async ({ doctorUserId, patientUserId, type, videoCallData }) => {
  try {
    // Find or create conversation between doctor and patient
    let conversation = await Conversation.findOne({
      participants: { $all: [doctorUserId, patientUserId] },
      isActive: true
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [doctorUserId, patientUserId]
      });
    }

    // Create appropriate message content
    let content = '';
    if (type === 'video_call_start') {
      content = 'Cuộc gọi video đã bắt đầu';
    } else if (type === 'video_call_end') {
      const duration = videoCallData.duration || 0;
      const minutes = Math.floor(duration);
      const seconds = Math.round((duration - minutes) * 60);
      content = `Cuộc gọi video đã kết thúc - Thời lượng: ${minutes} phút ${seconds > 0 ? seconds + ' giây' : ''}`;
    }

    // Create message
    const message = await Message.create({
      senderId: doctorUserId, // Doctor as sender (system message)
      receiverId: patientUserId,
      content,
      conversationId: conversation._id,
      messageType: type,
      videoCallData: {
        roomId: videoCallData.roomId,
        roomName: videoCallData.roomName,
        duration: videoCallData.duration,
        startTime: videoCallData.startTime,
        endTime: videoCallData.endTime
      }
    });

    // Update conversation's last message
    conversation.lastMessage = {
      content,
      senderId: doctorUserId,
      timestamp: new Date()
    };
    conversation.lastActivity = new Date();
    await conversation.save();

    // Populate sender info
    await message.populate({
      path: 'senderId',
      select: 'fullName profileImage roleType avatarUrl avatar'
    });

    // Emit socket event for new message
    if (global.io) {
      global.io.to(`conversation:${conversation._id}`).emit('new_message', message);
    }

    // Create notification for patient (only for video_call_end, not for video_call_start)
    if (type === 'video_call_end') {
      try {
        await createNotification({
          userId: patientUserId,
          type: 'video_call',
          title: 'Cuộc gọi video kết thúc',
          content,
          data: {
            conversationId: conversation._id,
            messageId: message._id,
            videoRoomId: videoCallData.roomId,
            senderId: doctorUserId
          }
        });
      } catch (notifError) {
        console.error('Error creating video call notification:', notifError);
      }
    }

    return message;
  } catch (error) {
    console.error('Error creating video call message:', error);
    throw error;
  }
};

/**
 * Notify users about incoming video call
 * @param {Object} params
 */
exports.notifyVideoCallStart = async ({ callerId, receiverId, roomId, roomName }) => {
  try {
    // Emit socket event for real-time notification
    if (global.io) {
      global.io.to(receiverId.toString()).emit('incoming_video_call', {
        callerId,
        roomId,
        roomName
      });
    }

    // Create notification
    await createNotification({
      userId: receiverId,
      type: 'video_call',
      title: 'Cuộc gọi video đến',
      content: 'Bạn có một cuộc gọi video đến',
      data: {
        videoRoomId: roomId,
        senderId: callerId
      }
    });
  } catch (error) {
    console.error('Error notifying video call start:', error);
    throw error;
  }
};

