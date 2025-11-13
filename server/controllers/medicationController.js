const Medication = require('../models/Medication');
const mongoose = require('mongoose');

// Get all medications with pagination and filtering
exports.getMedications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const hospitalId = req.query.hospitalId;
    
    let query = { isActive: true };
    
    // Filter by hospitalId
    // - Admin: can filter by hospitalId query param or no filter
    // - Doctor: filter by doctor.hospitalId
    // - Pharmacist: filter by user.hospitalId
    const userRole = req.user?.roleType || req.user?.role;
    
    if (userRole === 'doctor') {
      const Doctor = require('../models/Doctor');
      const doctor = await Doctor.findOne({ user: req.user.id });
      if (doctor && doctor.hospitalId) {
        query.hospitalId = doctor.hospitalId;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin bác sĩ hoặc chi nhánh'
        });
      }
    } else if (userRole === 'pharmacist') {
      const user = await require('../models/User').findById(req.user.id);
      if (user && user.hospitalId) {
        query.hospitalId = user.hospitalId;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Dược sĩ chưa được gán vào chi nhánh'
        });
      }
    } else if (userRole === 'admin' && hospitalId) {
      // Admin can filter by hospitalId query param
      query.hospitalId = hospitalId;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add category filter if provided
    if (category && category !== 'all') {
      query.category = category;
    }
    
    const total = await Medication.countDocuments(query);
    const medications = await Medication.find(query)
      .populate('hospitalId', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    return res.status(200).json({
      success: true,
      data: {
        docs: medications,
        totalDocs: total,
        totalPages: Math.ceil(total / limit),
        page,
        limit
      },
      message: 'Lấy danh sách thuốc thành công'
    });
  } catch (error) {
    console.error('Get medications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách thuốc',
      error: error.message
    });
  }
};

// Get medication by ID
exports.getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID thuốc không hợp lệ'
      });
    }
    
    const medication = await Medication.findById(id)
      .populate('hospitalId', 'name address');
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin thuốc'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: medication,
      message: 'Lấy thông tin thuốc thành công'
    });
  } catch (error) {
    console.error('Get medication by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin thuốc',
      error: error.message
    });
  }
};

// Create a new medication
exports.createMedication = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      defaultDosage,
      defaultUsage,
      defaultDuration,
      sideEffects,
      contraindications,
      manufacturer,
      unitType,
      unitTypeDisplay,
      stockQuantity,
      lowStockThreshold,
      hospitalId
    } = req.body;
    
    // Validation
    if (!name || !category || !hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (tên, danh mục và chi nhánh)'
      });
    }
    
    // Validate hospitalId exists
    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(400).json({
        success: false,
        message: 'Chi nhánh không hợp lệ'
      });
    }
    
    // Check if medication with the same name already exists in the same hospital
    const existingMedication = await Medication.findOne({ name, hospitalId });
    if (existingMedication) {
      return res.status(400).json({
        success: false,
        message: 'Thuốc với tên này đã tồn tại trong chi nhánh này'
      });
    }
    
    // Create new medication
    const newMedication = new Medication({
      name,
      description,
      category,
      defaultDosage,
      defaultUsage,
      defaultDuration,
      sideEffects,
      contraindications,
      manufacturer,
      unitType,
      unitTypeDisplay,
      stockQuantity: stockQuantity !== undefined ? stockQuantity : 0,
      lowStockThreshold: lowStockThreshold !== undefined ? lowStockThreshold : 10,
      hospitalId,
      createdBy: req.user ? req.user.id : undefined
    });
    
    await newMedication.save();
    
    const populatedMedication = await Medication.findById(newMedication._id)
      .populate('hospitalId', 'name address');
    
    return res.status(201).json({
      success: true,
      data: populatedMedication,
      message: 'Tạo thuốc mới thành công'
    });
  } catch (error) {
    console.error('Create medication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo thuốc mới',
      error: error.message
    });
  }
};

