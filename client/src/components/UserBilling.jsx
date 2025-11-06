import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { FaMoneyBillWave, FaCheck, FaClock, FaPills, FaBed, FaStethoscope, FaCreditCard, FaWallet, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import PayPalButton from './PayPalButton';

const UserBilling = ({ appointmentId, onPaymentComplete, hospitalization, appointment, initialBill = null, refreshKey }) => {
  const [bill, setBill] = useState(initialBill);
  const [loading, setLoading] = useState(false);
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [payPalConfig, setPayPalConfig] = useState({ type: null, amount: 0 });
  const [hospitalizationData, setHospitalizationData] = useState(hospitalization || null);
  const [paymentMethods, setPaymentMethods] = useState({
    consultation: 'cash',
    hospitalization: 'cash'
  });
  const [prescriptionPaymentMethods, setPrescriptionPaymentMethods] = useState({});

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

  useEffect(() => {
    if (!appointmentId) {
      setBill(null);
      return;
    }

    if (initialBill) {
      setBill(initialBill);
      setLoading(false);
    } else {
      fetchBill();
    }

    if (!hospitalization && initialBill?.hospitalizationBill?.hospitalizationId) {
      fetchHospitalization(initialBill.hospitalizationBill.hospitalizationId);
    }
  }, [appointmentId, initialBill, hospitalization, fetchBill]);

  useEffect(() => {
    if (refreshKey === undefined || !appointmentId) return;
    fetchBill();
  }, [refreshKey, appointmentId, fetchBill]);

  useEffect(() => {
    if (hospitalization) {
      setHospitalizationData(hospitalization);
    }
  }, [hospitalization]);

  useEffect(() => {
    if (bill?.hospitalizationBill?.hospitalizationId && !hospitalizationData) {
      fetchHospitalization(bill.hospitalizationBill.hospitalizationId);
    }
  }, [bill]);

  const fetchHospitalization = async (hospitalizationId) => {
    try {
      const response = await api.get(`/hospitalizations/${hospitalizationId}`);
      if (response.data.success) {
        setHospitalizationData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching hospitalization:', error);
      toast.error('KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒÂ¡Ã‚ÂºÃ‚Â£i thÃƒÆ’Ã‚Â´ng tin nÃƒÂ¡Ã‚ÂºÃ‚Â±m viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n');
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);

  const getStatusBadge = (status) => {
    if (status === 'paid') return (
      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-1"><FaCheck /> Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ thanh toÃƒÆ’Ã‚Â¡n</span>
    );
    if (status === 'cancelled') return (
      <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ hÃƒÂ¡Ã‚Â»Ã‚Â§y</span>
    );
    return (
      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center gap-1"><FaClock /> ChÃƒâ€ Ã‚Â°a thanh toÃƒÆ’Ã‚Â¡n</span>
    );
  };

  const payPrescription = async (prescriptionId, method) => {
    if (!bill || !prescriptionId) return;
    if (appointment?.status === 'hospitalized') {
      toast.warning('KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ thanh toÃƒÆ’Ã‚Â¡n khi Ãƒâ€žÃ¢â‚¬Ëœang nÃƒÂ¡Ã‚ÂºÃ‚Â±m viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n. Vui lÃƒÆ’Ã‚Â²ng Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â£i xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n.');
      return;
    }

    try {
      setLoading(true);

      if (method === 'momo') {
        // Get prescription to get amount
        const prescription = bill.medicationBill.prescriptionIds.find(p => p._id === prescriptionId);
        if (!prescription) {
          toast.error('KhÃƒÆ’Ã‚Â´ng tÃƒÆ’Ã‚Â¬m thÃƒÂ¡Ã‚ÂºÃ‚Â¥y Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc');
          return;
        }
        const res = await api.post('/payments/momo/create', {
          appointmentId: (bill.appointmentId && bill.appointmentId._id) ? bill.appointmentId._id : bill.appointmentId,
          amount: prescription.totalAmount,
          billType: 'medication',
          prescriptionId
        });
        if (res.data?.payUrl) {
          window.location.href = res.data.payUrl;
          return;
        }
        toast.error('KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒÂ¡Ã‚ÂºÃ‚Â¡o thanh toÃƒÆ’Ã‚Â¡n MoMo');
      } else if (method === 'paypal') {
        const prescription = bill.medicationBill.prescriptionIds.find(p => p._id === prescriptionId);
        if (!prescription) {
          toast.error('KhÃƒÆ’Ã‚Â´ng tÃƒÆ’Ã‚Â¬m thÃƒÂ¡Ã‚ÂºÃ‚Â¥y Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc');
          return;
        }
        setPayPalConfig({ type: 'prescription', prescriptionId, amount: prescription.totalAmount });
        setShowPayPalModal(true);
        setLoading(false);
        return;
      } else {
        // cash payment
        const response = await api.post('/billing/pay-prescription', {
          prescriptionId,
          paymentMethod: method,
          transactionId: `PRES-${Date.now()}`,
          paymentDetails: { method, timestamp: new Date().toISOString() }
        });
        
        if (response.data.success) {
          toast.success('Thanh toÃƒÆ’Ã‚Â¡n Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng');
          await fetchBill();
          if (onPaymentComplete) onPaymentComplete();
        } else {
          toast.error(response.data.message || 'Thanh toÃƒÆ’Ã‚Â¡n thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toÃƒÆ’Ã‚Â¡n thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
    } finally {
      setLoading(false);
    }
  };

  const pay = async (type) => {
    if (!bill) return;
    if (appointment?.status === 'hospitalized' && (type === 'consultation' || type === 'hospitalization')) {
      toast.warning('KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ thanh toÃƒÆ’Ã‚Â¡n khi Ãƒâ€žÃ¢â‚¬Ëœang nÃƒÂ¡Ã‚ÂºÃ‚Â±m viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n. Vui lÃƒÆ’Ã‚Â²ng Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â£i xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n.');
      return;
    }

    try {
      setLoading(true);
      const method = paymentMethods[type];
      const amount = type === 'consultation' ? bill.consultationBill.amount
        : bill.hospitalizationBill.amount;

      if (method === 'momo') {
        const res = await api.post('/payments/momo/create', {
          appointmentId: (bill.appointmentId && bill.appointmentId._id) ? bill.appointmentId._id : bill.appointmentId,
          amount,
          billType: type
        });
        if (res.data?.payUrl) {
          window.location.href = res.data.payUrl;
          return;
        }
        toast.error('KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒÂ¡Ã‚ÂºÃ‚Â¡o thanh toÃƒÆ’Ã‚Â¡n MoMo');
      } else if (method === 'paypal') {
        // Show PayPal modal with SDK
        setPayPalConfig({ type, amount });
        setShowPayPalModal(true);
        setLoading(false);
        return;
      } else {
        // cash ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“ xÃƒÆ’Ã‚Â¡c nhÃƒÂ¡Ã‚ÂºÃ‚Â­n nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i bÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ ngay
        const endpoint = type === 'consultation'
          ? '/billing/pay-consultation'
          : '/billing/pay-hospitalization';

        const txIdPrefix = type === 'consultation' ? 'CONS' : 'HOSP';
        const payload = {
          billId: bill._id,
          paymentMethod: method,
          transactionId: `${txIdPrefix}-${Date.now()}`,
          paymentDetails: { method, timestamp: new Date().toISOString() }
        };
        const response = await api.post(endpoint, payload);
        toast.success('Thanh toÃƒÆ’Ã‚Â¡n thÃƒÆ’Ã‚Â nh cÃƒÆ’Ã‚Â´ng');
        setBill(response.data.data);
        if (onPaymentComplete) onPaymentComplete();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Thanh toÃƒÆ’Ã‚Â¡n thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
    } finally {
      setLoading(false);
    }
  };

  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8 text-gray-500">Ãƒâ€žÃ‚Âang tÃƒÂ¡Ã‚ÂºÃ‚Â£i thÃƒÆ’Ã‚Â´ng tin thanh toÃƒÆ’Ã‚Â¡n...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaMoneyBillWave /> Thanh ToÃƒÆ’Ã‚Â¡n LÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ch HÃƒÂ¡Ã‚ÂºÃ‚Â¹n
            </h2>
            <p className="text-sm text-gray-600 mt-1">MÃƒÆ’Ã‚Â£ hÃƒÆ’Ã‚Â³a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n: {bill.billNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">TrÃƒÂ¡Ã‚ÂºÃ‚Â¡ng thÃƒÆ’Ã‚Â¡i tÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ng</p>
            <span className={`px-4 py-2 rounded-full font-semibold ${
              bill.overallStatus === 'paid' ? 'bg-green-100 text-green-800' :
              bill.overallStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {bill.overallStatus === 'paid' ? 'Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ thanh toÃƒÆ’Ã‚Â¡n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â§' : bill.overallStatus === 'partial' ? 'Thanh toÃƒÆ’Ã‚Â¡n mÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢t phÃƒÂ¡Ã‚ÂºÃ‚Â§n' : 'ChÃƒâ€ Ã‚Â°a thanh toÃƒÆ’Ã‚Â¡n'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ng hÃƒÆ’Ã‚Â³a Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(bill.totalAmount)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ thanh toÃƒÆ’Ã‚Â¡n</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(bill.paidAmount)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="text-sm text-gray-600">CÃƒÆ’Ã‚Â²n lÃƒÂ¡Ã‚ÂºÃ‚Â¡i</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(bill.remainingAmount)}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {bill.consultationBill.amount > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-6 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaStethoscope className="text-blue-600" /> PhÃƒÆ’Ã‚Â­ KhÃƒÆ’Ã‚Â¡m BÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡nh
              </h3>
              {getStatusBadge(bill.consultationBill.status)}
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(bill.consultationBill.amount)}</p>
                  {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentDate && (
                    <p className="text-sm text-gray-500 mt-1">
                      Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ thanh toÃƒÆ’Ã‚Â¡n: {new Date(bill.consultationBill.paymentDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {bill.consultationBill.status === 'paid' && bill.consultationBill.paymentMethod && (
                    <p className="text-sm text-gray-500">
                      PhÃƒâ€ Ã‚Â°Ãƒâ€ Ã‚Â¡ng thÃƒÂ¡Ã‚Â»Ã‚Â©c: {bill.consultationBill.paymentMethod === 'cash' ? 'TiÃƒÂ¡Ã‚Â»Ã‚Ân mÃƒÂ¡Ã‚ÂºÃ‚Â·t' : bill.consultationBill.paymentMethod === 'momo' ? 'MoMo' : 'PayPal'}
                    </p>
                  )}
                </div>
              </div>
              {bill.consultationBill.status === 'pending' && (
                <>
                  {appointment?.status === 'hospitalized' && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <FaClock className="inline mr-1" /> Ãƒâ€žÃ‚Âang nÃƒÂ¡Ã‚ÂºÃ‚Â±m viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n. Vui lÃƒÆ’Ã‚Â²ng Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â£i xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ thanh toÃƒÆ’Ã‚Â¡n phÃƒÆ’Ã‚Â­ khÃƒÆ’Ã‚Â¡m.
                      </p>
                    </div>
                  )}
                  {appointment?.status !== 'hospitalized' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPaymentMethods({ ...paymentMethods, consultation: 'cash' })}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            paymentMethods.consultation === 'cash'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <FaWallet className="inline mr-2" /> TiÃƒÂ¡Ã‚Â»Ã‚Ân mÃƒÂ¡Ã‚ÂºÃ‚Â·t
                        </button>
                        <button
                          onClick={() => setPaymentMethods({ ...paymentMethods, consultation: 'momo' })}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            paymentMethods.consultation === 'momo'
                              ? 'bg-pink-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <FaCreditCard className="inline mr-2" /> MoMo
                        </button>
                        <button
                          onClick={() => setPaymentMethods({ ...paymentMethods, consultation: 'paypal' })}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            paymentMethods.consultation === 'paypal'
                              ? 'bg-blue-500 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <FaCreditCard className="inline mr-2" /> PayPal
                        </button>
                      </div>
                      <button
                        disabled={loading}
                        onClick={() => pay('consultation')}
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Ãƒâ€žÃ‚Âang xÃƒÂ¡Ã‚Â»Ã‚Â­ lÃƒÆ’Ã‚Â½...</span>
                          </>
                        ) : (
                          <>
                            <FaMoneyBillWave /> Thanh ToÃƒÆ’Ã‚Â¡n {formatCurrency(bill.consultationBill.amount)}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-green-50 px-6 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaPills className="text-green-600" /> TiÃƒÂ¡Ã‚Â»Ã‚Ân ThuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc
              </h3>
              {getStatusBadge(bill.medicationBill.status)}
            </div>
            <div className="p-6">
              {/* Warning message if hospitalized */}
              {appointment?.status === 'hospitalized' && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-800">
                    <FaClock className="text-lg" />
                    <div>
                      <p className="font-semibold">Ãƒâ€žÃ‚Âang nÃƒÂ¡Ã‚ÂºÃ‚Â±m viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n</p>
                      <p className="text-sm">Vui lÃƒÆ’Ã‚Â²ng Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Â£i xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t viÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ thanh toÃƒÆ’Ã‚Â¡n Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Prescriptions list */}
              <div className="space-y-4 mb-4">
                {bill.medicationBill.prescriptionIds.map((prescription, idx) => {
                  const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
                    p => p.prescriptionId?._id?.toString() === prescription._id.toString() || 
                        p.prescriptionId?.toString() === prescription._id.toString()
                  );
                  const isPaid = prescriptionPayment?.status === 'paid' || prescription.status === 'dispensed';
                  const canPay = !isPaid && appointment?.status !== 'hospitalized';
                  
                  return (
                    <div key={prescription._id || idx} className="bg-white border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                            Ãƒâ€žÃ‚ÂÃƒÂ¡Ã‚Â»Ã‚Â£t {prescription.prescriptionOrder || idx + 1}
                          </span>
                          {prescription.isHospitalization && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                              NÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i trÃƒÆ’Ã‚Âº
                            </span>
                          )}
                          {isPaid && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                              Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ thanh toÃƒÆ’Ã‚Â¡n
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{formatCurrency(prescription.totalAmount)}</p>
                          {isPaid && prescriptionPayment?.paymentDate && (
                            <p className="text-xs text-gray-500">
                              {new Date(prescriptionPayment.paymentDate).toLocaleDateString('vi-VN')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {prescription.diagnosis && (
                        <div className="mb-2 text-sm text-gray-600">
                          <span className="font-medium">ChÃƒÂ¡Ã‚ÂºÃ‚Â©n Ãƒâ€žÃ¢â‚¬ËœoÃƒÆ’Ã‚Â¡n:</span> {prescription.diagnosis}
                        </div>
                      )}
                      
                      {canPay && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setPrescriptionPaymentMethods({ ...prescriptionPaymentMethods, [prescription._id]: 'cash' })}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                prescriptionPaymentMethods[prescription._id] === 'cash'
                                  ? 'bg-green-600 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <FaWallet className="inline mr-1.5" /> TiÃƒÂ¡Ã‚Â»Ã‚Ân mÃƒÂ¡Ã‚ÂºÃ‚Â·t
                            </button>
                            <button
                              onClick={() => setPrescriptionPaymentMethods({ ...prescriptionPaymentMethods, [prescription._id]: 'momo' })}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                prescriptionPaymentMethods[prescription._id] === 'momo'
                                  ? 'bg-pink-600 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <FaCreditCard className="inline mr-1.5" /> MoMo
                            </button>
                            <button
                              onClick={() => setPrescriptionPaymentMethods({ ...prescriptionPaymentMethods, [prescription._id]: 'paypal' })}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                prescriptionPaymentMethods[prescription._id] === 'paypal'
                                  ? 'bg-blue-500 text-white shadow-md'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <FaCreditCard className="inline mr-1.5" /> PayPal
                            </button>
                          </div>
                          <button
                            disabled={loading || !prescriptionPaymentMethods[prescription._id]}
                            onClick={() => payPrescription(prescription._id, prescriptionPaymentMethods[prescription._id] || 'cash')}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                          >
                            {loading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Ãƒâ€žÃ‚Âang xÃƒÂ¡Ã‚Â»Ã‚Â­ lÃƒÆ’Ã‚Â½...</span>
                              </>
                            ) : (
                              <>
                                <FaMoneyBillWave /> Thanh ToÃƒÆ’Ã‚Â¡n {formatCurrency(prescription.totalAmount)}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Total medication bill */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ng tiÃƒÂ¡Ã‚Â»Ã‚Ân thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc:</span>
                  <span className="text-xl font-bold text-green-600">{formatCurrency(bill.medicationBill.amount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {bill.hospitalizationBill.amount > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-purple-50 px-6 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <FaBed className="text-purple-600" /> PhÃƒÆ’Ã‚Â­ NÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i TrÃƒÆ’Ã‚Âº
              </h3>
              {getStatusBadge(bill.hospitalizationBill.status)}
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold text-purple-600">{formatCurrency(bill.hospitalizationBill.amount)}</p>
                  {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentDate && (
                    <p className="text-sm text-gray-500 mt-1">
                      Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ thanh toÃƒÆ’Ã‚Â¡n: {new Date(bill.hospitalizationBill.paymentDate).toLocaleString('vi-VN')}
                    </p>
                  )}
                  {bill.hospitalizationBill.status === 'paid' && bill.hospitalizationBill.paymentMethod && (
                    <p className="text-sm text-gray-500">
                      PhÃƒâ€ Ã‚Â°Ãƒâ€ Ã‚Â¡ng thÃƒÂ¡Ã‚Â»Ã‚Â©c: {bill.hospitalizationBill.paymentMethod === 'cash' ? 'TiÃƒÂ¡Ã‚Â»Ã‚Ân mÃƒÂ¡Ã‚ÂºÃ‚Â·t' : bill.hospitalizationBill.paymentMethod === 'momo' ? 'MoMo' : 'PayPal'}
                    </p>
                  )}
                  {hospitalizationData && (
                    <div className="mt-2 text-sm text-gray-600">
                      {hospitalizationData.totalHours > 0 && (
                        <p>TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ng thÃƒÂ¡Ã‚Â»Ã‚Âi gian: {hospitalizationData.totalHours} giÃƒÂ¡Ã‚Â»Ã‚Â</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Room History Details */}
              {hospitalizationData?.roomHistory && hospitalizationData.roomHistory.length > 0 && (
                <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm font-semibold text-purple-800 mb-3">Chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t phÃƒÆ’Ã‚Â²ng</div>
                  <div className="space-y-2">
                    {hospitalizationData.roomHistory.map((roomEntry, idx) => (
                      <div key={idx} className="bg-white rounded p-3 border border-purple-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-800">
                            PhÃƒÆ’Ã‚Â²ng {roomEntry.roomNumber || 'N/A'}
                            {roomEntry.roomType && (
                              <span className="ml-2 text-xs text-gray-500">({roomEntry.roomType})</span>
                            )}
                          </div>
                          {roomEntry.amount > 0 && (
                            <div className="text-sm font-semibold text-gray-700">
                              {formatCurrency(roomEntry.amount)}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">VÃƒÆ’Ã‚Â o:</span> {roomEntry.checkInTime ? new Date(roomEntry.checkInTime).toLocaleString('vi-VN') : 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Ra:</span> {roomEntry.checkOutTime ? new Date(roomEntry.checkOutTime).toLocaleString('vi-VN') : 'Ãƒâ€žÃ‚Âang ÃƒÂ¡Ã‚Â»Ã…Â¸'}
                          </div>
                          {roomEntry.hours > 0 && (
                            <div>
                              <span className="font-medium">ThÃƒÂ¡Ã‚Â»Ã‚Âi gian:</span> {roomEntry.hours} giÃƒÂ¡Ã‚Â»Ã‚Â
                            </div>
                          )}
                          {roomEntry.hourlyRate > 0 && (
                            <div>
                              <span className="font-medium">GiÃƒÆ’Ã‚Â¡/giÃƒÂ¡Ã‚Â»Ã‚Â:</span> {formatCurrency(roomEntry.hourlyRate)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {bill.hospitalizationBill.status === 'pending' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPaymentMethods({ ...paymentMethods, hospitalization: 'cash' })}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        paymentMethods.hospitalization === 'cash'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FaWallet className="inline mr-2" /> TiÃƒÂ¡Ã‚Â»Ã‚Ân mÃƒÂ¡Ã‚ÂºÃ‚Â·t
                    </button>
                    <button
                      onClick={() => setPaymentMethods({ ...paymentMethods, hospitalization: 'momo' })}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        paymentMethods.hospitalization === 'momo'
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FaCreditCard className="inline mr-2" /> MoMo
                    </button>
                    <button
                      onClick={() => setPaymentMethods({ ...paymentMethods, hospitalization: 'paypal' })}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        paymentMethods.hospitalization === 'paypal'
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FaCreditCard className="inline mr-2" /> PayPal
                    </button>
                  </div>
                  <button
                    disabled={loading}
                    onClick={() => pay('hospitalization')}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Ãƒâ€žÃ‚Âang xÃƒÂ¡Ã‚Â»Ã‚Â­ lÃƒÆ’Ã‚Â½...</span>
                      </>
                    ) : (
                      <>
                        <FaMoneyBillWave /> Thanh ToÃƒÆ’Ã‚Â¡n {formatCurrency(bill.hospitalizationBill.amount)}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">TiÃƒÂ¡Ã‚ÂºÃ‚Â¿n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢ thanh toÃƒÆ’Ã‚Â¡n</h3>
            <div className="flex justify-between text-sm mb-2">
              <span>TÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ng tiÃƒÂ¡Ã‚ÂºÃ‚Â¿n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢</span>
              <span className="font-semibold">{bill.totalAmount > 0 ? Math.round((bill.paidAmount / bill.totalAmount) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-4">
              <div className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-300" style={{ width: `${bill.totalAmount > 0 ? (bill.paidAmount / bill.totalAmount) * 100 : 0}%` }} />
            </div>
            
            {/* Chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t tÃƒÂ¡Ã‚Â»Ã‚Â«ng loÃƒÂ¡Ã‚ÂºÃ‚Â¡i */}
            <div className="space-y-3">
              {/* PhÃƒÆ’Ã‚Â­ khÃƒÆ’Ã‚Â¡m */}
              {bill.consultationBill.amount > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <FaStethoscope className="text-blue-600" />
                      <span className="text-sm text-gray-700">PhÃƒÆ’Ã‚Â­ khÃƒÆ’Ã‚Â¡m bÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡nh</span>
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

              {/* Ãƒâ€žÃ‚ÂÃƒâ€ Ã‚Â¡n thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc */}
              {bill.medicationBill.amount > 0 && bill.medicationBill.prescriptionIds && bill.medicationBill.prescriptionIds.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <FaPills className="text-green-600" />
                      <span className="text-sm text-gray-700">TiÃƒÂ¡Ã‚Â»Ã‚Ân thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc</span>
                      <span className="text-xs text-gray-500">({bill.medicationBill.prescriptionIds.length} Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n)</span>
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
                  {/* Chi tiÃƒÂ¡Ã‚ÂºÃ‚Â¿t tÃƒÂ¡Ã‚Â»Ã‚Â«ng Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n thuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc */}
                  <div className="mt-2 ml-4 space-y-1">
                    {bill.medicationBill.prescriptionIds.map((prescription, idx) => {
                      const prescriptionPayment = bill.medicationBill.prescriptionPayments?.find(
                        p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === prescription._id.toString()
                      );
                      const isPaid = prescriptionPayment?.status === 'paid' || prescription.status === 'dispensed';
                      return (
                        <div key={prescription._id || idx} className="flex justify-between items-center text-xs">
                          <span className="text-gray-600">
                            Ãƒâ€žÃ‚ÂÃƒÂ¡Ã‚Â»Ã‚Â£t {prescription.prescriptionOrder || idx + 1}
                            {prescription.isHospitalization && ' (NÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i trÃƒÆ’Ã‚Âº)'}
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

              {/* PhÃƒÆ’Ã‚Â­ nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i trÃƒÆ’Ã‚Âº */}
              {bill.hospitalizationBill.amount > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <FaBed className="text-purple-600" />
                      <span className="text-sm text-gray-700">PhÃƒÆ’Ã‚Â­ nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i trÃƒÆ’Ã‚Âº</span>
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
      </div>

      {/* PayPal Modal */}
      {showPayPalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowPayPalModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FaTimes className="text-xl" />
            </button>
            
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Thanh toÃƒÆ’Ã‚Â¡n PayPal</h3>
              <p className="text-gray-600">
                SÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ tiÃƒÂ¡Ã‚Â»Ã‚Ân: <span className="font-semibold text-blue-600">{formatCurrency(payPalConfig.amount)}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {payPalConfig.type === 'consultation' && 'PhÃƒÆ’Ã‚Â­ KhÃƒÆ’Ã‚Â¡m BÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡nh'}
                {payPalConfig.type === 'prescription' && 'Ãƒâ€žÃ‚ÂÃƒâ€ Ã‚Â¡n ThuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœc'}
                {payPalConfig.type === 'hospitalization' && 'PhÃƒÆ’Ã‚Â­ NÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i TrÃƒÆ’Ã‚Âº'}
              </p>
            </div>

            <div className="border-t pt-4">
              {payPalConfig.type === 'prescription' ? (
                <PayPalButton
                  amount={payPalConfig.amount}
                  appointmentId={(bill.appointmentId && bill.appointmentId._id) ? bill.appointmentId._id : bill.appointmentId}
                  billType="medication"
                  prescriptionId={payPalConfig.prescriptionId}
                  onSuccess={async () => {
                    setShowPayPalModal(false);
                    await fetchBill();
                    if (onPaymentComplete) onPaymentComplete();
                  }}
                  onError={() => {
                    // Keep modal open on error so user can retry
                  }}
                  onCancel={() => {
                    setShowPayPalModal(false);
                  }}
                />
              ) : (
                <PayPalButton
                  amount={payPalConfig.amount}
                  appointmentId={(bill.appointmentId && bill.appointmentId._id) ? bill.appointmentId._id : bill.appointmentId}
                  billType={payPalConfig.type}
                  onSuccess={async () => {
                    setShowPayPalModal(false);
                    await fetchBill();
                    if (onPaymentComplete) onPaymentComplete();
                  }}
                  onError={() => {
                    // Keep modal open on error so user can retry
                  }}
                  onCancel={() => {
                    setShowPayPalModal(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserBilling;
