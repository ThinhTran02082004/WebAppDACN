import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaPills, FaSearch, FaFilter, FaEye, FaCheckCircle,
  FaTimesCircle, FaExclamationTriangle, FaClock
} from 'react-icons/fa';

const Prescriptions = () => {
  const navigate = useNavigate();
  const { user, updateUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, approved, verified
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hospitalIdError, setHospitalIdError] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      // If user doesn't have hospitalId, try to fetch profile again
      if (user && !user.hospitalId && (user.roleType === 'pharmacist' || user.role === 'pharmacist')) {
        try {
          const profileRes = await api.get('/auth/profile');
          if (profileRes.data.success && profileRes.data.data) {
            const updatedUserData = profileRes.data.data;
            // Update user in context
            updateUserData(updatedUserData);
            
            // Check again after update
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
      // First, try to fetch user profile if hospitalId is missing
      const currentUser = await fetchUserProfile();
      
      // Check if user has hospitalId
      const userToCheck = currentUser || user;
      if (userToCheck && !userToCheck.hospitalId) {
        setHospitalIdError(true);
        setLoading(false);
        return;
      }
      
      fetchPrescriptions();
    };

    initialize();
  }, [statusFilter, currentPage, user, updateUserData]);

  const fetchPrescriptions = async () => {
    setLoading(true);
    setHospitalIdError(false);
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const response = await api.get(`/prescriptions/pharmacy/pending?page=${currentPage}&limit=20${status ? `&status=${status}` : ''}`);
      
      if (response.data.success) {
        setPrescriptions(response.data.data || []);
        setTotalPages(response.data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      if (error.response?.status === 400 && error.response?.data?.message?.includes('chưa được gán vào chi nhánh')) {
        setHospitalIdError(true);
        toast.error('Dược sĩ chưa được gán vào chi nhánh. Vui lòng liên hệ quản trị viên.');
      } else {
        toast.error(error.response?.data?.message || 'Không thể tải danh sách đơn thuốc');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (prescriptionId) => {
    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/verify`, {
        notes: 'Đã phê duyệt bởi dược sĩ'
      });
      
      if (response.data.success) {
        toast.success('Phê duyệt đơn thuốc thành công');
        fetchPrescriptions();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể phê duyệt đơn thuốc');
    }
  };

  const handleReject = async (prescriptionId, reason) => {
    if (!reason || reason.trim() === '') {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/reject`, {
        reason
      });
      
      if (response.data.success) {
        toast.success('Từ chối đơn thuốc thành công');
        fetchPrescriptions();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể từ chối đơn thuốc');
    }
  };

  const handleDispense = async (prescriptionId) => {
    try {
      const response = await api.post(`/prescriptions/${prescriptionId}/dispense`);
      
      if (response.data.success) {
        toast.success('Cấp thuốc thành công');
        fetchPrescriptions();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cấp thuốc');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      approved: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      verified: 'bg-green-100 text-green-800 border border-green-200',
      dispensed: 'bg-blue-100 text-blue-800 border border-blue-200',
      completed: 'bg-gray-100 text-gray-800 border border-gray-200',
      cancelled: 'bg-red-100 text-red-800 border border-red-200'
    };
    return badges[status] || badges.approved;
  };

  const getStatusText = (status) => {
    const texts = {
      approved: 'Chờ phê duyệt',
      verified: 'Đã phê duyệt',
      dispensed: 'Đã cấp thuốc',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy'
    };
    return texts[status] || status;
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      p._id.toLowerCase().includes(search) ||
      p.patientId?.fullName?.toLowerCase().includes(search) ||
      p.doctorId?.user?.fullName?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (hospitalIdError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <FaExclamationTriangle className="mx-auto text-red-500 text-5xl mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Thiếu thông tin chi nhánh</h2>
          <p className="text-gray-600 mb-4">
            Dược sĩ chưa được gán vào chi nhánh. Vui lòng liên hệ quản trị viên để được gán vào chi nhánh.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={async () => {
                try {
                  const profileRes = await api.get('/auth/profile');
                  if (profileRes.data.success && profileRes.data.data?.hospitalId) {
                    updateUserData(profileRes.data.data);
                    setHospitalIdError(false);
                    window.location.reload();
                  } else {
                    alert('Vẫn chưa có thông tin chi nhánh. Vui lòng liên hệ quản trị viên.');
                  }
                } catch (error) {
                  alert('Không thể tải lại thông tin. Vui lòng thử lại sau.');
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Tải lại thông tin
            </button>
            <button
              onClick={() => navigate('/pharmacist/dashboard')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Quay lại Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && prescriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản lý đơn thuốc</h1>
            <p className="text-gray-600 mt-1">Phê duyệt và cấp thuốc cho bệnh nhân</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo mã đơn, bệnh nhân, bác sĩ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="approved">Chờ phê duyệt</option>
                <option value="verified">Đã phê duyệt</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <FaPills className="mx-auto text-gray-400 text-6xl mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Không có đơn thuốc</h3>
          <p className="text-gray-600">
            {statusFilter === 'all' 
              ? 'Hiện tại không có đơn thuốc nào cần xử lý.' 
              : `Không có đơn thuốc ở trạng thái "${statusFilter === 'approved' ? 'Chờ phê duyệt' : 'Đã phê duyệt'}"`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý đơn thuốc</h1>
          <p className="text-gray-600 mt-1">Phê duyệt và cấp thuốc cho bệnh nhân</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã đơn, bệnh nhân, bác sĩ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="approved">Chờ phê duyệt</option>
              <option value="verified">Đã phê duyệt</option>
            </select>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-600">
              Tổng: <span className="font-semibold">{filteredPrescriptions.length}</span> đơn
            </span>
          </div>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mã đơn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bệnh nhân
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bác sĩ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chẩn đoán
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tổng tiền
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrescriptions.length > 0 ? (
                filteredPrescriptions.map((prescription) => (
                  <tr key={prescription._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/pharmacist/prescriptions/${prescription._id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {prescription._id.substring(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {prescription.patientId?.fullName || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {prescription.patientId?.phoneNumber || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {prescription.doctorId?.user?.fullName || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {prescription.diagnosis || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(prescription.status)}`}>
                        {getStatusText(prescription.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(prescription.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(prescription.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Link
                        to={`/pharmacist/prescriptions/${prescription._id}`}
                        className="text-blue-600 hover:text-blue-800"
                        title="Xem chi tiết"
                      >
                        <FaEye className="inline" />
                      </Link>
                      {prescription.status === 'approved' && (
                        <>
                          <button
                            onClick={() => handleVerify(prescription._id)}
                            className="text-green-600 hover:text-green-800"
                            title="Phê duyệt"
                          >
                            <FaCheckCircle className="inline" />
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Nhập lý do từ chối:');
                              if (reason) handleReject(prescription._id, reason);
                            }}
                            className="text-red-600 hover:text-red-800"
                            title="Từ chối"
                          >
                            <FaTimesCircle className="inline" />
                          </button>
                        </>
                      )}
                      {prescription.status === 'verified' && (
                        <button
                          onClick={() => handleDispense(prescription._id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Cấp thuốc"
                        >
                          <FaPills className="inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    Không có đơn thuốc nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Trang {currentPage} / {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Trước
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Prescriptions;

