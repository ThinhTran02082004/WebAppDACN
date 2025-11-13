const NodeCache = require("node-cache");

// Tạo một cache:
// stdTTL: 600 (10 phút) - Một session chat sẽ hết hạn sau 10 phút
// checkperiod: 120 (2 phút) - Cứ 2 phút nó sẽ kiểm tra và xóa key hết hạn
const sessionCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

/**
 * Lưu mapping session_id -> user_id
 * @param {string} sessionId - ID tạm thời (UUID)
 * @param {string} userId - ID thật (ObjectId)
 */
const setUserId = (sessionId, userId) => {
  sessionCache.set(sessionId, userId);
  console.log(`[Cache] Đã map ${sessionId} -> ${userId}`);
};

/**
 * Lấy userId thật từ sessionId
 * @param {string} sessionId - ID tạm thời (UUID)
 * @returns {string | undefined} - ID thật
 */
const getUserId = (sessionId) => {
  const userId = sessionCache.get(sessionId);
  if (userId) {
    console.log(`[Cache] Đã tìm thấy ${sessionId} -> ${userId}`);
  }
  return userId;
};

module.exports = {
  setUserId,
  getUserId
};