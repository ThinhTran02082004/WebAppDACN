const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
  importStock,
  adjustStock,
  getInventoryHistory,
  getStockSummary,
  getMedicationStockDetails,
  getLowStockAlerts
} = require('../controllers/medicationInventoryController');

// All routes require authentication
router.use(protect);

// Inventory management routes (Admin only)
router.post('/import', authorize('admin'), importStock);
router.post('/adjust', authorize('admin'), adjustStock);

// Query routes (Admin and Pharmacist)
router.get('/history', authorize('admin', 'pharmacist'), getInventoryHistory);
router.get('/summary', authorize('admin', 'pharmacist'), getStockSummary);
router.get('/alerts', authorize('admin', 'pharmacist'), getLowStockAlerts);
router.get('/medication/:medicationId', authorize('admin', 'pharmacist'), getMedicationStockDetails);

module.exports = router;

