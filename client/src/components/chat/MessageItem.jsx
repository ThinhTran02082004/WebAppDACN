import React from 'react';
import { Link } from 'react-router-dom';
import { FaVideo, FaCheck, FaCheckDouble, FaCalendarAlt, FaPaperclip } from 'react-icons/fa';

const MessageItem = ({ message, isOwnMessage, user, currentUser }) => {
  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (duration) => {
    if (!duration) return '0 phut';
    const minutes = Math.floor(duration);
    const seconds = Math.round((duration - minutes) * 60);
    return `${minutes} phut${seconds > 0 ? ` ${seconds} giay` : ''}`;
  };

  const getStatusColor = (status) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-gray-100 text-gray-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
      rejected: 'Từ chối'
    };
    return statusTexts[status] || status;
  };

  const fallbackProfile = isOwnMessage ? currentUser : user;
  const senderProfile = (message.senderId && typeof message.senderId === 'object')
    ? message.senderId
    : fallbackProfile;

  const avatarSrc =
    senderProfile?.avatarUrl ||
    senderProfile?.avatar?.url ||
    senderProfile?.profileImage ||
    fallbackProfile?.avatarUrl ||
    fallbackProfile?.avatar?.url ||
    fallbackProfile?.profileImage ||
    null;

  const displayName = senderProfile?.fullName || fallbackProfile?.fullName || 'User';
  const initials = displayName?.charAt(0)?.toUpperCase() || 'U';

  // Render video call message
  if (message.messageType === 'video_call_start' || message.messageType === 'video_call_end') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center space-x-2 text-sm text-gray-600">
          <FaVideo className="text-green-500" />
          <span>{message.content}</span>
          {message.videoCallData?.duration > 0 && (
            <span className="font-semibold">({formatDuration(message.videoCallData.duration)})</span>
          )}
        </div>
      </div>
    );
  }

  // Render system message
  if (message.messageType === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600">
          {message.content}
        </div>
      </div>
    );
  }

  // Render appointment message
  if (message.messageType === 'appointment' && message.appointmentData) {
    return (
      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className="max-w-[80%]">
          <Link 
            to={`/appointments/${message.appointmentData.appointmentId}`}
            className="block"
          >
            <div className="bg-white border-2 border-blue-200 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center mb-2">
                <FaCalendarAlt className="text-blue-600 mr-2" />
                <span className="font-semibold text-blue-600">Lịch hẹn</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Mã:</span>
                  <span className="font-medium">{message.appointmentData.bookingCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bác sĩ:</span>
                  <span className="font-medium">{message.appointmentData.doctorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ngày:</span>
                  <span className="font-medium">
                    {new Date(message.appointmentData.appointmentDate).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Giờ:</span>
                  <span className="font-medium">
                    {message.appointmentData.timeSlot?.startTime} - {message.appointmentData.timeSlot?.endTime}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(message.appointmentData.status)}`}>
                    {getStatusText(message.appointmentData.status)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
          <div className={`text-xs text-gray-500 mt-1 ${isOwnMessage ? 'text-right' : ''}`}>
            {formatTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  // Render regular message
  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-end space-x-2 max-w-[75%] ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        <div className="flex-shrink-0">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover border border-white shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-sm font-semibold border border-white shadow-sm">
              {initials}
            </div>
          )}
        </div>

        {/* Message content */}
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-4 py-2 rounded-2xl shadow-sm ${
              isOwnMessage
                ? 'bg-[#0084ff] text-white rounded-br-sm'   // màu xanh Messenger
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}
          >
            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 space-y-2">
                {message.attachments.map((attachment, index) => {
                  // Handle both old string format and new object format
                  const isObject = typeof attachment === 'object';
                  const resourceType = isObject ? attachment.resourceType : null;
                  const url = isObject ? (attachment.secureUrl || attachment.url) : attachment;
                  
                  return (
                    <div key={index}>
                      {resourceType === 'image' || (!resourceType && url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                        <img
                          src={url}
                          alt="attachment"
                          className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ) : resourceType === 'video' || (!resourceType && url?.match(/\.(mp4|avi|mov|wmv|webm|mkv)$/i)) ? (
                        <video
                          controls
                          className="max-w-full rounded-lg"
                          src={url}
                        >
                          Your browser does not support video.
                        </video>
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-blue-600 hover:underline"
                        >
                          <FaPaperclip />
                          <span>{isObject && attachment.originalName ? attachment.originalName : 'File đính kèm'}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Text content */}
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          </div>

          {/* Timestamp and read status */}
          <div className={`flex items-center space-x-1 mt-1 text-xs text-gray-500 ${isOwnMessage ? 'justify-end' : ''}`}>
            <span>{formatTime(message.createdAt)}</span>
            {isOwnMessage && (
              <span>
                {message.readAt ? (
                  <FaCheckDouble className="text-white/90" />
                ) : (
                  <FaCheck className="text-white/80" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
