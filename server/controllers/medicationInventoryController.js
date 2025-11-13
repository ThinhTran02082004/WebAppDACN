const MedicationInventory = require('../models/MedicationInventory');
const Medication = require('../models/Medication');
const asyncHandler = require('../middlewares/async');
const mongoose = require('mongoose');

// Import stock (admin only)
exports.importStock = asyncHandler(async (req, res) => {
  const { medicationId, quantity, unitPrice, supplier, batchNumber, expiryDate, notes, hospitalId } = req.body;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  // Check if user is admin or pharmacist
  if (userRole !== 'admin' && userRole !== 'pharmacist') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin hoặc dược sĩ mới có quyền nhập hàng'
    });
  }

  // Pharmacist can only import for their hospital
  if (userRole === 'pharmacist') {
    const User = require('../models/User');
    const pharmacist = await User.findById(userId);
    if (!pharmacist || !pharmacist.hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Dược sĩ chưa được gán vào chi nhánh'
      });
    }
    // Validate medication belongs to pharmacist's hospital
    const medication = await Medication.findById(medicationId);
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thuốc'
      });
    }
    if (medication.hospitalId.toString() !== pharmacist.hospitalId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể nhập thuốc cho chi nhánh của mình'
      });
    }
  }

  if (!medicationId || !quantity || quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Thông tin nhập hàng không hợp lệ'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const medication = await Medication.findById(medicationId).session(session);

    if (!medication) {
      throw new Error('Không tìm thấy thuốc');
    }

    // For admin: validate hospitalId if provided
    if (userRole === 'admin' && hospitalId) {
      // Validate medication belongs to the specified hospital
      const medicationHospitalId = medication.hospitalId?._id || medication.hospitalId;
      if (medicationHospitalId.toString() !== hospitalId.toString()) {
        throw new Error(`Thuốc "${medication.name}" không thuộc chi nhánh được chọn. Vui lòng chọn thuốc thuộc chi nhánh này.`);
      }
    }

    const previousStock = medication.stockQuantity;
    const newStock = previousStock + quantity;

    // Update medication stock
    medication.stockQuantity = newStock;
    
    // Update unit price if provided
    if (unitPrice !== undefined && unitPrice >= 0) {
      medication.unitPrice = unitPrice;
    }

    await medication.save({ session });

    // Create inventory record
    const inventory = await MedicationInventory.create([{
      medicationId,
      hospitalId: medication.hospitalId,
      transactionType: 'import',
      quantity,
      previousStock,
      newStock,
      unitPrice: unitPrice || medication.unitPrice,
      totalCost: (unitPrice || medication.unitPrice) * quantity,
      performedBy: userId,
      reason: 'Nhập hàng',
      referenceType: 'Manual',
      notes,
      supplier,
      batchNumber,
      expiryDate
    }], { session });

    await session.commitTransaction();

    // Emit real-time stock update
    if (global.io) {
      global.io.to('inventory_updates').emit('stock_updated', {
        medicationId: medication._id,
        medicationName: medication.name,
        oldStock: previousStock,
        newStock: newStock,
        quantity: quantity,
        action: 'import',
        performedBy: req.user.fullName || req.user.email
      });
    }

    const populatedInventory = await MedicationInventory.findById(inventory[0]._id)
      .populate('medicationId', 'name unitTypeDisplay category')
      .populate('performedBy', 'fullName email');

    res.status(201).json({
      success: true,
      message: 'Nhập hàng thành công',
      data: populatedInventory
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error importing stock:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể nhập hàng'
    });
  } finally {
    session.endSession();
  }
});

