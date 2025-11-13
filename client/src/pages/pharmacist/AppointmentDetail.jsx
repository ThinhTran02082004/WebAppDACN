import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaUser, FaCalendarAlt, FaMapMarkerAlt, FaFileMedical,
  FaNotesMedical, FaArrowLeft, FaFileAlt, FaClipboardCheck,
  FaClock, FaStethoscope, FaRegHospital, FaInfoCircle,
  FaPhoneAlt, FaEnvelope, FaHome, FaDoorOpen, FaVideo,
  FaMoneyBillWave, FaPills, FaCheckCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import moment from 'moment';
import 'moment/locale/vi';
import { useAuth } from '../../context/AuthContext';
import PharmacistBilling from '../../components/PharmacistBilling';

moment.locale('vi');

const PharmacistAppointmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUserData } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [bill, setBill] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hospitalIdError, setHospitalIdError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('prescriptions');

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user && !user.hospitalId && (user.roleType === 'pharmacist' || user.role === 'pharmacist')) {
        try {
          const profileRes = await api.get('/auth/profile');
          if (profileRes.data.success && profileRes.data.data) {
            const updatedUserData = profileRes.data.data;
            updateUserData(updatedUserData);
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
      const currentUser = await fetchUserProfile();
      const userToCheck = currentUser || user;
      if (userToCheck && !userToCheck.hospitalId) {
        setHospitalIdError(true);
        setLoading(false);
        return;
      }
      fetchAppointmentDetail();
    };

    initialize();
  }, [id, user, updateUserData]);

  const fetchAppointmentDetail = async () => {
    setLoading(true);
    setHospitalIdError(false);
    try {
      const response = await api.get(`/appointments/pharmacist/${id}`);
      if (response.data.success) {
        const data = response.data.data;
        setAppointment(data.appointment);
        setPrescriptions(data.prescriptions || []);
        setBill(data.bill);
        setMedicalRecords(data.medicalRecords || []);
      } else {
        const errorMsg = response.data.message || 'Không thể tải thông tin lịch hẹn';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Lỗi khi tải chi tiết lịch hẹn:', error);
      if (error.response?.status === 400 && error.response?.data?.message?.includes('chưa được gán vào chi nhánh')) {
        setHospitalIdError(true);
      }
      const errorMsg = error.response?.data?.message || 'Đã xảy ra lỗi khi tải thông tin. Vui lòng thử lại sau.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (prescriptionId) => {
    if (!window.confirm('Xác nhận bệnh nhân đã thanh toán đơn thuốc này bằng tiền mặt?')) return;
    
    setProcessing(true);
    try {
      const response = await api.post('/billing/pharmacist/confirm-payment', {
        appointmentId: id,
        billType: 'medication'
      });
      
      if (response.data.success) {
        toast.success('Xác nhận thanh toán thành công');
        await fetchAppointmentDetail();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xác nhận thanh toán');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Chờ xác nhận', className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
      confirmed: { text: 'Đã xác nhận', className: 'bg-blue-100 text-blue-800 border border-blue-200' },
      completed: { text: 'Hoàn thành', className: 'bg-green-100 text-green-800 border border-green-200' },
      pending_payment: { text: 'Chờ thanh toán', className: 'bg-orange-100 text-orange-800 border border-orange-200' },
      hospitalized: { text: 'Đang nằm viện', className: 'bg-purple-100 text-purple-800 border border-purple-200' },
      cancelled: { text: 'Đã hủy', className: 'bg-red-100 text-red-800 border border-red-200' },
      rejected: { text: 'Từ chối', className: 'bg-red-100 text-red-800 border border-red-200' },
      rescheduled: { text: 'Đổi lịch', className: 'bg-indigo-100 text-indigo-800 border border-indigo-200' },
      'no-show': { text: 'Không đến', className: 'bg-gray-100 text-gray-800 border border-gray-200' }
    };
    
    const badge = badges[status] || { text: status, className: 'bg-gray-100 text-gray-800 border border-gray-200' };
    
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full ${badge.className} text-sm font-medium`}>
        <span>{badge.text}</span>
      </div>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return moment(dateString).format('DD/MM/YYYY HH:mm');
    } catch {
      return 'N/A';
    }
  };

  if (hospitalIdError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Thiếu thông tin chi nhánh</h2>
          <p className="text-gray-600 mb-4">
            Dược sĩ chưa được gán vào chi nhánh. Vui lòng liên hệ quản trị viên.
          </p>
          <button
            onClick={async () => {
              try {
                const profileRes = await api.get('/auth/profile');
                if (profileRes.data.success && profileRes.data.data?.hospitalId) {
                  updateUserData(profileRes.data.data);
                  setHospitalIdError(false);
                  fetchAppointmentDetail();
                }
              } catch (error) {
                alert('Vẫn chưa có thông tin chi nhánh.');
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tải lại thông tin
          </button>
        </div>
      </div>
    );
  }

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
            onClick={() => navigate('/pharmacist/appointments')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/pharmacist/appointments')}
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
          {getStatusBadge(appointment.status)}
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
                    <FaUser className="mr-1" /> Bác sĩ
                  </label>
                  <p className="text-gray-900">{appointment.doctorId?.user?.fullName || 'N/A'}</p>
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

          {/* Tabs Section */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'prescriptions'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <FaPills className="inline mr-2" />
                Đơn Thuốc ({prescriptions.length})
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'billing'
                    ? 'border-b-2 border-green-600 text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
                }`}
              >
                <FaMoneyBillWave className="inline mr-2" />
                Thanh Toán
              </button>
              <button
                onClick={() => setActiveTab('medical-records')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'medical-records'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
                }`}
              >
                <FaFileMedical className="inline mr-2" />
                Hồ Sơ Khám ({medicalRecords.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'prescriptions' && (
                <div className="space-y-4">
                  {prescriptions.length > 0 ? (
                    prescriptions
                      .sort((a, b) => (a.prescriptionOrder || 1) - (b.prescriptionOrder || 1))
                      .map((prescription) => (
                        <div key={prescription._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                Đợt {prescription.prescriptionOrder || 1}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
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
                            </div>
                            <button
                              onClick={() => navigate(`/pharmacist/prescriptions/${prescription._id}`)}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              Xem chi tiết →
                            </button>
                          </div>
                          {prescription.diagnosis && (
                            <div className="text-sm text-gray-600 mb-2 pb-2 border-b">
                              <span className="font-medium">Chẩn đoán:</span> {prescription.diagnosis}
                            </div>
                          )}
                          <div className="text-sm mb-2">
                            <span className="font-medium text-gray-700">Số lượng thuốc:</span> {prescription.medications?.length || 0}
                          </div>
                          {prescription.totalAmount > 0 && (
                            <div className="text-sm font-semibold text-gray-800 mt-2 pt-2 border-t">
                              Tổng tiền: {formatCurrency(prescription.totalAmount)}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-2">
                            Ngày kê đơn: {formatDate(prescription.createdAt)}
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-8">
                      <FaPills className="mx-auto text-5xl text-gray-300 mb-4" />
                      <p className="text-gray-500">Chưa có đơn thuốc nào</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'billing' && (
                <PharmacistBilling
                  appointmentId={id}
                  onPaymentComplete={handlePaymentComplete}
                />
              )}

              {activeTab === 'medical-records' && (
                <div className="space-y-4">
                  {medicalRecords.length > 0 ? (
                    medicalRecords.map((record) => (
                      <div key={record._id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold">{record.title || 'Hồ sơ khám bệnh'}</h4>
                            <p className="text-sm text-gray-500">
                              {record.createdBy?.fullName} • {formatDate(record.createdAt)}
                            </p>
                          </div>
                        </div>
                        {record.description && (
                          <p className="text-sm text-gray-700 mt-2">{record.description}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <FaFileMedical className="mx-auto text-5xl text-gray-300 mb-4" />
                      <p className="text-gray-500">Chưa có hồ sơ khám bệnh</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <h2 className="text-lg font-semibold">Thao tác nhanh</h2>
            </div>
            <div className="p-6 space-y-3">
              {prescriptions.filter(p => p.status === 'verified').length > 0 && (
                <button
                  onClick={() => setActiveTab('prescriptions')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <FaPills /> Xem đơn thuốc cần cấp
                </button>
              )}
              {bill && bill.medicationBill && bill.medicationBill.amount > 0 && (
                <button
                  onClick={() => setActiveTab('billing')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <FaMoneyBillWave /> Xem thanh toán
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacistAppointmentDetail;