// Update medication
exports.updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID thuốc không hợp lệ'
      });
    }
    
    // Check if medication exists
    const medication = await Medication.findById(id);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin thuốc'
      });
    }
    
    // Prevent changing hospitalId
    if (updateData.hospitalId && updateData.hospitalId.toString() !== medication.hospitalId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể thay đổi chi nhánh của thuốc'
      });
    }
    
    // Remove hospitalId from updateData if present (to prevent accidental changes)
    delete updateData.hospitalId;
    
    // Check if user is trying to update to a name that already exists in the same hospital
    if (updateData.name && updateData.name !== medication.name) {
      const existingMedication = await Medication.findOne({ 
        name: updateData.name,
        hospitalId: medication.hospitalId,
        _id: { $ne: id }
      });
      
      if (existingMedication) {
        return res.status(400).json({
          success: false,
          message: 'Thuốc với tên này đã tồn tại trong chi nhánh này'
        });
      }
    }
    
    // Update medication
    const updatedMedication = await Medication.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('hospitalId', 'name address');
    
    return res.status(200).json({
      success: true,
      data: updatedMedication,
      message: 'Cập nhật thuốc thành công'
    });
  } catch (error) {
    console.error('Update medication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật thuốc',
      error: error.message
    });
  }
};

// Delete medication (soft delete)
exports.deleteMedication = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID thuốc không hợp lệ'
      });
    }
    
    // Check if medication exists
    const medication = await Medication.findById(id);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin thuốc'
      });
    }

    // Validate medication có đủ thông tin cần thiết trước khi save
    // Xử lý cả trường hợp hospitalId đã được populated
    const medicationHospitalId = medication.hospitalId?._id || medication.hospitalId;
    if (!medicationHospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Thuốc này không có thông tin chi nhánh, không thể xóa'
      });
    }

    // Kiểm tra xem medication có đang được sử dụng trong prescriptions chưa được hủy không
    const Prescription = require('../models/Prescription');
    const activePrescriptions = await Prescription.find({
      'medications.medicationId': id,
      status: { $nin: ['cancelled', 'completed'] }
    }).limit(1);

    if (activePrescriptions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa thuốc đang được sử dụng trong đơn thuốc đang xử lý'
      });
    }

    // Kiểm tra xem medication có đang được sử dụng trong prescription templates không
    const PrescriptionTemplate = require('../models/PrescriptionTemplate');
    const templatesUsingMedication = await PrescriptionTemplate.find({
      'medications.medicationId': id,
      isActive: true
    }).limit(1);

    if (templatesUsingMedication.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa thuốc đang được sử dụng trong đơn thuốc mẫu'
      });
    }
    
    // Soft delete by marking as inactive
    // Sử dụng findByIdAndUpdate để tránh validation issues
    await Medication.findByIdAndUpdate(
      id,
      { isActive: false },
      { runValidators: false } // Disable validators for soft delete
    );
    
    return res.status(200).json({
      success: true,
      message: 'Xóa thuốc thành công'
    });
  } catch (error) {
    console.error('Delete medication error:', error);
    // Log chi tiết lỗi để debug
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      errors: error.errors
    });
    
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa thuốc',
      error: error.message
    });
  }
};

