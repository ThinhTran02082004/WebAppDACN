const asyncHandler = require('../middlewares/async');
const { testAppointmentReminder } = require('../utils/cron');

/**
 * Test cron job - Gửi email nhắc nhở lịch hẹn
 * GET /api/admin/cron/test-appointment-reminder
 */
exports.testAppointmentReminder = asyncHandler(async (req, res) => {
  try {
    const results = await testAppointmentReminder();
    
    res.status(200).json({
      success: true,
      message: 'Test cron job hoàn thành',
      data: results
    });
  } catch (error) {
    console.error('Error testing cron job:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi test cron job',
      error: error.message
    });
  }
});


