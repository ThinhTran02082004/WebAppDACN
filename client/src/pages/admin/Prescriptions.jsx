import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaPills,
  FaSearch,
  FaFilter,
  FaEye,
  FaCheckCircle,
  FaTimesCircle,
  FaClipboardCheck
} from 'react-icons/fa';
import api from '../../utils/api';

const AdminPrescriptions = () => {
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('approved');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState({ specialties: [], doctors: [] });
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [detailPrescription, setDetailPrescription] = useState(null);

  useEffect(() => {
    fetchPrescriptions();
  }, [statusFilter, currentPage, selectedSpecialty, selectedDoctor]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const response = await api.get('/prescriptions/admin/filters');
      if (response.data.success) {
        setFilterOptions(response.data.data || { specialties: [], doctors: [] });
      }
    } catch (error) {
      console.error('Error fetching prescription filters:', error);
    }
  };

  const fetchPrescriptions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (selectedSpecialty !== 'all') {
        params.append('specialtyId', selectedSpecialty);
      }

      if (selectedDoctor !== 'all') {
        params.append('doctorId', selectedDoctor);
      }

      const response = await api.get(`/prescriptions/admin?${params.toString()}`);

      if (response.data.success) {
        setPrescriptions(response.data.data || []);
        setTotalPages(response.data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching admin prescriptions:', error);
      toast.error(error.response?.data?.message || 'Không thể tải danh sách đơn thuốc');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (prescriptionId) => {
    try {
      await api.post(`/prescriptions/${prescriptionId}/verify`, {
        notes: 'Phê duyệt bởi quản trị viên'
      });
      toast.success('Phê duyệt đơn thuốc thành công');
      fetchPrescriptions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể phê duyệt đơn thuốc');
    }
  };

  const handleReject = async (prescriptionId) => {
    const reason = prompt('Nhập lý do từ chối đơn thuốc:');
    if (!reason) {
      toast.info('Bạn cần nhập lý do để từ chối');
      return;
    }

    try {
      await api.post(`/prescriptions/${prescriptionId}/reject`, { reason });
      toast.success('Đã từ chối đơn thuốc');
      fetchPrescriptions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể từ chối đơn thuốc');
    }
  };

  const filteredPrescriptions = useMemo(() => {
    if (!searchTerm) {
      return prescriptions;
    }
    const lower = searchTerm.toLowerCase();
    return prescriptions.filter((prescription) => {
      const code = prescription._id?.toLowerCase() || '';
      const patient = prescription.patientId?.fullName?.toLowerCase() || '';
      const doctor = prescription.doctorId?.user?.fullName?.toLowerCase() || '';
      const hospital = prescription.hospitalId?.name?.toLowerCase() || '';
      return (
        code.includes(lower) ||
        patient.includes(lower) ||
        doctor.includes(lower) ||
        hospital.includes(lower)
      );
    });
  }, [prescriptions, searchTerm]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount || 0);

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

  const getStatusInfo = (status, isDraft = false) => {
    const mapping = {
      pending_approval: {
        label: 'Đơn nháp - Chờ duyệt',
        classes: 'bg-orange-100 text-orange-800 border border-orange-200'
      },
      approved: {
        label: isDraft ? 'Đơn nháp - Đã duyệt' : 'Chờ phê duyệt',
        classes: isDraft ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      },
      rejected: {
        label: 'Đơn nháp - Đã từ chối',
        classes: 'bg-red-100 text-red-800 border border-red-200'
      },
      verified: {
        label: 'Đã phê duyệt',
        classes: 'bg-green-100 text-green-800 border border-green-200'
      },
      dispensed: {
        label: 'Đã cấp thuốc',
        classes: 'bg-blue-100 text-blue-800 border border-blue-200'
      },
      completed: {
        label: 'Hoàn thành',
        classes: 'bg-gray-100 text-gray-800 border border-gray-200'
      },
      cancelled: {
        label: 'Đã hủy',
        classes: 'bg-red-100 text-red-800 border border-red-200'
      }
    };

    return (
      mapping[status] || {
        label: status,
        classes: 'bg-gray-100 text-gray-800 border border-gray-200'
      }
    );
  };

  const filteredDoctors = useMemo(() => {
    if (selectedSpecialty === 'all') {
      return filterOptions.doctors;
    }
    return filterOptions.doctors.filter(
      (doctor) => doctor.specialtyId && doctor.specialtyId === selectedSpecialty
    );
  }, [filterOptions.doctors, selectedSpecialty]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-500/30 border-l-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 font-medium">Đang tải danh sách đơn thuốc...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <FaClipboardCheck className="mr-2 text-blue-600" />
            Xét duyệt đơn thuốc
          </h1>
          <p className="text-gray-600 mt-1">
            Theo dõi và phê duyệt các đơn thuốc của bệnh nhân trên toàn hệ thống
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo mã đơn, bệnh nhân, bác sĩ, bệnh viện..."
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
              <option value="approved">Chờ phê duyệt</option>
              <option value="pending_approval">Đơn nháp chờ duyệt</option>
              <option value="verified">Đã phê duyệt</option>
              <option value="dispensed">Đã cấp thuốc</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
              <option value="all">Tất cả trạng thái</option>
            </select>
          </div>
          <div className="relative">
            <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={selectedSpecialty}
              onChange={(e) => {
                setSelectedSpecialty(e.target.value);
                setSelectedDoctor('all');
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">Tất cả chuyên khoa</option>
              {filterOptions.specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={selectedDoctor}
              onChange={(e) => {
                setSelectedDoctor(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">Tất cả bác sĩ</option>
              {filteredDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name} {doctor.specialtyName ? `(${doctor.specialtyName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-600">
              Tổng đơn hiển thị: <span className="font-semibold">{filteredPrescriptions.length}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                  Bệnh viện
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
                filteredPrescriptions.map((prescription) => {
                  const isDraft = prescription.isDraft || prescription.type === 'draft';
                  const statusInfo = getStatusInfo(prescription.status, isDraft);
                  return (
                    <tr key={prescription._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-800">
                          {prescription.prescriptionCode || prescription._id?.slice(0, 8).toUpperCase()}
                          {isDraft && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">
                              Nháp
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {prescription.appointmentId?.bookingCode || (isDraft ? 'Từ AI' : '')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {prescription.patientId?.fullName || '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {prescription.patientId?.phoneNumber || prescription.patientId?.email || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {prescription.doctorId?.user?.fullName || prescription.doctorName || '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {prescription.doctorId?.title || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {prescription.hospitalId?.name || '—'}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[180px]">
                          {prescription.hospitalId?.address || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.classes}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(prescription.totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(prescription.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => setDetailPrescription(prescription)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Xem chi tiết"
                        >
                          <FaEye className="inline" />
                        </button>
                        {!isDraft && prescription.status === 'approved' && (
                          <>
                            <button
                              onClick={() => handleVerify(prescription._id)}
                              className="text-green-600 hover:text-green-800"
                              title="Phê duyệt đơn"
                            >
                              <FaCheckCircle className="inline" />
                            </button>
                            <button
                              onClick={() => handleReject(prescription._id)}
                              className="text-red-600 hover:text-red-800"
                              title="Từ chối đơn"
                            >
                              <FaTimesCircle className="inline" />
                            </button>
                          </>
                        )}
                        {isDraft && (
                          <span className="text-xs text-gray-500 italic">
                            (Cần bác sĩ duyệt)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    Không có đơn thuốc nào phù hợp với tiêu chí lọc hiện tại
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Trang {currentPage} / {totalPages}
            </span>
            <div className="space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition"
              >
                Trước
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
      {detailPrescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setDetailPrescription(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-red-500"
            >
              <FaTimesCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center mb-4">
              <FaClipboardCheck className="text-blue-600 text-2xl mr-3" />
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Chi tiết đơn {detailPrescription.prescriptionCode || detailPrescription._id?.slice(0, 10).toUpperCase()}
                  {detailPrescription.isDraft && (
                    <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                      Đơn nháp
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-500">{formatDate(detailPrescription.createdAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 font-medium mb-1">Bệnh nhân</p>
                <p className="text-gray-900 font-semibold">{detailPrescription.patientId?.fullName}</p>
                <p className="text-gray-500">{detailPrescription.patientId?.email}</p>
                <p className="text-gray-500">{detailPrescription.patientId?.phoneNumber}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 font-medium mb-1">Bác sĩ</p>
                <p className="text-gray-900 font-semibold">
                  {detailPrescription.doctorId?.user?.fullName || detailPrescription.doctorName || 'Chưa gán'}
                </p>
                <p className="text-gray-500">{detailPrescription.doctorId?.title || ''}</p>
                {detailPrescription.isDraft && detailPrescription.status === 'pending_approval' && (
                  <p className="text-xs text-orange-600 mt-1">Cần bác sĩ duyệt</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 font-medium mb-1">Bệnh viện</p>
                <p className="text-gray-900 font-semibold">
                  {detailPrescription.hospitalId?.name}
                </p>
                <p className="text-gray-500">{detailPrescription.hospitalId?.address}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-500 font-medium mb-1">Chẩn đoán / Triệu chứng</p>
                <p className="text-gray-900">
                  {detailPrescription.diagnosis || detailPrescription.symptom || '—'}
                </p>
                <p className="text-gray-500 mt-1">
                  {detailPrescription.notes || detailPrescription.note || ''}
                </p>
                {detailPrescription.isDraft && detailPrescription.specialtyId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Chuyên khoa: {detailPrescription.specialtyId?.name || detailPrescription.specialtyName}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Danh sách thuốc</h3>
              <div className="overflow-y-auto max-h-64 border border-gray-100 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Tên thuốc</th>
                      <th className="px-4 py-2 text-left">Liều dùng</th>
                      <th className="px-4 py-2 text-left">Số lượng</th>
                      <th className="px-4 py-2 text-left">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {detailPrescription.medications?.map((med, index) => {
                      // Xử lý cả Prescription và PrescriptionDraft format
                      const medication = med.medicationId || med;
                      const medicationName = med.medicationName || med.name || medication?.name || 'N/A';
                      const quantity = med.quantity || 1;
                      const price = med.price || med.unitPrice || medication?.unitPrice || 0;
                      const totalPrice = med.totalPrice || (price * quantity);
                      const usage = med.usage || '';
                      const dosage = med.dosage || '';
                      
                      return (
                        <tr key={`${med.medicationId || med.medicationId?._id || index}-${medicationName}`}>
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-800">{medicationName}</div>
                            {usage && <div className="text-gray-500 text-xs">{usage}</div>}
                            {medication?.unitTypeDisplay && (
                              <div className="text-gray-500 text-xs">{medication.unitTypeDisplay}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-700">{dosage || 'Theo chỉ định'}</td>
                          <td className="px-4 py-2 text-gray-700">{quantity}</td>
                          <td className="px-4 py-2 text-gray-900 font-medium">
                            {formatCurrency(totalPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailPrescription(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminPrescriptions;


