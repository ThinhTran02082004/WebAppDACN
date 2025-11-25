const dotenv = require('dotenv');
const path = require('path'); 
const mongoose = require('mongoose');
const crypto = require('crypto');

// ⭐ Nạp .env TRƯỚC TIÊN
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { QdrantClient } = require("@qdrant/js-client-rest");
const { getEmbedding } = require('../services/embeddingService');
const { v4: uuidv4 } = require('uuid');
const Specialty = require('../models/Specialty');
const Service = require('../models/Service');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Hospital = require('../models/Hospital');

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

// Collection names
const COLLECTION_SPECIALTY = "specialty_mapper";
const COLLECTION_SERVICE = "service_mapper";
const COLLECTION_DOCTOR = "doctor_mapper";

// Parse command line arguments
const args = process.argv.slice(2);
const seedType = args[0] || 'all'; // 'all', 'specialty', 'service', 'doctor'
const forceUpdate = args.includes('--force') || args.includes('-f'); // Force update all records

const qdrantClient = new QdrantClient({ 
  url: QDRANT_URL, 
  apiKey: QDRANT_API_KEY 
});

// Helper function to generate stable ID from MongoDB _id or text
// Qdrant requires UUID format (not hex string), so we convert MD5 hash to UUID format
const generateStableId = (input) => {
  const hash = crypto.createHash('md5').update(input.toString()).digest('hex');
  // Convert 32-char hex string to UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // Take first 32 chars and format as UUID
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
};

// Helper function to generate content hash for change detection
const generateContentHash = (data) => {
  const content = JSON.stringify(data);
  return crypto.createHash('md5').update(content).digest('hex');
};

// Load mapping templates từ database (ưu tiên) hoặc JSON file (fallback)
let MAPPING_TEMPLATES = [];

async function loadMappingsFromDatabase() {
  try {
    const SpecialtyMapping = require('../models/SpecialtyMapping');
    const mappings = await SpecialtyMapping.find({ isActive: { $ne: false } })
      .populate('specialtyId', 'name')
      .lean();
    
    MAPPING_TEMPLATES = mappings.map(m => ({
      text: m.text,
      specialtyName: m.specialtyName || m.specialtyId?.name
    }));
    
    console.log(`✅ Đã tải ${MAPPING_TEMPLATES.length} mappings từ database`);
    return true;
  } catch (error) {
    console.warn('⚠️  Không thể tải mappings từ database:', error.message);
    return false;
  }
}

async function loadMappingsFromFile() {
  try {
    const mappingsFile = require('./specialtyMappings.json');
    MAPPING_TEMPLATES = mappingsFile.mappings || [];
    console.log(`✅ Đã tải ${MAPPING_TEMPLATES.length} mappings từ specialtyMappings.json`);
    return true;
  } catch (error) {
    console.warn('⚠️  Không thể tải specialtyMappings.json');
    return false;
  }
}

// Load mappings - ưu tiên database, fallback file, cuối cùng là default
async function loadMappings() {
  // Sẽ được gọi trong seedSpecialtyMapper function sau khi connect MongoDB
  const fromDB = await loadMappingsFromDatabase();
  if (!fromDB) {
    const fromFile = await loadMappingsFromFile();
    if (!fromFile) {
      // Fallback to default mappings
      MAPPING_TEMPLATES = [
        { text: "tiêm vaccine cho trẻ", specialtyName: "Nhi khoa" },
        { text: "khám cho trẻ em", specialtyName: "Nhi khoa" },
        { text: "khám nhi", specialtyName: "Nhi khoa" },
        { text: "khám thai", specialtyName: "Sản khoa" },
        { text: "sản khoa", specialtyName: "Sản khoa" },
        { text: "khám tổng quát", specialtyName: "Nội khoa" },
        { text: "tổng quát", specialtyName: "Nội khoa" },
        { text: "nội khoa", specialtyName: "Nội khoa" },
        { text: "phẫu thuật", specialtyName: "Ngoại khoa" },
        { text: "ngoại khoa", specialtyName: "Ngoại khoa" },
        { text: "khám da liễu", specialtyName: "Da liễu" },
        { text: "da liễu", specialtyName: "Da liễu" }
      ];
      console.log(`⚠️  Sử dụng ${MAPPING_TEMPLATES.length} mappings mặc định`);
    }
  }
}

// Initialize collections
const initializeCollection = async (collectionName, description) => {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);

    if (!collectionExists) {
      console.log(`Đang tạo collection (${description}): ${collectionName}...`);
      await qdrantClient.recreateCollection(collectionName, {
        vectors: {
          size: 768,
          distance: "Cosine",
        },
      });
      console.log(`✅ Tạo collection (${description}) thành công!`);
    } else {
      console.log(`ℹ️  Collection (${description}) đã tồn tại: ${collectionName}`);
    }
  } catch (error) {
    console.error(`❌ Lỗi khi kiểm tra/tạo collection ${collectionName}:`, error.message);
    throw error;
  }
};

