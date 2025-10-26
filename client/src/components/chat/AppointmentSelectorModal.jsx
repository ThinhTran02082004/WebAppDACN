import React, { useState, useEffect } from 'react';
import { FaCalendarAlt, FaTimes, FaSpinner } from 'react-icons/fa';
import api from '../../utils/api';

const AppointmentSelectorModal = ({ isOpen, onClose, onSelect, otherUserId }) => {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchAppointments();
    }
  }, [isOpen, otherUserId]);

  const filterByDate = (dateString, list = appointments) => {
    if (!dateString) return list;
    return list.filter(apt => {
      if (!apt.appointmentDate) return false;
      const aptDate = new Date(apt.appointmentDate).toISOString().split('T')[0];
      return aptDate === dateString;
    });
  };

  const fetchAppointments = async () => {
    if (!otherUserId) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/appointments/chat/shared', {
        params: { otherUserId }
      });
      const data = Array.isArray(response?.data?.data) ? response.data.data : [];
      // Filter appointments that are not cancelled or rejected (server already filters, but keep as fallback)
      const filtered = data.filter(apt => 
        apt.status !== 'cancelled' && apt.status !== 'rejected'
      );
      setAppointments(filtered);
      setFilteredAppointments(filterByDate(searchDate, filtered));
    } catch (error) {
      console.error('Error fetching appointments for chat:', error);
      setAppointments([]);
      setFilteredAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchByDate = () => {
    setFilteredAppointments(filterByDate(searchDate));
  };

  const handleClearFilter = () => {
    setSearchDate('');
    setFilteredAppointments(appointments);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Chọn lịch hẹn để gửi</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <FaTimes className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 border-b bg-gray-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">Ngày khám</label>
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleSearchByDate}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              Tìm kiếm
            </button>
            {searchDate && (
              <button
                onClick={handleClearFilter}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto p-4 max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <FaSpinner className="animate-spin text-primary text-2xl" />
              <span className="ml-2">Đang tải...</span>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FaCalendarAlt className="mx-auto text-4xl mb-2 text-gray-300" />
              <p>Không tìm thấy lịch hẹn phù hợp</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map(apt => {
                const patientName =
                  apt.patientId?.fullName ||
                  apt.patientInfo?.fullName ||
                  apt.patientName ||
                  'Không xác định';

                const patientContact =
                  apt.patientInfo?.phone ||
                  apt.patientContact ||
                  apt.patientId?.phone ||
                  null;

                return (
                  <button
                    key={apt._id}
                    onClick={() => {
                      onSelect(apt._id);
                      onClose();
                    }}
                    className="w-full text-left p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <FaCalendarAlt className="text-blue-600 mr-2" />
                          <span className="font-medium">{apt.bookingCode}</span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>
                            <span className="font-medium">Bác sĩ:</span>{' '}
                            {apt.doctorId?.user?.fullName || apt.doctorId?.fullName || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Người đặt:</span>{' '}
                            {patientName}
                          </div>
                          {patientContact && (
                            <div>
                              <span className="font-medium">Liên hệ:</span>{' '}
                              {patientContact}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Ngày:</span>{' '}
                            {new Date(apt.appointmentDate).toLocaleDateString('vi-VN')}
                          </div>
                          <div>
                            <span className="font-medium">Giờ:</span>{' '}
                            {apt.timeSlot?.startTime} - {apt.timeSlot?.endTime}
                          </div>
                          {apt.serviceId?.name && (
                            <div>
                              <span className="font-medium">Dịch vụ:</span> {apt.serviceId.name}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(apt.status)}`}>
                        {getStatusText(apt.status)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentSelectorModal;

