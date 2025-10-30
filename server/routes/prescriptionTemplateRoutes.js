const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  createTemplate,
  listTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  cloneTemplate,
  getTemplatesByCategory
} = require('../controllers/prescriptionTemplateController');

// All routes require authentication
router.use(protect);

// Public routes (for doctors and admins)
router.get('/', listTemplates);
router.get('/categories', getTemplatesByCategory);
router.get('/:id', getTemplateById);

// Create, update, delete (doctors and admins only)
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/clone', cloneTemplate);

module.exports = router;

