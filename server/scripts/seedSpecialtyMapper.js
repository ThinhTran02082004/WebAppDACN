const dotenv = require('dotenv');
const path = require('path'); 
const mongoose = require('mongoose');

// ⭐ Nạp .env TRƯỚC TIÊN
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { QdrantClient } = require("@qdrant/js-client-rest");
const { getEmbedding } = require('../services/embeddingService');
const { v4: uuidv4 } = require('uuid');
const Specialty = require('../models/Specialty');

// 1. Cấu hình Qdrant (xử lý URL giống qdrantService.js)
let QDRANT_URL = (process.env.QDRANT_URL || 'http://localhost:6333').trim();
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

// Loại bỏ dấu nháy ở hai đầu (nếu có)
QDRANT_URL = QDRANT_URL.replace(/^['"]+|['"]+$/g, '').trim();

// Đảm bảo URL có protocol hợp lệ
if (!/^https?:\/\//i.test(QDRANT_URL)) {
  QDRANT_URL = `http://${QDRANT_URL}`;
}

// Kiểm tra biến môi trường
if (!QDRANT_URL) {
  console.error("❌ Lỗi: QDRANT_URL không được định nghĩa trong file .env");
  process.exit(1);
}

if (!QDRANT_API_KEY) {
  console.warn("⚠️  Cảnh báo: QDRANT_API_KEY không được định nghĩa. Có thể không cần thiết nếu Qdrant không yêu cầu authentication.");
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Lỗi: GEMINI_API_KEY không được định nghĩa trong file .env (cần cho embedding)");
  process.exit(1);
}

console.log(`[Config] QDRANT_URL: ${QDRANT_URL.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@')}`);
console.log(`[Config] QDRANT_API_KEY: ${QDRANT_API_KEY ? 'Đã có' : 'Chưa có'}`);
console.log(`[Config] GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Đã có' : 'Chưa có'}`);

const COLLECTION_NAME = "specialty_mapper"; // Tên collection mới

const qdrantClient = new QdrantClient({ 
  url: QDRANT_URL, 
  apiKey: QDRANT_API_KEY 
});

// Mapping template - sẽ được cập nhật với ID thật từ database
// Format: { text: "từ khóa", specialtyName: "Tên chuyên khoa" }
const MAPPING_TEMPLATES = [
  // Nhi khoa
  { text: "tiêm vaccine cho trẻ", specialtyName: "Nhi khoa" },
  { text: "tiêm vaccien cho trẻ", specialtyName: "Nhi khoa" }, // Lỗi chính tả phổ biến
  { text: "tiêm vacxin cho trẻ", specialtyName: "Nhi khoa" }, // Biến thể khác
  { text: "khám cho trẻ em", specialtyName: "Nhi khoa" },
  { text: "khám nhi", specialtyName: "Nhi khoa" },
  { text: "tiêm vaccine", specialtyName: "Nhi khoa" },
  { text: "trẻ em", specialtyName: "Nhi khoa" },
  { text: "bé", specialtyName: "Nhi khoa" },
  { text: "trẻ sơ sinh", specialtyName: "Nhi khoa" },
  { text: "trẻ nhỏ", specialtyName: "Nhi khoa" },
  { text: "sốt ở trẻ", specialtyName: "Nhi khoa" },
  { text: "ho ở trẻ", specialtyName: "Nhi khoa" },
  
  // Sản khoa
  { text: "khám thai", specialtyName: "Sản khoa" },
  { text: "siêu âm thai", specialtyName: "Sản khoa" },
  { text: "mang thai", specialtyName: "Sản khoa" },
  { text: "thai kỳ", specialtyName: "Sản khoa" },
  { text: "sản khoa", specialtyName: "Sản khoa" },
  { text: "phụ khoa", specialtyName: "Sản khoa" },
  { text: "kinh nguyệt", specialtyName: "Sản khoa" },
  
  // Nội khoa
  { text: "khám chuyên khoa nội", specialtyName: "Nội khoa" },
  { text: "chuyên khoa nội", specialtyName: "Nội khoa" },
  { text: "khám tổng quát", specialtyName: "Nội khoa" },
  { text: "tổng quát", specialtyName: "Nội khoa" },
  { text: "khám sức khỏe tổng quát", specialtyName: "Nội khoa" },
  { text: "đau đầu", specialtyName: "Nội khoa" },
  { text: "sốt", specialtyName: "Nội khoa" },
  { text: "ho", specialtyName: "Nội khoa" },
  { text: "cảm cúm", specialtyName: "Nội khoa" },
  { text: "đau bụng", specialtyName: "Nội khoa" },
  { text: "nội khoa", specialtyName: "Nội khoa" },
  
  // Ngoại khoa
  { text: "phẫu thuật", specialtyName: "Ngoại khoa" },
  { text: "ngoại khoa", specialtyName: "Ngoại khoa" },
  { text: "chấn thương", specialtyName: "Ngoại khoa" },
  { text: "gãy xương", specialtyName: "Ngoại khoa" },
  
  // Da liễu
  { text: "khám da", specialtyName: "Da liễu" },
  { text: "khám da liễu", specialtyName: "Da liễu" },
  { text: "mụn", specialtyName: "Da liễu" },
  { text: "dị ứng da", specialtyName: "Da liễu" },
  { text: "phát ban", specialtyName: "Da liễu" },
  { text: "da liễu", specialtyName: "Da liễu" },
  { text: "ngứa da", specialtyName: "Da liễu" },
  { text: "eczema", specialtyName: "Da liễu" }
];

const seedMapper = async () => {
  try {
    console.log("\n=== BẮT ĐẦU SEEDING SPECIALTY MAPPER ===\n");
    
    // ⭐ BƯỚC 0: KẾT NỐI MONGODB VÀ LẤY DỮ LIỆU SPECIALTIES
    console.log(`[Bước 0] Đang kết nối MongoDB...`);
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalweb';
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log("✅ [Bước 0] Đã kết nối MongoDB thành công!");
    
    console.log(`[Bước 0] Đang lấy danh sách specialties từ database...`);
    const specialties = await Specialty.find({ isActive: { $ne: false } }).select('_id name');
    console.log(`[Bước 0] Tìm thấy ${specialties.length} specialties trong database:`);
    specialties.forEach(s => {
      console.log(`  - ${s.name} (ID: ${s._id})`);
    });
    
    // Tạo map từ tên specialty -> ID
    const specialtyMap = {};
    specialties.forEach(s => {
      specialtyMap[s.name] = s._id.toString();
    });
    
    // Cập nhật MAPPINGS với ID thật từ database
    const MAPPINGS = MAPPING_TEMPLATES.map(template => {
      const specialtyId = specialtyMap[template.specialtyName];
      if (!specialtyId) {
        console.warn(`⚠️  [Bước 0] CẢNH BÁO: Không tìm thấy specialty "${template.specialtyName}" trong database. Mapping này sẽ bị bỏ qua.`);
        return null;
      }
      return {
        text: template.text,
        specialtyId: specialtyId,
        specialtyName: template.specialtyName
      };
    }).filter(m => m !== null); // Loại bỏ các mapping không hợp lệ
    
    console.log(`[Bước 0] Đã tạo ${MAPPINGS.length} mappings hợp lệ từ ${MAPPING_TEMPLATES.length} templates.\n`);
    
    // ⭐ BƯỚC 1: CODE TỰ ĐỘNG TẠO COLLECTION (ĐÃ THÊM)
    console.log(`[Bước 1] Kiểm tra collection: ${COLLECTION_NAME}...`);
    
    try {
      const collections = await qdrantClient.getCollections();
      const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

      if (!collectionExists) {
        console.log(`[Bước 1] Đang tạo collection: ${COLLECTION_NAME}...`);
        await qdrantClient.recreateCollection(COLLECTION_NAME, {
          vectors: {
            size: 768, // Kích thước của 'text-embedding-004'
            distance: "Cosine",
          },
        });
        console.log("✅ [Bước 1] Tạo collection thành công!");
      } else {
        console.log("ℹ️  [Bước 1] Collection đã tồn tại.");
      }
    } catch (error) {
      console.error("❌ [Bước 1] Lỗi khi kiểm tra/tạo collection:", error.message);
      throw error;
    }
    // ⭐ HẾT BƯỚC 1

    // BƯỚC 2: NẠP DỮ LIỆU
    console.log(`\n[Bước 2] Đang nạp (seeding) bộ ánh xạ chuyên khoa...`);
    console.log(`[Bước 2] Tổng số mappings: ${MAPPINGS.length}`);
    
    let points = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < MAPPINGS.length; i++) {
      const item = MAPPINGS[i];
      try {
        console.log(`[Bước 2] Đang xử lý ${i + 1}/${MAPPINGS.length}: "${item.text}" -> ${item.specialtyName}`);
        const vector = await getEmbedding(item.text);
        points.push({
          id: uuidv4(),
          vector: vector,
          payload: { 
            specialtyId: item.specialtyId, 
            specialtyName: item.specialtyName 
          }
        });
        successCount++;
      } catch (error) {
        console.error(`❌ [Bước 2] Lỗi khi tạo embedding cho "${item.text}":`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n[Bước 2] Hoàn thành: ${successCount} thành công, ${errorCount} lỗi`);
    
    // Chỉ 'upsert' nếu có điểm mới
    if (points.length > 0) {
      console.log(`\n[Bước 3] Đang upload ${points.length} điểm dữ liệu lên Qdrant...`);
      try {
        await qdrantClient.upsert(COLLECTION_NAME, { wait: true, points: points });
        console.log(`✅ [Bước 3] Nạp ${points.length} điểm dữ liệu thành công!`);
      } catch (error) {
        console.error("❌ [Bước 3] Lỗi khi upload lên Qdrant:", error.message);
        throw error;
      }
    } else {
      console.log("⚠️  [Bước 3] Không có điểm dữ liệu mới để nạp.");
    }

    console.log("\n=== HOÀN TẤT SEEDING SPECIALTY MAPPER ===\n");
    
    // Đóng kết nối MongoDB
    await mongoose.disconnect();
    console.log("✅ Đã đóng kết nối MongoDB.");

  } catch (error) {
    console.error("\n❌ LỖI KHI NẠP BỘ ÁNH XẠ:", error);
    console.error("Chi tiết lỗi:", error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

seedMapper();
