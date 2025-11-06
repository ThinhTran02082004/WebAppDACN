import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaStethoscope, FaInfoCircle } from 'react-icons/fa';

const DoctorPaymentHistory = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { user } = useAuth();

  useEffect(() => {
    fetchPayments();
  }, [user, currentPage, pageSize, activeTab]);

  const fetchPayments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Fetch payments for appointments where user is the doctor
      const response = await api.get(`/billing/payment-history?page=${currentPage}&limit=${pageSize}&doctorId=${user._id || user.id}${activeTab !== 'all' ? `&billType=${activeTab}` : ''}`);
      
      if (response.data && response.data.data) {
        setPayments(response.data.data);
        setTotalItems(response.data.pagination.total);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        setPayments([]);
        setTotalItems(0);
        setTotalPages(1);
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch payment history:", err);
      const errorMsg = err.response?.data?.message || "Không thể tải lịch sử thanh toán. Vui lòng thử lại sau.";
      setError(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(parseInt(e.target.value));
    setCurrentPage(1);
  };

  const getStatusBadge = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'completed':
      case 'successful':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(amount);
  };

  const generatePaginationNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }
      
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    
    return pages;
  };

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
          <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaStethoscope /> Lịch Sử Thanh Toán Bệnh Nhân
            </h1>
            <p className="text-sm text-gray-500 mt-1">Xem các giao dịch thanh toán của bệnh nhân bạn đã khám</p>
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
                  activeTab === 'consultation'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => {
                  setActiveTab('consultation');
                  setCurrentPage(1);
                }}
              >
                Phí khám
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'medication'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => {
                  setActiveTab('medication');
                  setCurrentPage(1);
                }}
              >
                Tiền thuốc
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === 'hospitalization'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => {
                  setActiveTab('hospitalization');
                  setCurrentPage(1);
                }}
              >
                Phí nội trú
              </button>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Không có lịch sử thanh toán</h3>
              <p className="mt-1 text-gray-500">
                {activeTab === 'all' 
                  ? 'Bạn chưa có bệnh nhân nào thực hiện thanh toán.' 
                  : `Không có lịch sử thanh toán nào cho "${
                      activeTab === 'consultation' ? 'Phí khám' : 
                      activeTab === 'medication' ? 'Tiền thuốc' :
                      'Phí nội trú'
                    }".`}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mã thanh toán
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bệnh nhân
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ngày thanh toán
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Loại
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Số tiền
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phương thức
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chi tiết
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => {
                      const getBillTypeLabel = (billType) => {
                        switch (billType) {
                          case 'consultation':
                            return 'Phí khám';
                          case 'medication':
                            return 'Tiền thuốc';
                          case 'hospitalization':
                            return 'Phí nội trú';
                          default:
                            return billType;
                        }
                      };

                      const getBillTypeBadge = (billType) => {
                        switch (billType) {
                          case 'consultation':
                            return 'bg-blue-100 text-blue-800';
                          case 'medication':
                            return 'bg-green-100 text-green-800';
                          case 'hospitalization':
                            return 'bg-purple-100 text-purple-800';
                          default:
                            return 'bg-gray-100 text-gray-800';
                        }
                      };

                      return (
                        <tr key={payment._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {payment.paymentNumber || payment.transactionId || payment._id.substring(0, 8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {payment.patientId?.fullName || 'N/A'}
                            </div>
                            {payment.patientId?.email && (
                              <div className="text-xs text-gray-500">{payment.patientId.email}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getBillTypeBadge(payment.billType)}`}>
                              {getBillTypeLabel(payment.billType)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payment.paymentMethod === 'cash' ? 'Tiền mặt' : 
                             payment.paymentMethod === 'momo' ? 'MoMo' :
                             payment.paymentMethod === 'paypal' ? 'PayPal' :
                             payment.paymentMethod}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(payment.paymentStatus)}`}>
                              {payment.paymentStatus === 'completed' ? 'Thành công' :
                               payment.paymentStatus === 'pending' ? 'Đang xử lý' :
                               payment.paymentStatus === 'failed' ? 'Thất bại' :
                               payment.paymentStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {payment.appointmentId ? (
                              <Link 
                                to={`/doctor/appointments/${typeof payment.appointmentId === 'object' ? payment.appointmentId._id : payment.appointmentId}`} 
                                className="text-primary hover:text-primary-dark"
                              >
                                Xem lịch hẹn
                              </Link>
                            ) : (
                              <span className="text-gray-400">Không có chi tiết</span>
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
                    Hiển thị <span className="font-medium">{payments.length}</span> / <span className="font-medium">{totalItems}</span> kết quả
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

          {/* Info Note */}
          <div className="bg-blue-50 border-t border-blue-200 px-6 py-4">
            <div className="flex items-start gap-2">
              <FaInfoCircle className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                <strong>Lưu ý:</strong> Đây là lịch sử thanh toán của các bệnh nhân bạn đã khám. Bạn có thể xem chi tiết để theo dõi tình trạng thanh toán.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorPaymentHistory;

