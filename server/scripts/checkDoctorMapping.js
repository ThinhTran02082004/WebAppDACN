const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Specialty = require('../models/Specialty');
const Hospital = require('../models/Hospital');
const { QdrantClient } = require("@qdrant/js-client-rest");
const { getEmbedding } = require('../services/embeddingService');
const crypto = require('crypto');

// Cấu hình Qdrant
let QDRANT_URL = (process.env.QDRANT_URL || 'http://localhost:6333').trim();
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
QDRANT_URL = QDRANT_URL.replace(/^['"]+|['"]+$/g, '').trim();
if (!/^https?:\/\//i.test(QDRANT_URL)) {
  QDRANT_URL = `http://${QDRANT_URL}`;
}

const qdrantClient = new QdrantClient({ 
  url: QDRANT_URL, 
  apiKey: QDRANT_API_KEY 
});

const COLLECTION_DOCTOR = "doctor_mapper";

// Helper function to generate stable ID
const generateStableId = (input) => {
  const hash = crypto.createHash('md5').update(input.toString()).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
};

const checkDoctorMapping = async () => {
  try {
    console.log('Connecting to MongoDB...');
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalweb';
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully\n');

    // Tìm bác sĩ "Nguyễn Quốc Duy"
    const doctorName = 'Nguyễn Quốc Duy';
    const doctorUser = await User.findOne({
      fullName: { $regex: new RegExp(doctorName.replace(/\s+/g, '.*'), 'i') },
      roleType: 'doctor'
    });

    if (!doctorUser) {
      console.log(`❌ Không tìm thấy bác sĩ "${doctorName}" trong database`);
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Tìm thấy bác sĩ: ${doctorUser.fullName} (ID: ${doctorUser._id})`);

    // Tìm thông tin Doctor
    const doctor = await Doctor.findOne({ user: doctorUser._id })
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name')
      .populate('user', 'fullName');

    if (!doctor) {
      console.log(`❌ Không tìm thấy thông tin Doctor cho ${doctorUser.fullName}`);
      await mongoose.disconnect();
      return;
    }

    console.log('\n=== THÔNG TIN BÁC SĨ TRONG DATABASE ===');
    console.log(`Tên: ${doctor.user?.fullName || 'N/A'}`);
    console.log(`Chức danh: ${doctor.title || 'N/A'}`);
    console.log(`Chuyên khoa: ${doctor.specialtyId?.name || 'N/A'} (ID: ${doctor.specialtyId?._id || 'N/A'})`);
    console.log(`Bệnh viện: ${doctor.hospitalId?.name || 'N/A'}`);
    console.log(`Mô tả: ${doctor.description || 'N/A'}`);
    console.log(`Học vấn: ${doctor.education || 'N/A'}`);

    // Kiểm tra trong Qdrant
    console.log('\n=== KIỂM TRA TRONG QDRANT ===');
    const stableId = generateStableId(doctor._id);
    
    try {
      const searchResult = await qdrantClient.search(COLLECTION_DOCTOR, {
        vector: await getEmbedding(doctorName),
        limit: 5,
        with_payload: true,
        score_threshold: 0.7
      });

      console.log(`Tìm thấy ${searchResult.length} kết quả trong Qdrant:`);
      searchResult.forEach((result, index) => {
        console.log(`\n${index + 1}. Score: ${result.score.toFixed(3)}`);
        console.log(`   Doctor ID: ${result.payload.doctorId}`);
        console.log(`   Tên: ${result.payload.fullName}`);
        console.log(`   Chuyên khoa: ${result.payload.specialtyName} (ID: ${result.payload.specialtyId})`);
        console.log(`   Bệnh viện: ${result.payload.hospitalName}`);
        
        if (result.payload.doctorId === doctor._id.toString()) {
          console.log(`   ✅ Đây là bác sĩ cần tìm!`);
          if (result.payload.specialtyName !== doctor.specialtyId?.name) {
            console.log(`   ⚠️  CHUYÊN KHOA KHÔNG KHỚP!`);
            console.log(`      Database: ${doctor.specialtyId?.name}`);
            console.log(`      Qdrant: ${result.payload.specialtyName}`);
          } else {
            console.log(`   ✅ Chuyên khoa khớp với database`);
          }
        }
      });

      // Tìm điểm chính xác bằng ID
      try {
        const point = await qdrantClient.retrieve(COLLECTION_DOCTOR, {
          ids: [stableId]
        });
        
        if (point && point.length > 0) {
          console.log(`\n=== THÔNG TIN CHÍNH XÁC TRONG QDRANT (theo ID) ===`);
          const payload = point[0].payload;
          console.log(`Doctor ID: ${payload.doctorId}`);
          console.log(`Tên: ${payload.fullName}`);
          console.log(`Chức danh: ${payload.title}`);
          console.log(`Chuyên khoa: ${payload.specialtyName} (ID: ${payload.specialtyId})`);
          console.log(`Bệnh viện: ${payload.hospitalName}`);
          
          if (payload.specialtyName !== doctor.specialtyId?.name) {
            console.log(`\n❌ PHÁT HIỆN MAPPING SAI!`);
            console.log(`   Database: ${doctor.specialtyId?.name}`);
            console.log(`   Qdrant: ${payload.specialtyName}`);
            console.log(`\n💡 Cần re-seed doctor mapper để sửa lỗi này.`);
            console.log(`   Chạy: node server/scripts/seedSpecialtyMapper.js doctor --force`);
          } else {
            console.log(`\n✅ Mapping chính xác!`);
          }
        } else {
          console.log(`\n⚠️  Không tìm thấy điểm dữ liệu với ID ${stableId} trong Qdrant`);
          console.log(`   Cần seed lại doctor mapper.`);
        }
      } catch (error) {
        console.log(`\n⚠️  Không thể retrieve điểm dữ liệu: ${error.message}`);
      }

    } catch (error) {
      console.error(`\n❌ Lỗi khi tìm kiếm trong Qdrant:`, error.message);
    }

  } catch (error) {
    console.error('Lỗi:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nĐã đóng kết nối MongoDB');
  }
};

checkDoctorMapping();

