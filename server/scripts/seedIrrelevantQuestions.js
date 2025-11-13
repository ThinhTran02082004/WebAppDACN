const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path'); 

// ⭐ 1. SỬA LỖI Ở ĐÂY: Nạp .env TRƯỚC TIÊN
// Phải nạp biến môi trường trước khi import bất kỳ service nào
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 2. Bây giờ mới import các file service
const { connectDB } = require('../config/database');
const { initializeCollection, addQuestionsToQdrant, initializeCollections } = require('../services/qdrantService');

// DANH SÁCH CÂU HỎI LẠC ĐỀ
const QUESTIONS = [
  // Tán gẫu (Chit-chat)
  "Bạn tên gì?",
  "Bạn là ai?",
  "Bạn khoẻ không?",
  "Bạn bao nhiêu tuổi?",
  "Bạn là trai hay gái?",
  "Bạn được tạo ra bởi ai?",
  "Bạn là người hay máy?",
  "Tạm biệt",
  "Cảm ơn bạn",

  // Giải trí (Entertainment)
  "Kể cho tôi một câu chuyện cười",
  "Hát một bài đi",
  "Làm thơ đi",

  // Chủ đề không liên quan (Rõ ràng)
  "Nói về chính trị",
  "Thảo luận về thể thao",
  "Giá vàng hôm nay?",
  "Công thức nấu phở",
  "Viết code cho tôi",

  // Lăng mạ / Nói bậy
  "Chửi nhau đi",
  "Nói bậy",
  "Đồ ngốc",
  "Bạn thật vô dụng"
];
const seedQuestions = async () => {
  try {
    // 1. Khởi tạo (tạo collection nếu chưa có)
    await initializeCollections();
    
    // 2. Thêm câu hỏi
    await addQuestionsToQdrant(QUESTIONS);
    
    console.log("HOÀN TẤT SEEDING VÀO QDRANT!");
  } catch (error) {
    console.error("Lỗi khi seeding Qdrant:", error);
  }
};

// Script này không cần kết nối MongoDB
seedQuestions();