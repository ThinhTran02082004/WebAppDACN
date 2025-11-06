import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  FaMoneyBillWave, FaCheck, FaClock, FaPills, FaBed, FaStethoscope,
  FaInfoCircle, FaWallet
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const PharmacistBilling = ({ appointmentId, onPaymentComplete }) => {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (appointmentId) {
      fetchBill();
    }
  }, [appointmentId]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/billing/appointment/${appointmentId}`);
      setBill(response.data.data);
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error('Không thể tải thông tin hóa đơn');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPrescriptionPayment = async (prescriptionId) => {
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

  if (loading && !bill) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-gray-500">Đang tải thông tin thanh toán...</div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-gray-500">Không có thông tin hóa đơn</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaMoneyBillWave /> Quản Lý Thanh Toán Thuốc
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
        {/* Medication Bill - Focus */}
        {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
          <div className="border-2 border-green-200 rounded-lg overflow-hidden">
            <div className="bg-green-50 px-6 py-4 border-b border-green-200 flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-green-700">
                <FaPills /> Đơn Thuốc
              </h3>
              {getStatusBadge(bill.medicationBill.status)}
            </div>
            <div className="p-6">
              <div className="mb-4 pb-4 border-b border-green-200">
                <p className="text-sm text-gray-600 mb-1">Tổng tiền thuốc</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(bill.medicationBill.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">Số đơn thuốc: {bill.medicationBill.prescriptionIds.length}</p>
              </div>

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
                          {isPaid && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                              <FaCheck /> Đã thanh toán
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
                          onClick={() => handleConfirmPrescriptionPayment(prescription._id)}
                          disabled={loading}
                          className="w-full mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <FaWallet />
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

        {/* Consultation Bill - Read-only */}
        {bill.consultationBill.amount > 0 && (
          <div className="border border-blue-200 rounded-lg overflow-hidden opacity-75">
            <div className="bg-blue-50 px-6 py-3 border-b border-blue-200 flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-blue-700">
                <FaStethoscope /> Phí Khám Bệnh
              </h3>
              {getStatusBadge(bill.consultationBill.status)}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center">
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
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(bill.consultationBill.amount)}</p>
                  {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentDate && (
                    <p className="text-sm text-gray-600 mt-1">
                      Đã thanh toán: {new Date(bill.consultationBill.paymentDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hospitalization Bill - Read-only */}
        {bill.hospitalizationBill.amount > 0 && (
          <div className="border border-purple-200 rounded-lg overflow-hidden opacity-75">
            <div className="bg-purple-50 px-6 py-3 border-b border-purple-200 flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2 text-purple-700">
                <FaBed /> Phí Nội Trú
              </h3>
              {getStatusBadge(bill.hospitalizationBill.status)}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(bill.hospitalizationBill.amount)}</p>
                  {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentDate && (
                    <p className="text-sm text-gray-600 mt-1">
                      Đã thanh toán: {new Date(bill.hospitalizationBill.paymentDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Note */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <FaInfoCircle className="text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700">
              <strong>Lưu ý:</strong> Dược sĩ có thể xác nhận thanh toán tiền mặt cho đơn thuốc. 
              Thanh toán MoMo và PayPal sẽ được tự động cập nhật từ hệ thống thanh toán.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PharmacistBilling;

