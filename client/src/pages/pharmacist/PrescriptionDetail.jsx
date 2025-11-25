import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { 
  FaArrowLeft, FaCheckCircle, FaTimesCircle, FaPills,
  FaFileMedical, FaUser, FaUserMd, FaPrint, FaExclamationTriangle,
  FaMoneyBillWave
} from 'react-icons/fa';

const PrescriptionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUserData } = useAuth();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [hospitalIdError, setHospitalIdError] = useState(false);
  const [stockValidation, setStockValidation] = useState(null);

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
      
      if (id) {
        fetchPrescription();
      }
    };

    initialize();
  }, [id, user, updateUserData]);

  const fetchPrescription = async () => {
    try {
      setLoading(true);
      setHospitalIdError(false);
      const response = await api.get(`/prescriptions/${id}`);
      if (response.data.success) {
        const prescriptionData = response.data.data;
        setPrescription(prescriptionData);
        
        // Validate stock availability when prescription is loaded
        if (prescriptionData.status === 'verified' && prescriptionData.medications) {
          validateStock(prescriptionData.medications);
        }
      } else {
        toast.error('Không thể tải đơn thuốc');
      }
    } catch (error) {
      console.error('Error fetching prescription:', error);
      if (error.response?.status === 400 && error.response?.data?.message?.includes('chưa được gán vào chi nhánh')) {
        setHospitalIdError(true);
      }
      toast.error(error.response?.data?.message || 'Không thể tải đơn thuốc');
    } finally {
      setLoading(false);
    }
  };

  const validateStock = async (medications) => {
    try {
      const response = await api.post('/prescriptions/validate-stock', {
        medications: medications.map(med => ({
          medicationId: med.medicationId._id || med.medicationId,
          quantity: med.quantity
        })),
        prescriptionId: id
      });
      
      if (response.data.success) {
        setStockValidation(response.data.data);
      }
    } catch (error) {
      console.error('Error validating stock:', error);
    }
  };

  const handleVerify = async () => {
    if (processing) return;
    
    try {
      setProcessing(true);
      const response = await api.post(`/prescriptions/${id}/verify`, {
        notes: verificationNotes || undefined
      });
      
      if (response.data.success) {
        toast.success('Phê duyệt đơn thuốc thành công');
        await fetchPrescription();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể phê duyệt đơn thuốc');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    if (processing) return;

    try {
      setProcessing(true);
      const response = await api.post(`/prescriptions/${id}/reject`, {
        reason: rejectReason
      });
      
      if (response.data.success) {
        toast.success('Từ chối đơn thuốc thành công');
        setShowRejectModal(false);
        setRejectReason('');
        await fetchPrescription();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể từ chối đơn thuốc');
    } finally {
      setProcessing(false);
    }
  };

  const handleDispense = async () => {
    if (processing) return;

    // Check stock before dispense
    if (stockValidation) {
      const unavailableMedications = stockValidation.filter(s => !s.available);
      if (unavailableMedications.length > 0) {
        const medNames = unavailableMedications.map(m => m.medicationName || 'Thuốc').join(', ');
        toast.error(`Không đủ tồn kho cho: ${medNames}`);
        return;
      }
    }

    if (!window.confirm('Xác nhận cấp thuốc cho đơn thuốc này?')) {
      return;
    }

    try {
      setProcessing(true);
      const response = await api.post(`/prescriptions/${id}/dispense`);
      
      if (response.data.success) {
        toast.success('Cấp thuốc thành công');
        await fetchPrescription();
        setStockValidation(null); // Clear validation after successful dispense
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể cấp thuốc');
      // Refresh stock validation on error
      if (prescription?.medications) {
        validateStock(prescription.medications);
      }
    } finally {
      setProcessing(false);
    }
  };

  // Check if dispense button should be disabled
  const canDispense = () => {
    if (prescription?.status !== 'verified') return false;
    if (stockValidation) {
      const allAvailable = stockValidation.every(s => s.available);
      return allAvailable;
    }
    return true; // Allow if validation not loaded yet
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Không xác định';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Không xác định';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount || 0);
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
      pending: 'Chờ xử lý',
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
              onClick={() => navigate('/pharmacist/prescriptions')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 text-center">
        <p className="text-gray-500 mb-4">Không tìm thấy đơn thuốc</p>
        <Link 
          to="/pharmacist/prescriptions"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <FaArrowLeft className="mr-2" />
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link 
          to="/pharmacist/prescriptions"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <FaArrowLeft className="mr-2" />
          Quay lại danh sách
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <FaPrint className="mr-2" />
          In đơn thuốc
        </button>
      </div>

      {/* Prescription Card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Đơn thuốc {prescription.prescriptionOrder ? `đợt ${prescription.prescriptionOrder}` : ''}
              </h1>
              {prescription.isHospitalization && (
                <span className="inline-block mt-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                  Nội trú
                </span>
              )}
            </div>
            <div className="mt-2 md:mt-0 flex gap-2">
              <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-semibold text-sm">
                Mã: {prescription._id.substring(0, 8).toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full font-semibold text-sm ${getStatusBadge(prescription.status)}`}>
                {getStatusText(prescription.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Patient and Doctor Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                <FaUser className="mr-2" />
                Bệnh nhân
              </h3>
              <p className="text-gray-800 font-medium">{prescription.patientId?.fullName || 'N/A'}</p>
              <p className="text-sm text-gray-600">{prescription.patientId?.phoneNumber || ''}</p>
              <p className="text-sm text-gray-600">{prescription.patientId?.email || ''}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                <FaUserMd className="mr-2" />
                Bác sĩ kê đơn
              </h3>
              <p className="text-gray-800 font-medium">
                {prescription.doctorId?.user?.fullName || 'N/A'}
              </p>
              {prescription.doctorId?.title && (
                <p className="text-sm text-gray-600">{prescription.doctorId.title}</p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Ngày kê đơn</h3>
              <p className="text-gray-800">{formatDate(prescription.createdAt)}</p>
            </div>
            {prescription.verifiedAt && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Ngày phê duyệt</h3>
                <p className="text-gray-800">{formatDate(prescription.verifiedAt)}</p>
                {prescription.verifiedBy?.fullName && (
                  <p className="text-xs text-gray-600">Bởi: {prescription.verifiedBy.fullName}</p>
                )}
              </div>
            )}
            {prescription.dispensedAt && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Ngày cấp thuốc</h3>
                <p className="text-gray-800">{formatDate(prescription.dispensedAt)}</p>
                {prescription.dispensedBy?.fullName && (
                  <p className="text-xs text-gray-600">Bởi: {prescription.dispensedBy.fullName}</p>
                )}
              </div>
            )}
          </div>

          {/* Diagnosis */}
          {prescription.diagnosis && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-500 mb-2">Chẩn đoán</h2>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-gray-800">{prescription.diagnosis}</p>
              </div>
            </div>
          )}

          {/* Medications */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
              <FaFileMedical className="mr-2" />
              Danh sách thuốc
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="px-4 py-3 border-b">Thuốc</th>
                    <th className="px-4 py-3 border-b">Số lượng</th>
                    <th className="px-4 py-3 border-b">Tồn kho</th>
                    <th className="px-4 py-3 border-b">Liều lượng</th>
                    <th className="px-4 py-3 border-b">Cách dùng</th>
                    <th className="px-4 py-3 border-b">Thời gian</th>
                    <th className="px-4 py-3 border-b text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {prescription.medications && prescription.medications.length > 0 ? (
                    prescription.medications.map((med, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">
                            {med.medicationId?.name || med.medicationName}
                          </div>
                          {med.unitPrice > 0 && (
                            <div className="text-xs text-gray-500">
                              {formatCurrency(med.unitPrice)} / {med.medicationId?.unitTypeDisplay || 'đơn vị'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{med.quantity} {med.medicationId?.unitTypeDisplay || 'đơn vị'}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const stockInfo = stockValidation?.find(s => 
                              s.medicationId === (med.medicationId?._id || med.medicationId)?.toString()
                            );
                            const availableStock = stockInfo?.availableStock ?? med.medicationId?.stockQuantity ?? 'N/A';
                            const isLowStock = availableStock !== 'N/A' && availableStock < med.quantity;
                            const isOutOfStock = availableStock !== 'N/A' && availableStock === 0;
                            
                            return (
                              <div>
                                <span className={isOutOfStock ? 'text-red-600 font-semibold' : isLowStock ? 'text-yellow-600 font-semibold' : 'text-gray-800'}>
                                  {availableStock !== 'N/A' ? `${availableStock} ${med.medicationId?.unitTypeDisplay || 'đơn vị'}` : 'N/A'}
                                </span>
                                {isLowStock && !isOutOfStock && (
                                  <div className="text-xs text-yellow-600 mt-1">
                                    <FaExclamationTriangle className="inline mr-1" />
                                    Tồn kho thấp
                                  </div>
                                )}
                                {isOutOfStock && (
                                  <div className="text-xs text-red-600 mt-1">
                                    <FaExclamationTriangle className="inline mr-1" />
                                    Hết hàng
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">{med.dosage || '—'}</td>
                        <td className="px-4 py-3">{med.usage || '—'}</td>
                        <td className="px-4 py-3">{med.duration || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {med.totalPrice > 0 ? formatCurrency(med.totalPrice) : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-4 py-3 text-center text-gray-500">Không có thuốc</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total Amount */}
          {prescription.totalAmount > 0 && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-green-900">Tổng tiền đơn thuốc:</span>
                <span className="text-2xl font-bold text-green-900">
                  {formatCurrency(prescription.totalAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          {prescription.notes && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-500 mb-2">Ghi chú</h2>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-gray-800">{prescription.notes}</p>
              </div>
            </div>
          )}

          {/* Verification Notes */}
          {prescription.verificationNotes && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-500 mb-2">Ghi chú phê duyệt</h2>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <p className="text-gray-800">{prescription.verificationNotes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {prescription.status === 'approved' && (
          <div className="p-6 bg-yellow-50 border-t border-yellow-200">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ghi chú phê duyệt (tùy chọn)
                </label>
                <textarea
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập ghi chú khi phê duyệt..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleVerify}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
                >
                  <FaCheckCircle className="mr-2" />
                  {processing ? 'Đang xử lý...' : 'Phê duyệt đơn thuốc'}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-semibold"
                >
                  <FaTimesCircle className="mr-2" />
                  Từ chối
                </button>
              </div>
            </div>
          </div>
        )}

        {prescription.status === 'verified' && (
          <div className="p-6 bg-green-50 border-t border-green-200">
            {stockValidation && !stockValidation.every(s => s.available) && (
              <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                <div className="flex items-start">
                  <FaExclamationTriangle className="text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 mb-1">Cảnh báo tồn kho</p>
                    <ul className="text-xs text-yellow-700 list-disc list-inside">
                      {stockValidation
                        .filter(s => !s.available)
                        .map((s, idx) => (
                          <li key={idx}>
                            {s.medicationName}: {s.reason || `Cần ${s.requestedQuantity}, chỉ còn ${s.availableStock}`}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleDispense}
              disabled={processing || !canDispense()}
              className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              <FaPills className="mr-2" />
              {processing ? 'Đang xử lý...' : canDispense() ? 'Cấp thuốc' : 'Không thể cấp thuốc (thiếu tồn kho)'}
            </button>
          </div>
        )}

        {prescription.status === 'dispensed' && (
          <div className="p-6 bg-blue-50 border-t border-blue-200">
            <div className="text-center mb-4">
              <FaCheckCircle className="mx-auto text-4xl text-green-600 mb-2" />
              <p className="text-lg font-semibold text-gray-800">Đơn thuốc đã được cấp</p>
              {prescription.dispensedAt && (
                <p className="text-sm text-gray-600 mt-1">
                  Ngày cấp: {formatDate(prescription.dispensedAt)}
                </p>
              )}
            </div>
            {/* Button to confirm payment if not paid yet - chỉ hiển thị nếu có appointment hoặc đơn từ AI */}
            {(prescription.appointmentId || prescription.createdFromDraft) && (
              <div className="mt-4">
                <button
                  onClick={async () => {
                    if (!window.confirm('Xác nhận bệnh nhân đã thanh toán đơn thuốc này bằng tiền mặt?')) return;
                    try {
                      setProcessing(true);
                      // Đối với đơn thuốc từ AI, không cần appointmentId
                      const appointmentId = prescription.appointmentId?._id || prescription.appointmentId;
                      const response = await api.post('/billing/pay-prescription', {
                        prescriptionId: prescription._id,
                        paymentMethod: 'cash',
                        transactionId: `PRES-CASH-${Date.now()}`,
                        paymentDetails: { 
                          method: 'cash', 
                          timestamp: new Date().toISOString(),
                          confirmedBy: user?.fullName || 'Pharmacist'
                        }
                      });
                      if (response.data.success) {
                        toast.success('Xác nhận thanh toán thành công');
                        await fetchPrescription();
                      }
                    } catch (error) {
                      toast.error(error.response?.data?.message || 'Không thể xác nhận thanh toán');
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  disabled={processing}
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                >
                  <FaMoneyBillWave className="mr-2" />
                  {processing ? 'Đang xử lý...' : 'Xác nhận thanh toán tiền mặt'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Từ chối đơn thuốc</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lý do từ chối *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Nhập lý do từ chối đơn thuốc..."
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {processing ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionDetail;

