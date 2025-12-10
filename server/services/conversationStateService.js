const ConversationState = require('../models/ConversationState');

/**
 * Lấy state hiện tại của conversation
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} - Conversation state hoặc null nếu không tìm thấy
 */
const getState = async (sessionId) => {
  try {
    if (!sessionId) {
      return null;
    }

    let state = await ConversationState.findOne({ sessionId });

    // Nếu không tìm thấy, tạo mới
    if (!state) {
      state = await ConversationState.create({
        sessionId,
        structuredState: {
          currentState: 'GREETING'
        }
      });
    }

    return state;
  } catch (error) {
    console.error('[ConversationStateService] Lỗi khi lấy state:', error);
    return null;
  }
};

/**
 * Cập nhật state với patch (merge, không overwrite)
 * @param {string} sessionId - Session ID
 * @param {Object} patch - Object chứa các field cần cập nhật
 * @param {string} userId - User ID (optional, để cập nhật nếu user đăng nhập)
 * @returns {Promise<Object>} - State đã được cập nhật
 */
const updateState = async (sessionId, patch, userId = null) => {
  try {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    // Tìm hoặc tạo state
    let state = await ConversationState.findOne({ sessionId });

    if (!state) {
      state = await ConversationState.create({
        sessionId,
        userId: userId || undefined,
        structuredState: {
          currentState: 'GREETING'
        }
      });
    }

    // Cập nhật userId nếu có
    if (userId && !state.userId) {
      state.userId = userId;
    }

    // Merge patch vào structuredState
    if (patch.structuredState) {
      // Deep merge structuredState
      state.structuredState = {
        ...state.structuredState,
        ...patch.structuredState,
        patientInfo: {
          ...state.structuredState.patientInfo,
          ...(patch.structuredState.patientInfo || {})
        },
        bookingRequest: {
          ...state.structuredState.bookingRequest,
          ...(patch.structuredState.bookingRequest || {})
        },
        drugQueries: {
          ...state.structuredState.drugQueries,
          ...(patch.structuredState.drugQueries || {})
        }
      };
    }

    // Cập nhật các field khác
    if (patch.summary !== undefined) {
      state.summary = patch.summary;
    }

    // Cập nhật lastUpdatedAt
    state.lastUpdatedAt = new Date();

    await state.save();
    return state;
  } catch (error) {
    console.error('[ConversationStateService] Lỗi khi cập nhật state:', error);
    throw error;
  }
};

/**
 * Lưu summary của conversation
 * @param {string} sessionId - Session ID
 * @param {string} summary - Tóm tắt hội thoại (5-10 dòng)
 * @returns {Promise<Object>} - State đã được cập nhật
 */
const saveSummary = async (sessionId, summary) => {
  try {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    const state = await ConversationState.findOne({ sessionId });
    if (!state) {
      throw new Error(`State not found for sessionId: ${sessionId}`);
    }

    state.summary = summary;
    state.lastUpdatedAt = new Date();
    await state.save();

    return state;
  } catch (error) {
    console.error('[ConversationStateService] Lỗi khi lưu summary:', error);
    throw error;
  }
};

/**
 * Xóa state (khi session kết thúc)
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} - True nếu xóa thành công
 */
const deleteState = async (sessionId) => {
  try {
    if (!sessionId) {
      return false;
    }

    const result = await ConversationState.deleteOne({ sessionId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('[ConversationStateService] Lỗi khi xóa state:', error);
    return false;
  }
};

module.exports = {
  getState,
  updateState,
  saveSummary,
  deleteState
};

