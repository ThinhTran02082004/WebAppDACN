const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

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
  getEmbedding,
};

