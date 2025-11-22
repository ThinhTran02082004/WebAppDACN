import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FaUser, FaCalendarAlt, FaMapMarkerAlt, FaFileMedical, 
  FaNotesMedical, FaArrowLeft, FaFileAlt, FaClipboardCheck,
  FaClock, FaStethoscope, FaRegHospital, FaInfoCircle,
  FaPhoneAlt, FaEnvelope, FaHome, FaDoorOpen, FaVideo, FaMoneyBillWave, FaPlus
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import api from '../../utils/api';
import moment from 'moment';
import 'moment/locale/vi';
import AdminBilling from '../../components/AdminBilling';
import PrescriptionManager from '../../components/PrescriptionManager';
import HospitalizationManager from '../../components/HospitalizationManager';

moment.locale('vi');

const AdminAppointmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('prescription'); // 'prescription', 'hospitalization', 'billing'
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const isRescheduled = appointment?.status === 'rescheduled' ||
    (appointment?.rescheduleCount && appointment.rescheduleCount > 0) ||
    (appointment?.rescheduleHistory && appointment.rescheduleHistory.length > 0);
  useEffect(() => {
    fetchAppointmentDetail();
  }, [id]);

  const fetchAppointmentDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/admin/appointments/${id}`);
      if (response.data.success) {
        setAppointment(response.data.data);
      } else {
        const errorMsg = response.data.message || 'Không thể tải thông tin lịch hẹn';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Lỗi khi tải chi tiết lịch hẹn:', error);
      const errorMsg = error.response?.data?.message || 'Đã xảy ra lỗi khi tải thông tin. Vui lòng thử lại sau.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Chờ xác nhận', className: 'bg-yellow-100 text-yellow-800 border border-yellow-200', icon: <FaInfoCircle className="mr-1.5" /> },
      confirmed: { text: 'Đã xác nhận', className: 'bg-blue-100 text-blue-800 border border-blue-200', icon: <FaClipboardCheck className="mr-1.5" /> },
      completed: { text: 'Hoàn thành', className: 'bg-green-100 text-green-800 border border-green-200', icon: <FaClipboardCheck className="mr-1.5" /> },
      pending_payment: { text: 'Chờ thanh toán', className: 'bg-orange-100 text-orange-800 border border-orange-200', icon: <FaClock className="mr-1.5" /> },
      hospitalized: { text: 'Đang nằm viện', className: 'bg-purple-100 text-purple-800 border border-purple-200', icon: <FaRegHospital className="mr-1.5" /> },
      cancelled: { text: 'Đã hủy', className: 'bg-red-100 text-red-800 border border-red-200', icon: null },
      rejected: { text: 'Từ chối', className: 'bg-red-100 text-red-800 border border-red-200', icon: null },
      rescheduled: { text: 'Đổi lịch', className: 'bg-indigo-100 text-indigo-800 border border-indigo-200', icon: <FaCalendarAlt className="mr-1.5" /> },
      'no-show': { text: 'Không đến', className: 'bg-gray-100 text-gray-800 border border-gray-200', icon: <FaInfoCircle className="mr-1.5" /> }
    };
    
    const badge = badges[status] || { text: status, className: 'bg-gray-100 text-gray-800 border border-gray-200', icon: null };
    
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full ${badge.className} text-sm font-medium`}>
        {badge.icon}
        <span>{badge.text}</span>
      </div>
    );
  };

  const handleCompleteAppointment = async () => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const response = await api.put(`/appointments/${id}/complete`);
      
      if (response.data.success) {
        toast.success('Lịch hẹn đã hoàn thành thành công');
        await fetchAppointmentDetail();
      } else {
        toast.error(`Không thể hoàn thành lịch hẹn: ${response.data.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error('Lỗi khi hoàn thành lịch hẹn:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || 'Lỗi khi hoàn thành lịch hẹn';
      toast.error(errorMessage);
      
      // If there are unpaid parts, show them
      if (error.response?.data?.unpaidParts) {
        const unpaidParts = error.response.data.unpaidParts;
        toast.info(`Còn thiếu thanh toán: ${unpaidParts.join(', ')}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <FaInfoCircle className="mx-auto text-4xl text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Lỗi</h3>
          <p className="text-red-600">{error || 'Không tìm thấy thông tin lịch hẹn'}</p>
          <button
            onClick={() => navigate('/admin/appointments')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/admin/appointments')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaArrowLeft className="text-xl text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chi tiết lịch hẹn</h1>
            <p className="text-gray-600">Mã: {appointment.bookingCode || appointment._id}</p>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            {getStatusBadge(appointment.status)}
            {isRescheduled && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-medium">
                <FaCalendarAlt className="mr-1" /> Lịch đã đổi
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Information */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <h2 className="text-lg font-semibold flex items-center">
                <FaUser className="mr-2" /> Thông tin bệnh nhân
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 font-medium">Họ và tên</label>
                  <p className="text-gray-900 font-medium">{appointment.patientId?.fullName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaPhoneAlt className="mr-1" /> Số điện thoại
                  </label>
                  <p className="text-gray-900">{appointment.patientId?.phoneNumber || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaEnvelope className="mr-1" /> Email
                  </label>
                  <p className="text-gray-900">{appointment.patientId?.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaHome className="mr-1" /> Địa chỉ
                  </label>
                  <p className="text-gray-900">{appointment.patientId?.address || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Details */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white">
              <h2 className="text-lg font-semibold flex items-center">
                <FaCalendarAlt className="mr-2" /> Thông tin lịch hẹn
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaStethoscope className="mr-1" /> Chuyên khoa
                  </label>
                  <p className="text-gray-900">{appointment.specialtyId?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaFileAlt className="mr-1" /> Dịch vụ
                  </label>
                  <p className="text-gray-900">{appointment.serviceId?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaCalendarAlt className="mr-1" /> Ngày khám
                  </label>
                  <p className="text-gray-900">
                    {moment(appointment.appointmentDate).format('DD/MM/YYYY')}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaClock className="mr-1" /> Giờ khám
                  </label>
                  <p className="text-gray-900">
                    {appointment.timeSlot?.startTime} - {appointment.timeSlot?.endTime}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaRegHospital className="mr-1" /> Cơ sở y tế
                  </label>
                  <p className="text-gray-900">{appointment.hospitalId?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaDoorOpen className="mr-1" /> Phòng khám
                  </label>
                  <p className="text-gray-900">{appointment.roomId?.name || 'N/A'}</p>
                </div>
              </div>

              {appointment.symptoms && (
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaNotesMedical className="mr-1" /> Triệu chứng
                  </label>
                  <p className="text-gray-900 mt-1">{appointment.symptoms}</p>
                </div>
              )}

              {appointment.notes && (
                <div>
                  <label className="text-sm text-gray-500 font-medium flex items-center">
                    <FaInfoCircle className="mr-1" /> Ghi chú
                  </label>
                  <p className="text-gray-900 mt-1">{appointment.notes}</p>
                </div>
              )}
            </div>
          </div>


          {/* Medical Information */}
          {(appointment.symptoms || appointment.medicalHistory || (appointment.prescriptions && appointment.prescriptions.length > 0 && appointment.prescriptions[0]?.diagnosis)) && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <h2 className="text-lg font-semibold flex items-center">
                  <FaFileMedical className="mr-2" /> Thông tin bệnh lý
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {appointment.symptoms && (
                  <div>
                    <label className="text-sm text-gray-500 font-medium">Triệu chứng</label>
                    <p className="text-gray-900 mt-1">{appointment.symptoms}</p>
                  </div>
                )}
                {appointment.medicalHistory && (
                  <div>
                    <label className="text-sm text-gray-500 font-medium">Tiền sử bệnh</label>
                    <p className="text-gray-900 mt-1">{appointment.medicalHistory}</p>
                  </div>
                )}
                {appointment.prescriptions && appointment.prescriptions.length > 0 && appointment.prescriptions[0]?.diagnosis && (
                  <div>
                    <label className="text-sm text-gray-500 font-medium">Chẩn đoán</label>
                    <p className="text-gray-900 mt-1">{appointment.prescriptions[0].diagnosis}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Thao tác</h2>
            </div>
            <div className="p-6 flex flex-wrap gap-3">
              {(appointment.status === 'confirmed' || appointment.status === 'pending_payment' || appointment.status === 'hospitalized') && (
                <>
                  {appointment.status === 'confirmed' && (
                    <button
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm text-sm"
                      onClick={() => { setActiveTab('prescription'); setShowPrescriptionForm(true); }}
                    >
                      <FaNotesMedical className="mr-1.5" /> Kê Đơn Thuốc
                    </button>
                  )}
                  {(appointment.status === 'confirmed' || appointment.status === 'pending_payment') && (
                    <button 
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-sm disabled:opacity-70 text-sm"
                      onClick={handleCompleteAppointment}
                      disabled={isUpdating}
                    >
                      <FaClipboardCheck className="mr-1.5" /> Hoàn Thành Khám
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tabs Section */}
          {(appointment.status === 'confirmed' || appointment.status === 'completed' || appointment.status === 'hospitalized' || appointment.status === 'pending_payment') && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
              {/* Tab Headers */}
              <div className="flex border-b overflow-x-auto">
                <button
                  onClick={() => setActiveTab('prescription')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'prescription'
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <FaNotesMedical className="inline mr-2" />
                  Đơn Thuốc
                </button>
                <button
                  onClick={() => setActiveTab('hospitalization')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'hospitalization'
                      ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                  }`}
                >
                  <FaRegHospital className="inline mr-2" />
                  Nằm Viện
                </button>
                <button
                  onClick={() => setActiveTab('billing')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'billing'
                      ? 'border-b-2 border-green-600 text-green-600 bg-green-50'
                      : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
                  }`}
                >
                  <FaFileMedical className="inline mr-2" />
                  Thanh Toán
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'prescription' && (
                  <div>
                    {showPrescriptionForm ? (
                      <PrescriptionManager
                        appointmentId={appointment._id}
                        patientId={appointment.patientId?._id}
                        onPrescriptionCreated={() => {
                          setShowPrescriptionForm(false);
                          toast.success('Đơn thuốc đã được tạo thành công');
                          fetchAppointmentDetail();
                        }}
                      />
                    ) : (
                      <>
                        {Array.isArray(appointment.prescriptions) && appointment.prescriptions.length > 0 ? (
                          <div className="space-y-3">
                            {appointment.prescriptions
                              .sort((a, b) => (a.prescriptionOrder || 1) - (b.prescriptionOrder || 1))
                              .map((p) => (
                              <div key={p._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="font-semibold">
                                      Đơn thuốc {p.prescriptionOrder ? `đợt ${p.prescriptionOrder}` : ''}
                                    </div>
                                    {p.isHospitalization && (
                                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                                        Nội trú
                                      </span>
                                    )}
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                      p.status === 'dispensed' ? 'bg-green-100 text-green-800' :
                                      p.status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                                      p.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {p.status === 'pending' ? 'Chờ xử lý' :
                                       p.status === 'approved' ? 'Đã kê đơn' :
                                       p.status === 'verified' ? 'Đã phê duyệt' :
                                       p.status === 'dispensed' ? 'Đã cấp thuốc' :
                                       p.status === 'completed' ? 'Hoàn thành' : p.status}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500">{new Date(p.createdAt).toLocaleString('vi-VN')}</div>
                                </div>
                                {p.diagnosis && (
                                  <div className="text-sm text-gray-600 mb-2 pb-2 border-b">
                                    <span className="font-medium">Chẩn đoán:</span> <span className="text-gray-800">{p.diagnosis}</span>
                                  </div>
                                )}
                                <div className="text-sm mb-2">
                                  <div className="font-medium text-gray-700 mb-1">Danh sách thuốc:</div>
                                  <div className="space-y-2">
                                    {p.medications?.map((m, i) => (
                                      <div key={i} className="bg-gray-50 rounded p-3">
                                        <div className="font-medium text-gray-800 mb-1">
                                          {m.medicationId?.name || m.medicationName}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                                          <div><span className="font-medium">Số lượng:</span> {m.quantity} {m.medicationId?.unitTypeDisplay || 'đơn vị'}</div>
                                          <div><span className="font-medium">Liều lượng:</span> {m.dosage || '—'}</div>
                                          <div><span className="font-medium">Cách dùng:</span> {m.usage || '—'}</div>
                                          <div><span className="font-medium">Thời gian:</span> {m.duration || '—'}</div>
                                        </div>
                                        {m.totalPrice > 0 && (
                                          <div className="mt-1 text-xs text-gray-700">
                                            <span className="font-medium">Tổng tiền:</span> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(m.totalPrice)}
                                          </div>
                                        )}
                                        {m.notes && (
                                          <div className="mt-1 text-xs text-gray-500 italic">{m.notes}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {p.totalAmount > 0 && (
                                  <div className="text-sm font-semibold text-gray-800 mt-2 pt-2 border-t">
                                    Tổng tiền: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.totalAmount)}
                                  </div>
                                )}
                                {p.notes && (
                                  <div className="text-sm text-gray-600 mt-2 pt-2 border-t">
                                    <span className="font-medium">Ghi chú:</span> {p.notes}
                                  </div>
                                )}
                                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                  <span>Ngày kê đơn: {new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>
                                  <Link 
                                    to={`/prescriptions/${p._id}`}
                                    className="text-blue-600 hover:underline"
                                  >
                                    Xem chi tiết →
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FaNotesMedical className="mx-auto text-5xl text-gray-300 mb-4" />
                            <p className="text-gray-500 mb-4">Chưa có đơn thuốc nào được kê</p>
                            {appointment.status === 'confirmed' && (
                              <button
                                onClick={() => setShowPrescriptionForm(true)}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                <FaPlus className="inline mr-2" />
                                Kê Đơn Thuốc Mới
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'hospitalization' && (
                  <HospitalizationManager
                    appointmentId={appointment._id}
                    patientId={appointment.patientId?._id}
                    onUpdate={() => {
                      fetchAppointmentDetail();
                      toast.success('Cập nhật thông tin nằm viện thành công');
                    }}
                  />
                )}

                {activeTab === 'billing' && (
                  <AdminBilling
                    appointmentId={appointment._id}
                    initialBill={appointment.bill}
                    onPaymentComplete={() => {
                      fetchAppointmentDetail();
                      toast.success('Thanh toán thành công');
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Doctor Information */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
              <h2 className="text-lg font-semibold">Bác sĩ</h2>
            </div>
            <div className="p-6">
              <div className="text-center mb-4">
                <div className="w-20 h-20 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                  <FaUser className="text-3xl text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900">
                  {appointment.doctorId?.title} {appointment.doctorId?.user?.fullName || 'N/A'}
                </h3>
                <p className="text-sm text-gray-600">{appointment.specialtyId?.name}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <FaPhoneAlt className="mr-2" />
                  <span>{appointment.doctorId?.user?.phoneNumber || 'N/A'}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <FaEnvelope className="mr-2" />
                  <span>{appointment.doctorId?.user?.email || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminAppointmentDetail;

