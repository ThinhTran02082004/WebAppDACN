const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { createNotification } = require('../controllers/notificationController');

/**
 * Create a system message for video call start/end
 * @param {Object} params
 * @param {String} params.doctorUserId - Doctor's user ID
 * @param {String} params.patientUserId - Patient's user ID  
 * @param {String} params.type - 'video_call_start' or 'video_call_end'
 * @param {Object} params.videoCallData - Video call details
 * @returns {Promise<Message>}
 */
exports.createVideoCallMessage = async ({ doctorUserId, patientUserId, type, videoCallData }) => {
  try {
    // Find or create conversation between doctor and patient
    let conversation = await Conversation.findOne({
      participants: { $all: [doctorUserId, patientUserId] },
      isActive: true
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [doctorUserId, patientUserId]
      });
    }

    // Create appropriate message content
    let content = '';
    if (type === 'video_call_start') {
      content = 'Cuộc gọi video đã bắt đầu';
    } else if (type === 'video_call_end') {
      const duration = videoCallData.duration || 0;
      const minutes = Math.floor(duration);
      const seconds = Math.round((duration - minutes) * 60);
      content = `Cuộc gọi video đã kết thúc - Thời lượng: ${minutes} phút ${seconds > 0 ? seconds + ' giây' : ''}`;
    }

    // Create message
    const message = await Message.create({
      senderId: doctorUserId, // Doctor as sender (system message)
      receiverId: patientUserId,
      content,
      conversationId: conversation._id,
      messageType: type,
      videoCallData: {
        roomId: videoCallData.roomId,
        roomName: videoCallData.roomName,
        duration: videoCallData.duration,
        startTime: videoCallData.startTime,
        endTime: videoCallData.endTime
      }
    });

    // Update conversation's last message
    conversation.lastMessage = {
      content,
      senderId: doctorUserId,
      timestamp: new Date()
    };
    conversation.lastActivity = new Date();
    await conversation.save();

    // Populate sender info
    await message.populate({
      path: 'senderId',
      select: 'fullName profileImage roleType avatarUrl avatar'
    });

    // Emit socket event for new message
    if (global.io) {
      global.io.to(`conversation:${conversation._id}`).emit('new_message', message);
    }

    // Create notification for patient (only for video_call_end, not for video_call_start)
    if (type === 'video_call_end') {
      try {
        await createNotification({
          userId: patientUserId,
          type: 'video_call',
          title: 'Cuộc gọi video kết thúc',
          content,
          data: {
            conversationId: conversation._id,
            messageId: message._id,
            videoRoomId: videoCallData.roomId,
            senderId: doctorUserId
          }
        });
      } catch (notifError) {
        console.error('Error creating video call notification:', notifError);
      }
    }

    return message;
  } catch (error) {
    console.error('Error creating video call message:', error);
    throw error;
  }
};

/**
 * Notify users about incoming video call
 * @param {Object} params
 */
exports.notifyVideoCallStart = async ({ callerId, receiverId, roomId, roomName }) => {
  try {
    // Emit socket event for real-time notification
    if (global.io) {
      global.io.to(receiverId.toString()).emit('incoming_video_call', {
        callerId,
        roomId,
        roomName
      });
    }

    // Create notification
    await createNotification({
      userId: receiverId,
      type: 'video_call',
      title: 'Cuộc gọi video đến',
      content: 'Bạn có một cuộc gọi video đến',
      data: {
        videoRoomId: roomId,
        senderId: callerId
      }
    });
  } catch (error) {
    console.error('Error notifying video call start:', error);
    throw error;
  }
};

