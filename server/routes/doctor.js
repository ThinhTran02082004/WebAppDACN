const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { protect, authorize, doctor } = require('../middlewares/authMiddleware');
const { uploadToMemory } = require('../middlewares/uploadMiddleware');

// === PUBLIC ROUTES ===

// GET /api/doctors?specialty=... - Lọc bác sĩ theo chuyên khoa (public)
router.get('/', doctorController.getDoctors);

// GET /api/doctors/doctors/:id - Chi tiết bác sĩ (public, cho web client compatibility)
router.get('/doctors/:id', doctorController.getDoctorById);

// === AUTHENTICATED SPECIFIC ROUTES (must be before dynamic routes) ===

// GET /api/doctors/favorites - Danh sách bác sĩ yêu thích của người dùng
router.get('/favorites', protect, doctorController.getFavorites);

// GET /api/doctors/profile - Lấy thông tin hồ sơ bác sĩ đăng nhập
router.get('/profile', protect, doctor, doctorController.getDoctorProfile);

// PUT /api/doctors/profile - Cập nhật thông tin hồ sơ bác sĩ
router.put('/profile', protect, doctor, doctorController.updateDoctorProfile);

// POST /api/doctors/avatar - Tải lên ảnh đại diện bác sĩ
router.post('/avatar', protect, doctor, uploadToMemory.single('avatar'), doctorController.uploadDoctorAvatar);

// GET /api/doctors/dashboard/stats - Lấy thống kê cho dashboard bác sĩ
router.get('/dashboard/stats', protect, doctor, doctorController.getDoctorDashboardStats);

// GET /api/doctors/reviews - Lấy đánh giá về bác sĩ đăng nhập
router.get('/reviews', protect, doctor, doctorController.getDoctorReviews);

// POST /api/doctors/reviews/:reviewId/reply - Phản hồi đánh giá
router.post('/reviews/:reviewId/reply', protect, doctor, doctorController.replyToReview);

// GET /api/doctors/patients - Lấy danh sách bệnh nhân đã khám
router.get('/patients', protect, doctor, doctorController.getDoctorPatients);

// === PUBLIC DYNAMIC ID ROUTES (must be after all specific routes) ===

// GET /api/doctors/:id - Chi tiết bác sĩ (public, không cần đăng nhập)
router.get('/:id', doctorController.getDoctorById);

// GET /api/doctors/:id/schedule - Lịch làm việc của bác sĩ (public)
router.get('/:id/schedule', doctorController.getDoctorSchedule);

// GET /api/doctors/:id/services - Dịch vụ của bác sĩ (public)
router.get('/:id/services', doctorController.getDoctorServices);

// === AUTHENTICATED DYNAMIC ID ROUTES ===

// GET /api/doctors/:id/favorite - Kiểm tra bác sĩ có trong danh sách yêu thích không
router.get('/:id/favorite', protect, doctorController.checkFavorite);

// POST /api/doctors/:id/favorite - Thêm bác sĩ vào danh sách yêu thích
router.post('/:id/favorite', protect, doctorController.addToFavorites);

// DELETE /api/doctors/:id/favorite - Xóa bác sĩ khỏi danh sách yêu thích
router.delete('/:id/favorite', protect, doctorController.removeFromFavorites);

module.exports = router; 