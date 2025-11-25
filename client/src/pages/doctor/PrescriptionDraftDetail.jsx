import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import { 
  FaArrowLeft, FaCheckCircle, FaTimesCircle, FaPills,
  FaFileMedical, FaUser, FaUserMd, FaHospital, FaExclamationTriangle
} from 'react-icons/fa';

const PrescriptionDraftDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');

  useEffect(() => {
    if (id) {
      fetchDraft();
    }
  }, [id]);

  const fetchDraft = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/prescriptions/doctor/drafts/${id}`);
      if (response.data.success) {
        setDraft(response.data.data);
      } else {
        toast.error('Không thể tải đơn thuốc nháp');
        navigate('/doctor/prescription-drafts');
      }
    } catch (error) {
      console.error('Error fetching prescription draft:', error);
      toast.error(error.response?.data?.message || 'Không thể tải đơn thuốc nháp');
      navigate('/doctor/prescription-drafts');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn duyệt đơn thuốc nháp này? Đơn thuốc sẽ được tạo và trừ kho thuốc.')) {
      return;
    }

    setProcessing(true);
    try {
      const response = await api.post(`/prescriptions/doctor/drafts/${id}/approve`, {
        notes: approveNotes || 'Đã được bác sĩ duyệt'
      });
      
      if (response.data.success) {
        toast.success('Duyệt đơn thuốc nháp thành công');
        navigate('/doctor/prescription-drafts');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể duyệt đơn thuốc nháp');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason || rejectReason.trim() === '') {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }

    setProcessing(true);
    try {
      const response = await api.post(`/prescriptions/doctor/drafts/${id}/reject`, {
        reason: rejectReason.trim()
      });
      
      if (response.data.success) {
        toast.success('Từ chối đơn thuốc nháp thành công');
        navigate('/doctor/prescription-drafts');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể từ chối đơn thuốc nháp');
    } finally {
      setProcessing(false);
      setShowRejectModal(false);
      setRejectReason('');
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
      pending_approval: { color: 'bg-yellow-100 text-yellow-800', icon: FaExclamationTriangle, text: 'Chờ duyệt' },
      approved: { color: 'bg-green-100 text-green-800', icon: FaCheckCircle, text: 'Đã duyệt' },
      rejected: { color: 'bg-red-100 text-red-800', icon: FaTimesCircle, text: 'Đã từ chối' }
    };
    const badge = badges[status] || badges.pending_approval;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="mr-2" />
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Không tìm thấy đơn thuốc nháp</p>
          <Link to="/doctor/prescription-drafts" className="text-blue-600 hover:underline mt-2 inline-block">
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const totalAmount = draft.medications?.reduce((sum, med) => {
    const price = med.price || med.medicationId?.unitPrice || 0;
    const quantity = med.quantity || 1;
    return sum + (price * quantity);
  }, 0) || 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/doctor/prescription-drafts"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <FaArrowLeft className="mr-2" />
          Quay lại danh sách
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <FaFileMedical className="mr-2" />
              Chi Tiết Đơn Thuốc Nháp
            </h1>
            <p className="text-gray-600 mt-1">Mã đơn: {draft.prescriptionCode || 'N/A'}</p>
          </div>
          <div>
            {getStatusBadge(draft.status)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FaUser className="mr-2" />
              Thông Tin Bệnh Nhân
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Họ và tên</label>
                <p className="text-gray-900">{draft.patientId?.fullName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{draft.patientId?.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Số điện thoại</label>
                <p className="text-gray-900">{draft.patientId?.phoneNumber || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Diagnosis & Symptoms */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Chẩn Đoán & Triệu Chứng</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Triệu chứng</label>
                <p className="text-gray-900 mt-1">{draft.symptom || 'N/A'}</p>
              </div>
              {draft.diagnosis && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Chẩn đoán</label>
                  <p className="text-gray-900 mt-1">{draft.diagnosis}</p>
                </div>
              )}
              {draft.note && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Ghi chú</label>
                  <p className="text-gray-900 mt-1">{draft.note}</p>
                </div>
              )}
            </div>
          </div>

          {/* Medications */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FaPills className="mr-2" />
              Danh Sách Thuốc ({draft.medications?.length || 0} loại)
            </h2>
            {draft.medications && draft.medications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên thuốc</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số lượng</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đơn giá</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {draft.medications.map((med, index) => {
                      const medication = med.medicationId || med;
                      const price = med.price || medication?.unitPrice || 0;
                      const quantity = med.quantity || 1;
                      const total = price * quantity;
                      return (
                        <tr key={index}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {med.name || medication?.name || 'N/A'}
                            </div>
                            {medication?.unitTypeDisplay && (
                              <div className="text-sm text-gray-500">{medication.unitTypeDisplay}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {quantity}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(price)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        Tổng cộng:
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                        {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Không có thuốc nào</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Hospital & Specialty Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FaHospital className="mr-2" />
              Thông Tin Bệnh Viện
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Bệnh viện</label>
                <p className="text-gray-900">{draft.hospitalId?.name || 'N/A'}</p>
                {draft.hospitalId?.address && (
                  <p className="text-sm text-gray-500">{draft.hospitalId.address}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Chuyên khoa</label>
                <p className="text-gray-900">{draft.specialtyId?.name || 'N/A'}</p>
              </div>
              {draft.doctorId && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Bác sĩ được gán</label>
                  <p className="text-gray-900">{draft.doctorId?.user?.fullName || draft.doctorName || 'N/A'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {draft.status === 'pending_approval' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Thao Tác</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ghi chú khi duyệt (tùy chọn)
                  </label>
                  <textarea
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nhập ghi chú..."
                  />
                </div>
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <FaCheckCircle className="mr-2" />
                  {processing ? 'Đang xử lý...' : 'Duyệt Đơn Thuốc'}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <FaTimesCircle className="mr-2" />
                  Từ Chối
                </button>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Thông Tin Khác</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="font-medium text-gray-500">Ngày tạo</label>
                <p className="text-gray-900">{formatDate(draft.createdAt)}</p>
              </div>
              {draft.approvedAt && (
                <div>
                  <label className="font-medium text-gray-500">Ngày duyệt/từ chối</label>
                  <p className="text-gray-900">{formatDate(draft.approvedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Từ Chối Đơn Thuốc Nháp</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lý do từ chối <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Nhập lý do từ chối..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default PrescriptionDraftDetail;

