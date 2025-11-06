import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FaMoneyBillWave, FaCheck, FaClock, FaPills, FaBed, FaStethoscope } from 'react-icons/fa';

const BillingManager = ({ appointmentId, onPaymentComplete }) => {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({
    consultation: 'cash',
    medication: 'cash',
    hospitalization: 'cash'
  });

  useEffect(() => {
    if (appointmentId) {
      fetchBill();
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


  const handleConfirmCashPayment = async (billType) => {
    const billTypeLabels = {
      consultation: 'phí khám',
      medication: 'tiền thuốc',
      hospitalization: 'phí nội trú'
    };

    if (!window.confirm(`Xác nhận bệnh nhân đã thanh toán ${billTypeLabels[billType]} bằng tiền mặt?`)) return;

    try {
      setLoading(true);
      const response = await api.post('/billing/confirm-cash-payment', {
        appointmentId: bill.appointmentId?._id || bill.appointmentId,
        billType
      });

      if (response.data.success) {
        toast.success(`Xác nhận thanh toán ${billTypeLabels[billType]} thành công`);
        setBill(response.data.data.bill);
        if (onPaymentComplete) onPaymentComplete();
      } else {
        toast.error(response.data.message || 'Xác nhận thất bại');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xác nhận thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPrescriptionCashPayment = async (prescriptionId) => {
    if (!window.confirm('Xác nhận bệnh nhân đã thanh toán đơn thuốc này bằng tiền mặt?')) return;

    try {
      setLoading(true);
      const response = await api.post('/billing/pay-prescription', {
        prescriptionId,
        paymentMethod: 'cash',
        transactionId: `PRES-CASH-${Date.now()}`,
        paymentDetails: { method: 'cash', timestamp: new Date().toISOString() }
      });

      if (response.data.success) {
        toast.success('Xác nhận thanh toán đơn thuốc thành công');
        setBill(response.data.data.bill);
        if (onPaymentComplete) onPaymentComplete();
      } else {
        toast.error(response.data.message || 'Xác nhận thất bại');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xác nhận thất bại');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    if (status === 'paid') {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1">
        <FaCheck /> Đã thanh toán
      </span>;
    }
    if (status === 'cancelled') {
      return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">Đã hủy</span>;
    }
    return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center gap-1">
      <FaClock /> Chưa thanh toán
    </span>;
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: 'Tiền mặt',
      momo: 'MoMo',
      paypal: 'PayPal'
    };
    return labels[method] || method;
  };

  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-gray-500">Đang tải thông tin thanh toán...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaMoneyBillWave />
              Hóa Đơn Thanh Toán
            </h2>
            <p className="text-sm text-gray-600 mt-1">Mã hóa đơn: {bill.billNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Trạng thái tổng</p>
            <span className={`px-4 py-2 rounded-full font-semibold ${
              bill.overallStatus === 'paid' ? 'bg-green-100 text-green-800' :
              bill.overallStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {bill.overallStatus === 'paid' ? 'Đã thanh toán đủ' :
               bill.overallStatus === 'partial' ? 'Thanh toán một phần' :
               'Chưa thanh toán'}
            </span>
          </div>
        </div>

        {/* Total Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">Tổng hóa đơn</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(bill.totalAmount)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">Đã thanh toán</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(bill.paidAmount)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">Còn lại</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(bill.remainingAmount)}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Consultation Bill */}
        {bill.consultationBill.amount > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-6 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaStethoscope className="text-blue-600" />
                Phí Khám Bệnh
              </h3>
              {getStatusBadge(bill.consultationBill.status)}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(bill.consultationBill.amount)}
                  </p>
                  {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentDate && (
                    <p className="text-sm text-gray-600 mt-1">
                      Đã thanh toán: {new Date(bill.consultationBill.paymentDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentMethod && (
                    <p className="text-sm text-gray-600">
                      Phương thức: {getPaymentMethodLabel(bill.consultationBill.paymentMethod)}
                    </p>
                  )}
                </div>
                
                {bill.consultationBill.status === 'pending' && (
                  <button
                    onClick={() => handleConfirmCashPayment('consultation')}
                    disabled={loading}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    <FaCheck />
                    Xác nhận thanh toán tiền mặt
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Medication Bill - Đơn Thuốc */}
        {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-green-50 px-6 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaPills className="text-green-600" />
                Đơn Thuốc
              </h3>
              {getStatusBadge(bill.medicationBill.status)}
            </div>
            <div className="p-6">
              {/* Tổng tiền thuốc */}
              <div className="mb-4 pb-4 border-b">
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
                    <div key={prescription._id || idx} className="bg-white border rounded-lg p-4">
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
                              Phương thức: {getPaymentMethodLabel(prescriptionPayment.paymentMethod)}
                            </p>
                          )}
                        </div>
                      </div>

                      {prescription.diagnosis && (
                        <div className="mb-3 pb-3 border-b border-gray-100">
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
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-purple-50 px-6 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaBed className="text-purple-600" />
                Phí Nội Trú
              </h3>
              {getStatusBadge(bill.hospitalizationBill.status)}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    {formatCurrency(bill.hospitalizationBill.amount)}
                  </p>
                  {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentDate && (
                    <p className="text-sm text-gray-600 mt-1">
                      Đã thanh toán: {new Date(bill.hospitalizationBill.paymentDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentMethod && (
                    <p className="text-sm text-gray-600">
                      Phương thức: {getPaymentMethodLabel(bill.hospitalizationBill.paymentMethod)}
                    </p>
                  )}
                </div>
                
                {bill.hospitalizationBill.status === 'pending' && (
                  <button
                    onClick={() => handleConfirmCashPayment('hospitalization')}
                    disabled={loading}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    <FaCheck />
                    Xác nhận thanh toán tiền mặt
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Tiến độ thanh toán</span>
            <span className="font-semibold">
              {bill.totalAmount > 0 ? Math.round((bill.paidAmount / bill.totalAmount) * 100) : 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-300"
              style={{ width: `${bill.totalAmount > 0 ? (bill.paidAmount / bill.totalAmount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Payment Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <strong>Lưu ý:</strong> Đây là thông tin thanh toán của bệnh nhân. Bạn có thể xác nhận khi bệnh nhân đã thanh toán tiền mặt bằng cách nhấn nút "Xác nhận thanh toán tiền mặt" cho từng phần.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingManager;

