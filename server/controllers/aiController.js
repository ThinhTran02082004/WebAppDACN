const axios = require('axios');

// POST /api/ai/gemini-chat
// body: { messages: [{ role: 'user'|'assistant'|'system', content: '...'}], system?: string }
exports.geminiChat = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY is not configured' });
    }

    const { messages = [], system } = req.body || {};
    const lastUser = Array.isArray(messages)
      ? [...messages].reverse().find(m => m.role === 'user')
      : null;

    const userText = (lastUser && lastUser.content) || req.body?.prompt || '';
    if (!userText || !userText.trim()) {
      return res.status(400).json({ success: false, message: 'Missing prompt or messages' });
    }

    const systemText = system || (Array.isArray(messages) ? messages.find(m => m.role === 'system')?.content : undefined);

    // Build contents per Google AI Studio API
    const contents = [
      ...(systemText ? [{ parts: [{ text: `System: ${systemText}` }] }] : []),
      { parts: [{ text: userText }] }
    ];

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

    const { data } = await axios.post(
      url,
      { contents },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        }
      }
    );

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ success: true, data: { text, raw: data } });
  } catch (error) {
    console.error('Gemini chat error:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Gemini request failed', error: error.response?.data || error.message });
  }
};
