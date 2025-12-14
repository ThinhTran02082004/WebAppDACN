const { cloudinary } = require('../config/cloudinary');

/**
 * Upload media (image or video) to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} originalName - Original filename
 * @param {string} folder - Cloudinary folder (default: 'chat-media')
 * @returns {Promise<Object>} - Upload result with metadata
 */
const uploadMediaToCloudinary = async (fileBuffer, originalName, folder = 'chat-media') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto', // Automatically detect image or video
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        
        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type, // 'image' or 'video'
          format: result.format,
          size: result.bytes,
          width: result.width,
          height: result.height,
          duration: result.duration, // Only for video
          originalName: originalName
        });
      }
    );
    
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete media from Cloudinary
 * @param {string} publicId - Public ID of the media
 * @param {string} resourceType - Resource type ('image' or 'video')
 * @returns {Promise<Object>} - Delete result
 */
const deleteMediaFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

module.exports = {
  uploadMediaToCloudinary,
  deleteMediaFromCloudinary
};

