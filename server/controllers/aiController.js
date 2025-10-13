const axios = require('axios');

// ===== Static knowledge (example). Can be stored externally =====
const KNOWLEDGE_BASE = [
  {
    id: 'hours',
    title: 'Working hours',
    url: '/faq/working-hours',
    text: 'The clinic is open from 7:30 AM to 5:00 PM, Monday to Saturday. Closed on Sunday.'
  },
  {
    id: 'service-im',
    title: 'General Internal Medicine Service',
    url: '/services/internal-medicine',
    text: 'General health check-up, health consultation, and basic screening packages.'
  },
  {
    id: 'insurance',
    title: 'Health Insurance',
    url: '/faq/insurance',
    text: 'We accept health insurance as per regulations. Please bring your insurance card and ID.'
  }
];

// ===== Retriever =====
function score(query, doc) {
  const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (doc.title + ' ' + doc.text).toLowerCase();
  let s = 0;
  for (const w of toks) if (hay.includes(w)) s++;
  return s;
}
function retrieveTopK(query, k = 4, minScore = 1) {
  return KNOWLEDGE_BASE
    .map(d => ({ d, s: score(query, d) }))
    .filter(x => x.s >= minScore)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x, i) => ({
      idx: i + 1,
      id: x.d.id,
      title: x.d.title,
      url: x.d.url,
      text: x.d.text
    }));
}
function buildContextBlock(sources) {
  return sources.map(s =>
`[${s.idx}] ${s.title} - ${s.url}
${s.text}`).join('\n\n');
}

// ===== Constants =====
const OUT_OF_SCOPE = 'vấn đề trên tôi không thể giúp bạn';
const SYSTEM_POLICY = `
You are a friendly assistant at a medical clinic.

You help users with questions about:
- Healthcare, hospitals/clinics, doctors, and medical appointment consultation.

Rules:
- Answer ONLY based on the CONTEXT provided (from the clinic knowledge base or web).
- If not enough information, you may search the web for recent and factual info related to hospitals, doctors, or healthcare topics.
- If the question is outside these topics, reply EXACTLY: "${OUT_OF_SCOPE}".
- Never diagnose or give treatment advice.
- In emergencies, tell the user to call local emergency services.
- Always include citations in the form [src:N].
`;

// ===== Helper for web search =====
async function searchWeb(query, apiKey) {
  try {
    const { data } = await axios.get(
      `https://www.googleapis.com/customsearch/v1`,
      {
        params: {
          key: apiKey,
          cx: process.env.SEARCH_ENGINE_ID, // your Google CSE ID
          q: query
        }
      }
    );
    return (data.items || []).slice(0, 3).map((item, i) => ({
      idx: i + 1,
      id: 'web-' + i,
      title: item.title,
      url: item.link,
      text: item.snippet
    }));
  } catch (err) {
    console.error('Web search failed:', err.message);
    return [];
  }
}

// ===== Controller =====
exports.geminiChat = async (req, res) => {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY not configured' });
    }

    const { messages = [], system } = req.body || {};
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const userText = lastUser?.content || req.body?.prompt || '';
    if (!userText.trim()) {
      return res.status(400).json({ success: false, message: 'Missing prompt' });
    }

    // 1) Retrieve from local KB
    let sources = retrieveTopK(userText, 4, 1);

    // 2) If nothing relevant -> search web (only for healthcare topics)
    if (sources.length === 0 && /clinic|doctor|hospital|health|medical|bác sĩ|phòng khám/i.test(userText)) {
      const webResults = await searchWeb(userText, process.env.GOOGLE_API_KEY);
      if (webResults.length > 0) {
        sources = webResults;
      }
    }

    if (sources.length === 0) {
      return res.json({ success: true, data: { text: OUT_OF_SCOPE, raw: null, citations: [] } });
    }

    // 3) Build prompt
    const contextBlock = buildContextBlock(sources);
    const systemText = system || SYSTEM_POLICY;
    const base = 'https://generativelanguage.googleapis.com/v1beta';
    const model = 'models/gemini-2.5-flash:generateContent';
    const url = `${base}/${model}?key=${geminiKey}`;

    const historyParts = (Array.isArray(messages) ? messages : []).map(m => ({
      parts: [{ text: m.content }]
    }));

    const contents = [
      { parts: [{ text: `System: ${systemText}` }] },
      ...historyParts,
      {
        parts: [{
          text: `CONTEXT (use ONLY the info below):
${contextBlock}

USER QUESTION:
${userText}

INSTRUCTIONS:
- Answer clearly and briefly.
- Add citations like [src:N].
- If still unrelated or unclear, reply EXACTLY: "${OUT_OF_SCOPE}".`
        }]
      }
    ];

    const { data } = await axios.post(url, { contents }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text)?.join('\n') || '';
    const allowed = new Set(sources.map(s => String(s.idx)));
    const cites = Array.from(text.matchAll(/\[src:(\d+)\]/gi)).map(m => m[1]);
    const hasValidCitation = cites.some(c => allowed.has(String(c)));
    const isOut = text.trim() === OUT_OF_SCOPE;
    const finalText = (!hasValidCitation && !isOut) ? OUT_OF_SCOPE : text;
    const citeMap = sources.map(s => ({ idx: s.idx, title: s.title, url: s.url }));

    return res.json({
      success: true,
      data: { text: finalText, raw: data, citations: citeMap }
    });

  } catch (error) {
    console.error('Gemini chat error:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Gemini request failed',
      error: error.response?.data || error.message
    });
  }
};
