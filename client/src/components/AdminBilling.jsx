import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { 
  FaMoneyBillWave, FaCheck, FaClock, FaPills, FaBed, FaStethoscope, 
  FaCreditCard, FaWallet, FaFileInvoice, FaHistory, FaInfoCircle, FaExclamationTriangle
} from 'react-icons/fa';
const AdminBilling = ({ appointmentId, onPaymentComplete }) => {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingBillType, setConfirmingBillType] = useState(null);
  const [confirmingPrescriptionId, setConfirmingPrescriptionId] = useState(null);
  useEffect(() => {
    if (appointmentId) {
      fetchBill();
      fetchPaymentHistory();
    }
  }, [appointmentId]);
  const fetchBill = async () => {
    try {
      const response = await api.get(`/billing/appointment/${appointmentId}`);
      setBill(response.data.data);
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error('Không thể tải thông tin hóa đơn');
    }
  };
  const fetchPaymentHistory = async () => {
    try {
      const response = await api.get(`/billing/payments/history`, {
        params: { appointmentId, limit: 100 }
      });
      if (response.data.success) {
        setPaymentHistory(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Không thể tải lịch sử thanh toán');
    }
  };
  const handleConfirmCashPayment = async (billType) => {
    setConfirmingBillType(billType);
    setConfirmingPrescriptionId(null);
    setShowConfirmModal(true);
  };

  const handleConfirmPrescriptionCashPayment = async (prescriptionId) => {
    setConfirmingBillType('medication');
    setConfirmingPrescriptionId(prescriptionId);
    setShowConfirmModal(true);
  };

  const executeCashPayment = async () => {
    const billTypeLabels = {
      consultation: 'phí khám',
      medication: 'tiền thuốc',
      hospitalization: 'phí nội trú'
    };

    try {
      setLoading(true);
      
      if (confirmingPrescriptionId) {
        // Xác nhận thanh toán cho một đơn thuốc cụ thể
        const response = await api.post('/billing/pay-prescription', {
          prescriptionId: confirmingPrescriptionId,
          paymentMethod: 'cash',
          transactionId: `PRES-CASH-${Date.now()}`,
          paymentDetails: { method: 'cash', timestamp: new Date().toISOString() }
        });

        if (response.data.success) {
          toast.success('Xác nhận thanh toán đơn thuốc thành công');
          setBill(response.data.data.bill);
          fetchPaymentHistory();
          if (onPaymentComplete) onPaymentComplete();
        } else {
          toast.error(response.data.message || 'Xác nhận thất bại');
        }
      } else {
        // Xác nhận thanh toán cho một loại bill
        const response = await api.post('/billing/confirm-cash-payment', {
          appointmentId: bill.appointmentId?._id || bill.appointmentId,
          billType: confirmingBillType
        });

        if (response.data.success) {
          toast.success(`Xác nhận thanh toán ${billTypeLabels[confirmingBillType]} thành công`);
          setBill(response.data.data.bill);
          fetchPaymentHistory();
          if (onPaymentComplete) onPaymentComplete();
        } else {
          toast.error(response.data.message || 'Xác nhận thất bại');
        }
      }
      
      setShowConfirmModal(false);
      setConfirmingBillType(null);
      setConfirmingPrescriptionId(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xác nhận thất bại');
    } finally {
      setLoading(false);
    }
  };
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };
  const getStatusBadge = (status) => {
    if (status === 'paid') {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1">
          <FaCheck /> Đã thanh toán
        </span>
      );
    }
    if (status === 'cancelled') {
      return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">Đã hủy</span>;
    }
    return (
      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center gap-1">
        <FaClock /> Chưa thanh toán
      </span>
    );
  };
  const getPaymentMethodLabel = (method) => {
    const labels = { cash: 'Tiền mặt', momo: 'MoMo', paypal: 'PayPal' };
    return labels[method] || method;
  };
  const getPaymentMethodIcon = (method) => {
    if (method === 'cash') return <FaWallet className="inline mr-2" />;
    return <FaCreditCard className="inline mr-2" />;
  };
  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-gray-500">Đang tải thông tin thanh toán...</div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FaFileInvoice /> Quản Lý Hóa Đơn
              </h2>
              <p className="text-sm text-indigo-100 mt-1">Mã hóa đơn: {bill.billNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-indigo-100">Trạng thái tổng</p>
              <span className={`px-4 py-2 rounded-full font-semibold mt-2 inline-block ${
                bill.overallStatus === 'paid' ? 'bg-green-500' :
                bill.overallStatus === 'partial' ? 'bg-yellow-400 text-gray-900' :
                'bg-red-500'
              }`}>
                {bill.overallStatus === 'paid' ? 'Đã thanh toán đủ' :
                 bill.overallStatus === 'partial' ? 'Thanh toán một phần' :
                 'Chưa thanh toán'}
              </span>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
              <p className="text-sm text-indigo-100 mb-1">Tổng hóa đơn</p>
              <p className="text-2xl font-bold">{formatCurrency(bill.totalAmount)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
              <p className="text-sm text-indigo-100 mb-1">Đã thanh toán</p>
              <p className="text-2xl font-bold text-green-300">{formatCurrency(bill.paidAmount)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
              <p className="text-sm text-indigo-100 mb-1">Còn lại</p>
              <p className="text-2xl font-bold text-red-300">{formatCurrency(bill.remainingAmount)}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Consultation Bill */}
          {bill.consultationBill.amount > 0 && (
            <div className="border-2 border-blue-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-blue-50 px-6 py-4 border-b border-blue-200 flex justify-between items-center">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-blue-700">
                  <FaStethoscope /> Phí Khám Bệnh
                </h3>
                {getStatusBadge(bill.consultationBill.status)}
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex-1">
                    {/* Hiển thị thông tin giảm giá nếu có */}
                    {bill.consultationBill.originalAmount > 0 && bill.consultationBill.originalAmount !== bill.consultationBill.amount && (
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Giá gốc:</span>
                          <span className="text-gray-500 line-through">{formatCurrency(bill.consultationBill.originalAmount)}</span>
                        </div>
                        {bill.consultationBill.discount > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-green-600 font-medium">Giảm giá:</span>
                            <span className="text-green-600 font-medium">-{formatCurrency(bill.consultationBill.discount)}</span>
                          </div>
                        )}
                        {bill.consultationBill.couponId && (
                          <div className="text-xs text-blue-600 mt-1">
                            <FaInfoCircle className="inline mr-1" />
                            Đã áp dụng mã giảm giá
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-3xl font-bold text-blue-600">{formatCurrency(bill.consultationBill.amount)}</p>
                    {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentDate && (
                      <p className="text-sm text-gray-600 mt-1">
                        Đã thanh toán: {new Date(bill.consultationBill.paymentDate).toLocaleString('vi-VN')}
                      </p>
                    )}
                    {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentMethod && (
                      <p className="text-sm text-gray-600">
                        {getPaymentMethodIcon(bill.consultationBill.paymentMethod)}
                        {getPaymentMethodLabel(bill.consultationBill.paymentMethod)}
                      </p>
                    )}
                  </div>
                </div>
                {bill.consultationBill.status === 'pending' && (
                  <button
                    onClick={() => handleConfirmCashPayment('consultation')}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    <FaCheck />
                    Xác nhận thanh toán tiền mặt
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Medication Bill - Đơn Thuốc */}
          {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
            <div className="border-2 border-green-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-green-50 px-6 py-4 border-b border-green-200 flex justify-between items-center">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-green-700">
                  <FaPills /> Đơn Thuốc
                </h3>
                {getStatusBadge(bill.medicationBill.status)}
              </div>
              <div className="p-6">
                {/* Tổng tiền thuốc */}
                <div className="mb-4 pb-4 border-b border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Tổng tiền thuốc</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(bill.medicationBill.amount)}</p>
                  <p className="text-xs text-gray-500 mt-1">Số đơn thuốc: {bill.medicationBill.prescriptionIds.length}</p>
                </div>
                {/* Danh sách từng prescription */}
                <div className="space-y-4">
                  {bill.medicationBill.prescriptionIds.map((prescription, idx) => {
                    const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
                      p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === prescription._id.toString()
                    );
                    const isPaid = prescriptionPayment?.status === 'paid' || prescription.status === 'dispensed';
                    return (
                      <div key={prescription._id || idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                              Đợt {prescription.prescriptionOrder || idx + 1}
                            </span>
                            {prescription.isHospitalization && (
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                                Nội trú
                              </span>
                            )}
                            {isPaid ? (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                <FaCheck /> Đã thanh toán
                              </span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                <FaClock /> Chưa thanh toán
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(prescription.totalAmount)}
                            </p>
                            {isPaid && prescriptionPayment?.paymentDate && (
                              <p className="text-xs text-gray-500 mt-1">
                                Đã thanh toán: {new Date(prescriptionPayment.paymentDate).toLocaleString('vi-VN')}
                              </p>
                            )}
                            {isPaid && prescriptionPayment?.paymentMethod && (
                              <p className="text-xs text-gray-500">
                                {getPaymentMethodIcon(prescriptionPayment.paymentMethod)}
                                {getPaymentMethodLabel(prescriptionPayment.paymentMethod)}
                              </p>
                            )}
                          </div>
                        </div>
                        {prescription.diagnosis && (
                          <div className="mb-3 pb-3 border-b border-gray-200">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Chẩn đoán:</span> {prescription.diagnosis}
                            </p>
                          </div>
                        )}
                        {!isPaid && (
                          <button
                            onClick={() => handleConfirmPrescriptionCashPayment(prescription._id)}
                            disabled={loading}
                            className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <FaCheck />
                            Xác nhận thanh toán tiền mặt
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {/* Hospitalization Bill */}
          {bill.hospitalizationBill.amount > 0 && (
            <div className="border-2 border-purple-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-purple-50 px-6 py-4 border-b border-purple-200 flex justify-between items-center">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-purple-700">
                  <FaBed /> Phí Nội Trú
                </h3>
                {getStatusBadge(bill.hospitalizationBill.status)}
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-3xl font-bold text-purple-600">{formatCurrency(bill.hospitalizationBill.amount)}</p>
                    {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentDate && (
                      <p className="text-sm text-gray-600 mt-1">
                        Đã thanh toán: {new Date(bill.hospitalizationBill.paymentDate).toLocaleString('vi-VN')}
                      </p>
                    )}
                    {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentMethod && (
                      <p className="text-sm text-gray-600">
                        {getPaymentMethodIcon(bill.hospitalizationBill.paymentMethod)}
                        Phương thức: {getPaymentMethodLabel(bill.hospitalizationBill.paymentMethod)}
                      </p>
                    )}
                  </div>
                </div>
                {bill.hospitalizationBill.status === 'pending' && (
                  <button
                    onClick={() => handleConfirmCashPayment('hospitalization')}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    <FaCheck />
                    Xác nhận thanh toán tiền mặt
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Progress Bar */}
          <div className="mt-6 bg-gray-50 rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Tiến độ thanh toán</h3>
              
              {/* Overall Progress */}
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Tổng tiến độ</span>
                <span className="font-semibold">
                  {bill.totalAmount > 0 ? Math.round((bill.paidAmount / bill.totalAmount) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-4 shadow-inner">
                <div
                  className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 h-4 rounded-full transition-all duration-500 shadow-md"
                  style={{ width: `${bill.totalAmount > 0 ? (bill.paidAmount / bill.totalAmount) * 100 : 0}%` }}
                />
              </div>
              
              {/* Chi tiết từng loại */}
              <div className="space-y-4">
                {/* Phí khám */}
                {bill.consultationBill.amount > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <FaStethoscope className="text-blue-600" />
                        <span className="text-sm text-gray-700 font-medium">Phí khám bệnh</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {formatCurrency(bill.consultationBill.status === 'paid' ? bill.consultationBill.amount : 0)} / {formatCurrency(bill.consultationBill.amount)}
                        </span>
                        {bill.consultationBill.status === 'paid' ? (
                          <FaCheck className="text-green-600" />
                        ) : (
                          <FaClock className="text-yellow-600" />
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          bill.consultationBill.status === 'paid' ? 'bg-green-500' : 'bg-yellow-400'
                        }`}
                        style={{ width: `${bill.consultationBill.status === 'paid' ? 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* Tiền thuốc */}
                {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <FaPills className="text-green-600" />
                        <span className="text-sm text-gray-700 font-medium">Tiền thuốc</span>
                        <span className="text-xs text-gray-500">({bill.medicationBill.prescriptionIds.length} đơn)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {(() => {
                            const paidAmount = bill.medicationBill.prescriptionIds.reduce((sum, pres) => {
                              const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
                                p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === pres._id.toString()
                              );
                              const isPaid = prescriptionPayment?.status === 'paid' || pres.status === 'dispensed';
                              return sum + (isPaid ? pres.totalAmount : 0);
                            }, 0);
                            return `${formatCurrency(paidAmount)} / ${formatCurrency(bill.medicationBill.amount)}`;
                          })()}
                        </span>
                        {bill.medicationBill.status === 'paid' ? (
                          <FaCheck className="text-green-600" />
                        ) : (
                          <FaClock className="text-yellow-600" />
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          bill.medicationBill.status === 'paid' ? 'bg-green-500' : 'bg-yellow-400'
                        }`}
                        style={{ 
                          width: `${(() => {
                            const paidAmount = bill.medicationBill.prescriptionIds.reduce((sum, pres) => {
                              const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
                                p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === pres._id.toString()
                              );
                              const isPaid = prescriptionPayment?.status === 'paid' || pres.status === 'dispensed';
                              return sum + (isPaid ? pres.totalAmount : 0);
                            }, 0);
                            return bill.medicationBill.amount > 0 ? (paidAmount / bill.medicationBill.amount) * 100 : 0;
                          })()}%` 
                        }}
                      />
                    </div>
                    {/* Chi tiết từng đơn thuốc */}
                    <div className="mt-2 ml-4 space-y-1">
                      {bill.medicationBill.prescriptionIds.map((prescription, idx) => {
                        const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
                          p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === prescription._id.toString()
                        );
                        const isPaid = prescriptionPayment?.status === 'paid' || prescription.status === 'dispensed';
                        return (
                          <div key={prescription._id || idx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">
                              Đợt {prescription.prescriptionOrder || idx + 1}
                              {prescription.isHospitalization && ' (Nội trú)'}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">
                                {formatCurrency(isPaid ? prescription.totalAmount : 0)} / {formatCurrency(prescription.totalAmount)}
                              </span>
                              {isPaid ? (
                                <FaCheck className="text-green-600 text-xs" />
                              ) : (
                                <FaClock className="text-yellow-600 text-xs" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Phí nội trú */}
                {bill.hospitalizationBill.amount > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <FaBed className="text-purple-600" />
                        <span className="text-sm text-gray-700 font-medium">Phí nội trú</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {formatCurrency(bill.hospitalizationBill.status === 'paid' ? bill.hospitalizationBill.amount : 0)} / {formatCurrency(bill.hospitalizationBill.amount)}
                        </span>
                        {bill.hospitalizationBill.status === 'paid' ? (
                          <FaCheck className="text-green-600" />
                        ) : (
                          <FaClock className="text-yellow-600" />
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          bill.hospitalizationBill.status === 'paid' ? 'bg-green-500' : 'bg-yellow-400'
                        }`}
                        style={{ width: `${bill.hospitalizationBill.status === 'paid' ? 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Payment History Toggle */}
          <div className="mt-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <FaHistory />
              {showHistory ? 'Ẩn' : 'Hiển thị'} Lịch Sử Thanh Toán
            </button>
            
            {showHistory && paymentHistory.length > 0 && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b">
                  <h4 className="font-semibold">Lịch Sử Thanh Toán</h4>
                </div>
                <div className="divide-y">
                  {paymentHistory.map((payment, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {getPaymentMethodIcon(payment.paymentMethod)}
                            {getPaymentMethodLabel(payment.paymentMethod)} • {payment.billType === 'consultation' ? 'Phí khám' : payment.billType === 'medication' ? 'Tiền thuốc' : 'Phí nội trú'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(payment.createdAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          payment.paymentStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.paymentStatus === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <FaInfoCircle className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">
                <strong>Lưu ý:</strong> Admin có thể xác nhận thanh toán tiền mặt tại đây. 
                Thanh toán MoMo và PayPal sẽ được tự động cập nhật từ hệ thống thanh toán.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={(e) => e.target === e.currentTarget && setShowConfirmModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-scaleIn">
            <div className="p-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-amber-100 rounded-full">
                  <FaExclamationTriangle className="text-amber-600 text-3xl" />
                </div>
              </div>

              {/* Message */}
              <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
                Xác nhận thanh toán tiền mặt
              </h3>
              <p className="text-gray-600 text-center mb-6">
                {confirmingPrescriptionId 
                  ? 'Bạn có chắc chắn bệnh nhân đã thanh toán đơn thuốc này bằng tiền mặt?'
                  : `Bạn có chắc chắn bệnh nhân đã thanh toán ${
                      confirmingBillType === 'consultation' ? 'phí khám' :
                      confirmingBillType === 'medication' ? 'tiền thuốc' :
                      'phí nội trú'
                    } bằng tiền mặt?`}
              </p>

              {/* Amount reminder */}
              {confirmingPrescriptionId ? (
                bill?.medicationBill?.prescriptionIds?.find(p => p._id === confirmingPrescriptionId) && (
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-4 mb-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <FaMoneyBillWave className="text-amber-600" />
                      <p className="text-sm font-semibold text-gray-700">Số tiền cần xác nhận</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(bill.medicationBill.prescriptionIds.find(p => p._id === confirmingPrescriptionId).totalAmount)}
                    </p>
                  </div>
                )
              ) : (
                confirmingBillType && bill && (
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-4 mb-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <FaMoneyBillWave className="text-amber-600" />
                      <p className="text-sm font-semibold text-gray-700">Số tiền cần xác nhận</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(
                        confirmingBillType === 'consultation' ? bill.consultationBill.amount :
                        confirmingBillType === 'medication' ? bill.medicationBill.amount :
                        bill.hospitalizationBill.amount
                      )}
                    </p>
                  </div>
                )
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setConfirmingBillType(null);
                    setConfirmingPrescriptionId(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={executeCashPayment}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <FaCheck />
                      <span>Xác nhận</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminBilling;
