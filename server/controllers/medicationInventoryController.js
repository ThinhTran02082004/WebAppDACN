const MedicationInventory = require('../models/MedicationInventory');
const Medication = require('../models/Medication');
const asyncHandler = require('../middlewares/async');
const mongoose = require('mongoose');

// Import stock (admin only)
exports.importStock = asyncHandler(async (req, res) => {
  const { medicationId, quantity, unitPrice, supplier, batchNumber, expiryDate, notes } = req.body;
  const userId = req.user.id;
  const userRole = req.user.roleType || req.user.role;

  // Check if user is admin
  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin mới có quyền nhập hàng'
    });
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

  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin mới có quyền điều chỉnh tồn kho'
    });
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
  const { medicationId, transactionType, startDate, endDate, page = 1, limit = 50 } = req.query;

  const query = {};

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
  const { category, lowStock } = req.query;

  const query = { isActive: true };

  if (category) {
    query.category = category;
  }

  const medications = await Medication.find(query)
    .select('name category stockQuantity lowStockThreshold unitTypeDisplay unitPrice')
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

  const medication = await Medication.findById(medicationId);

  if (!medication) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy thuốc'
    });
  }

  // Get recent transactions
  const recentTransactions = await MedicationInventory.find({ medicationId })
    .populate('performedBy', 'fullName')
    .sort({ createdAt: -1 })
    .limit(20);

  // Calculate statistics
  const stats = await MedicationInventory.aggregate([
    { $match: { medicationId: mongoose.Types.ObjectId(medicationId) } },
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
  const lowStockMedications = await Medication.find({
    isActive: true,
    $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
  })
    .select('name category stockQuantity lowStockThreshold unitTypeDisplay unitPrice')
    .sort({ stockQuantity: 1 });

  const alerts = lowStockMedications.map(med => ({
    _id: med._id,
    name: med.name,
    category: med.category,
    stockQuantity: med.stockQuantity,
    lowStockThreshold: med.lowStockThreshold,
    unitTypeDisplay: med.unitTypeDisplay,
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

