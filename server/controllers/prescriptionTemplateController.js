const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const Medication = require('../models/Medication');
const Doctor = require('../models/Doctor');
const asyncHandler = require('../middlewares/async');

// Create new prescription template
exports.createTemplate = asyncHandler(async (req, res) => {
  const { name, description, category, diseaseType, medications } = req.body;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  // Validate role
  if (userRole !== 'admin' && userRole !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin và bác sĩ mới có thể tạo đơn thuốc mẫu'
    });
  }

  // Validate medications
  if (!medications || medications.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Đơn thuốc phải có ít nhất 1 loại thuốc'
    });
  }

  // Validate all medications exist and have stock
  for (const med of medications) {
    const medication = await Medication.findById(med.medicationId);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy thuốc với ID: ${med.medicationId}`
      });
    }
    if (!medication.isActive) {
      return res.status(400).json({
        success: false,
        message: `Thuốc ${medication.name} hiện không khả dụng`
      });
    }
  }

  try {
    const template = await PrescriptionTemplate.create({
      name,
      description,
      category,
      diseaseType,
      medications,
      createdBy: userId,
      createdByRole: userRole,
      creatorName: req.user.fullName || req.user.email,
      isPublic: true
    });

    const populatedTemplate = await PrescriptionTemplate.findById(template._id)
      .populate('medications.medicationId', 'name unitPrice unitTypeDisplay')
      .populate('createdBy', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Tạo đơn thuốc mẫu thành công',
      data: populatedTemplate
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo đơn thuốc mẫu',
      error: error.message
    });
  }
});

// List all templates
exports.listTemplates = asyncHandler(async (req, res) => {
  const { category, createdBy, isPublic, page = 1, limit = 20, search } = req.query;

  const query = { isActive: true };

  if (category) {
    query.category = category;
  }

  if (createdBy) {
    query.createdBy = createdBy;
  }

  if (isPublic !== undefined) {
    query.isPublic = isPublic === 'true';
  }

  if (search) {
    query.$text = { $search: search };
  }

  const skip = (page - 1) * limit;

  const templates = await PrescriptionTemplate.find(query)
    .populate('medications.medicationId', 'name unitPrice unitTypeDisplay stockQuantity')
    .populate('createdBy', 'fullName email')
    .sort({ usageCount: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await PrescriptionTemplate.countDocuments(query);

  res.json({
    success: true,
    data: templates,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      limit: parseInt(limit)
    }
  });
});

// Get template by ID
exports.getTemplateById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const template = await PrescriptionTemplate.findById(id)
    .populate('medications.medicationId', 'name unitPrice unitTypeDisplay stockQuantity description')
    .populate('createdBy', 'fullName email');

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc mẫu'
    });
  }

  res.json({
    success: true,
    data: template
  });
});

// Update template
exports.updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, category, diseaseType, medications, isPublic } = req.body;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  const template = await PrescriptionTemplate.findById(id);

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc mẫu'
    });
  }

  // Check permission
  const isOwner = template.createdBy.toString() === userId;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền chỉnh sửa đơn thuốc mẫu này'
    });
  }

  // Validate medications if provided
  if (medications && medications.length > 0) {
    for (const med of medications) {
      const medication = await Medication.findById(med.medicationId);
      if (!medication) {
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy thuốc với ID: ${med.medicationId}`
        });
      }
    }
  }

  // Update fields
  if (name) template.name = name;
  if (description !== undefined) template.description = description;
  if (category) template.category = category;
  if (diseaseType !== undefined) template.diseaseType = diseaseType;
  if (medications) template.medications = medications;
  if (isPublic !== undefined) template.isPublic = isPublic;

  await template.save();

  const updatedTemplate = await PrescriptionTemplate.findById(id)
    .populate('medications.medicationId', 'name unitPrice unitTypeDisplay')
    .populate('createdBy', 'fullName email');

  res.json({
    success: true,
    message: 'Cập nhật đơn thuốc mẫu thành công',
    data: updatedTemplate
  });
});

// Delete template (soft delete)
exports.deleteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  const template = await PrescriptionTemplate.findById(id);

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc mẫu'
    });
  }

  // Check permission
  const isOwner = template.createdBy.toString() === userId;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xóa đơn thuốc mẫu này'
    });
  }

  template.isActive = false;
  await template.save();

  res.json({
    success: true,
    message: 'Xóa đơn thuốc mẫu thành công'
  });
});

// Clone template
exports.cloneTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  const originalTemplate = await PrescriptionTemplate.findById(id);

  if (!originalTemplate) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy đơn thuốc mẫu'
    });
  }

  if (!originalTemplate.isActive) {
    return res.status(400).json({
      success: false,
      message: 'Không thể sao chép đơn thuốc mẫu đã bị xóa'
    });
  }

  const clonedTemplate = await PrescriptionTemplate.create({
    name: name || `${originalTemplate.name} (Copy)`,
    description: originalTemplate.description,
    category: originalTemplate.category,
    diseaseType: originalTemplate.diseaseType,
    medications: originalTemplate.medications,
    createdBy: userId,
    createdByRole: userRole,
    creatorName: req.user.fullName || req.user.email,
    isPublic: false // Mặc định clone là private
  });

  const populatedClone = await PrescriptionTemplate.findById(clonedTemplate._id)
    .populate('medications.medicationId', 'name unitPrice unitTypeDisplay')
    .populate('createdBy', 'fullName email');

  res.status(201).json({
    success: true,
    message: 'Sao chép đơn thuốc mẫu thành công',
    data: populatedClone
  });
});

// Get templates by category
exports.getTemplatesByCategory = asyncHandler(async (req, res) => {
  const categories = await PrescriptionTemplate.aggregate([
    { $match: { isActive: true, isPublic: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        templates: { $push: '$$ROOT' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: categories
  });
});

