import React from 'react';
import { FaTimes, FaPaperPlane, FaSpinner } from 'react-icons/fa';

const MediaPreviewModal = ({ isOpen, media, onClose, onSend, caption, setCaption, uploading }) => {
  if (!isOpen || !media) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-lg font-semibold">Xem trước</h3>
          <button 
            onClick={onClose} 
            className="text-white hover:text-gray-300 transition-colors"
            disabled={uploading}
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-white rounded-lg p-4">
          <div className="mb-4 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
            {media.type?.startsWith('image') ? (
              <img
                src={media.preview}
                alt="Preview"
                className="max-w-full max-h-[60vh] object-contain"
              />
            ) : media.type?.startsWith('video') ? (
              <video
                controls
                src={media.preview}
                className="max-w-full max-h-[60vh]"
              >
                Your browser does not support video.
              </video>
            ) : null}
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Thêm chú thích..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={uploading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {media.file && (
                <span>
                  {media.file.name} ({(media.file.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={uploading}
              >
                Hủy
              </button>
              <button
                onClick={onSend}
                disabled={uploading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <FaPaperPlane />
                    <span>Gửi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewModal;

