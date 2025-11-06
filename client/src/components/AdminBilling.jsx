import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { 
  FaMoneyBillWave, FaCheck, FaClock, FaPills, FaBed, FaStethoscope, 
  FaCreditCard, FaWallet, FaFileInvoice, FaHistory, FaInfoCircle 
} from 'react-icons/fa';

const AdminBilling = ({ appointmentId, onPaymentComplete, initialBill = null, refreshKey }) => {
  const [bill, setBill] = useState(initialBill);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const fetchBill = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setLoading(true);
      const response = await api.get(`/billing/appointment/${appointmentId}`);
      setBill(response.data.data);
    } catch (error) {
      console.error('Error fetching bill:', error);
      toast.error('Khong the tai thong tin hoa don');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  const fetchPaymentHistory = useCallback(async () => {
    if (!appointmentId) {
      setPaymentHistory([]);
      return;
    }
    try {
      const response = await api.get(`/billing/payments/history`, {
        params: { appointmentId, limit: 100 }
      });
      if (response.data.success) {
        setPaymentHistory(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Khong the tai lich su thanh toan');
    }
  }, [appointmentId]);

  useEffect(() => {
    if (!appointmentId) {
      setBill(null);
      setPaymentHistory([]);
      return;
    }

    if (initialBill) {
      setBill(initialBill);
      setLoading(false);
    } else {
      fetchBill();
    }

    fetchPaymentHistory();
  }, [appointmentId, initialBill, fetchBill, fetchPaymentHistory]);

  useEffect(() => {
    if (refreshKey === undefined || !appointmentId) return;
    fetchBill();
    fetchPaymentHistory();
  }, [refreshKey, appointmentId, fetchBill, fetchPaymentHistory]);

  const handleConfirmCashPayment = async (billType) => {
    const billTypeLabels = {
      consultation: 'phÃƒÂ­ khÃƒÂ¡m',
      medication: 'tiÃ¡Â»Ân thuÃ¡Â»â€˜c',
      hospitalization: 'phÃƒÂ­ nÃ¡Â»â„¢i trÃƒÂº'
    };

    if (!window.confirm(`XÃƒÂ¡c nhÃ¡ÂºÂ­n bÃ¡Â»â€¡nh nhÃƒÂ¢n Ã„â€˜ÃƒÂ£ thanh toÃƒÂ¡n ${billTypeLabels[billType]} bÃ¡ÂºÂ±ng tiÃ¡Â»Ân mÃ¡ÂºÂ·t?`)) return;

    try {
      setLoading(true);
      const response = await api.post('/billing/confirm-cash-payment', {
        appointmentId: bill.appointmentId?._id || bill.appointmentId,
        billType
      });

      if (response.data.success) {
        toast.success(`XÃƒÂ¡c nhÃ¡ÂºÂ­n thanh toÃƒÂ¡n ${billTypeLabels[billType]} thÃƒÂ nh cÃƒÂ´ng`);
        setBill(response.data.data.bill);
        fetchPaymentHistory();
        if (onPaymentComplete) onPaymentComplete();
      } else {
        toast.error(response.data.message || 'XÃƒÂ¡c nhÃ¡ÂºÂ­n thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'XÃƒÂ¡c nhÃ¡ÂºÂ­n thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPrescriptionCashPayment = async (prescriptionId) => {
    if (!window.confirm('XÃƒÂ¡c nhÃ¡ÂºÂ­n bÃ¡Â»â€¡nh nhÃƒÂ¢n Ã„â€˜ÃƒÂ£ thanh toÃƒÂ¡n Ã„â€˜Ã†Â¡n thuÃ¡Â»â€˜c nÃƒÂ y bÃ¡ÂºÂ±ng tiÃ¡Â»Ân mÃ¡ÂºÂ·t?')) return;

    try {
      setLoading(true);
      const response = await api.post('/billing/pay-prescription', {
        prescriptionId,
        paymentMethod: 'cash',
        transactionId: `PRES-CASH-${Date.now()}`,
        paymentDetails: { method: 'cash', timestamp: new Date().toISOString() }
      });

      if (response.data.success) {
        toast.success('XÃƒÂ¡c nhÃ¡ÂºÂ­n thanh toÃƒÂ¡n Ã„â€˜Ã†Â¡n thuÃ¡Â»â€˜c thÃƒÂ nh cÃƒÂ´ng');
        setBill(response.data.data.bill);
        fetchPaymentHistory();
        if (onPaymentComplete) onPaymentComplete();
      } else {
        toast.error(response.data.message || 'XÃƒÂ¡c nhÃ¡ÂºÂ­n thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'XÃƒÂ¡c nhÃ¡ÂºÂ­n thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i');
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
          <FaCheck /> Ã„ÂÃƒÂ£ thanh toÃƒÂ¡n
        </span>
      );
    }
    if (status === 'cancelled') {
      return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">Ã„ÂÃƒÂ£ hÃ¡Â»Â§y</span>;
    }
    return (
      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center gap-1">
        <FaClock /> ChÃ†Â°a thanh toÃƒÂ¡n
      </span>
    );
  };

  const getPaymentMethodLabel = (method) => {
    const labels = { cash: 'TiÃ¡Â»Ân mÃ¡ÂºÂ·t', momo: 'MoMo', paypal: 'PayPal' };
    return labels[method] || method;
  };

  const getPaymentMethodIcon = (method) => {
    if (method === 'cash') return <FaWallet className="inline mr-2" />;
    return <FaCreditCard className="inline mr-2" />;
  };

  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-gray-500">Ã„Âang tÃ¡ÂºÂ£i thÃƒÂ´ng tin thanh toÃƒÂ¡n...</div>
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
                <FaFileInvoice /> QuÃ¡ÂºÂ£n LÃƒÂ½ HÃƒÂ³a Ã„ÂÃ†Â¡n
              </h2>
              <p className="text-sm text-indigo-100 mt-1">MÃƒÂ£ hÃƒÂ³a Ã„â€˜Ã†Â¡n: {bill.billNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-indigo-100">TrÃ¡ÂºÂ¡ng thÃƒÂ¡i tÃ¡Â»â€¢ng</p>
              <span className={`px-4 py-2 rounded-full font-semibold mt-2 inline-block ${
                bill.overallStatus === 'paid' ? 'bg-green-500' :
                bill.overallStatus === 'partial' ? 'bg-yellow-400 text-gray-900' :
                'bg-red-500'
              }`}>
                {bill.overallStatus === 'paid' ? 'Ã„ÂÃƒÂ£ thanh toÃƒÂ¡n Ã„â€˜Ã¡Â»Â§' :
                 bill.overallStatus === 'partial' ? 'Thanh toÃƒÂ¡n mÃ¡Â»â„¢t phÃ¡ÂºÂ§n' :
                 'ChÃ†Â°a thanh toÃƒÂ¡n'}
              </span>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
              <p className="text-sm text-indigo-100 mb-1">TÃ¡Â»â€¢ng hÃƒÂ³a Ã„â€˜Ã†Â¡n</p>
              <p className="text-2xl font-bold">{formatCurrency(bill.totalAmount)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
              <p className="text-sm text-indigo-100 mb-1">Ã„ÂÃƒÂ£ thanh toÃƒÂ¡n</p>
              <p className="text-2xl font-bold text-green-300">{formatCurrency(bill.paidAmount)}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
              <p className="text-sm text-indigo-100 mb-1">CÃƒÂ²n lÃ¡ÂºÂ¡i</p>
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
                  <FaStethoscope /> PhÃƒÂ­ KhÃƒÂ¡m BÃ¡Â»â€¡nh
                </h3>
                {getStatusBadge(bill.consultationBill.status)}
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-3xl font-bold text-blue-600">{formatCurrency(bill.consultationBill.amount)}</p>
                    {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentDate && (
                      <p className="text-sm text-gray-600 mt-1">
                        Ã„ÂÃƒÂ£ thanh toÃƒÂ¡n: {new Date(bill.consultationBill.paymentDate).toLocaleString('vi-VN')}
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
                    XÃƒÂ¡c nhÃ¡ÂºÂ­n thanh toÃƒÂ¡n tiÃ¡Â»Ân mÃ¡ÂºÂ·t
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Medication Bill - Ã„ÂÃ†Â¡n ThuÃ¡Â»â€˜c */}
          {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
            <div className="border-2 border-green-200 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-green-50 px-6 py-4 border-b border-green-200 flex justify-between items-center">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-green-700">
                  <FaPills /> Ã„ÂÃ†Â¡n ThuÃ¡Â»â€˜c
                </h3>
                {getStatusBadge(bill.medicationBill.status)}
              </div>
              <div className="p-6">
                {/* TÃ¡Â»â€¢ng tiÃ¡Â»Ân thuÃ¡Â»â€˜c */}
                <div className="mb-4 pb-4 border-b border-green-200">
                  <p className="text-sm text-gray-600 mb-1">TÃ¡Â»â€¢ng tiÃ¡Â»Ân thuÃ¡Â»â€˜c</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(bill.medicationBill.amount)}</p>
                  <p className="text-xs text-gray-500 mt-1">SÃ¡Â»â€˜ Ã„â€˜Ã†Â¡n thuÃ¡Â»â€˜c: {bill.medicationBill.prescriptionIds.length}</p>
                </div>

                {/* Danh sÃƒÂ¡ch tÃ¡Â»Â«ng prescription */}
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
                              Ã„ÂÃ¡Â»Â£t {prescription.prescriptionOrder || idx + 1}
                            </span>
                            {prescription.isHospitalization && (
                              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                                NÃ¡Â»â„¢i trÃƒÂº
                              </span>
                            )}
                            {isPaid ? (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                <FaCheck /> Ã„ÂÃƒÂ£ thanh toÃƒÂ¡n
                              </span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                                <FaClock /> ChÃ†Â°a thanh toÃƒÂ¡n
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(prescription.totalAmount)}
                            </p>
                            {isPaid && prescriptionPayment?.paymentDate && (
                              <p className="text-xs text-gray-500 mt-1">
                                Ã„ÂÃƒÂ£ thanh toÃƒÂ¡n: {new Date(prescriptionPayment.paymentDate).toLocaleString('vi-VN')}
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
                              <span className="font-medium">ChÃ¡ÂºÂ©n Ã„â€˜oÃƒÂ¡n:</span> {prescription.diagnosis}
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
                            XÃƒÂ¡c nhÃ¡ÂºÂ­n thanh toÃƒÂ¡n tiÃ¡Â»Ân mÃ¡ÂºÂ·t
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
                  <FaBed /> PhÃƒÂ­ NÃ¡Â»â„¢i TrÃƒÂº
                </h3>
                {getStatusBadge(bill.hospitalizationBill.status)}
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-3xl font-bold text-purple-600">{formatCurrency(bill.hospitalizationBill.amount)}</p>
                    {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentDate && (
                      <p className="text-sm text-gray-600 mt-1">
                        Ã„ÂÃƒÂ£ thanh toÃƒÂ¡n: {new Date(bill.hospitalizationBill.paymentDate).toLocaleString('vi-VN')}
                      </p>
                    )}
                    {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentMethod && (
                      <p className="text-sm text-gray-600">
                        {getPaymentMethodIcon(bill.hospitalizationBill.paymentMethod)}
                        {getPaymentMethodLabel(bill.hospitalizationBill.paymentMethod)}
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
                    XÃƒÂ¡c nhÃ¡ÂºÂ­n thanh toÃƒÂ¡n tiÃ¡Â»Ân mÃ¡ÂºÂ·t
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mt-6 bg-gray-50 rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">TiÃ¡ÂºÂ¿n Ã„â€˜Ã¡Â»â„¢ thanh toÃƒÂ¡n</h3>
              
              {/* Overall Progress */}
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">TÃ¡Â»â€¢ng tiÃ¡ÂºÂ¿n Ã„â€˜Ã¡Â»â„¢</span>
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
              
              {/* Chi tiÃ¡ÂºÂ¿t tÃ¡Â»Â«ng loÃ¡ÂºÂ¡i */}
              <div className="space-y-4">
                {/* PhÃƒÂ­ khÃƒÂ¡m */}
                {bill.consultationBill.amount > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <FaStethoscope className="text-blue-600" />
                        <span className="text-sm text-gray-700 font-medium">PhÃƒÂ­ khÃƒÂ¡m bÃ¡Â»â€¡nh</span>
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

                {/* TiÃ¡Â»Ân thuÃ¡Â»â€˜c */}
                {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <FaPills className="text-green-600" />
                        <span className="text-sm text-gray-700 font-medium">TiÃ¡Â»Ân thuÃ¡Â»â€˜c</span>
                        <span className="text-xs text-gray-500">({bill.medicationBill.prescriptionIds.length} Ã„â€˜Ã†Â¡n)</span>
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
                    {/* Chi tiÃ¡ÂºÂ¿t tÃ¡Â»Â«ng Ã„â€˜Ã†Â¡n thuÃ¡Â»â€˜c */}
                    <div className="mt-2 ml-4 space-y-1">
                      {bill.medicationBill.prescriptionIds.map((prescription, idx) => {
                        const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
                          p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === prescription._id.toString()
                        );
                        const isPaid = prescriptionPayment?.status === 'paid' || prescription.status === 'dispensed';
                        return (
                          <div key={prescription._id || idx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">
                              Ã„ÂÃ¡Â»Â£t {prescription.prescriptionOrder || idx + 1}
                              {prescription.isHospitalization && ' (NÃ¡Â»â„¢i trÃƒÂº)'}
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

                {/* PhÃƒÂ­ nÃ¡Â»â„¢i trÃƒÂº */}
                {bill.hospitalizationBill.amount > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <FaBed className="text-purple-600" />
                        <span className="text-sm text-gray-700 font-medium">PhÃƒÂ­ nÃ¡Â»â„¢i trÃƒÂº</span>
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
              {showHistory ? 'Ã¡ÂºÂ¨n' : 'HiÃ¡Â»Æ’n thÃ¡Â»â€¹'} LÃ¡Â»â€¹ch SÃ¡Â»Â­ Thanh ToÃƒÂ¡n
            </button>
            
            {showHistory && paymentHistory.length > 0 && (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b">
                  <h4 className="font-semibold">LÃ¡Â»â€¹ch SÃ¡Â»Â­ Thanh ToÃƒÂ¡n</h4>
                </div>
                <div className="divide-y">
                  {paymentHistory.map((payment, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {getPaymentMethodIcon(payment.paymentMethod)}
                            {getPaymentMethodLabel(payment.paymentMethod)} Ã¢â‚¬Â¢ {payment.billType === 'consultation' ? 'PhÃƒÂ­ khÃƒÂ¡m' : payment.billType === 'medication' ? 'TiÃ¡Â»Ân thuÃ¡Â»â€˜c' : 'PhÃƒÂ­ nÃ¡Â»â„¢i trÃƒÂº'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(payment.createdAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          payment.paymentStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.paymentStatus === 'completed' ? 'HoÃƒÂ n thÃƒÂ nh' : 'Ã„Âang xÃ¡Â»Â­ lÃƒÂ½'}
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
                <strong>LÃ†Â°u ÃƒÂ½:</strong> Admin cÃƒÂ³ thÃ¡Â»Æ’ xÃƒÂ¡c nhÃ¡ÂºÂ­n thanh toÃƒÂ¡n tiÃ¡Â»Ân mÃ¡ÂºÂ·t tÃ¡ÂºÂ¡i Ã„â€˜ÃƒÂ¢y. 
                Thanh toÃƒÂ¡n MoMo vÃƒÂ  PayPal sÃ¡ÂºÂ½ Ã„â€˜Ã†Â°Ã¡Â»Â£c tÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng cÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t tÃ¡Â»Â« hÃ¡Â»â€¡ thÃ¡Â»â€˜ng thanh toÃƒÂ¡n.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBilling;
