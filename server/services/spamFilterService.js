const qdrantService = require('./qdrantService');
const conversationStateService = require('./conversationStateService');

// Cache để track behavior (có thể dùng Redis sau này)
const behaviorCache = new Map(); // sessionId -> { requestCount, lastRequestTime, cancelCount, ... }

/**
 * Tính contentScore dựa trên embedding và regex
 * @param {string} userPrompt - Câu hỏi của user
 * @returns {Promise<number>} - Score từ 0-1 (1 = spam nhất)
 */
const calculateContentScore = async (userPrompt) => {
  if (!userPrompt || typeof userPrompt !== 'string') {
    return 0;
  }

  const lowerText = userPrompt.toLowerCase();
  let score = 0;

  // 1. Kiểm tra embedding similarity với irrelevant_questions (threshold thấp hơn: 0.9)
  try {
    const isIrrelevant = await qdrantService.isIrrelevant(userPrompt);
    if (isIrrelevant) {
      score += 0.4; // Nếu match với irrelevant, tăng score
    }
  } catch (error) {
    console.error('[SpamFilter] Lỗi khi kiểm tra embedding:', error);
  }

  // 2. Regex check: chửi bậy, link, quảng cáo
  const spamPatterns = [
    /(http|https|www\.|\.com|\.vn|\.net)/i, // Link
    /(quảng cáo|advertisement|ads|spam)/i, // Quảng cáo
    /(đm|địt|đụ|fuck|shit|damn)/i, // Chửi bậy
    /(cờ bạc|casino|bet|đánh bạc)/i, // Cờ bạc
    /(sex|porn|xxx)/i, // Nội dung không phù hợp
    /(hack|virus|malware|trojan)/i, // Malware
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(userPrompt)) {
      score += 0.3;
      break; // Chỉ tính 1 lần
    }
  }

  // 3. Kiểm tra độ dài bất thường (quá ngắn hoặc quá dài)
  if (userPrompt.length < 3) {
    score += 0.1; // Câu quá ngắn có thể là spam
  } else if (userPrompt.length > 1000) {
    score += 0.1; // Câu quá dài có thể là spam
  }

  // Normalize về 0-1
  return Math.min(score, 1.0);
};

/**
 * Tính behaviorScore dựa trên hành vi
 * @param {string} sessionId - Session ID
 * @param {string} userPrompt - Câu hỏi của user
 * @returns {Promise<number>} - Score từ 0-1 (1 = spam nhất)
 */
const calculateBehaviorScore = async (sessionId, userPrompt) => {
  if (!sessionId) {
    return 0;
  }

  let behavior = behaviorCache.get(sessionId);
  if (!behavior) {
    behavior = {
      requestCount: 0,
      lastRequestTime: null,
      cancelCount: 0,
      requestTimes: [] // Lưu thời gian các request gần đây
    };
    behaviorCache.set(sessionId, behavior);
  }

  const now = Date.now();
  behavior.requestCount++;
  behavior.lastRequestTime = now;
  behavior.requestTimes.push(now);

  // Chỉ giữ 60 requests gần nhất (trong 1 phút)
  const oneMinuteAgo = now - 60 * 1000;
  behavior.requestTimes = behavior.requestTimes.filter(t => t > oneMinuteAgo);

  let score = 0;

  // 1. Kiểm tra tần suất request (30 requests/phút = spam)
  const requestsInLastMinute = behavior.requestTimes.length;
  if (requestsInLastMinute > 30) {
    score += 0.5; // Rất cao
  } else if (requestsInLastMinute > 20) {
    score += 0.3; // Cao
  } else if (requestsInLastMinute > 10) {
    score += 0.1; // Trung bình
  }

  // 2. Kiểm tra số lần hủy lịch (nếu có state)
  try {
    const state = await conversationStateService.getState(sessionId);
    if (state && state.structuredState) {
      // Có thể thêm logic đếm số lần hủy lịch từ state hoặc database
      // Hiện tại chỉ check bookingIntent nhưng không có booking
      if (state.structuredState.bookingIntent && !state.structuredState.bookingRequest?.status) {
        // Có intent nhưng không đặt được -> có thể là spam
        score += 0.1;
      }
    }
  } catch (error) {
    console.error('[SpamFilter] Lỗi khi lấy state:', error);
  }

  // 3. Kiểm tra pattern: cùng một câu hỏi lặp lại nhiều lần
  // (Có thể implement sau với lịch sử chat)

  // Normalize về 0-1
  return Math.min(score, 1.0);
};

