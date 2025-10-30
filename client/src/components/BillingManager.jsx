import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/billing/appointment/${appointmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBill(response.data.data);
    } catch (error) {
      console.error('Error fetching bill:', error);
    }
  };

  const handlePayConsultation = async () => {
    if (!window.confirm('Xác nhận thanh toán phí khám?')) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const paymentData = {
        billId: bill._id,
        paymentMethod: paymentMethods.consultation,
        transactionId: `CONS-${Date.now()}`,
        paymentDetails: {
          method: paymentMethods.consultation,
          timestamp: new Date().toISOString()
        }
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/billing/pay-consultation`,
        paymentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Thanh toán phí khám thành công');
      setBill(response.data.data);

      if (onPaymentComplete) onPaymentComplete();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handlePayMedication = async () => {
    if (!window.confirm('Xác nhận thanh toán tiền thuốc?')) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const paymentData = {
        billId: bill._id,
        paymentMethod: paymentMethods.medication,
        transactionId: `MED-${Date.now()}`,
        paymentDetails: {
          method: paymentMethods.medication,
          timestamp: new Date().toISOString()
        }
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/billing/pay-medication`,
        paymentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Thanh toán tiền thuốc thành công');
      setBill(response.data.data);

      if (onPaymentComplete) onPaymentComplete();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handlePayHospitalization = async () => {
    if (!window.confirm('Xác nhận thanh toán phí nội trú?')) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const paymentData = {
        billId: bill._id,
        paymentMethod: paymentMethods.hospitalization,
        transactionId: `HOSP-${Date.now()}`,
        paymentDetails: {
          method: paymentMethods.hospitalization,
          timestamp: new Date().toISOString()
        }
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/billing/pay-hospitalization`,
        paymentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Thanh toán phí nội trú thành công');
      setBill(response.data.data);

      if (onPaymentComplete) onPaymentComplete();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toán thất bại');
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
                  <div className="flex flex-col gap-2">
                    <select
                      value={paymentMethods.consultation}
                      onChange={(e) => setPaymentMethods({ ...paymentMethods, consultation: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="momo">MoMo</option>
                      <option value="paypal">PayPal</option>
                    </select>
                    <button
                      onClick={handlePayConsultation}
                      disabled={loading}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                      <FaMoneyBillWave />
                      Thanh Toán
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Medication Bill */}
        {bill.medicationBill.amount > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-green-50 px-6 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaPills className="text-green-600" />
                Tiền Thuốc
              </h3>
              {getStatusBadge(bill.medicationBill.status)}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-3xl font-bold text-green-600">
                    {formatCurrency(bill.medicationBill.amount)}
                  </p>
                  {bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Số đơn thuốc: {bill.medicationBill.prescriptionIds.length}
                    </p>
                  )}
                  {bill.medicationBill.status === 'paid' && bill.medicationBill.paymentDate && (
                    <p className="text-sm text-gray-600">
                      Đã thanh toán: {new Date(bill.medicationBill.paymentDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {bill.medicationBill.status === 'paid' && bill.medicationBill.paymentMethod && (
                    <p className="text-sm text-gray-600">
                      Phương thức: {getPaymentMethodLabel(bill.medicationBill.paymentMethod)}
                    </p>
                  )}
                </div>
                
                {bill.medicationBill.status === 'pending' && (
                  <div className="flex flex-col gap-2">
                    <select
                      value={paymentMethods.medication}
                      onChange={(e) => setPaymentMethods({ ...paymentMethods, medication: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="momo">MoMo</option>
                      <option value="paypal">PayPal</option>
                    </select>
                    <button
                      onClick={handlePayMedication}
                      disabled={loading}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                      <FaMoneyBillWave />
                      Thanh Toán
                    </button>
                  </div>
                )}
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
                  <div className="flex flex-col gap-2">
                    <select
                      value={paymentMethods.hospitalization}
                      onChange={(e) => setPaymentMethods({ ...paymentMethods, hospitalization: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="cash">Tiền mặt</option>
                      <option value="momo">MoMo</option>
                      <option value="paypal">PayPal</option>
                    </select>
                    <button
                      onClick={handlePayHospitalization}
                      disabled={loading}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                      <FaMoneyBillWave />
                      Thanh Toán
                    </button>
                  </div>
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-700">
            <strong>Lưu ý:</strong> Bạn có thể thanh toán từng phần riêng biệt theo nhu cầu. 
            Mỗi phần có thể chọn phương thức thanh toán khác nhau (Tiền mặt, MoMo, PayPal).
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingManager;

