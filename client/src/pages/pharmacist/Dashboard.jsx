import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
  FaPills, FaCheckCircle, FaClock, FaDollarSign,
  FaExclamationTriangle, FaChartLine, FaAngleRight
} from 'react-icons/fa';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, updateUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hospitalIdError, setHospitalIdError] = useState(false);
  const [stats, setStats] = useState({
    pendingApproval: 0,
    verified: 0,
    dispensedToday: 0,
    totalAmount: 0
  });
  const [recentPrescriptions, setRecentPrescriptions] = useState([]);

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

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Get pharmacy statistics
        const statsRes = await api.get('/prescriptions/pharmacy/pending?limit=100');
        if (statsRes.data.success) {
          const prescriptions = statsRes.data.data || [];
          const pendingCount = prescriptions.filter(p => p.status === 'approved').length;
          const verifiedCount = prescriptions.filter(p => p.status === 'verified').length;
          
          // Get today's dispensed
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dispensedToday = prescriptions.filter(p => {
            if (p.status === 'dispensed' && p.dispensedAt) {
              const dispensedDate = new Date(p.dispensedAt);
              return dispensedDate >= today;
            }
            return false;
          }).length;

          const totalAmount = prescriptions
            .filter(p => p.status === 'dispensed')
            .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

          setStats({
            pendingApproval: pendingCount,
            verified: verifiedCount,
            dispensedToday,
            totalAmount
          });

          setRecentPrescriptions(prescriptions.slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        if (error.response?.status === 400 && error.response?.data?.message?.includes('chưa được gán vào chi nhánh')) {
          setHospitalIdError(true);
        }
      } finally {
        setLoading(false);
      }
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

      // User has hospitalId, fetch dashboard data
      await fetchDashboardData();
    };

    initialize();
  }, [user, updateUserData]);

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
              onClick={() => {
                // Clear user data and redirect to login
                localStorage.removeItem('userInfo');
                sessionStorage.removeItem('userInfo');
                window.location.href = '/login';
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Đăng xuất và đăng nhập lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tổng quan</h1>
          <p className="text-gray-600 mt-1">Quản lý đơn thuốc và kho thuốc</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Chờ phê duyệt</p>
              <p className="text-3xl font-bold text-gray-800">{stats.pendingApproval}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <FaClock className="text-2xl text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Đã phê duyệt</p>
              <p className="text-3xl font-bold text-gray-800">{stats.verified}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <FaCheckCircle className="text-2xl text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Đã cấp hôm nay</p>
              <p className="text-3xl font-bold text-gray-800">{stats.dispensedToday}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <FaPills className="text-2xl text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tổng doanh thu</p>
              <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <FaDollarSign className="text-2xl text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Prescriptions */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <FaPills className="mr-2 text-blue-600" />
            Đơn thuốc gần đây
          </h2>
          <Link 
            to="/pharmacist/prescriptions"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
          >
            Xem tất cả <FaAngleRight className="ml-1" />
          </Link>
        </div>
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
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tổng tiền
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày tạo
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentPrescriptions.length > 0 ? (
                recentPrescriptions.map((prescription) => (
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {prescription.doctorId?.user?.fullName || 'N/A'}
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    Không có đơn thuốc nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

