const express = require('express');
const router = express.Router();
const { geminiChat, getChatHistory } = require('../controllers/aiController');
const { optionalAuth } = require('../middlewares/authMiddleware');

router.post('/gemini-chat', optionalAuth, geminiChat);
router.get('/chat-history', optionalAuth, getChatHistory);

module.exports = router;

