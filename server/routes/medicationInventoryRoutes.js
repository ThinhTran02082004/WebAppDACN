const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
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

// Inventory management routes
router.post('/import', importStock); // Admin only
router.post('/adjust', adjustStock); // Admin only

// Query routes
router.get('/history', getInventoryHistory);
router.get('/summary', getStockSummary);
router.get('/alerts', getLowStockAlerts);
router.get('/medication/:medicationId', getMedicationStockDetails);

module.exports = router;

