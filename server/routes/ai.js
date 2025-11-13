const express = require('express');
const router = express.Router();

// Import hàm controller và middleware
const { geminiChat, getChatHistory } = require('../controllers/aiController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// Định nghĩa route: POST /api/ai/gemini-chat
// (Vì server.js đã dùng /api/ai, ở đây chúng ta chỉ cần /gemini-chat)
// Sử dụng optionalAuth để lấy userId nếu user đã đăng nhập (để lưu lịch sử)
router.post('/gemini-chat', optionalAuth, geminiChat);

// Định nghĩa route: GET /api/ai/chat-history
// Lấy lịch sử chat của user hiện tại (nếu đã đăng nhập)
router.get('/chat-history', optionalAuth, getChatHistory);

module.exports = router;