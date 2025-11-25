const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SpecialtyMapping = require('../models/SpecialtyMapping');
const Specialty = require('../models/Specialty');
const mappingsFile = require('./specialtyMappings.json');

async function importMappings() {
  try {
    console.log('\n=== BẮT ĐẦU IMPORT MAPPINGS TỪ JSON ===\n');
    
    // Connect MongoDB
    console.log('[Init] Đang kết nối MongoDB...');
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalweb';
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    console.log('✅ [Init] Đã kết nối MongoDB thành công!\n');
    
    // Get all specialties
    const specialties = await Specialty.find({ isActive: { $ne: false } }).select('_id name');
    const specialtyMap = {};
    specialties.forEach(s => {
      specialtyMap[s.name] = s._id.toString();
    });
    
    console.log(`[Bước 1] Đã tải ${specialties.length} specialties từ database\n`);
    
    // Get existing mappings
    const existingMappings = await SpecialtyMapping.find({ isActive: { $ne: false } }).select('text');
    const existingTexts = new Set(existingMappings.map(m => m.text.toLowerCase().trim()));
    console.log(`[Bước 2] Đã có ${existingTexts.size} mappings trong database\n`);
    
    // Process mappings from JSON
    const mappings = mappingsFile.mappings || [];
    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`[Bước 3] Đang xử lý ${mappings.length} mappings từ file JSON...\n`);
    
    for (const mapping of mappings) {
      try {
        const text = mapping.text.trim();
        const specialtyName = mapping.specialtyName;
        
        // Check if already exists
        if (existingTexts.has(text.toLowerCase())) {
          skippedCount++;
          continue;
        }
        
        // Check if specialty exists
        const specialtyId = specialtyMap[specialtyName];
        if (!specialtyId) {
          console.warn(`⚠️  Bỏ qua: Không tìm thấy specialty "${specialtyName}" cho mapping "${text}"`);
          errorCount++;
          continue;
        }
        
        // Create new mapping
        const newMapping = new SpecialtyMapping({
          text: text,
          specialtyId: specialtyId,
          specialtyName: specialtyName,
          isActive: true,
          note: mapping.note || undefined
        });
        
        await newMapping.save();
        existingTexts.add(text.toLowerCase()); // Add to set to avoid duplicates in same batch
        addedCount++;
        console.log(`✅ Đã thêm: "${text}" -> ${specialtyName}`);
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error (unique constraint)
          skippedCount++;
          console.log(`⏭️  Bỏ qua (đã tồn tại): "${mapping.text}"`);
        } else {
          errorCount++;
          console.error(`❌ Lỗi khi thêm "${mapping.text}":`, error.message);
        }
      }
    }
    
    console.log(`\n=== KẾT QUẢ ===`);
    console.log(`✅ Đã thêm: ${addedCount} mappings`);
    console.log(`⏭️  Đã bỏ qua (đã tồn tại): ${skippedCount} mappings`);
    console.log(`❌ Lỗi: ${errorCount} mappings`);
    console.log(`\n=== HOÀN TẤT IMPORT ===\n`);
    
    // Close connection
    await mongoose.disconnect();
    console.log('✅ Đã đóng kết nối MongoDB.');
    
  } catch (error) {
    console.error('\n❌ LỖI KHI IMPORT MAPPINGS:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

importMappings();

