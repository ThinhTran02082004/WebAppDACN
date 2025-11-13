import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaCalendarAlt, FaSearch, FaFilter, FaEye,
  FaClock, FaCheckCircle, FaPills, FaUser, FaFileAlt
} from 'react-icons/fa';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const Appointments = () => {
  const navigate = useNavigate();
  const { user, updateUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hospitalIdError, setHospitalIdError] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user && !user.hospitalId && (user.roleType === 'pharmacist' || user.role === 'pharmacist')) {
        try {
          const profileRes = await api.get('/auth/profile');
          if (profileRes.data.success && profileRes.data.data) {
            const updatedUserData = profileRes.data.data;
            updateUserData(updatedUserData);
            if (!updatedUserData.hospitalId) {
              setHospitalIdError(true);
              setLoading(false);
              return null;
            }
            return updatedUserData;
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          if (error.response?.status === 400 && error.response?.data?.message?.includes('chưa được gán vào chi nhánh')) {
            setHospitalIdError(true);
            setLoading(false);
            return null;
          }
        }
      }
      return user;
    };

    const initialize = async () => {
      const currentUser = await fetchUserProfile();
      const userToCheck = currentUser || user;
      if (userToCheck && !userToCheck.hospitalId) {
        setHospitalIdError(true);
        setLoading(false);
        return;
      }
      fetchAppointments();
    };

    initialize();
  }, [currentPage, statusFilter, user, updateUserData]);

  const fetchAppointments = async () => {
    setLoading(true);
    setHospitalIdError(false);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };
      
      const response = await api.get('/appointments/pharmacist', { params });
      
      if (response.data.success) {
        setAppointments(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      if (error.response?.status === 400 && error.response?.data?.message?.includes('chưa được gán vào chi nhánh')) {
        setHospitalIdError(true);
        toast.error('Dược sĩ chưa được gán vào chi nhánh. Vui lòng liên hệ quản trị viên.');
      } else {
        toast.error(error.response?.data?.message || 'Không thể tải danh sách lịch hẹn');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      pending_payment: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
      rescheduled: 'bg-indigo-100 text-indigo-800',
      'no-show': 'bg-gray-100 text-gray-800',
      hospitalized: 'bg-purple-100 text-purple-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      completed: 'Hoàn thành',
      pending_payment: 'Chờ thanh toán',
      cancelled: 'Đã hủy',
      rejected: 'Từ chối',
      rescheduled: 'Đổi lịch',
      'no-show': 'Không đến',
      hospitalized: 'Đang nằm viện'
    };
    return texts[status] || status;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  const filteredAppointments = appointments.filter(appt => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      appt.patientId?.fullName?.toLowerCase().includes(search) ||
      appt.bookingCode?.toLowerCase().includes(search) ||
      appt.doctorId?.user?.fullName?.toLowerCase().includes(search)
    );
  });

  if (hospitalIdError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Thiếu thông tin chi nhánh</h2>
          <p className="text-gray-600 mb-4">
            Dược sĩ chưa được gán vào chi nhánh. Vui lòng liên hệ quản trị viên.
          </p>
          <button
            onClick={async () => {
              try {
                const profileRes = await api.get('/auth/profile');
                if (profileRes.data.success && profileRes.data.data?.hospitalId) {
                  updateUserData(profileRes.data.data);
                  setHospitalIdError(false);
                  fetchAppointments();
                }
              } catch (error) {
                alert('Vẫn chưa có thông tin chi nhánh.');
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tải lại thông tin
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaCalendarAlt /> Quản Lý Lịch Hẹn
            </h1>
            <p className="text-gray-600 mt-1">
              Quản lý các lịch hẹn có đơn thuốc cần xử lý
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên bệnh nhân, mã đặt lịch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="pending_payment">Chờ thanh toán</option>
            <option value="completed">Hoàn thành</option>
          </select>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaCalendarAlt className="mx-auto text-4xl mb-4 text-gray-300" />
            <p className="text-lg">Không có lịch hẹn nào</p>
            <p className="text-sm mt-2">
              {searchTerm ? 'Thử thay đổi từ khóa tìm kiếm' : 'Hiện tại không có lịch hẹn nào có đơn thuốc cần xử lý'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mã đặt lịch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bệnh nhân
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bác sĩ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ngày khám
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đơn thuốc
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {appointment.bookingCode || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={
                                appointment.patientId?.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  appointment.patientId?.fullName || 'Patient'
                                )}&background=3B82F6&color=fff`
                              }
                              alt={appointment.patientId?.fullName}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {appointment.patientId?.fullName || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {appointment.patientId?.phoneNumber || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {appointment.doctorId?.user?.fullName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {appointment.specialtyId?.name || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(appointment.appointmentDate)}
                        </div>
                        {appointment.timeSlot && (
                          <div className="text-sm text-gray-500">
                            {appointment.timeSlot.startTime} - {appointment.timeSlot.endTime}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FaPills className="text-blue-600" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {appointment.prescriptionsCount || 0} đơn
                            </div>
                            {appointment.pendingPrescriptionsCount > 0 && (
                              <div className="text-xs text-orange-600 font-medium">
                                {appointment.pendingPrescriptionsCount} chờ xử lý
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                            appointment.status
                          )}`}
                        >
                          {getStatusText(appointment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => navigate(`/pharmacist/appointments/${appointment._id}`)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <FaEye /> Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Trang {currentPage} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Appointments;

