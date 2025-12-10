const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    index: true // Index để tìm kiếm nhanh theo sessionId
  },
  userPrompt: {
    type: String,
    required: true
  },
  aiResponse: {
    type: String,
    required: true
  },
  // Đây là trường phân tích "đúng mục đích" mà bạn muốn
  usedTool: {
    type: Boolean,
    default: false,
    index: true
  },
  // Có thể thêm cờ 'spam' nếu bạn muốn admin gắn cờ thủ công
  // isSpam: {
  //   type: Boolean,
  //   default: false
  // }
}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

chatHistorySchema.index({ createdAt: -1 });
chatHistorySchema.index({ userId: 1, sessionId: 1 }); // Index kết hợp để query nhanh hơn

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
module.exports = ChatHistory;