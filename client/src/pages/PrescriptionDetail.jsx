import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { 
  FaArrowLeft, FaPrint, FaMoneyBillWave, FaCheck, FaClock, 
  FaWallet, FaCreditCard, FaUserMd, FaFileMedical
} from 'react-icons/fa';
import PayPalButton from '../components/PayPalButton';

const PrescriptionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('momo'); // Default to momo instead of cash
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPayPalModal, setShowPayPalModal] = useState(false);

  useEffect(() => {
    if (id && user) {
      fetchPrescription();
    }
  }, [id, user]);

  const fetchPrescription = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/prescriptions/${id}`);
      if (response.data.success) {
        const prescriptionData = response.data.data;
        setPrescription(prescriptionData);
        
        // Fetch appointment and bill
        if (prescriptionData.appointmentId) {
          const appointmentId = prescriptionData.appointmentId._id || prescriptionData.appointmentId;
          try {
            const apptRes = await api.get(`/appointments/${appointmentId}`);
            if (apptRes.data.success) {
              setAppointment(apptRes.data.data);
            }
          } catch (err) {
            console.error('Error fetching appointment:', err);
          }

          try {
            const billRes = await api.get(`/billing/appointment/${appointmentId}`);
            if (billRes.data.success) {
              setBill(billRes.data.data);
            }
          } catch (err) {
            console.error('Error fetching bill:', err);
          }
        }
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Không xác định';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
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

  const getPrescriptionPaymentStatus = () => {
    if (!bill || !bill.medicationBill?.prescriptionPayments) {
      return { status: 'pending', payment: null };
    }
    
    const payment = bill.medicationBill.prescriptionPayments.find(
      p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === prescription._id.toString()
    );
    
    return {
      status: payment?.status || 'pending',
      payment
    };
  };

  const isPaid = () => {
    return prescription.status === 'dispensed' || getPrescriptionPaymentStatus().status === 'paid';
  };

  const canPay = () => {
    return !isPaid() && appointment?.status !== 'hospitalized' && user?.roleType === 'user';
  };

  const canConfirmCash = () => {
    return !isPaid() && (user?.roleType === 'doctor' || user?.roleType === 'admin');
  };

  const handlePayPrescription = async (method) => {
    if (!prescription || appointment?.status === 'hospitalized') {
      toast.warning('Không thể thanh toán khi đang nằm viện. Vui lòng đợi xuất viện.');
      return;
    }

    try {
      setProcessingPayment(true);

      if (method === 'momo') {
        const res = await api.post('/payments/momo/create', {
          appointmentId: prescription.appointmentId._id || prescription.appointmentId,
          amount: prescription.totalAmount,
          billType: 'medication',
          prescriptionId: prescription._id
        });
        if (res.data?.payUrl) {
          window.location.href = res.data.payUrl;
          return;
        }
        toast.error('Không thể tạo thanh toán MoMo');
      } else if (method === 'paypal') {
        setShowPayPalModal(true);
        setProcessingPayment(false);
        return;
      } else {
        // Cash payment
        const response = await api.post('/billing/pay-prescription', {
          prescriptionId: prescription._id,
          paymentMethod: method,
          transactionId: `PRES-${Date.now()}`,
          paymentDetails: { method, timestamp: new Date().toISOString() }
        });
        
        if (response.data.success) {
          toast.success('Thanh toán đơn thuốc thành công');
          await fetchPrescription();
        } else {
          toast.error(response.data.message || 'Thanh toán thất bại');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleConfirmCashPayment = async () => {
    if (!window.confirm('Xác nhận bệnh nhân đã thanh toán đơn thuốc này bằng tiền mặt?')) {
      return;
    }

    try {
      setProcessingPayment(true);
      const response = await api.post('/billing/pay-prescription', {
        prescriptionId: prescription._id,
        paymentMethod: 'cash',
        transactionId: `PRES-CASH-${Date.now()}`,
        paymentDetails: { method: 'cash', timestamp: new Date().toISOString(), confirmedBy: user.fullName }
      });

      if (response.data.success) {
        toast.success('Xác nhận thanh toán tiền mặt thành công');
        await fetchPrescription();
      } else {
        toast.error(response.data.message || 'Xác nhận thất bại');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xác nhận thất bại');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-64">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button 
              onClick={() => navigate(-1)} 
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="bg-gray-50 min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto text-center">
            <p className="text-gray-500 mb-4">Không tìm thấy đơn thuốc</p>
            <button 
              onClick={() => navigate(-1)} 
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const paymentStatus = getPrescriptionPaymentStatus();
  const appointmentId = prescription.appointmentId?._id || prescription.appointmentId;

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 print:hidden">
            <Link 
              to={appointmentId ? `/appointments/${appointmentId}` : '/appointments'} 
              className="inline-flex items-center text-primary hover:text-primary-dark"
            >
              <FaArrowLeft className="mr-2" />
              Quay lại
            </Link>
          </div>

          {/* Prescription Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none" id="printable-content">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
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
                  <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
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
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Date and Doctor Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h2 className="text-sm font-medium text-gray-500 mb-2">Ngày kê đơn</h2>
                  <p className="text-gray-800">{formatDate(prescription.createdAt)}</p>
                  {prescription.verifiedAt && (
                    <>
                      <h2 className="text-sm font-medium text-gray-500 mb-2 mt-4">Ngày phê duyệt</h2>
                      <p className="text-gray-800">{formatDate(prescription.verifiedAt)}</p>
                      {prescription.verifiedBy?.fullName && (
                        <p className="text-xs text-gray-600">Bởi: {prescription.verifiedBy.fullName}</p>
                      )}
                    </>
                  )}
                  {prescription.dispensedAt && (
                    <>
                      <h2 className="text-sm font-medium text-gray-500 mb-2 mt-4">Ngày cấp thuốc</h2>
                      <p className="text-gray-800">{formatDate(prescription.dispensedAt)}</p>
                    </>
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-medium text-gray-500 mb-2">Bác sĩ kê đơn</h2>
                  <p className="text-gray-800">
                    {prescription.doctorId?.user?.fullName || prescription.doctorId?.name || 'Không xác định'}
                  </p>
                  {prescription.doctorId?.title && (
                    <p className="text-sm text-gray-600">{prescription.doctorId.title}</p>
                  )}
                </div>
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
                  <FaFileMedical className="mr-2" /> Danh sách thuốc
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                        <th className="px-4 py-3 border-b">Thuốc</th>
                        <th className="px-4 py-3 border-b">Số lượng</th>
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
                          <td colSpan="6" className="px-4 py-3 text-center text-gray-500">Không có thuốc</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {prescription.notes && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-gray-500 mb-2">Ghi chú</h2>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <p className="text-gray-800">{prescription.notes}</p>
                  </div>
                </div>
              )}

              {/* Total Amount */}
              {prescription.totalAmount > 0 && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-green-900">Tổng tiền đơn thuốc:</span>
                    <span className="text-2xl font-bold text-green-900">
                      {formatCurrency(prescription.totalAmount)}
                    </span>
                  </div>
                  {paymentStatus.payment && paymentStatus.status === 'paid' && (
                    <div className="mt-2 text-sm text-green-700">
                      <FaCheck className="inline mr-1" />
                      Đã thanh toán ngày {formatDate(paymentStatus.payment.paymentDate)}
                      {paymentStatus.payment.paymentMethod && (
                        <span className="ml-2">
                          ({paymentStatus.payment.paymentMethod === 'cash' ? 'Tiền mặt' : 
                             paymentStatus.payment.paymentMethod === 'momo' ? 'MoMo' : 'PayPal'})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <button 
              onClick={handlePrint}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <FaPrint className="mr-2" /> In đơn thuốc
            </button>
            
            {appointmentId && (
              <Link 
                to={`/appointments/${appointmentId}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Xem chi tiết lịch hẹn
              </Link>
            )}

            {/* User Payment Button */}
            {canPay() && (
              <div className="flex-1 min-w-full md:min-w-0">
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Thanh toán đơn thuốc</h3>
                  {appointment?.status === 'hospitalized' && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <FaClock className="inline mr-1" /> Đang nằm viện. Vui lòng đợi xuất viện để thanh toán.
                      </p>
                    </div>
                  )}
                  {appointment?.status !== 'hospitalized' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPaymentMethod('momo')}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            paymentMethod === 'momo'
                              ? 'bg-pink-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <FaCreditCard className="inline mr-2" /> MoMo
                        </button>
                        <button
                          onClick={() => setPaymentMethod('paypal')}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            paymentMethod === 'paypal'
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <FaCreditCard className="inline mr-2" /> PayPal
                        </button>
                      </div>
                      <button
                        disabled={processingPayment}
                        onClick={() => handlePayPrescription(paymentMethod)}
                        className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold flex items-center justify-center gap-2"
                      >
                        {processingPayment ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Đang xử lý...</span>
                          </>
                        ) : (
                          <>
                            <FaMoneyBillWave /> Thanh Toán {formatCurrency(prescription.totalAmount)}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Doctor/Admin Confirm Cash Payment */}
            {canConfirmCash() && (
              <button
                disabled={processingPayment}
                onClick={handleConfirmCashPayment}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {processingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <FaCheck className="mr-2" /> Xác nhận thanh toán tiền mặt
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PayPal Modal */}
      {showPayPalModal && prescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowPayPalModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Thanh toán PayPal</h3>
              <p className="text-gray-600">
                Số tiền: <span className="font-semibold text-blue-600">{formatCurrency(prescription.totalAmount)}</span>
              </p>
            </div>
            <div className="border-t pt-4">
              <PayPalButton
                amount={prescription.totalAmount}
                appointmentId={appointmentId}
                billType="medication"
                prescriptionId={prescription._id}
                onSuccess={async () => {
                  setShowPayPalModal(false);
                  await fetchPrescription();
                }}
                onError={() => {}}
                onCancel={() => setShowPayPalModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
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
        }
      `}} />
    </div>
  );
};

export default PrescriptionDetail;