// Adjust stock (admin only) - for corrections
exports.adjustStock = asyncHandler(async (req, res) => {
  const { medicationId, newStock, reason, notes } = req.body;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  // Admin and pharmacist can adjust stock (pharmacist only for their hospital)
  if (userRole !== 'admin' && userRole !== 'pharmacist') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin hoặc dược sĩ mới có quyền điều chỉnh tồn kho'
    });
  }

  // Pharmacist can only adjust for their hospital
  if (userRole === 'pharmacist') {
    const User = require('../models/User');
    const pharmacist = await User.findById(userId);
    if (!pharmacist || !pharmacist.hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Dược sĩ chưa được gán vào chi nhánh'
      });
    }
    const medication = await Medication.findById(medicationId);
    if (medication && medication.hospitalId.toString() !== pharmacist.hospitalId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể điều chỉnh tồn kho thuốc của chi nhánh mình'
      });
    }
  }

  if (!medicationId || newStock === undefined || newStock < 0) {
    return res.status(400).json({
      success: false,
      message: 'Thông tin điều chỉnh không hợp lệ'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const medication = await Medication.findById(medicationId).session(session);

    if (!medication) {
      throw new Error('Không tìm thấy thuốc');
    }

    const previousStock = medication.stockQuantity;
    const quantity = newStock - previousStock;

    medication.stockQuantity = newStock;
    await medication.save({ session });

    // Create inventory record
    const inventory = await MedicationInventory.create([{
      medicationId,
      hospitalId: medication.hospitalId,
      transactionType: 'adjust',
      quantity: Math.abs(quantity),
      previousStock,
      newStock,
      performedBy: userId,
      reason: reason || 'Điều chỉnh tồn kho',
      referenceType: 'Manual',
      notes
    }], { session });

    await session.commitTransaction();

    // Emit real-time update
    if (global.io) {
      global.io.to('inventory_updates').emit('stock_updated', {
        medicationId: medication._id,
        medicationName: medication.name,
        oldStock: previousStock,
        newStock: newStock,
        quantity: quantity,
        action: 'adjust',
        performedBy: req.user.fullName || req.user.email
      });
    }

    const populatedInventory = await MedicationInventory.findById(inventory[0]._id)
      .populate('medicationId', 'name unitTypeDisplay')
      .populate('performedBy', 'fullName email');

    res.json({
      success: true,
      message: 'Điều chỉnh tồn kho thành công',
      data: populatedInventory
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error adjusting stock:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể điều chỉnh tồn kho'
    });
  } finally {
    session.endSession();
  }
});

// Get inventory history
exports.getInventoryHistory = asyncHandler(async (req, res) => {
  const { medicationId, transactionType, startDate, endDate, hospitalId, page = 1, limit = 50 } = req.query;
  const userRole = req.user?.roleType || req.user?.role;

  const query = {};

  // Filter by hospitalId for pharmacist
  if (userRole === 'pharmacist') {
    const User = require('../models/User');
    const pharmacist = await User.findById(req.user.id);
    if (!pharmacist || !pharmacist.hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Dược sĩ chưa được gán vào chi nhánh'
      });
    }
    query.hospitalId = pharmacist.hospitalId;
  } else if (userRole === 'admin' && hospitalId) {
    // Admin can optionally filter by hospitalId
    query.hospitalId = hospitalId;
  }

  if (medicationId) {
    query.medicationId = medicationId;
  }

  if (transactionType) {
    query.transactionType = transactionType;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const skip = (page - 1) * limit;

  const history = await MedicationInventory.find(query)
    .populate('medicationId', 'name unitTypeDisplay category')
    .populate('performedBy', 'fullName email')
    .populate('hospitalId', 'name address')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip(skip);

  const total = await MedicationInventory.countDocuments(query);

  res.json({
    success: true,
    data: history,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      limit: parseInt(limit)
    }
  });
});

// Get stock summary
exports.getStockSummary = asyncHandler(async (req, res) => {
  const { category, lowStock, hospitalId } = req.query;
  const userRole = req.user?.roleType || req.user?.role;

  const query = { isActive: true };

  // Filter by hospitalId for pharmacist
  if (userRole === 'pharmacist') {
    const User = require('../models/User');
    const pharmacist = await User.findById(req.user.id);
    if (!pharmacist || !pharmacist.hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Dược sĩ chưa được gán vào chi nhánh'
      });
    }
    query.hospitalId = pharmacist.hospitalId;
  } else if (userRole === 'admin' && hospitalId) {
    // Admin can optionally filter by hospitalId
    query.hospitalId = hospitalId;
  }

  if (category) {
    query.category = category;
  }

  const medications = await Medication.find(query)
    .select('name category stockQuantity lowStockThreshold unitTypeDisplay unitPrice hospitalId')
    .populate('hospitalId', 'name address')
    .sort({ name: 1 });

  let summary = medications.map(med => ({
    _id: med._id,
    name: med.name,
    category: med.category,
    stockQuantity: med.stockQuantity,
    lowStockThreshold: med.lowStockThreshold,
    unitTypeDisplay: med.unitTypeDisplay,
    unitPrice: med.unitPrice,
    stockValue: med.stockQuantity * med.unitPrice,
    status: med.stockQuantity === 0 ? 'out-of-stock' :
            med.stockQuantity <= med.lowStockThreshold ? 'low-stock' : 'in-stock'
  }));

  // Filter by low stock if requested
  if (lowStock === 'true') {
    summary = summary.filter(item => item.status === 'low-stock' || item.status === 'out-of-stock');
  }

  // Calculate totals
  const totalValue = summary.reduce((sum, item) => sum + item.stockValue, 0);
  const lowStockCount = summary.filter(item => item.status === 'low-stock').length;
  const outOfStockCount = summary.filter(item => item.status === 'out-of-stock').length;

  res.json({
    success: true,
    data: {
      medications: summary,
      statistics: {
        totalMedications: summary.length,
        totalValue,
        lowStockCount,
        outOfStockCount
      }
    }
  });
});

