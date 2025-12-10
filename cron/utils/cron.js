const cron = require('node-cron');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * Khởi tạo cron job seed specialty mappings (mặc định 02:00 hằng ngày)
 */
const initCronJobs = () => {
  console.log('Khởi tạo cron seed specialty mappings...');

  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🔄 Bắt đầu tự động seed specialty mappings...');
      const scriptPath = path.join(__dirname, '../scripts/seedSpecialtyMapper.js');
      const { stdout, stderr } = await execAsync(`node "${scriptPath}" specialty`, {
        cwd: path.join(__dirname, '..'),
        timeout: 300000, // 5 phút
      });
      if (stdout) console.log(stdout);
      if (stderr) console.error('Specialty seed stderr:', stderr);
      console.log('✅ Hoàn thành seed specialty mappings');
    } catch (error) {
      console.error('❌ Lỗi khi seed specialty mappings:', error.message);
    }
  });

  console.log('Đã khởi tạo cron job seed specialty mappings (02:00).');
};

module.exports = {
  initCronJobs,
};