// Get medication categories
exports.getMedicationCategories = async (req, res) => {
  try {
    const categories = [
      { id: 'pain-relief', name: 'Giảm đau', description: 'Thuốc giảm đau, hạ sốt' },
      { id: 'gastrointestinal', name: 'Dạ dày', description: 'Thuốc điều trị các vấn đề về dạ dày, đường ruột' },
      { id: 'antibiotic', name: 'Kháng sinh', description: 'Thuốc kháng sinh' },
      { id: 'antiviral', name: 'Kháng virus', description: 'Thuốc kháng virus' },
      { id: 'antihistamine', name: 'Kháng histamine', description: 'Thuốc chống dị ứng' },
      { id: 'cardiovascular', name: 'Tim mạch', description: 'Thuốc điều trị các vấn đề về tim mạch' },
      { id: 'respiratory', name: 'Hô hấp', description: 'Thuốc điều trị các vấn đề về hô hấp' },
      { id: 'neurological', name: 'Thần kinh', description: 'Thuốc điều trị các vấn đề về thần kinh' },
      { id: 'other', name: 'Khác', description: 'Các loại thuốc khác' }
    ];
    
    return res.status(200).json({
      success: true,
      data: categories,
      message: 'Lấy danh sách danh mục thuốc thành công'
    });
  } catch (error) {
    console.error('Get medication categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách danh mục thuốc',
      error: error.message
    });
  }
};

// Reduce stock for multiple medications
exports.reduceStock = async (req, res) => {
  try {
    const { medications } = req.body;
    
    if (!medications || !Array.isArray(medications)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp danh sách thuốc hợp lệ'
      });
    }
    
    const results = [];
    
    for (const item of medications) {
      try {
        const { medicationId, quantity } = item;
        
        if (!medicationId || !quantity || quantity <= 0) {
          results.push({
            success: false,
            medicationId,
            message: 'ID thuốc hoặc số lượng không hợp lệ'
          });
          continue;
        }
        
        const medication = await Medication.findById(medicationId);
        
        if (!medication) {
          results.push({
            success: false,
            medicationId,
            message: 'Không tìm thấy thuốc'
          });
          continue;
        }
        
        if (medication.stockQuantity < quantity) {
          results.push({
            success: false,
            medicationId,
            message: `Số lượng thuốc không đủ. Hiện chỉ còn ${medication.stockQuantity} ${medication.unitTypeDisplay}`
          });
          continue;
        }
        
        medication.stockQuantity -= quantity;
        await medication.save();
        
        results.push({
          success: true,
          medicationId,
          name: medication.name,
          newQuantity: medication.stockQuantity,
          message: 'Cập nhật tồn kho thành công'
        });
      } catch (error) {
        console.error(`Error processing medication ${item.medicationId}:`, error);
        results.push({
          success: false,
          medicationId: item.medicationId,
          message: 'Lỗi khi xử lý thuốc: ' + error.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      data: results,
      message: 'Cập nhật tồn kho thành công'
    });
  } catch (error) {
    console.error('Reduce stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật tồn kho thuốc',
      error: error.message
    });
  }
};

// Add stock for multiple medications (when medications are removed from a prescription)
exports.addStock = async (req, res) => {
  try {
    const { medications } = req.body;
    
    if (!medications || !Array.isArray(medications)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp danh sách thuốc hợp lệ'
      });
    }
    
    const results = [];
    
    for (const item of medications) {
      try {
        const { medicationId, quantity } = item;
        
        if (!medicationId || !quantity || quantity <= 0) {
          results.push({
            success: false,
            medicationId,
            message: 'ID thuốc hoặc số lượng không hợp lệ'
          });
          continue;
        }
        
        const medication = await Medication.findById(medicationId);
        
        if (!medication) {
          results.push({
            success: false,
            medicationId,
            message: 'Không tìm thấy thuốc'
          });
          continue;
        }
        
        // Add to stock
        medication.stockQuantity += quantity;
        await medication.save();
        
        results.push({
          success: true,
          medicationId,
          name: medication.name,
          newQuantity: medication.stockQuantity,
          message: 'Cập nhật tồn kho thành công'
        });
      } catch (error) {
        console.error(`Error processing medication ${item.medicationId}:`, error);
        results.push({
          success: false,
          medicationId: item.medicationId,
          message: 'Lỗi khi xử lý thuốc: ' + error.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      data: results,
      message: 'Cập nhật tồn kho thành công'
    });
  } catch (error) {
    console.error('Add stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật tồn kho thuốc',
      error: error.message
    });
  }
}; 