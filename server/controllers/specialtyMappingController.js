const SpecialtyMapping = require('../models/SpecialtyMapping');
const Specialty = require('../models/Specialty');
const asyncHandler = require('../middlewares/async');
const qdrantService = require('../services/qdrantService');

/**
 * @route   GET /api/admin/specialty-mappings
 * @desc    Lấy danh sách specialty mappings
 * @access  Admin
 */
exports.getSpecialtyMappings = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
  const search = req.query.search || '';
  const specialtyId = req.query.specialtyId;

  const filter = { isActive: { $ne: false } };
  
  if (search) {
    filter.text = { $regex: search, $options: 'i' };
  }
  
  if (specialtyId) {
    filter.specialtyId = specialtyId;
  }

  const [mappings, total] = await Promise.all([
    SpecialtyMapping.find(filter)
      .populate('specialtyId', 'name')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ priority: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SpecialtyMapping.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      mappings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * @route   GET /api/admin/specialty-mappings/:id
 * @desc    Lấy chi tiết một mapping
 * @access  Admin
 */
exports.getSpecialtyMapping = asyncHandler(async (req, res) => {
  const mapping = await SpecialtyMapping.findById(req.params.id)
    .populate('specialtyId', 'name')
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email');

  if (!mapping) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy mapping'
    });
  }

  res.json({
    success: true,
    data: mapping
  });
});

/**
 * @route   POST /api/admin/specialty-mappings
 * @desc    Tạo mapping mới
 * @access  Admin
 */
exports.createSpecialtyMapping = asyncHandler(async (req, res) => {
  const { text, specialtyId, priority, note } = req.body;

  if (!text || !specialtyId) {
    return res.status(400).json({
      success: false,
      message: 'Thiếu thông tin bắt buộc: text, specialtyId'
    });
  }

  // Kiểm tra specialty có tồn tại không
  const specialty = await Specialty.findById(specialtyId);
  if (!specialty) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy chuyên khoa'
    });
  }

  // Kiểm tra mapping đã tồn tại chưa
  const existing = await SpecialtyMapping.findOne({ text: text.trim() });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: `Mapping "${text}" đã tồn tại`
    });
  }

  const mapping = await SpecialtyMapping.create({
    text: text.trim(),
    specialtyId,
    specialtyName: specialty.name,
    priority: priority || 0,
    note,
    createdBy: req.user.id,
    updatedBy: req.user.id
  });

  // Tự động seed vào Qdrant
  try {
    await seedMappingToQdrant(mapping);
  } catch (error) {
    console.error('Error seeding mapping to Qdrant:', error);
    // Không fail request, chỉ log error
  }

  res.status(201).json({
    success: true,
    message: 'Đã tạo mapping thành công',
    data: mapping
  });
});

/**
 * @route   PUT /api/admin/specialty-mappings/:id
 * @desc    Cập nhật mapping (ví dụ: đổi "khám tổng quát" từ Nội khoa sang Ngoại khoa)
 * @access  Admin
 */
exports.updateSpecialtyMapping = asyncHandler(async (req, res) => {
  const { specialtyId, priority, note, isActive } = req.body;

  const mapping = await SpecialtyMapping.findById(req.params.id);
  if (!mapping) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy mapping'
    });
  }

  // Nếu thay đổi specialtyId
  if (specialtyId && specialtyId.toString() !== mapping.specialtyId.toString()) {
    const specialty = await Specialty.findById(specialtyId);
    if (!specialty) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chuyên khoa'
      });
    }
    mapping.specialtyId = specialtyId;
    mapping.specialtyName = specialty.name;
  }

  if (priority !== undefined) mapping.priority = priority;
  if (note !== undefined) mapping.note = note;
  if (isActive !== undefined) mapping.isActive = isActive;
  mapping.updatedBy = req.user.id;

  await mapping.save();

  // Tự động cập nhật Qdrant
  try {
    await seedMappingToQdrant(mapping);
  } catch (error) {
    console.error('Error updating mapping in Qdrant:', error);
  }

  res.json({
    success: true,
    message: 'Đã cập nhật mapping thành công',
    data: mapping
  });
});

/**
 * @route   DELETE /api/admin/specialty-mappings/:id
 * @desc    Xóa mapping (soft delete)
 * @access  Admin
 */
exports.deleteSpecialtyMapping = asyncHandler(async (req, res) => {
  const mapping = await SpecialtyMapping.findById(req.params.id);
  if (!mapping) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy mapping'
    });
  }

  mapping.isActive = false;
  mapping.updatedBy = req.user.id;
  await mapping.save();

  // TODO: Có thể xóa khỏi Qdrant hoặc để đó (không ảnh hưởng nhiều)

  res.json({
    success: true,
    message: 'Đã xóa mapping thành công'
  });
});

/**
 * @route   POST /api/admin/specialty-mappings/seed-to-qdrant
 * @desc    Seed tất cả mappings vào Qdrant (sau khi thay đổi)
 * @access  Admin
 */
exports.seedMappingsToQdrant = asyncHandler(async (req, res) => {
  const mappings = await SpecialtyMapping.find({ isActive: { $ne: false } })
    .populate('specialtyId', 'name');

  let successCount = 0;
  let errorCount = 0;

  for (const mapping of mappings) {
    try {
      await seedMappingToQdrant(mapping);
      successCount++;
    } catch (error) {
      console.error(`Error seeding mapping "${mapping.text}":`, error);
      errorCount++;
    }
  }

  res.json({
    success: true,
    message: `Đã seed ${successCount} mappings vào Qdrant${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`,
    data: {
      successCount,
      errorCount,
      total: mappings.length
    }
  });
});

/**
 * Helper function: Seed một mapping vào Qdrant
 */
async function seedMappingToQdrant(mapping) {
  const { getEmbedding } = require('../services/embeddingService');
  const { QdrantClient } = require("@qdrant/js-client-rest");
  const crypto = require('crypto');
  
  const QDRANT_URL = (process.env.QDRANT_URL || 'http://localhost:6333').trim().replace(/^['"]+|['"]+$/g, '');
  const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  const qdrantClient = new QdrantClient({ 
    url: QDRANT_URL, 
    apiKey: QDRANT_API_KEY 
  });

  const COLLECTION_SPECIALTY = "specialty_mapper";
  
  const vector = await getEmbedding(mapping.text);
  // Convert MD5 hash to UUID format for Qdrant compatibility
  const hash = crypto.createHash('md5').update(mapping.text).digest('hex');
  const stableId = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  
  const contentHash = crypto.createHash('md5')
    .update(JSON.stringify({ text: mapping.text, specialtyId: mapping.specialtyId.toString() }))
    .digest('hex');

  await qdrantClient.upsert(COLLECTION_SPECIALTY, {
    wait: true,
    points: [{
      id: stableId,
      vector: vector,
      payload: {
        specialtyId: mapping.specialtyId.toString(),
        specialtyName: mapping.specialtyName,
        text: mapping.text,
        contentHash: contentHash
      }
    }]
  });
}

