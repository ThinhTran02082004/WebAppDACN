import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

const MedicalRecordDetail = () => {
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef();

  useEffect(() => {
    const fetchPrescription = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/prescriptions/${id}`);
        if (response.data.success) {
          setPrescription(response.data.data);
        } else {
          const errorMsg = response.data.message || "Không thể tải đơn thuốc. Vui lòng thử lại sau.";
          setError(errorMsg);
          toast.error(errorMsg);
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch prescription:", err);
        const errorMsg = err.response?.data?.message || "Không thể tải đơn thuốc. Vui lòng thử lại sau.";
        setError(errorMsg);
        toast.error(errorMsg);
        setLoading(false);
      }
    };

    if (id && user) {
      fetchPrescription();
    }
  }, [id, user]);

  // Helper to format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'Không xác định';
    try {
      return format(new Date(dateString), 'dd MMMM yyyy');
    } catch (error) {
      return 'Không xác định';
    }
  };

  // Helper for displaying time in Vietnamese format
  const formatAppointmentDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return `${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
    } catch (error) {
      return '';
    }
  };

  // Helper to get status badge color
  const getStatusBadge = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'completed':
      case 'hoàn thành':
        return 'bg-green-100 text-green-800';
      case 'scheduled':
      case 'đã đặt lịch':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
      case 'đang khám':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
      case 'đã hủy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'Không xác định';
    
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Hoàn thành';
      case 'scheduled':
        return 'Đã đặt lịch';
      case 'in_progress':
        return 'Đang khám';
      case 'cancelled':
        return 'Đã hủy';
      case 'hospitalized':
        return 'Đang nằm viện';
      case 'pending_payment':
        return 'Chờ thanh toán';
      case 'pending':
        return 'Chờ xác nhận';
      case 'confirmed':
        return 'Đã xác nhận';
      case 'rescheduled':
        return 'Đã đổi lịch';
      default:
        return status;
    }
  };

  // Simple print function
  const handlePrint = () => {
    window.print();
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
                onClick={() => navigate('/medical-history')} 
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Quay lại lịch sử khám bệnh
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 012-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h2 className="text-2xl font-semibold mt-4">Không tìm thấy đơn thuốc</h2>
              <button 
                onClick={() => navigate('/medical-history')} 
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Quay lại lịch sử đơn thuốc
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
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <div className="mb-6 print:hidden">
            <Link 
              to="/medical-history" 
              className="inline-flex items-center text-primary hover:text-primary-dark"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại danh sách
            </Link>
          </div>

          {/* Prescription Detail Card */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden print:shadow-none" id="printable-content">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">
                  Đơn thuốc {prescription.prescriptionOrder ? `đợt ${prescription.prescriptionOrder}` : ''}
                </h1>
                <div className="mt-2 md:mt-0 flex gap-2">
                  <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-semibold text-sm">
                    Mã: {prescription._id.substring(0, 8).toUpperCase()}
                  </div>
                  {prescription.isHospitalization && (
                    <div className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full font-semibold text-sm">
                      Nội trú
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Date Information */}
              <div className="flex items-center mb-6">
                <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-700">
                  {formatAppointmentDate(prescription.appointmentId?.appointmentDate || prescription.createdAt)} 
                </span>
                <span className="ml-4 text-sm text-gray-500">
                  Ngày kê đơn: {formatDate(prescription.createdAt)}
                </span>
              </div>

              {/* Doctor and Hospital Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Doctor Info */}
                <div>
                  <h2 className="text-sm font-medium text-blue-600 flex items-center mb-3">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Thông tin bác sĩ
                  </h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p><span className="font-medium">Bác sĩ:</span> {prescription.doctorId?.user?.fullName || 'Không xác định'}</p>
                    <p><span className="font-medium">Chức danh:</span> {prescription.doctorId?.title || 'Bác sĩ'}</p>
                  </div>
                </div>

                {/* Status Info */}
                <div>
                  <h2 className="text-sm font-medium text-blue-600 flex items-center mb-3">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Trạng thái đơn thuốc
                  </h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p><span className="font-medium">Trạng thái:</span> 
                      <span className={`ml-2 px-2 py-1 rounded text-sm ${
                        prescription.status === 'dispensed' ? 'bg-green-100 text-green-800' :
                        prescription.status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                        prescription.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {prescription.status === 'pending' ? 'Chờ xử lý' :
                         prescription.status === 'approved' ? 'Đã kê đơn' :
                         prescription.status === 'verified' ? 'Đã phê duyệt' :
                         prescription.status === 'dispensed' ? 'Đã cấp thuốc' :
                         prescription.status === 'completed' ? 'Hoàn thành' : prescription.status}
                      </span>
                    </p>
                    {prescription.totalAmount > 0 && (
                      <p className="mt-2"><span className="font-medium">Tổng tiền:</span> {new Intl.NumberFormat('vi-VN', { 
                        style: 'currency', 
                        currency: 'VND' 
                      }).format(prescription.totalAmount)}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Diagnosis */}
              {prescription.diagnosis && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-blue-600 flex items-center mb-3">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Chẩn đoán
                  </h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p><span className="font-medium">Chẩn đoán:</span> {prescription.diagnosis}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {prescription.notes && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-blue-600 flex items-center mb-3">
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Ghi chú
                  </h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p>{prescription.notes}</p>
                  </div>
                </div>
              )}

              {/* Prescription */}
              <div>
                <h2 className="text-sm font-medium text-blue-600 flex items-center mb-3">
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Đơn thuốc
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3 border-b border-gray-200">Thuốc</th>
                        <th className="px-4 py-3 border-b border-gray-200">Liều lượng</th>
                        <th className="px-4 py-3 border-b border-gray-200">Cách dùng</th>
                        <th className="px-4 py-3 border-b border-gray-200">Thời gian</th>
                        <th className="px-4 py-3 border-b border-gray-200">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescription.medications && prescription.medications.length > 0 ? (
                        prescription.medications.map((med, index) => (
                          <tr key={index} className="border-b border-gray-200">
                            <td className="px-4 py-3">
                              {med.medicationId?.name || med.medicationName || 'Không có thông tin'}
                              {med.unitPrice && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(med.unitPrice)} / {med.medicationId?.unitTypeDisplay || 'đơn vị'}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">{med.dosage || 'Không có thông tin'}</td>
                            <td className="px-4 py-3">{med.usage || 'Không có thông tin'}</td>
                            <td className="px-4 py-3">{med.duration || 'Không có thông tin'}</td>
                            <td className="px-4 py-3">
                              <div>Số lượng: {med.quantity} {med.medicationId?.unitTypeDisplay || 'đơn vị'}</div>
                              {med.totalPrice > 0 && (
                                <div className="text-xs text-gray-600 mt-1">
                                  Tổng: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(med.totalPrice)}
                                </div>
                              )}
                              {med.notes && (
                                <div className="text-xs text-gray-500 mt-1">{med.notes}</div>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-4 py-3 text-center text-gray-500">Không có thông tin đơn thuốc</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Amount */}
              {prescription.totalAmount > 0 && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-900">Tổng tiền đơn thuốc:</span>
                    <span className="text-xl font-bold text-blue-900">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(prescription.totalAmount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with ID reference */}
            <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 print:bg-white">
              ID: {prescription._id} - Ngày tạo: {formatDate(prescription.createdAt)}
              {prescription.dispensedAt && ` - Ngày cấp thuốc: ${formatDate(prescription.dispensedAt)}`}
            </div>
          </div>

          {/* Add print CSS */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #printable-content, #printable-content * {
                visibility: visible;
              }
              #printable-content {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              .print\\:hidden {
                display: none !important;
              }
              .print\\:shadow-none {
                box-shadow: none !important;
              }
              .print\\:bg-white {
                background-color: white !important;
              }
            }
          `}} />

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-4 print:hidden">
            <Link 
              to="/medical-history" 
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại
            </Link>
            <button 
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              In hồ sơ
            </button>
            <Link 
              to="/appointment" 
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Đặt lịch mới
            </Link>
            {prescription.appointmentId && (
              <Link 
                to={`/appointments/${prescription.appointmentId._id || prescription.appointmentId}`} 
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Xem chi tiết lịch hẹn
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalRecordDetail; 