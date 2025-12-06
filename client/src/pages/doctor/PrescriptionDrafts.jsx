import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaPills, FaSearch, FaFilter, FaEye, FaCheckCircle,
  FaTimesCircle, FaExclamationTriangle, FaClock, FaFileMedical
} from 'react-icons/fa';

const PrescriptionDrafts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchDrafts();
  }, [statusFilter, currentPage]);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const response = await api.get(`/prescriptions/doctor/drafts?page=${currentPage}&limit=20${status ? `&status=${status}` : ''}`);
      
      if (response.data.success) {
        setDrafts(response.data.data || []);
        setTotalPages(response.data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching prescription drafts:', error);
      toast.error(error.response?.data?.message || 'Không thể tải danh sách đơn thuốc nháp');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (draftId) => {
    if (!window.confirm('Bạn có chắc chắn muốn duyệt đơn thuốc nháp này?')) {
      return;
    }

    try {
      const response = await api.post(`/prescriptions/doctor/drafts/${draftId}/approve`, {
        notes: 'Đã được bác sĩ duyệt'
      });
      
      if (response.data.success) {
        toast.success('Duyệt đơn thuốc nháp thành công');
        fetchDrafts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể duyệt đơn thuốc nháp');
    }
  };

  const handleReject = async (draftId) => {
    const reason = prompt('Nhập lý do từ chối đơn thuốc nháp:');
    if (!reason || reason.trim() === '') {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      const response = await api.post(`/prescriptions/doctor/drafts/${draftId}/reject`, {
        reason: reason.trim()
      });
      
      if (response.data.success) {
        toast.success('Từ chối đơn thuốc nháp thành công');
        fetchDrafts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể từ chối đơn thuốc nháp');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending_approval: { color: 'bg-yellow-100 text-yellow-800', icon: FaClock, text: 'Chờ duyệt' },
      approved: { color: 'bg-green-100 text-green-800', icon: FaCheckCircle, text: 'Đã duyệt' },
      rejected: { color: 'bg-red-100 text-red-800', icon: FaTimesCircle, text: 'Đã từ chối' },
      completed: { color: 'bg-blue-100 text-blue-800', icon: FaCheckCircle, text: 'Hoàn thành' },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: FaTimesCircle, text: 'Đã hủy' }
    };
    const badge = badges[status] || badges.pending_approval;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="mr-1" />
        {badge.text}
      </span>
    );
  };

  const filteredDrafts = drafts.filter(draft => {
    const searchLower = searchTerm.toLowerCase();
    return (
      draft.prescriptionCode?.toLowerCase().includes(searchLower) ||
      draft.patientId?.fullName?.toLowerCase().includes(searchLower) ||
      draft.symptom?.toLowerCase().includes(searchLower) ||
      draft.diagnosis?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FaFileMedical className="mr-2" />
          Đơn Thuốc Nháp Cần Duyệt
        </h1>
        <p className="text-gray-600 mt-1">Duyệt các đơn thuốc nháp được tạo từ AI</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tìm kiếm
            </label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm theo mã, tên bệnh nhân, triệu chứng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tất cả</option>
              <option value="pending_approval">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Đã từ chối</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drafts List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredDrafts.length === 0 ? (
          <div className="text-center py-12">
            <FaFileMedical className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Không có đơn thuốc nháp</h3>
            <p className="mt-1 text-sm text-gray-500">
              {statusFilter === 'pending_approval' 
                ? 'Hiện không có đơn thuốc nháp nào cần duyệt'
                : 'Không tìm thấy đơn thuốc nháp nào'}
            </p>
          </div>
        ) : (
          <>
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
                      Triệu chứng
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chuyên khoa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Số thuốc
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
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
                  {filteredDrafts.map((draft) => (
                    <tr key={draft._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {draft.prescriptionCode || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {draft.patientId?.fullName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {draft.patientId?.phoneNumber || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {draft.symptom || draft.diagnosis || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {draft.specialtyId?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {draft.medications?.length || 0} loại
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(draft.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(draft.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Link
                            to={`/doctor/prescription-drafts/${draft._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <FaEye className="inline mr-1" />
                            Xem
                          </Link>
                          {draft.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApprove(draft._id)}
                                className="text-green-600 hover:text-green-900 ml-3"
                              >
                                <FaCheckCircle className="inline mr-1" />
                                Duyệt
                              </button>
                              <button
                                onClick={() => handleReject(draft._id)}
                                className="text-red-600 hover:text-red-900 ml-3"
                              >
                                <FaTimesCircle className="inline mr-1" />
                                Từ chối
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Trang <span className="font-medium">{currentPage}</span> / <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Trước
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Sau
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PrescriptionDrafts;

