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

/**
 * Lưu availableSlots vào cache để có thể lấy lại khi user chọn slot
 * @param {string} sessionId - ID tạm thời (UUID)
 * @param {Array} availableSlots - Danh sách slots
 */
const setAvailableSlots = (sessionId, availableSlots) => {
  const key = `slots_${sessionId}`;
  sessionCache.set(key, availableSlots);
  console.log(`[Cache] Đã lưu ${availableSlots.length} slots cho session ${sessionId}`);
};

/**
 * Lấy availableSlots từ cache
 * @param {string} sessionId - ID tạm thời (UUID)
 * @returns {Array | undefined} - Danh sách slots
 */
const getAvailableSlots = (sessionId) => {
  const key = `slots_${sessionId}`;
  const slots = sessionCache.get(key);
  if (slots) {
    console.log(`[Cache] Đã lấy ${slots.length} slots từ cache cho session ${sessionId}`);
  }
  return slots;
};

module.exports = {
  setUserId,
  getUserId,
  setAvailableSlots,
  getAvailableSlots
};