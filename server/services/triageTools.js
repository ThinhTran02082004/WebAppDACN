const { getEmbedding } = require('./embeddingService');
const qdrantService = require('./qdrantService');
const Specialty = require('../models/Specialty');

/**
 * Phát hiện các trường hợp cấp cứu dựa trên triệu chứng
 * @param {string} symptomsText - Mô tả triệu chứng
 * @returns {Object} - { isEmergency: boolean, reason: string }
 */
const detectEmergency = (symptomsText) => {
  if (!symptomsText) {
    return { isEmergency: false, reason: null };
  }

  const lowerText = symptomsText.toLowerCase();
  
  // Các từ khóa cấp cứu
  const emergencyKeywords = [
    'đau ngực dữ dội', 'đau tim', 'nhồi máu cơ tim', 'suy tim',
    'khó thở nặng', 'thở gấp', 'thở nhanh', 'ngạt thở',
    'ngất xỉu', 'bất tỉnh', 'mất ý thức',
    'chảy máu nhiều', 'xuất huyết', 'chảy máu không cầm',
    'sốc', 'sốc phản vệ', 'phản vệ',
    'co giật', 'động kinh',
    'đau bụng dữ dội', 'viêm ruột thừa', 'thủng dạ dày',
    'tai nạn', 'chấn thương nặng', 'gãy xương', 'bỏng nặng',
    'ngộ độc', 'uống nhầm thuốc', 'uống nhầm hóa chất',
    'đột quỵ', 'tai biến mạch máu não', 'liệt nửa người',
    'sốt cao trên 40', 'sốt rất cao'
  ];

  for (const keyword of emergencyKeywords) {
    if (lowerText.includes(keyword)) {
      return {
        isEmergency: true,
        reason: `Phát hiện triệu chứng cấp cứu: ${keyword}`
      };
    }
  }

  return { isEmergency: false, reason: null };
};

/**
 * Chọn department tốt nhất từ kết quả vector search
 * @param {Array} mappings - Kết quả từ Qdrant search
 * @param {number} age - Tuổi (optional)
 * @param {string} gender - Giới tính (optional)
 * @returns {Object} - { department: string, riskLevel: string, reason: string }
 */
const pickBestDepartment = (mappings, age = null, gender = null) => {
  if (!mappings || mappings.length === 0) {
    return {
      department: 'Nội khoa', // Default fallback
      riskLevel: 'normal',
      reason: 'Không tìm thấy mapping phù hợp, đề xuất khoa Nội khoa (tổng quát)'
    };
  }

  // Lấy mapping có score cao nhất
  const bestMapping = mappings[0];
  const department = bestMapping.payload?.specialtyName || 'Nội khoa';
  const score = bestMapping.score || 0;

  // Xác định risk level dựa trên score
  let riskLevel = 'normal';
  if (score >= 0.9) {
    riskLevel = 'urgent';
  } else if (score >= 0.95) {
    riskLevel = 'emergency';
  }

  // Có thể thêm logic điều chỉnh dựa trên age/gender nếu cần
  // Ví dụ: trẻ em < 5 tuổi → Nhi khoa
  if (age && age < 5 && department !== 'Nhi khoa') {
    return {
      department: 'Nhi khoa',
      riskLevel: 'normal',
      reason: `Bệnh nhân dưới 5 tuổi, đề xuất khám Nhi khoa. (Mapping gốc: ${department})`
    };
  }

  return {
    department,
    riskLevel,
    reason: `Dựa trên vector similarity (score: ${score.toFixed(3)}) với specialty_mappings`
  };
};

/**
 * Tool: Phân loại triệu chứng để đề xuất chuyên khoa
 * @param {Object} params - { symptomsText: string, age?: number, gender?: string }
 * @returns {Promise<Object>} - { department: string, riskLevel: string, reason: string }
 */
const triageSpecialty = async ({ symptomsText, age = null, gender = null }) => {
  try {
    if (!symptomsText || typeof symptomsText !== 'string' || symptomsText.trim().length === 0) {
      return {
        error: 'symptomsText is required and must be a non-empty string'
      };
    }

    console.log(`[Triage] Đang phân loại triệu chứng: "${symptomsText.substring(0, 100)}..."`);

    // 1. Kiểm tra cấp cứu trước
    const emergencyCheck = detectEmergency(symptomsText);
    if (emergencyCheck.isEmergency) {
      console.log(`[Triage] ⚠️ PHÁT HIỆN CẤP CỨU: ${emergencyCheck.reason}`);
      return {
        department: 'Khoa Cấp cứu',
        riskLevel: 'emergency',
        reason: emergencyCheck.reason
      };
    }

    // 2. Lấy embedding của symptomsText
    const embedding = await getEmbedding(symptomsText);
    if (!embedding || embedding.length === 0) {
      console.error('[Triage] Không thể tạo embedding cho symptomsText');
      return {
        department: 'Nội khoa',
        riskLevel: 'normal',
        reason: 'Lỗi khi tạo embedding, đề xuất khoa Nội khoa (tổng quát)'
      };
    }

    // 3. Vector search trong Qdrant: specialty_mappings
    // Sử dụng hàm findSpecialtyMapping từ qdrantService
    const mapping = await qdrantService.findSpecialtyMapping(symptomsText);
    
    if (mapping && mapping.specialtyName) {
      console.log(`[Triage] ✅ Tìm thấy mapping: "${mapping.specialtyName}" (ID: ${mapping.specialtyId})`);
      
      // Xác định risk level (có thể điều chỉnh logic này)
      let riskLevel = 'normal';
      if (emergencyCheck.isEmergency) {
        riskLevel = 'emergency';
      }

      return {
        department: mapping.specialtyName,
        departmentId: mapping.specialtyId,
        riskLevel,
        reason: `Dựa trên vector search trong specialty_mappings`
      };
    }

    // 4. Fallback: Nếu không tìm thấy mapping, sử dụng logic manual
    console.log(`[Triage] Không tìm thấy mapping trong Qdrant, sử dụng fallback logic`);
    
    const fallbackResult = pickBestDepartment([], age, gender);
    return fallbackResult;

  } catch (error) {
    console.error('[Triage] Lỗi khi phân loại triệu chứng:', error);
    return {
      department: 'Nội khoa',
      riskLevel: 'normal',
      reason: `Lỗi khi phân loại: ${error.message}. Đề xuất khoa Nội khoa (tổng quát)`
    };
  }
};

module.exports = {
  triageSpecialty,
  detectEmergency,
  pickBestDepartment
};

