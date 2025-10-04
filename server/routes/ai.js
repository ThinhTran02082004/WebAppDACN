const express = require('express');
const router = express.Router();

const { geminiChat } = require('../controllers/aiController');

router.post('/gemini-chat', geminiChat);

module.exports = router;