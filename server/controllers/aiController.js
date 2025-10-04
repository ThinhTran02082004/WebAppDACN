const axios = require('axios');

// ===== Tri thức tĩnh (ví dụ). Có thể tách ra file JSON/DB =====
const KNOWLEDGE_BASE = [
  {
    id: 'hours',
    title: 'Giờ làm việc',
    url: '/faq/gio-lam-viec',
    text: 'Phòng khám mở cửa 7:30–17:00 từ Thứ 2–Thứ 7. Chủ nhật nghỉ.'
  },
  {
    id: 'service-im',
    title: 'Dịch vụ Nội tổng quát',
    url: '/dich-vu/noi-tong-quat',
    text: 'Khám nội tổng quát, tư vấn sức khỏe, gói tầm soát cơ bản.'
  },
  {
    id: 'insurance',
    title: 'Bảo hiểm y tế',
    url: '/faq/bhyt',
    text: 'Chấp nhận BHYT theo quy định. Vui lòng mang theo thẻ BHYT và giấy tờ tùy thân.'
  }
  // TODO: thêm các mục: giá, địa chỉ cơ sở, chuyên khoa, bác sĩ...
];

// ===== Retriever đơn giản: đếm từ khóa trùng =====
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
      idx: i + 1,         // để trích dẫn [src:N]
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

// ===== Chính sách & câu trả lời ngoài phạm vi =====
const OUT_OF_SCOPE = 'Xin lỗi, câu hỏi này không thuộc phạm vi hỗ trợ của chúng tôi.';
const SYSTEM_POLICY = `
Bạn là trợ lý đặt lịch cho phòng khám.
CHỈ ĐƯỢC trả lời dựa trên CONTEXT do hệ thống cung cấp.
- Nếu CONTEXT không đủ để trả lời, hãy trả CHÍNH XÁC câu: "${OUT_OF_SCOPE}"
- KHÔNG chẩn đoán hay đưa lời khuyên y khoa. Trường hợp khẩn cấp, nhắc gọi cấp cứu.
- Mọi câu trả lời hợp lệ PHẢI kèm trích dẫn nguồn dạng [src:N] (N là số thứ tự trong CONTEXT).
- Không dùng kiến thức ngoài CONTEXT, không suy đoán.
`;

// ===== Controller =====
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

    // 1) Truy xuất context
    const sources = retrieveTopK(userText, 4, 1);   // tăng minScore lên 2 nếu muốn “gắt” hơn
    if (sources.length === 0) {
      // Không có tài liệu liên quan -> từ chối ngay, không gọi model
      return res.json({ success: true, data: { text: OUT_OF_SCOPE, raw: null, citations: [] } });
    }

    // 2) Dựng prompt khóa phạm vi
    const contextBlock = buildContextBlock(sources);
    const systemText = system || SYSTEM_POLICY;

    const base = 'https://generativelanguage.googleapis.com/v1beta';
    // Khuyến nghị dùng model 2.5-flash (ổn định hơn 2.0)
    const model = 'models/gemini-2.5-flash:generateContent';
    const url = `${base}/${model}?key=${apiKey}`;

    // Chuyển lịch sử chat theo schema của Google (role optional; dùng parts)
    const historyParts = (Array.isArray(messages) ? messages : []).map(m => ({
      parts: [{ text: m.content }]
    }));

    const contents = [
      { parts: [{ text: `System: ${systemText}` }] },
      ...historyParts,
      {
        parts: [{
          text:
`CONTEXT (chỉ dùng thông tin dưới đây):
${contextBlock}

CÂU HỎI:
${userText}

YÊU CẦU:
- Trả lời ngắn gọn, rõ ràng.
- Chèn trích dẫn theo [src:N] ngay sau câu/đoạn tương ứng.
- Nếu không thể trả lời từ CONTEXT, trả CHÍNH XÁC câu: "${OUT_OF_SCOPE}".`
        }]
      }
    ];

    const { data } = await axios.post(
      url,
      { contents },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const text = data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      ?.filter(Boolean)
      ?.join('\n') || '';

    // 3) Hậu kiểm: bắt buộc có citation hợp lệ hoặc là câu OUT_OF_SCOPE
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
