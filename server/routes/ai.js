const express = require('express');
const router = express.Router();

// Import hàm controller
const { geminiChat } = require('../controllers/aiController');

// Định nghĩa route: POST /api/ai/gemini-chat
// (Vì server.js đã dùng /api/ai, ở đây chúng ta chỉ cần /gemini-chat)
router.post('/gemini-chat', geminiChat);

module.exports = router;