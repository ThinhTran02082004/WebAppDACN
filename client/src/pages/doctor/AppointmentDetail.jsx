import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FaUser, FaCalendarAlt, FaMapMarkerAlt, FaFileMedical, 
  FaNotesMedical, FaClipboardCheck, FaTimesCircle, FaCheckCircle,
  FaArrowLeft, FaFileAlt, FaPrint, FaExclamationCircle,
  FaClock, FaStethoscope, FaRegHospital, FaInfoCircle,
  FaPhoneAlt, FaEnvelope, FaHome, FaDoorOpen, FaVideo, FaPlus, FaTimes, FaComments, FaShare
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';

import api from '../../utils/api';
import VideoCallButton from '../../components/VideoCallButton';
import PrescriptionManager from '../../components/PrescriptionManager';
import HospitalizationManager from '../../components/HospitalizationManager';
import DoctorBilling from '../../components/DoctorBilling';

const AppointmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'prescription', 'hospitalization', 'billing'
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);

  useEffect(() => {
    fetchAppointmentDetail();
  }, [id]);

  const fetchAppointmentDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/appointments/${id}`);
      if (response.data.success) {
        setAppointment(response.data.data);
      } else {
        const errorMsg = response.data.message || 'Không thể tải thông tin lịch hẹn';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Lỗi khi tải chi tiết lịch hẹn:', error);
      const errorMsg = error.response?.data?.message || 'Đã xảy ra lỗi khi tải thông tin. Vui lòng thử lại sau.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus, reason = '') => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      let endpoint;
      let requestData = {};
      
      if (newStatus === 'confirmed') {
        endpoint = `/appointments/${id}/confirmed`;
      } else if (newStatus === 'rejected') {
        endpoint = `/appointments/${id}/reject`;
        requestData = { reason };
      } else if (newStatus === 'completed') {
        await handleCompleteAppointment();
        setIsUpdating(false);
        return;
      }
      
      const response = await api.put(endpoint, requestData);
      
      if (response.data.success) {
        // Cập nhật state
        setAppointment({
          ...appointment,
          status: newStatus
        });
        setShowRejectionModal(false);
        // Hiển thị thông báo thành công
        toast.success(`Cập nhật trạng thái lịch hẹn thành công.`);
      } else {
        console.error("Cập nhật thất bại:", response.data.message);
        toast.error(`Không thể cập nhật trạng thái: ${response.data.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error(`Lỗi cập nhật trạng thái:`, error.response?.data || error.message);
      toast.error('Đã xảy ra lỗi khi cập nhật trạng thái. Vui lòng thử lại sau.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openRejectionModal = () => {
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleRejection = () => {
    if (rejectionReason.trim()) {
      handleStatusChange('rejected', rejectionReason);
    }
  };

  const handleChatWithPatient = async () => {
    try {
      // Get patient's user ID
      const patientUserId = appointment?.patientId?._id || appointment?.patientId;
      
      if (!patientUserId) {
        toast.error('Không thể tìm thấy thông tin bệnh nhân');
        return;
      }

      // Create or get existing conversation
      const response = await api.post('/chat/conversations', {
        participantId: patientUserId,
        appointmentId: appointment._id
      });

      if (response.data.success) {
        // Navigate to chat page with conversation ID
        navigate(`/doctor/chat/${response.data.data._id}`);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error(error.response?.data?.message || 'Không thể bắt đầu trò chuyện. Vui lòng thử lại sau.');
    }
  };

  const handleShareToChat = async () => {
    try {
      const patientUserId = appointment?.patientId?._id || appointment?.patientId;
      
      if (!patientUserId) {
        toast.error('Không thể tìm thấy thông tin bệnh nhân');
        return;
      }

      // Create or get conversation
      const response = await api.post('/chat/conversations', {
        participantId: patientUserId,
        appointmentId: appointment._id
      });

      if (response.data.success) {
        const conversationId = response.data.data._id;
        
        // Send appointment to chat
        await api.post(`/chat/conversations/${conversationId}/send-appointment`, {
          appointmentId: appointment._id
        });
        
        toast.success('Đã chia sẻ lịch hẹn vào chat');
        navigate(`/doctor/chat/${conversationId}`);
      }
    } catch (error) {
      console.error('Error sharing appointment:', error);
      toast.error('Không thể chia sẻ lịch hẹn');
    }
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'N/A';
    
    // Create a UTC-based date object to avoid timezone issues
    const date = new Date(dateTimeStr);
    const utcDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds()
    ));
    
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(utcDate);
  };

  const renderStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Chờ xác nhận', className: 'bg-yellow-100 text-yellow-800 border border-yellow-200', icon: <FaExclamationCircle className="mr-1.5" /> },
      confirmed: { text: 'Đã xác nhận', className: 'bg-blue-100 text-blue-800 border border-blue-200', icon: <FaCheckCircle className="mr-1.5" /> },
      completed: { text: 'Hoàn thành', className: 'bg-green-100 text-green-800 border border-green-200', icon: <FaClipboardCheck className="mr-1.5" /> },
      pending_payment: { text: 'Chờ thanh toán', className: 'bg-orange-100 text-orange-800 border border-orange-200', icon: <FaClock className="mr-1.5" /> },
      hospitalized: { text: 'Đang nằm viện', className: 'bg-purple-100 text-purple-800 border border-purple-200', icon: <FaRegHospital className="mr-1.5" /> },
      cancelled: { text: 'Đã hủy', className: 'bg-red-100 text-red-800 border border-red-200', icon: <FaTimesCircle className="mr-1.5" /> },
      rejected: { text: 'Đã từ chối', className: 'bg-red-100 text-red-800 border border-red-200', icon: <FaTimesCircle className="mr-1.5" /> },
      rescheduled: { text: 'Đã đổi lịch', className: 'bg-indigo-100 text-indigo-800 border border-indigo-200', icon: <FaCalendarAlt className="mr-1.5" /> },
      'no-show': { text: 'Không đến', className: 'bg-gray-100 text-gray-800 border border-gray-200', icon: <FaExclamationCircle className="mr-1.5" /> }
    };
    
    const badge = badges[status] || { text: status, className: 'bg-gray-100 text-gray-800 border border-gray-200', icon: null };
    
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full ${badge.className} text-sm font-medium`}>
        {badge.icon}
        <span>{badge.text}</span>
      </div>
    );
  };


  const printAppointment = () => {
    window.print();
  };

  const handleCompleteAppointment = async () => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const response = await api.put(`/appointments/${id}/complete`);
      
      if (response.data.success) {
        toast.success('Lịch hẹn đã hoàn thành thành công');
        await fetchAppointmentDetail();
      } else {
        toast.error(`Không thể hoàn thành lịch hẹn: ${response.data.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error('Lỗi khi hoàn thành lịch hẹn:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || 'Lỗi khi hoàn thành lịch hẹn';
      toast.error(errorMessage);
      
      // If there are unpaid parts, show them
      if (error.response?.data?.unpaidParts) {
        const unpaidParts = error.response.data.unpaidParts;
        toast.info(`Còn thiếu thanh toán: ${unpaidParts.join(', ')}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Modal từ chối lịch hẹn
  const renderRejectionModal = () => {
    if (!showRejectionModal) return null;
    
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 transform transition-all">
          <div className="flex justify-between items-center p-5 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <FaTimesCircle className="text-red-500 mr-2" /> Từ chối lịch hẹn
            </h3>
            <button 
              className="text-gray-400 hover:text-gray-500 focus:outline-none transition-colors"
              onClick={() => setShowRejectionModal(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5">
            <p className="text-gray-600 mb-3">Vui lòng nhập lý do từ chối lịch hẹn:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Lý do từ chối..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <div className="flex justify-end space-x-3 p-5 border-t border-gray-200">
            <button 
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setShowRejectionModal(false)}
            >
              Hủy
            </button>
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              onClick={handleRejection}
              disabled={!rejectionReason.trim() || isUpdating}
            >
              {isUpdating ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </button>
          </div>
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary/30 border-l-primary rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu lịch hẹn...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <FaExclamationCircle className="mx-auto text-5xl text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Đã xảy ra lỗi</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
            onClick={() => navigate('/doctor/appointments')}
          >
            <FaArrowLeft className="mr-2" /> Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <FaExclamationCircle className="mx-auto text-5xl text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Không tìm thấy lịch hẹn</h2>
          <p className="text-gray-600 mb-6">Lịch hẹn bạn đang tìm kiếm không tồn tại hoặc đã bị xóa</p>
          <button 
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
            onClick={() => navigate('/doctor/appointments')}
          >
            <FaArrowLeft className="mr-2" /> Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      {renderRejectionModal()}
      
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100">
          <div className="flex items-center mb-4 sm:mb-0">
            <button 
              className="mr-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
              onClick={() => navigate('/doctor/appointments')}
            >
              <FaArrowLeft />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Chi tiết lịch hẹn</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <div className="text-xs sm:text-sm text-gray-500">Mã lịch hẹn: <span className="font-medium text-primary">{appointment.bookingCode || 'N/A'}</span></div>
                {appointment.queueNumber > 0 && (
                  <div className="inline-flex items-center px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded text-xs sm:text-sm font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 11h.01M7 15h.01M11 7h6M11 11h6M11 15h6" />
                    </svg>
                    STT khám: {appointment.queueNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            {renderStatusBadge(appointment.status)}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 sm:px-6 py-4 bg-gray-50 flex flex-wrap gap-3 justify-between border-b border-gray-100">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {/* Chat Button - Show for pending, rescheduled, confirmed, or completed appointments */}
            {(appointment.status === 'pending' || appointment.status === 'rescheduled' || appointment.status === 'confirmed' || appointment.status === 'completed') && (
              <>
                <button
                  className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg bg-green-100 text-green-800 hover:bg-green-200 transition-all text-sm font-medium"
                  onClick={handleChatWithPatient}
                >
                  <FaComments className="mr-1.5" />
                  <span className="hidden sm:inline">Chat với bệnh nhân</span>
                  <span className="sm:hidden">Chat</span>
                </button>
                <button
                  onClick={handleShareToChat}
                  className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 transition-all text-sm font-medium"
                >
                  <FaShare className="mr-1.5" />
                  <span className="hidden sm:inline">Chia sẻ vào chat</span>
                  <span className="sm:hidden">Chia sẻ</span>
                </button>
              </>
            )}
            {/* Video Call Button for confirmed appointments */}
            {appointment.status === 'confirmed' && (
              <VideoCallButton 
                appointmentId={appointment._id}
                userRole="doctor"
                appointmentStatus={appointment.status}
              />
            )}
            
            {(appointment.status === 'pending' || appointment.status === 'rescheduled') && (
              <>
                <button 
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm disabled:opacity-70 text-xs sm:text-sm"
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={isUpdating}
                >
                  <FaCheckCircle className="mr-1.5" /> Xác nhận lịch hẹn
                </button>
                <button 
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-sm disabled:opacity-70 text-xs sm:text-sm"
                  onClick={openRejectionModal}
                  disabled={isUpdating}
                >
                  <FaTimesCircle className="mr-1.5" /> Từ chối lịch hẹn
                </button>
              </>
            )}
            
            {(appointment.status === 'confirmed' || appointment.status === 'hospitalized') && (
              <>
                <button 
                  className="inline-flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm disabled:opacity-70 text-xs sm:text-sm"
                  onClick={() => { setActiveTab('prescription'); setShowPrescriptionForm(true); }}
                >
                  <FaNotesMedical className="mr-1.5" /> Kê Đơn Thuốc
                </button>
                {appointment.status === 'confirmed' && (
                  <button 
                    className="inline-flex items-center px-3 sm:px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-sm disabled:opacity-70 text-xs sm:text-sm"
                    onClick={() => handleStatusChange('completed')}
                    disabled={isUpdating}
                  >
                    <FaClipboardCheck className="mr-1.5" /> Hoàn Thành Khám
                  </button>
                )}
              </>
            )}
          </div>
          
          <div className="flex gap-2 sm:gap-3">
            <button 
              className="inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all text-xs sm:text-sm"
              onClick={printAppointment}
            >
              <FaPrint className="mr-1.5" /> In lịch hẹn
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Patient Information */}
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <h2 className="text-base sm:text-lg font-semibold flex items-center">
              <FaUser className="mr-2 text-blue-200" /> Thông tin bệnh nhân
            </h2>
          </div>
          <div className="p-4 sm:p-6 divide-y divide-gray-100">
            <div className="flex flex-col md:flex-row md:items-center py-3 sm:py-4 first:pt-0 last:pb-0">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaUser className="mr-2 text-blue-500" /> Họ và tên
              </div>
              <div className="w-full md:w-2/3 text-gray-800 font-medium">
                {appointment.patientId?.fullName || 'N/A'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaCalendarAlt className="mr-2 text-blue-500" /> Ngày sinh
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.patientId?.dateOfBirth ? 
                  new Date(appointment.patientId.dateOfBirth).toLocaleDateString('vi-VN') : 'N/A'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaInfoCircle className="mr-2 text-blue-500" /> Giới tính
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.patientId?.gender === 'male' ? 'Nam' : 
                 appointment.patientId?.gender === 'female' ? 'Nữ' : 'Khác'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaEnvelope className="mr-2 text-blue-500" /> Email
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.patientId?.email || 'N/A'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaPhoneAlt className="mr-2 text-blue-500" /> Số điện thoại
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.patientId?.phoneNumber || 'N/A'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaHome className="mr-2 text-blue-500" /> Địa chỉ
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.patientId?.address || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Appointment Details */}
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <h2 className="text-base sm:text-lg font-semibold flex items-center">
              <FaCalendarAlt className="mr-2" /> Thông tin lịch hẹn
            </h2>
          </div>
          <div className="p-4 sm:p-6 divide-y divide-gray-100">
            <div className="flex flex-col md:flex-row md:items-center py-4 first:pt-0 last:pb-0">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaStethoscope className="mr-2 text-green-500" /> Chuyên khoa
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.specialtyId?.name || 'N/A'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaNotesMedical className="mr-2 text-green-500" /> Dịch vụ
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.serviceId?.name || 'Khám thông thường'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaCalendarAlt className="mr-2 text-green-500" /> Ngày khám
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {(() => {
                  const date = new Date(appointment.appointmentDate);
                  const utcDate = new Date(Date.UTC(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    12, 0, 0
                  ));
                  return utcDate.toLocaleDateString('vi-VN');
                })()}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaClock className="mr-2 text-green-500" /> Giờ khám
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.timeSlot ? `${appointment.timeSlot.startTime} - ${appointment.timeSlot.endTime}` : 'N/A'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaInfoCircle className="mr-2 text-green-500" /> Loại khám
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {appointment.appointmentType === 'first-visit' ? 'Khám lần đầu' : 
                 appointment.appointmentType === 'follow-up' ? 'Tái khám' : 
                 appointment.appointmentType || 'N/A'}
              </div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center py-4">
              <div className="w-full md:w-1/3 font-medium text-gray-700 mb-1 md:mb-0 flex items-center">
                <FaCalendarAlt className="mr-2 text-green-500" /> Ngày đặt lịch
              </div>
              <div className="w-full md:w-2/3 text-gray-800">
                {formatDateTime(appointment.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location Information */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden mb-6">
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <h2 className="text-base sm:text-lg font-semibold flex items-center">
            <FaMapMarkerAlt className="mr-2" /> Địa điểm khám
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Bệnh viện</div>
              <div className="flex items-center">
                <FaRegHospital className="text-purple-500 mr-2" />
                <span className="font-medium text-gray-800">{appointment.hospitalId?.name || 'N/A'}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Địa chỉ</div>
              <div className="flex items-start">
                <FaMapMarkerAlt className="text-purple-500 mr-2 mt-0.5" />
                <span className="text-gray-800">{appointment.hospitalId?.address || 'N/A'}</span>
              </div>
            </div>
            {appointment.timeSlot?.roomId && (
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Phòng khám</div>
                <div className="flex items-center">
                  <FaDoorOpen className="text-purple-500 mr-2" />
                  <span className="font-medium text-gray-800">
                    {typeof appointment.timeSlot.roomId === 'object' 
                      ? `${appointment.timeSlot.roomId.name} (Phòng ${appointment.timeSlot.roomId.number}, Tầng ${appointment.timeSlot.roomId.floor})` 
                      : `Phòng ${appointment.timeSlot.roomId}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Medical Information */}
      <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden mb-6">
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <h2 className="text-base sm:text-lg font-semibold flex items-center">
            <FaNotesMedical className="mr-2" /> Thông tin bệnh lý
          </h2>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Triệu chứng</h3>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 sm:p-4 text-gray-700">
              {appointment.symptoms || 'Bệnh nhân không cung cấp thông tin triệu chứng.'}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Tiền sử bệnh</h3>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 sm:p-4 text-gray-700">
              {appointment.medicalHistory || 'Bệnh nhân không cung cấp thông tin tiền sử bệnh.'}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Ghi chú</h3>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 sm:p-4 text-gray-700">
              {appointment.notes || appointment.reason || 'Bệnh nhân không cung cấp ghi chú.'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      {(appointment.status === 'confirmed' || appointment.status === 'completed' || appointment.status === 'hospitalized' || appointment.status === 'pending_payment') && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6 sm:mb-8">
          {/* Tab Headers */}
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('prescription')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'prescription'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <FaNotesMedical className="inline mr-2" />
              Đơn Thuốc
            </button>
            <button
              onClick={() => setActiveTab('hospitalization')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'hospitalization'
                  ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
              }`}
            >
              <FaRegHospital className="inline mr-2" />
              Nằm Viện
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'billing'
                  ? 'border-b-2 border-green-600 text-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
              }`}
            >
              <FaFileMedical className="inline mr-2" />
              Thanh Toán
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'prescription' && (
              <div>
                {showPrescriptionForm ? (
                  <PrescriptionManager
                    appointmentId={appointment._id}
                    patientId={appointment.patientId?._id}
                    onPrescriptionCreated={() => {
                      setShowPrescriptionForm(false);
                      toast.success('Đơn thuốc đã được tạo thành công');
                      fetchAppointmentDetail();
                    }}
                  />
                ) : (
                  <>
                    {Array.isArray(appointment.prescriptions) && appointment.prescriptions.length > 0 ? (
                      <div className="space-y-3">
                        {appointment.prescriptions
                          .sort((a, b) => (a.prescriptionOrder || 1) - (b.prescriptionOrder || 1))
                          .map((p) => (
                          <div key={p._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold">
                                  Đơn thuốc {p.prescriptionOrder ? `đợt ${p.prescriptionOrder}` : ''}
                                </div>
                                {p.isHospitalization && (
                                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                                    Nội trú
                                  </span>
                                )}
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  p.status === 'dispensed' ? 'bg-green-100 text-green-800' :
                                  p.status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                                  p.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {p.status === 'pending' ? 'Chờ xử lý' :
                                   p.status === 'approved' ? 'Đã kê đơn' :
                                   p.status === 'verified' ? 'Đã phê duyệt' :
                                   p.status === 'dispensed' ? 'Đã cấp thuốc' :
                                   p.status === 'completed' ? 'Hoàn thành' : p.status}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">{new Date(p.createdAt).toLocaleString('vi-VN')}</div>
                            </div>
                            {p.diagnosis && (
                              <div className="text-sm text-gray-600 mb-2 pb-2 border-b">
                                <span className="font-medium">Chẩn đoán:</span> <span className="text-gray-800">{p.diagnosis}</span>
                              </div>
                            )}
                            <div className="text-sm mb-2">
                              <div className="font-medium text-gray-700 mb-1">Danh sách thuốc:</div>
                              <ul className="list-disc pl-5 space-y-1">
                                {p.medications?.map((m, i) => (
                                  <li key={i} className="text-gray-600">
                                    {m.medicationId?.name || m.medicationName} — SL: {m.quantity} {m.medicationId?.unitTypeDisplay || ''}, Liều: {m.dosage}, Cách dùng: {m.usage}
                                    {m.totalPrice > 0 && (
                                      <span className="ml-2 text-gray-500">
                                        ({new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(m.totalPrice)})
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            {p.totalAmount > 0 && (
                              <div className="text-sm font-semibold text-gray-800 mt-2 pt-2 border-t">
                                Tổng tiền: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.totalAmount)}
                              </div>
                            )}
                            {p.notes && (
                              <div className="text-sm text-gray-600 mt-2 pt-2 border-t">
                                <span className="font-medium">Ghi chú:</span> {p.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FaNotesMedical className="mx-auto text-5xl text-gray-300 mb-4" />
                        <p className="text-gray-500 mb-4">Chưa có đơn thuốc nào được kê</p>
                        {(appointment.status === 'confirmed' || appointment.status === 'hospitalized') && (
                          <button
                            onClick={() => setShowPrescriptionForm(true)}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <FaPlus className="inline mr-2" />
                            Kê Đơn Thuốc Mới
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'hospitalization' && (
              <HospitalizationManager
                appointmentId={appointment._id}
                patientId={appointment.patientId?._id}
                onUpdate={() => {
                  fetchAppointmentDetail();
                  toast.success('Cập nhật thông tin nằm viện thành công');
                }}
              />
            )}

            {activeTab === 'billing' && (
              <DoctorBilling
                appointmentId={appointment._id}
                onPaymentComplete={() => {
                  fetchAppointmentDetail();
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentDetail; 
