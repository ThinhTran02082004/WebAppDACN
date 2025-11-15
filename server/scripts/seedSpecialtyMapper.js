const dotenv = require('dotenv');
const path = require('path'); 

// ⭐ Nạp .env TRƯỚC TIÊN
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { QdrantClient } = require("@qdrant/js-client-rest");
const { getEmbedding } = require('../services/embeddingService');
const { v4: uuidv4 } = require('uuid');

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

// ID thật từ CSDL MongoDB
const MAPPINGS = [
  // Nhi khoa
  { text: "tiêm vaccine cho trẻ", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "khám cho trẻ em", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "khám nhi", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "tiêm vaccine", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "trẻ em", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "bé", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "trẻ sơ sinh", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "trẻ nhỏ", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "sốt ở trẻ", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  { text: "ho ở trẻ", specialtyId: "68fd980bdcfa11c6c0b3e6c4", specialtyName: "Nhi khoa" },
  
  // Sản khoa
  { text: "khám thai", specialtyId: "68fd980bdcfa11c6c0b3e6c3", specialtyName: "Sản khoa" },
  { text: "siêu âm thai", specialtyId: "68fd980bdcfa11c6c0b3e6c3", specialtyName: "Sản khoa" },
  { text: "mang thai", specialtyId: "68fd980bdcfa11c6c0b3e6c3", specialtyName: "Sản khoa" },
  { text: "thai kỳ", specialtyId: "68fd980bdcfa11c6c0b3e6c3", specialtyName: "Sản khoa" },
  { text: "sản khoa", specialtyId: "68fd980bdcfa11c6c0b3e6c3", specialtyName: "Sản khoa" },
  { text: "phụ khoa", specialtyId: "68fd980bdcfa11c6c0b3e6c3", specialtyName: "Sản khoa" },
  { text: "kinh nguyệt", specialtyId: "68fd980bdcfa11c6c0b3e6c3", specialtyName: "Sản khoa" },
  
  // Nội khoa
  { text: "đau đầu", specialtyId: "68fd980bdcfa11c6c0b3e6c1", specialtyName: "Nội khoa" },
  { text: "sốt", specialtyId: "68fd980bdcfa11c6c0b3e6c1", specialtyName: "Nội khoa" },
  { text: "ho", specialtyId: "68fd980bdcfa11c6c0b3e6c1", specialtyName: "Nội khoa" },
  { text: "cảm cúm", specialtyId: "68fd980bdcfa11c6c0b3e6c1", specialtyName: "Nội khoa" },
  { text: "đau bụng", specialtyId: "68fd980bdcfa11c6c0b3e6c1", specialtyName: "Nội khoa" },
  { text: "nội khoa", specialtyId: "68fd980bdcfa11c6c0b3e6c1", specialtyName: "Nội khoa" },
  { text: "khám tổng quát", specialtyId: "68fd980bdcfa11c6c0b3e6c1", specialtyName: "Nội khoa" },
  
  // Ngoại khoa
  { text: "phẫu thuật", specialtyId: "68fd980bdcfa11c6c0b3e6c2", specialtyName: "Ngoại khoa" },
  { text: "ngoại khoa", specialtyId: "68fd980bdcfa11c6c0b3e6c2", specialtyName: "Ngoại khoa" },
  { text: "chấn thương", specialtyId: "68fd980bdcfa11c6c0b3e6c2", specialtyName: "Ngoại khoa" },
  { text: "gãy xương", specialtyId: "68fd980bdcfa11c6c0b3e6c2", specialtyName: "Ngoại khoa" },
  
  // Da liễu
  { text: "mụn", specialtyId: "68fd980bdcfa11c6c0b3e6c5", specialtyName: "Da liễu" },
  { text: "dị ứng da", specialtyId: "68fd980bdcfa11c6c0b3e6c5", specialtyName: "Da liễu" },
  { text: "phát ban", specialtyId: "68fd980bdcfa11c6c0b3e6c5", specialtyName: "Da liễu" },
  { text: "da liễu", specialtyId: "68fd980bdcfa11c6c0b3e6c5", specialtyName: "Da liễu" },
  { text: "ngứa da", specialtyId: "68fd980bdcfa11c6c0b3e6c5", specialtyName: "Da liễu" },
  { text: "eczema", specialtyId: "68fd980bdcfa11c6c0b3e6c5", specialtyName: "Da liễu" }
];

const seedMapper = async () => {
  try {
    console.log("\n=== BẮT ĐẦU SEEDING SPECIALTY MAPPER ===\n");
    
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

  } catch (error) {
    console.error("\n❌ LỖI KHI NẠP BỘ ÁNH XẠ:", error);
    console.error("Chi tiết lỗi:", error);
    process.exit(1);
  }
};

seedMapper();
