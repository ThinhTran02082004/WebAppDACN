const { GoogleGenerativeAI } = require("@google/generative-ai");

// Khởi tạo model embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ 
    model: "text-embedding-004" 
});

/**
 * Biến một chuỗi văn bản thành vector
 * @param {string} text - Văn bản đầu vào
 * @returns {Promise<number[]>} - Vector (dãy số)
 */
const getEmbedding = async (text) => {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Lỗi khi tạo embedding:", error);
    throw new Error("Không thể tạo vector cho văn bản.");
  }
};

module.exports = {
  getEmbedding
  // Xóa hàm isIrrelevant khỏi đây
};