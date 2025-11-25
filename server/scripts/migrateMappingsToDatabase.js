/**
 * Script migration: Import mappings từ JSON file vào database
 * Chạy một lần để migrate dữ liệu từ file sang database
 * 
 * Usage: node server/scripts/migrateMappingsToDatabase.js
 */

const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SpecialtyMapping = require('../models/SpecialtyMapping');
const Specialty = require('../models/Specialty');

async function migrateMappings() {
  try {
    console.log('\n=== BẮT ĐẦU MIGRATION MAPPINGS ===\n');
    
    // Connect MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalweb';
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log('✅ Đã kết nối MongoDB\n');
    
    // Load mappings từ JSON file
    let mappingsFromFile = [];
    try {
      const mappingsFile = require('./specialtyMappings.json');
      mappingsFromFile = mappingsFile.mappings || [];
      console.log(`📄 Đã tải ${mappingsFromFile.length} mappings từ file\n`);
    } catch (error) {
      console.error('❌ Không thể tải specialtyMappings.json:', error.message);
      process.exit(1);
    }
    
    // Lấy danh sách specialties
    const specialties = await Specialty.find({ isActive: { $ne: false } });
    const specialtyMap = {};
    specialties.forEach(s => {
      specialtyMap[s.name] = s._id;
    });
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const mapping of mappingsFromFile) {
      try {
        const specialtyId = specialtyMap[mapping.specialtyName];
        
        if (!specialtyId) {
          console.warn(`⚠️  Không tìm thấy specialty "${mapping.specialtyName}", bỏ qua: "${mapping.text}"`);
          skippedCount++;
          continue;
        }
        
        // Kiểm tra mapping đã tồn tại chưa
        const existing = await SpecialtyMapping.findOne({ text: mapping.text.trim() });
        
        if (existing) {
          // Update nếu specialty khác
          if (existing.specialtyId.toString() !== specialtyId.toString()) {
            existing.specialtyId = specialtyId;
            existing.specialtyName = mapping.specialtyName;
            existing.isActive = true;
            await existing.save();
            updatedCount++;
            console.log(`🔄 Đã cập nhật: "${mapping.text}" -> ${mapping.specialtyName}`);
          } else {
            skippedCount++;
            console.log(`⏭️  Đã tồn tại: "${mapping.text}"`);
          }
        } else {
          // Tạo mới
          await SpecialtyMapping.create({
            text: mapping.text.trim(),
            specialtyId: specialtyId,
            specialtyName: mapping.specialtyName,
            note: mapping.note || '',
            isActive: true
          });
          createdCount++;
          console.log(`✅ Đã tạo: "${mapping.text}" -> ${mapping.specialtyName}`);
        }
      } catch (error) {
        console.error(`❌ Lỗi khi xử lý "${mapping.text}":`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n=== KẾT QUẢ MIGRATION ===`);
    console.log(`✅ Đã tạo: ${createdCount}`);
    console.log(`🔄 Đã cập nhật: ${updatedCount}`);
    console.log(`⏭️  Đã bỏ qua: ${skippedCount}`);
    console.log(`❌ Lỗi: ${errorCount}`);
    console.log(`📊 Tổng cộng: ${mappingsFromFile.length}\n`);
    
    await mongoose.disconnect();
    console.log('✅ Đã đóng kết nối MongoDB');
    console.log('\n🎉 HOÀN TẤT MIGRATION!\n');
    
  } catch (error) {
    console.error('\n❌ LỖI MIGRATION:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

migrateMappings();