/**
 * Tính tổng spamScore
 * @param {string} userPrompt - Câu hỏi của user
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} - { spamScore, contentScore, behaviorScore, zone }
 */
const calculateSpamScore = async (userPrompt, sessionId) => {
  const contentScore = await calculateContentScore(userPrompt);
  const behaviorScore = await calculateBehaviorScore(sessionId, userPrompt);

  // Tổng hợp: 60% content, 40% behavior
  const spamScore = 0.6 * contentScore + 0.4 * behaviorScore;

  // Xác định zone
  let zone = 'normal';
  if (spamScore >= 0.7) {
    zone = 'spam';
  } else if (spamScore >= 0.3) {
    zone = 'suspicious';
  }

  return {
    spamScore,
    contentScore,
    behaviorScore,
    zone
  };
};

/**
 * Kiểm tra spam và trả về response phù hợp
 * @param {string} userPrompt - Câu hỏi của user
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} - null nếu không spam, hoặc { blocked: boolean, message: string }
 */
const checkSpam = async (userPrompt, sessionId) => {
  const { spamScore, zone } = await calculateSpamScore(userPrompt, sessionId);

  console.log(`[SpamFilter] spamScore: ${spamScore.toFixed(3)}, zone: ${zone}`);

  // Zone 1: Normal (< 0.3) - Cho qua
  if (zone === 'normal') {
    return null; // Không spam, cho qua
  }

  // Zone 2: Suspicious (0.3 - 0.7) - Gửi câu hỏi xác nhận
  if (zone === 'suspicious') {
    return {
      blocked: false,
      message: "Anh/chị có đang muốn tư vấn y tế hoặc đặt lịch khám không ạ? Nếu có, vui lòng cho biết triệu chứng hoặc bệnh viện mong muốn.",
      spamScore,
      zone
    };
  }

  // Zone 3: Spam (>= 0.7) - Block hoặc trả lời chung chung
  return {
    blocked: true,
    message: "Xin lỗi, tôi chỉ có thể hỗ trợ các câu hỏi liên quan đến việc tìm kiếm và đặt lịch y tế.",
    spamScore,
    zone
  };
};

/**
 * Kiểm tra xem có thể cho phép đặt lịch không (dựa trên state machine và spamScore)
 * @param {string} sessionId - Session ID
 * @param {number} spamScore - Spam score hiện tại
 * @returns {Promise<boolean>} - true nếu cho phép đặt lịch
 */
const canProceedToBooking = async (sessionId, spamScore) => {
  // Nếu spamScore cao, không cho đặt lịch
  if (spamScore >= 0.7) {
    return false;
  }

  // Kiểm tra state machine
  try {
    const state = await conversationStateService.getState(sessionId);
    if (state && state.structuredState) {
      const currentState = state.structuredState.currentState;
      
      // Chỉ cho phép đặt lịch khi ở các state phù hợp
      const allowedStates = ['BOOKING_OPTIONS', 'CONFIRM_BOOKING'];
      if (allowedStates.includes(currentState)) {
        return true;
      }

      // Nếu spamScore cao, không cho chuyển sang booking states
      if (spamScore >= 0.3 && currentState === 'GREETING') {
        return false;
      }
    }
  } catch (error) {
    console.error('[SpamFilter] Lỗi khi kiểm tra state:', error);
  }

  return true;
};

/**
 * Reset behavior cache cho session (khi cần)
 * @param {string} sessionId - Session ID
 */
const resetBehaviorCache = (sessionId) => {
  if (sessionId) {
    behaviorCache.delete(sessionId);
  }
};

module.exports = {
  calculateSpamScore,
  checkSpam,
  canProceedToBooking,
  resetBehaviorCache
};

