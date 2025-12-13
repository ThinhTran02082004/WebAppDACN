import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiService } from '../services/api';

interface RouteParams {
  prescriptionId?: string;
}

const formatCurrency = (amount?: number) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '—';
  try {
    return amount.toLocaleString('vi-VN') + ' ₫';
  } catch {
    return `${amount} ₫`;
  }
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Không xác định';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
};

const getStatusMeta = (status?: string) => {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return { label: 'Chờ xử lý', bg: '#fef3c7', color: '#b45309' };
    case 'approved':
      return { label: 'Đã kê đơn', bg: '#dbeafe', color: '#1d4ed8' };
    case 'verified':
      return { label: 'Đã phê duyệt', bg: '#ede9fe', color: '#6d28d9' };
    case 'dispensed':
      return { label: 'Đã cấp thuốc', bg: '#dcfce7', color: '#15803d' };
    case 'completed':
      return { label: 'Hoàn thành', bg: '#e5e7eb', color: '#111827' };
    case 'cancelled':
      return { label: 'Đã hủy', bg: '#fee2e2', color: '#b91c1c' };
    default:
      return { label: status || 'Không xác định', bg: '#f3f4f6', color: '#4b5563' };
  }
};

const PrescriptionDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { prescriptionId } = (route.params ?? {}) as RouteParams;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [prescription, setPrescription] = useState<any>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'momo' | 'paypal'>('momo');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const loadPrescription = async () => {
    if (!prescriptionId) {
      setError('Không tìm thấy mã đơn thuốc.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getPrescriptionById(prescriptionId);
      const data = (response?.data as any) || {};
      setPrescription(data?.data || data?.prescription || data);
    } catch (err: any) {
      console.error('Failed to load prescription detail:', err);
      setError(err?.message || 'Không thể tải chi tiết đơn thuốc.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescription();
  }, [prescriptionId, reloadKey]);

  // Refresh when screen comes into focus (e.g., returning from payment)
  useFocusEffect(
    useCallback(() => {
      if (prescriptionId) {
        // Small delay to ensure server has processed payment
        const timer = setTimeout(() => {
          loadPrescription();
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [prescriptionId])
  );

  const medications = useMemo(() => {
    if (!prescription) return [];
    if (Array.isArray(prescription.medications)) return prescription.medications;
    if (Array.isArray(prescription.items)) return prescription.items;
    return [];
  }, [prescription]);

  const statusMeta = getStatusMeta(prescription?.status);
  const appointmentId = prescription?.appointmentId?._id || prescription?.appointmentId;

  // Check if prescription is already paid
  const isPrescriptionPaid = () => {
    // Check payment status from prescription data
    if (prescription?.paymentStatus === 'paid') return true;
    if (prescription?.status === 'dispensed' || prescription?.status === 'completed') {
      // These statuses might indicate payment, but we should check payment status explicitly
      return prescription?.paymentStatus === 'paid';
    }
    return false;
  };

  const startMomoPayment = async () => {
    try {
      if (!prescription?._id || !appointmentId) {
        Alert.alert('Lỗi', 'Thông tin đơn thuốc không đầy đủ.');
        return;
      }

      const prescriptionAmount = prescription.totalAmount || 0;
      if (prescriptionAmount <= 0) {
        Alert.alert('Lỗi', 'Số tiền đơn thuốc không hợp lệ.');
        return;
      }

      if (isPrescriptionPaid()) {
        Alert.alert('Thông báo', 'Đơn thuốc này đã được thanh toán.');
        return;
      }

      setIsProcessingPayment(true);
      const redirectUrl = 'https://mymobileapp.local/payment/result';
      const prescriptionOrder = prescription.prescriptionOrder || 1;
      const paymentParams = {
        appointmentId: appointmentId,
        amount: Number(prescriptionAmount),
        billType: 'medication',
        prescriptionId: prescription._id,
        orderInfo: `Thanh toán đơn thuốc đợt ${prescriptionOrder}${prescription.appointmentId?.bookingCode ? ` - Lịch hẹn #${prescription.appointmentId.bookingCode}` : ''}`,
        redirectUrl,
      };
      
      console.log('[Payment] Creating MoMo payment for prescription:', paymentParams);
      const created = await apiService.createMomoPayment(paymentParams);
      console.log('[Payment] MoMo payment created for prescription, response:', created);
      
      const payUrl = (created?.data as any)?.payUrl;
      if (payUrl) {
        navigation.navigate('PaymentWebView', { 
          url: payUrl, 
          mode: 'momo', 
          appointmentId: appointmentId,
          prescriptionId: prescription._id
        });
      } else {
        Alert.alert('Lỗi', 'Không thể khởi tạo thanh toán MoMo.');
      }
    } catch (e: any) {
      console.error('[Payment] Error paying prescription:', e);
      Alert.alert('Lỗi', e?.message || 'Không thể khởi tạo thanh toán.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const startPaypalPayment = async () => {
    try {
      if (!prescription?._id || !appointmentId) {
        Alert.alert('Lỗi', 'Thông tin đơn thuốc không đầy đủ.');
        return;
      }

      const prescriptionAmount = prescription.totalAmount || 0;
      if (prescriptionAmount <= 0) {
        Alert.alert('Lỗi', 'Số tiền đơn thuốc không hợp lệ.');
        return;
      }

      if (isPrescriptionPaid()) {
        Alert.alert('Thông báo', 'Đơn thuốc này đã được thanh toán.');
        return;
      }

      setIsProcessingPayment(true);
      const paymentPayload = {
        appointmentId: appointmentId,
        amount: Number(prescriptionAmount),
        billType: 'medication',
        prescriptionId: prescription._id,
      };

      const created = await apiService.createPaypalPayment(paymentPayload);
      const approvalUrl = (created?.data as any)?.approvalUrl;
      if (approvalUrl) {
        navigation.navigate('PaymentWebView', { 
          url: approvalUrl, 
          mode: 'paypal', 
          appointmentId: appointmentId,
          prescriptionId: prescription._id
        });
      } else {
        Alert.alert('Lỗi', 'Không thể khởi tạo thanh toán PayPal.');
      }
    } catch (e: any) {
      console.error('[Payment] Error paying prescription with PayPal:', e);
      Alert.alert('Lỗi', e?.message || 'Không thể khởi tạo thanh toán PayPal.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePay = (mode: 'paypal' | 'momo') => {
    if (!prescription?.totalAmount) {
      Alert.alert('Thông báo', 'Đơn thuốc này chưa có thông tin chi phí để thanh toán.');
      return;
    }
    if (mode === 'momo') {
      startMomoPayment();
    } else {
      startPaypalPayment();
    }
  };

  const handleViewAppointment = () => {
    if (!appointmentId) {
      Alert.alert('Thông báo', 'Đơn thuốc này không gắn với lịch hẹn cụ thể.');
      return;
    }
    navigation.navigate('AppointmentDetail', { appointmentId });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chi tiết đơn thuốc</Text>
          {prescription?.prescriptionOrder ? (
            <Text style={styles.headerSubtitle}>Đợt {prescription.prescriptionOrder}</Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
          <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Có lỗi xảy ra</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => prescriptionId && setReloadKey((key) => key + 1)}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin chung</Text>
            <InfoRow label="Bệnh nhân" value={prescription?.patientId?.fullName || '—'} />
            <InfoRow label="Bác sĩ" value={prescription?.doctorId?.user?.fullName || '—'} />
            <InfoRow label="Mã đơn thuốc" value={prescription?._id || '—'} />
            <InfoRow label="Chẩn đoán" value={prescription?.diagnosis || '—'} />
            <InfoRow label="Ngày kê" value={formatDateTime(prescription?.createdAt)} />
            {prescription?.verifiedAt ? (
              <InfoRow label="Ngày phê duyệt" value={formatDateTime(prescription?.verifiedAt)} />
            ) : null}
            {prescription?.dispensedAt ? (
              <InfoRow label="Ngày cấp thuốc" value={formatDateTime(prescription?.dispensedAt)} />
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thuốc được kê</Text>
            {medications.length === 0 ? (
              <Text style={styles.emptyText}>Không có thuốc trong đơn này.</Text>
            ) : (
              medications.map((med: any, index: number) => (
                <View key={med._id || index} style={styles.medItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName}>{med.medicationId?.name || med.medicationName || 'Thuốc'}</Text>
                    {med.dosage ? <Text style={styles.medMeta}>Liều dùng: {med.dosage}</Text> : null}
                    {med.usage ? <Text style={styles.medMeta}>Cách dùng: {med.usage}</Text> : null}
                    {med.duration ? <Text style={styles.medMeta}>Thời gian: {med.duration}</Text> : null}
                    <Text style={styles.medMeta}>
                      Số lượng: {med.quantity} {med.medicationId?.unitTypeDisplay || ''}
                    </Text>
                  </View>
                  <Text style={styles.medPrice}>{formatCurrency(med.totalPrice)}</Text>
                </View>
              ))
            )}
          </View>

          {prescription?.notes ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ghi chú</Text>
              <Text style={styles.noteText}>{prescription.notes}</Text>
            </View>
          ) : null}

          {typeof prescription?.totalAmount === 'number' && prescription.totalAmount > 0 ? (
            <View style={[styles.card, styles.totalCard]}>
              <Text style={styles.sectionTitle}>Tổng chi phí</Text>
              <Text style={styles.totalAmount}>{formatCurrency(prescription.totalAmount)}</Text>
              
              {isPrescriptionPaid() ? (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  <Text style={styles.paidText}>Đã thanh toán</Text>
                </View>
              ) : (
                <>
                  <View style={styles.paymentMethodRow}>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodButton,
                        selectedPaymentMethod === 'momo' && styles.paymentMethodButtonSelectedMomo,
                      ]}
                      onPress={() => setSelectedPaymentMethod('momo')}
                      disabled={isProcessingPayment}
                    >
                      <Ionicons name="wallet-outline" size={18} color={selectedPaymentMethod === 'momo' ? '#fff' : '#374151'} style={{ marginRight: 6 }} />
                      <Text
                        style={[
                          styles.paymentMethodButtonText,
                          selectedPaymentMethod === 'momo' && styles.paymentMethodButtonTextSelected,
                        ]}
                      >
                        MoMo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodButton,
                        selectedPaymentMethod === 'paypal' && styles.paymentMethodButtonSelectedPaypal,
                      ]}
                      onPress={() => setSelectedPaymentMethod('paypal')}
                      disabled={isProcessingPayment}
                    >
                      <Ionicons name="logo-paypal" size={18} color={selectedPaymentMethod === 'paypal' ? '#fff' : '#374151'} style={{ marginRight: 6 }} />
                      <Text
                        style={[
                          styles.paymentMethodButtonText,
                          selectedPaymentMethod === 'paypal' && styles.paymentMethodButtonTextSelected,
                        ]}
                      >
                        PayPal
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.paymentMainButton,
                      styles.paymentMainButtonGreen,
                      isProcessingPayment && styles.paymentMainButtonDisabled,
                    ]}
                    onPress={() => handlePay(selectedPaymentMethod)}
                    disabled={isProcessingPayment || !appointmentId}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name={selectedPaymentMethod === 'paypal' ? 'logo-paypal' : 'wallet-outline'}
                          size={18}
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.paymentMainButtonText}>
                          Thanh toán {formatCurrency(prescription.totalAmount)}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          <TouchableOpacity style={styles.appointmentButton} activeOpacity={0.85} onPress={handleViewAppointment}>
            <Ionicons name="calendar" size={18} color="#2563eb" style={{ marginRight: 8 }} />
            <Text style={styles.appointmentButtonText}>Xem chi tiết lịch hẹn</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const InfoRow = ({ label, value }: { label: string; value?: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

export default PrescriptionDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#b91c1c',
  },
  errorMessage: {
    textAlign: 'center',
    color: '#7f1d1d',
    marginTop: 4,
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    width: 120,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  medItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  medMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  medPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
    marginLeft: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
  },
  totalCard: {
    alignItems: 'center',
  },
  totalAmount: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '700',
    color: '#16a34a',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  paymentMethodButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentMethodButtonSelectedMomo: {
    backgroundColor: '#ea4c89',
    borderColor: '#ea4c89',
  },
  paymentMethodButtonSelectedPaypal: {
    backgroundColor: '#003087',
    borderColor: '#003087',
  },
  paymentMethodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  paymentMethodButtonTextSelected: {
    color: '#ffffff',
  },
  paymentMainButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  paymentMainButtonGreen: {
    backgroundColor: '#16a34a',
  },
  paymentMainButtonDisabled: {
    opacity: 0.6,
  },
  paymentMainButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  paidText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
  },
  noteText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  appointmentButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
  },
  appointmentButtonText: {
    color: '#2563eb',
    fontWeight: '700',
    fontSize: 15,
  },
});