// Seed Specialty Mapper
const seedSpecialtyMapper = async () => {
  try {
    console.log("\n=== BẮT ĐẦU SEEDING SPECIALTY MAPPER ===\n");
    
    // Load mappings từ database hoặc file
    await loadMappings();
    
    await initializeCollection(COLLECTION_SPECIALTY, "Bộ ánh xạ chuyên khoa");
    
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
    }).filter(m => m !== null);
    
    console.log(`[Bước 0] Đã tạo ${MAPPINGS.length} mappings hợp lệ từ ${MAPPING_TEMPLATES.length} templates.\n`);
    
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
        const stableId = generateStableId(item.text); // Stable ID từ text
        points.push({
          id: stableId,
          vector: vector,
          payload: { 
            specialtyId: item.specialtyId, 
            specialtyName: item.specialtyName,
            text: item.text,
            contentHash: generateContentHash({ text: item.text, specialtyId: item.specialtyId })
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
        await qdrantClient.upsert(COLLECTION_SPECIALTY, { wait: true, points: points });
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
    console.error("\n❌ LỖI KHI NẠP BỘ ÁNH XẠ CHUYÊN KHOA:", error);
    throw error;
  }
};

// Seed Service Mapper
const seedServiceMapper = async () => {
  try {
    console.log("\n=== BẮT ĐẦU SEEDING SERVICE MAPPER ===\n");
    
    await initializeCollection(COLLECTION_SERVICE, "Bộ ánh xạ dịch vụ");
    
    console.log(`[Bước 0] Đang lấy danh sách services từ database...`);
    const services = await Service.find({ isActive: { $ne: false } })
      .select('_id name description shortDescription specialtyId updatedAt')
      .populate('specialtyId', 'name');
    
    console.log(`[Bước 0] Tìm thấy ${services.length} services trong database.\n`);
    
    // Get existing points from Qdrant to check what needs updating
    let existingPoints = new Map();
    if (!forceUpdate) {
      try {
        const scrollResult = await qdrantClient.scroll(COLLECTION_SERVICE, {
          limit: 10000,
          with_payload: true,
        });
        scrollResult.points.forEach(point => {
          existingPoints.set(point.id, point.payload);
        });
        console.log(`[Bước 0] Đã tải ${existingPoints.size} điểm dữ liệu hiện có từ Qdrant để so sánh.\n`);
      } catch (error) {
        console.log(`[Bước 0] Không thể tải dữ liệu hiện có (có thể collection mới): ${error.message}\n`);
      }
    }
    
    let points = [];
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const BATCH_SIZE = 10; // Process in batches
    
    for (let i = 0; i < services.length; i += BATCH_SIZE) {
      const batch = services.slice(i, i + BATCH_SIZE);
      console.log(`[Bước 1] Đang xử lý batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(services.length / BATCH_SIZE)} (${i + 1}-${Math.min(i + BATCH_SIZE, services.length)}/${services.length})...`);
      
      const batchPromises = batch.map(async (service) => {
        try {
          const stableId = generateStableId(service._id);
          const contentHash = generateContentHash({
            name: service.name,
            description: service.description || '',
            shortDescription: service.shortDescription || '',
            specialtyId: service.specialtyId?._id?.toString() || '',
            updatedAt: service.updatedAt?.toISOString() || ''
          });
          
          // Check if needs update
          if (!forceUpdate && existingPoints.has(stableId)) {
            const existing = existingPoints.get(stableId);
            if (existing.contentHash === contentHash) {
              skipCount++;
              return null; // Skip, no changes
            }
          }
          
          // Create searchable text from service name and description
          const searchText = [
            service.name,
            service.shortDescription || '',
            service.description || '',
            service.specialtyId?.name || ''
          ].filter(Boolean).join(' ');
          
          const vector = await getEmbedding(searchText);
          
          return {
            id: stableId,
            vector: vector,
            payload: {
              serviceId: service._id.toString(),
              serviceName: service.name,
              description: service.description || '',
              shortDescription: service.shortDescription || '',
              specialtyId: service.specialtyId?._id?.toString() || '',
              specialtyName: service.specialtyId?.name || '',
              contentHash: contentHash,
              updatedAt: service.updatedAt?.toISOString() || new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`❌ Lỗi khi xử lý service "${service.name}":`, error.message);
          errorCount++;
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validPoints = batchResults.filter(p => p !== null);
      points.push(...validPoints);
      successCount += validPoints.length;
    }
    
    console.log(`\n[Bước 1] Hoàn thành: ${successCount} cần cập nhật, ${skipCount} không thay đổi, ${errorCount} lỗi`);
    
    if (points.length > 0) {
      console.log(`\n[Bước 2] Đang upload ${points.length} điểm dữ liệu lên Qdrant...`);
      try {
        // Upload in smaller batches to avoid timeout
        const UPLOAD_BATCH_SIZE = 50;
        for (let i = 0; i < points.length; i += UPLOAD_BATCH_SIZE) {
          const uploadBatch = points.slice(i, i + UPLOAD_BATCH_SIZE);
          await qdrantClient.upsert(COLLECTION_SERVICE, { wait: true, points: uploadBatch });
          console.log(`  ✅ Đã upload batch ${Math.floor(i / UPLOAD_BATCH_SIZE) + 1}/${Math.ceil(points.length / UPLOAD_BATCH_SIZE)} (${uploadBatch.length} điểm)`);
        }
        console.log(`✅ [Bước 2] Nạp ${points.length} điểm dữ liệu thành công!`);
      } catch (error) {
        console.error("❌ [Bước 2] Lỗi khi upload lên Qdrant:", error.message);
        throw error;
      }
    } else {
      console.log("ℹ️  [Bước 2] Không có dữ liệu mới để cập nhật.");
    }

    console.log("\n=== HOÀN TẤT SEEDING SERVICE MAPPER ===\n");
  } catch (error) {
    console.error("\n❌ LỖI KHI NẠP BỘ ÁNH XẠ DỊCH VỤ:", error);
    throw error;
  }
};

// Seed Doctor Mapper
const seedDoctorMapper = async () => {
  try {
    console.log("\n=== BẮT ĐẦU SEEDING DOCTOR MAPPER ===\n");
    
    await initializeCollection(COLLECTION_DOCTOR, "Bộ ánh xạ bác sĩ");
    
    console.log(`[Bước 0] Đang lấy danh sách doctors từ database...`);
    const doctors = await Doctor.find({ isAvailable: { $ne: false } })
      .select('_id user specialtyId hospitalId title description education experience updatedAt')
      .populate('user', 'fullName')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name');
    
    console.log(`[Bước 0] Tìm thấy ${doctors.length} doctors trong database.\n`);
    
    // Get existing points from Qdrant
    let existingPoints = new Map();
    if (!forceUpdate) {
      try {
        const scrollResult = await qdrantClient.scroll(COLLECTION_DOCTOR, {
          limit: 10000,
          with_payload: true,
        });
        scrollResult.points.forEach(point => {
          existingPoints.set(point.id, point.payload);
        });
        console.log(`[Bước 0] Đã tải ${existingPoints.size} điểm dữ liệu hiện có từ Qdrant để so sánh.\n`);
      } catch (error) {
        console.log(`[Bước 0] Không thể tải dữ liệu hiện có (có thể collection mới): ${error.message}\n`);
      }
    }
    
    let points = [];
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < doctors.length; i += BATCH_SIZE) {
      const batch = doctors.slice(i, i + BATCH_SIZE);
      console.log(`[Bước 1] Đang xử lý batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(doctors.length / BATCH_SIZE)} (${i + 1}-${Math.min(i + BATCH_SIZE, doctors.length)}/${doctors.length})...`);
      
      const batchPromises = batch.map(async (doctor) => {
        try {
          const stableId = generateStableId(doctor._id);
          const contentHash = generateContentHash({
            title: doctor.title || '',
            fullName: doctor.user?.fullName || '',
            specialtyId: doctor.specialtyId?._id?.toString() || '',
            specialtyName: doctor.specialtyId?.name || '',
            hospitalId: doctor.hospitalId?._id?.toString() || '',
            hospitalName: doctor.hospitalId?.name || '',
            description: doctor.description || '',
            education: doctor.education || '',
            experience: doctor.experience || 0,
            updatedAt: doctor.updatedAt?.toISOString() || ''
          });
          
          // Check if needs update
          if (!forceUpdate && existingPoints.has(stableId)) {
            const existing = existingPoints.get(stableId);
            if (existing.contentHash === contentHash) {
              skipCount++;
              return null;
            }
          }
          
          // Create searchable text
          const searchText = [
            doctor.title || '',
            doctor.user?.fullName || '',
            doctor.specialtyId?.name || '',
            doctor.hospitalId?.name || '',
            doctor.description || '',
            doctor.education || ''
          ].filter(Boolean).join(' ');
          
          const vector = await getEmbedding(searchText);
          
          return {
            id: stableId,
            vector: vector,
            payload: {
              doctorId: doctor._id.toString(),
              title: doctor.title || '',
              fullName: doctor.user?.fullName || '',
              specialtyId: doctor.specialtyId?._id?.toString() || '',
              specialtyName: doctor.specialtyId?.name || '',
              hospitalId: doctor.hospitalId?._id?.toString() || '',
              hospitalName: doctor.hospitalId?.name || '',
              description: doctor.description || '',
              education: doctor.education || '',
              experience: doctor.experience || 0,
              contentHash: contentHash,
              updatedAt: doctor.updatedAt?.toISOString() || new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`❌ Lỗi khi xử lý doctor "${doctor.user?.fullName || doctor._id}":`, error.message);
          errorCount++;
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validPoints = batchResults.filter(p => p !== null);
      points.push(...validPoints);
      successCount += validPoints.length;
    }
    
    console.log(`\n[Bước 1] Hoàn thành: ${successCount} cần cập nhật, ${skipCount} không thay đổi, ${errorCount} lỗi`);
    
    if (points.length > 0) {
      console.log(`\n[Bước 2] Đang upload ${points.length} điểm dữ liệu lên Qdrant...`);
      try {
        const UPLOAD_BATCH_SIZE = 50;
        for (let i = 0; i < points.length; i += UPLOAD_BATCH_SIZE) {
          const uploadBatch = points.slice(i, i + UPLOAD_BATCH_SIZE);
          await qdrantClient.upsert(COLLECTION_DOCTOR, { wait: true, points: uploadBatch });
          console.log(`  ✅ Đã upload batch ${Math.floor(i / UPLOAD_BATCH_SIZE) + 1}/${Math.ceil(points.length / UPLOAD_BATCH_SIZE)} (${uploadBatch.length} điểm)`);
        }
        console.log(`✅ [Bước 2] Nạp ${points.length} điểm dữ liệu thành công!`);
      } catch (error) {
        console.error("❌ [Bước 2] Lỗi khi upload lên Qdrant:", error.message);
        throw error;
      }
    } else {
      console.log("ℹ️  [Bước 2] Không có dữ liệu mới để cập nhật.");
    }

    console.log("\n=== HOÀN TẤT SEEDING DOCTOR MAPPER ===\n");
  } catch (error) {
    console.error("\n❌ LỖI KHI NẠP BỘ ÁNH XẠ BÁC SĨ:", error);
    throw error;
  }
};

// Main function
const seedMapper = async () => {
  try {
    console.log(`\n🚀 BẮT ĐẦU SEEDING MAPPER (Type: ${seedType}, Force: ${forceUpdate})\n`);
    
    // Connect to MongoDB
    console.log(`[Init] Đang kết nối MongoDB...`);
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalweb';
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log("✅ [Init] Đã kết nối MongoDB thành công!\n");
    
    // Seed based on type
    if (seedType === 'all' || seedType === 'specialty') {
      await seedSpecialtyMapper();
    }
    
    if (seedType === 'all' || seedType === 'service') {
      await seedServiceMapper();
    }
    
    if (seedType === 'all' || seedType === 'doctor') {
      await seedDoctorMapper();
    }
    
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("✅ Đã đóng kết nối MongoDB.");
    console.log("\n🎉 HOÀN TẤT TẤT CẢ SEEDING!\n");
    
  } catch (error) {
    console.error("\n❌ LỖI KHI NẠP BỘ ÁNH XẠ:", error);
    console.error("Chi tiết lỗi:", error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// Show usage if help requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📖 HƯỚNG DẪN SỬ DỤNG:

  node seedSpecialtyMapper.js [type] [options]

Loại seed:
  all        - Seed tất cả (specialty, service, doctor) [mặc định]
  specialty  - Chỉ seed specialty mapper
  service    - Chỉ seed service mapper
  doctor     - Chỉ seed doctor mapper

Tùy chọn:
  --force, -f  - Force update tất cả records (bỏ qua kiểm tra thay đổi)
  --help, -h   - Hiển thị hướng dẫn này

Ví dụ:
  node seedSpecialtyMapper.js                    # Seed tất cả
  node seedSpecialtyMapper.js service            # Chỉ seed services
  node seedSpecialtyMapper.js doctor --force    # Force update doctors
  node seedSpecialtyMapper.js all -f             # Force update tất cả

Lưu ý:
  - Script sẽ tự động kiểm tra và chỉ cập nhật những records đã thay đổi
  - Sử dụng --force để cập nhật tất cả records (chậm hơn)
  - Dữ liệu service và doctor được cập nhật dựa trên contentHash
  
  📝 CẬP NHẬT MAPPING:
  - Services/Doctors: Tự động từ database, chỉ cần chạy script (KHÔNG cần sửa file)
  - Specialty mappings: Sửa file server/scripts/specialtyMappings.json rồi chạy script
  
  Xem thêm: server/scripts/README_SEEDING.md
  `);
  process.exit(0);
}

seedMapper();