// Get medication stock details with history
exports.getMedicationStockDetails = asyncHandler(async (req, res) => {
  const { medicationId } = req.params;
  const userRole = req.user?.roleType || req.user?.role;

  const medication = await Medication.findById(medicationId).populate('hospitalId', 'name address');

  if (!medication) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thuốc'
    });
  }

  let pharmacist = null;
  // Validate pharmacist can only view medications from their hospital
  if (userRole === 'pharmacist') {
    const User = require('../models/User');
    pharmacist = await User.findById(req.user.id);
    if (!pharmacist || !pharmacist.hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Dược sĩ chưa được gán vào chi nhánh'
      });
    }
    if (medication.hospitalId.toString() !== pharmacist.hospitalId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể xem thông tin thuốc của chi nhánh mình'
      });
    }
  }

  // Build query for recent transactions with hospitalId filter for pharmacist
  const transactionQuery = { medicationId };
  if (userRole === 'pharmacist' && pharmacist?.hospitalId) {
    transactionQuery.hospitalId = pharmacist.hospitalId;
  }

  // Get recent transactions
  const recentTransactions = await MedicationInventory.find(transactionQuery)
    .populate('performedBy', 'fullName')
    .populate('hospitalId', 'name address')
    .sort({ createdAt: -1 })
    .limit(20);

  // Build aggregate match query
  const aggregateMatch = { medicationId: mongoose.Types.ObjectId(medicationId) };
  if (userRole === 'pharmacist' && pharmacist?.hospitalId) {
    aggregateMatch.hospitalId = pharmacist.hospitalId;
  }

  // Calculate statistics
  const stats = await MedicationInventory.aggregate([
    { $match: aggregateMatch },
    {
      $group: {
        _id: '$transactionType',
        totalQuantity: { $sum: '$quantity' },
        count: { $sum: 1 }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      medication: {
        _id: medication._id,
        name: medication.name,
        category: medication.category,
        stockQuantity: medication.stockQuantity,
        lowStockThreshold: medication.lowStockThreshold,
        unitTypeDisplay: medication.unitTypeDisplay,
        unitPrice: medication.unitPrice,
        stockValue: medication.stockQuantity * medication.unitPrice
      },
      recentTransactions,
      statistics: stats
    }
  });
});

// Get low stock alerts
exports.getLowStockAlerts = asyncHandler(async (req, res) => {
  const userRole = req.user?.roleType || req.user?.role;
  const query = {
    isActive: true,
    $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
  };

  // Filter by hospitalId for pharmacist
  if (userRole === 'pharmacist') {
    const User = require('../models/User');
    const pharmacist = await User.findById(req.user.id);
    if (!pharmacist || !pharmacist.hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Dược sĩ chưa được gán vào chi nhánh'
      });
    }
    query.hospitalId = pharmacist.hospitalId;
  }

  // Optional: Admin can filter by hospitalId if provided
  if (userRole === 'admin' && req.query.hospitalId) {
    query.hospitalId = req.query.hospitalId;
  }

  const lowStockMedications = await Medication.find(query)
    .select('name category stockQuantity lowStockThreshold unitTypeDisplay unitPrice hospitalId')
    .populate('hospitalId', 'name address')
    .sort({ stockQuantity: 1 });

  const alerts = lowStockMedications.map(med => ({
    _id: med._id,
    name: med.name,
    category: med.category,
    stockQuantity: med.stockQuantity,
    lowStockThreshold: med.lowStockThreshold,
    unitTypeDisplay: med.unitTypeDisplay,
    hospitalId: med.hospitalId,
    severity: med.stockQuantity === 0 ? 'critical' : 'warning',
    message: med.stockQuantity === 0 
      ? 'Thuốc đã hết hàng' 
      : `Còn ${med.stockQuantity} ${med.unitTypeDisplay}`
  }));

  res.json({
    success: true,
    data: alerts,
    count: alerts.length
  });
});

