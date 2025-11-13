const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
module.exports = ChatHistory;