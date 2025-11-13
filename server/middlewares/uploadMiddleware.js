const multer = require('multer');
const path = require('path');

// Memory storage for all uploads (no local file storage)
const memoryStorage = multer.memoryStorage();

// Kiểm tra loại file
const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif|webp|svg|jfif|bmp|tiff|tif|ico|heic|heif|avif|raw|psd|ai|eps/;
  const videoTypes = /mp4|avi|mov|wmv|flv|webm|mkv|m4v|mpeg|mpg|3gp/;
  
  // Kiểm tra mime type
  const isImage = imageTypes.test(file.mimetype) || file.mimetype.startsWith('image/');
  const isVideo = videoTypes.test(file.mimetype) || file.mimetype.startsWith('video/');
  
  // Kiểm tra extension
  const extname = path.extname(file.originalname).toLowerCase();
  const isImageExt = imageTypes.test(extname);
  const isVideoExt = videoTypes.test(extname);
  
  if ((isImage && isImageExt) || (isVideo && isVideoExt)) {
    return cb(null, true);
  }
  
  cb(new Error('Định dạng file không được hỗ trợ. Hệ thống chấp nhận file ảnh (JPEG, PNG, GIF, WEBP...) và video (MP4, AVI, MOV, WEBM...).'));
};

// Cấu hình upload với memory storage
const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // Giới hạn 50MB
  },
  fileFilter: fileFilter
});

// Sử dụng cùng một cấu hình cho tất cả các loại upload
const uploadAvatar = upload;
const uploadToMemory = upload;

module.exports = { upload, uploadToMemory, uploadAvatar }; 