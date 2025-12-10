require('dotenv').config();
const { initCronJobs } = require('./utils/cron');
const { connectDB } = require('./config/database');

// Kết nối DB rồi khởi động cron
connectDB()
  .then(() => {
    initCronJobs();
  })
  .catch((err) => {
    console.error('Failed to init cron service:', err);
    process.exit(1);
  });

