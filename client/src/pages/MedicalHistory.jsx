import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const MedicalHistory = () => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [draftRecords, setDraftRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ officialTotal: 0, draftTotal: 0 });
  const { user } = useAuth();

  useEffect(() => {
    fetchMedicalHistory();
  }, [user, currentPage, pageSize, activeTab]);

  const fetchMedicalHistory = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/prescriptions/user/history?page=${currentPage}&limit=${pageSize}${activeTab !== 'all' ? `&status=${activeTab}` : ''}`);
      
      if (response.data && response.data.records) {
        const records = response.data.records;
        const drafts = records.filter(record => record.isDraft);
        const official = records.filter(record => !record.isDraft);

        setMedicalRecords(official);
        setDraftRecords(drafts);
        setTotalItems(response.data.pagination?.total || records.length);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setStats(response.data.stats || { officialTotal: official.length, draftTotal: drafts.length });
        setError(null);
      } else {
        setMedicalRecords([]);
        setDraftRecords([]);
        setTotalItems(0);
        setTotalPages(1);
        setStats({ officialTotal: 0, draftTotal: 0 });
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch medical history:", err);
      const errorMsg = err.response?.data?.message || "Không thể tải lịch sử khám bệnh. Vui lòng thử lại sau.";
      setError(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (e) => {
    setPageSize(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Filter is now handled by backend, but we can add client-side filtering if needed
  const filteredRecords = medicalRecords;
  const showDraftSection = activeTab === 'all' || activeTab === 'pending_approval';
  const visibleDraftCount = showDraftSection ? draftRecords.length : 0;

  const getStatusBadge = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending_approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'dispensed':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'Không xác định';
    
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Chờ xử lý';
      case 'pending_approval':
        return 'Chờ duyệt';
      case 'approved':
        return 'Đã kê đơn';
      case 'verified':
        return 'Đã phê duyệt';
      case 'dispensed':
        return 'Đã cấp thuốc';
      case 'completed':
        return 'Hoàn thành';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  // Generate pagination numbers
  const generatePaginationNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always add first page
      pages.push(1);
      
      // Calculate start and end of the middle section
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if at edges
      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }
      
      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always add last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  const displayedCount = visibleDraftCount + filteredRecords.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
            <div className="text-center text-red-500">
              <svg className="w-16 h-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-semibold mt-4">{error}</h2>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden max-w-6xl mx-auto">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-800">Lịch sử đơn thuốc</h1>
            <p className="text-sm text-gray-500 mt-1">
              Bạn có {stats.draftTotal || 0} đơn chờ duyệt và {stats.officialTotal || 0} đơn đã ghi nhận
            </p>
          </div>

          {/* Filter tabs */}
          <div className="border-b border-gray-200">
            <div className="px-6 flex space-x-4 overflow-x-auto">
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'all'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => {
                  setActiveTab('all');
                  setCurrentPage(1);
                }}
              >
                Tất cả
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'pending_approval'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => {
                  setActiveTab('pending_approval');
                  setCurrentPage(1);
                }}
              >
                Đơn chờ duyệt
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'approved'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => {
                  setActiveTab('approved');
                  setCurrentPage(1);
                }}
              >
                Đã kê đơn
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'dispensed'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => {
                  setActiveTab('dispensed');
                  setCurrentPage(1);
                }}
              >
                Đã cấp thuốc
              </button>
            </div>
          </div>

          {showDraftSection && draftRecords.length > 0 && (
            <div className="px-6 py-5 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Đơn thuốc chờ duyệt</h2>
                  <p className="text-sm text-gray-500 mt-1">Các đơn thuốc do AI đề xuất đang chờ dược sĩ/bác sĩ thẩm định</p>
                </div>
                <span className="text-sm text-gray-500">
                  Tổng cộng: <strong>{stats.draftTotal || draftRecords.length}</strong> đơn
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {draftRecords.map((draft) => (
                  <div key={draft.prescriptionCode || draft.createdAt} className="border border-gray-200 rounded-lg bg-gray-50 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Mã đơn thuốc</p>
                        <p className="text-lg font-semibold text-gray-900">{draft.prescriptionCode || 'Đang cấp mã'}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(draft.status)}`}>
                        {formatStatus(draft.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-gray-500">Ngày tạo</p>
                        <p className="font-medium">{draft.createdAt ? format(new Date(draft.createdAt), 'dd/MM/yyyy HH:mm') : '—'}</p>
                      </div>
                      <div>
                  <p className="text-gray-500">Triệu chứng</p>
                  <p className="font-medium">{draft.symptom || 'Chưa xác định'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Số thuốc đề xuất</p>
                        <p className="font-medium">{draft.medicationsCount || 0} loại</p>
                      </div>
                    </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div>
                  <p className="text-gray-500">Chi nhánh phụ trách</p>
                  <p className="font-medium">{draft.hospital?.name || 'Đang xác định'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Chuyên khoa gợi ý</p>
                  <p className="font-medium">{draft.specialty?.name || 'Chưa xác định'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Bác sĩ phụ trách</p>
                  <p className="font-medium">{draft.doctor?.name || 'Chưa có bác sĩ'}</p>
                </div>
              </div>

                    {draft.medications && draft.medications.length > 0 && (
                      <div className="mt-3 text-sm text-gray-600">
                        <p className="text-gray-500">Danh sách thuốc gợi ý</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {draft.medications.slice(0, 3).map((med, idx) => (
                            <span key={`${draft.prescriptionCode || idx}-${idx}`} className="px-3 py-1 rounded-full bg-white border text-xs">
                              {med.name} × {med.quantity}
                            </span>
                          ))}
                          {draft.medicationsCount > 3 && (
                            <span className="text-xs text-gray-500">+{draft.medicationsCount - 3} thuốc khác</span>
                          )}
                        </div>
                      </div>
                    )}

              {draft.hospitalAvailability && draft.hospitalAvailability.length > 0 && (
                <div className="mt-4 text-sm text-gray-600">
                  <p className="text-gray-500">Tình trạng thuốc tại các chi nhánh</p>
                  <div className="mt-2 space-y-2">
                    {draft.hospitalAvailability.map((branch, idx) => (
                      <div key={`${draft.prescriptionCode || idx}-branch-${idx}`} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                          <p className="font-medium text-gray-900">{branch.hospitalName || 'Chi nhánh không xác định'}</p>
                          <span className="text-xs text-gray-500 mt-1 md:mt-0">
                            Còn {branch.totalInStock || 0} loại / Hết {branch.outOfStock?.length || 0} loại
                          </span>
                        </div>
                        {branch.inStock && branch.inStock.length > 0 && (
                          <p className="mt-2 text-xs text-gray-500">
                            Thuốc còn: {branch.inStock.slice(0, 3).map(item => item.name).join(', ')}
                            {branch.inStock.length > 3 ? '…' : ''}
                          </p>
                        )}
                        {branch.outOfStock && branch.outOfStock.length > 0 && (
                          <p className="mt-1 text-xs text-gray-400">
                            Hết thuốc: {branch.outOfStock.slice(0, 3).map(item => item.name).join(', ')}
                            {branch.outOfStock.length > 3 ? '…' : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

                    <p className="mt-3 text-xs text-gray-500">
                      Đơn thuốc sẽ xuất hiện trong lịch sử chính thức sau khi được dược sĩ/bác sĩ phê duyệt.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Không có lịch sử đơn thuốc chính thức</h3>
              <p className="mt-1 text-gray-500">
                {activeTab === 'all' 
                  ? (draftRecords.length > 0 
                      ? 'Hiện bạn chỉ có các đơn chờ duyệt. Vui lòng chờ dược sĩ/bác sĩ phê duyệt.' 
                      : 'Bạn chưa có lịch sử đơn thuốc nào.') 
                  : `Không có đơn thuốc nào ở trạng thái "${
                      activeTab === 'approved' ? 'Đã kê đơn' : 
                      activeTab === 'dispensed' ? 'Đã cấp thuốc' : 
                      activeTab === 'pending_approval' ? 'Chờ duyệt' : 'Chờ xử lý'
                    }".`}
              </p>
              <Link 
                to="/appointment" 
                className="mt-5 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark"
              >
                Đặt lịch khám mới
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ngày khám
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bác sĩ
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chuyên khoa
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chẩn đoán
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Số đơn thuốc
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chi tiết
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thanh toán
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRecords.map((record) => {
                      // Get diagnosis from first prescription
                      const firstPrescription = record.prescriptions && record.prescriptions[0];
                      const diagnosis = firstPrescription?.diagnosis || 'Chưa có chẩn đoán';
                      // Get overall status (if all dispensed then dispensed, if any approved then approved, else pending)
                      const overallStatus = record.prescriptions?.every(p => p.status === 'dispensed') 
                        ? 'dispensed'
                        : record.prescriptions?.some(p => p.status === 'approved' || p.status === 'verified' || p.status === 'dispensed')
                        ? 'approved'
                        : 'pending';
                      
                      // Tính tổng tiền và kiểm tra trạng thái thanh toán
                       const totalAmount = record.prescriptions?.reduce((sum, p) => sum + (p.totalAmount || 0), 0) || 0;
                       const hasPayablePrescription = record.prescriptions?.some((p) => {
                         const status = p.status;
                         const paymentStatus = p.paymentStatus || 'pending';
                         const amount = p.totalAmount || 0;
                         return (
                           amount > 0 &&
                           paymentStatus !== 'paid' &&
                           (status === 'approved' || status === 'verified')
                         );
                       });
                       const allPaid = record.prescriptions?.length > 0 && record.prescriptions.every((p) => {
                         const paymentStatus = p.paymentStatus || 'pending';
                         const amount = p.totalAmount || 0;
                         return amount === 0 || paymentStatus === 'paid';
                       });
                      
                      return (
                        <tr key={record.appointmentId?._id || record.appointmentId || record.createdAt} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(record.appointmentDate || record.createdAt), 'dd/MM/yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center mr-2">
                                {record.doctor?.charAt(0) || 'D'}
                              </div>
                              <div className="text-sm text-gray-900">{record.doctor || 'Chưa xác định'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.specialty || 'Chưa xác định'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="max-w-xs truncate">
                              {diagnosis}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.prescriptions?.length || 0} đơn
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(overallStatus)}`}>
                              {formatStatus(overallStatus)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {record.appointmentId ? (
                              <Link 
                                to={`/appointments/${record.appointmentId}`} 
                                className="text-primary hover:text-primary-dark"
                              >
                                Xem chi tiết
                              </Link>
                            ) : firstPrescription?._id ? (
                              <Link 
                                to={`/prescriptions/${firstPrescription._id}`} 
                                className="text-primary hover:text-primary-dark"
                              >
                                Xem chi tiết
                              </Link>
                            ) : (
                              <span className="text-gray-400">Không có dữ liệu</span>
                            )}
                          </td>
                           <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                             {hasPayablePrescription ? (
                              <Link
                                to={firstPrescription?._id ? `/prescriptions/${firstPrescription._id}` : '#'}
                                className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Thanh toán
                              </Link>
                             ) : allPaid ? (
                               <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-green-700 text-xs font-medium rounded-md">
                                 <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                 </svg>
                                 Đã thanh toán
                               </span>
                             ) : totalAmount === 0 ? (
                              <span className="text-xs text-gray-400">Miễn phí</span>
                            ) : (
                              <span className="text-xs text-gray-400">Chưa thể thanh toán</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center mb-4 sm:mb-0">
                  <span className="text-sm text-gray-700">
                    Hiển thị <span className="font-medium">{displayedCount}</span> / <span className="font-medium">{totalItems}</span> bản ghi (bao gồm cả đơn chờ duyệt)
                  </span>
                  <div className="ml-4">
                    <label htmlFor="pageSize" className="mr-2 text-sm text-gray-600">Số dòng:</label>
                    <select
                      id="pageSize"
                      name="pageSize"
                      value={pageSize}
                      onChange={handlePageSizeChange}
                      className="text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center justify-center sm:justify-end space-x-1">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentPage === 1
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    &laquo;
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentPage === 1
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    &lsaquo;
                  </button>
                  
                  {/* Page numbers */}
                  {generatePaginationNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-700">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          currentPage === page
                            ? 'bg-primary text-white'
                            : 'text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentPage === totalPages
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    &rsaquo;
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentPage === totalPages
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalHistory; 