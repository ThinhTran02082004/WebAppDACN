import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, RefreshControl } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../services/api';
import { IconColors } from '../config/icons';
import { useAuth } from '../contexts/AuthContext';

type PaymentEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  method?: string;
  status?: string;
  billType?: string;
  transactionId?: string;
  paymentNumber?: string;
  appointmentId?: string;
  appointment?: any;
};

const formatPaymentMethod = (method?: string) => {
  switch ((method || '').toLowerCase()) {
    case 'cash':
      return 'Tiền mặt';
    case 'momo':
      return 'MoMo';
    case 'paypal':
      return 'PayPal';
    default:
      return method ? method.toUpperCase?.() || String(method) : undefined;
  }
};

export default function PaymentHistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  const formatVnd = (amount?: number) => {
    if (typeof amount !== 'number') return '0 ₫';
    try {
      return amount.toLocaleString('vi-VN') + ' ₫';
    } catch {
      return `${amount} ₫`;
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const resp = await apiService.getPaymentHistory({ page: 1, limit: 50 });
      const payload: any = resp?.data || resp;
      const rawList = (payload?.data ?? payload?.records ?? payload) as any[];
      const entries: PaymentEntry[] = (Array.isArray(rawList) ? rawList : []).map((item, index) => {
        const amount = Number(item?.amount || 0);
        const appointment = item?.appointmentId || {};
        const doctorName = appointment?.doctorId?.user?.fullName;
        const serviceName = appointment?.serviceId?.name;
        const specialtyName = appointment?.specialtyId?.name;
        
        // Debug: Log payment item to see what backend returns
        if (index === 0 || amount === 110000) {
          console.log('[PaymentHistory] Payment item:', {
            amount,
            billType: item?.billType,
            paymentType: item?.paymentType,
            type: item?.type,
            description: item?.description,
            item: JSON.stringify(item).substring(0, 200),
          });
        }
        
        // Priority: billType first (to show correct payment type), then description, then other fields
        // IMPORTANT: Always check billType first to ensure correct payment type is displayed
        // Also check alternative field names that backend might use
        const billType = item?.billType || item?.paymentType || item?.type;
        
        // Fallback: If billType is not available, try to infer from appointment bill
        let inferredBillType = billType;
        if (!billType && appointment?.bill) {
          const bill = appointment.bill;
          // If amount exactly matches medicationAmount, it's likely a medication payment
          if (amount > 0 && bill.medicationAmount === amount) {
            inferredBillType = 'medication';
          }
          // If amount exactly matches consultationAmount, it's likely a consultation payment
          else if (amount > 0 && bill.consultationAmount === amount) {
            inferredBillType = 'consultation';
          }
          // If amount exactly matches hospitalizationAmount, it's likely a hospitalization payment
          else if (amount > 0 && bill.hospitalizationAmount === amount) {
            inferredBillType = 'hospitalization';
          }
        }
        
        const description =
          (inferredBillType === 'medication'
            ? 'Thanh toán tiền thuốc'
            : inferredBillType === 'hospitalization'
            ? 'Thanh toán phí nội trú'
            : inferredBillType === 'consultation'
            ? 'Thanh toán phí khám'
            : item?.description ||
              serviceName ||
              doctorName ||
              specialtyName ||
              'Thanh toán lịch hẹn');

        // Generate unique ID: use _id if available, otherwise use index + timestamp for uniqueness
        const uniqueId = item?._id || item?.id || `payment-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

        return {
          id: String(uniqueId),
          date: String(item?.paymentDate || item?.createdAt || appointment?.appointmentDate || ''),
          description,
          amount,
          method: item?.paymentMethod,
          status: item?.paymentStatus,
          billType: inferredBillType, // Use inferred billType (from billType or inferred from amount)
          transactionId: item?.transactionId,
          paymentNumber: item?.paymentNumber,
          appointmentId: appointment?._id || item?.appointmentId,
          appointment,
        } as PaymentEntry;
      });

      entries.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setPayments(entries);
    } catch (e) {
      setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadPayments();
      } else {
        setLoading(false);
        setPayments([]);
      }
    }, [user])
  );

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      loadPayments();
    }
  };

  const getStatusColor = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'paid':
      case 'completed':
      case 'successful':
        return '#10b981';
      case 'pending':
      case 'processing':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      case 'refunded':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const formatBillType = (billType?: string) => {
    switch ((billType || '').toLowerCase()) {
      case 'consultation':
        return 'Phí khám';
      case 'medication':
        return 'Tiền thuốc';
      case 'hospitalization':
        return 'Phí nội trú';
      default:
        return undefined;
    }
  };

  const formatStatusLabel = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'paid':
      case 'completed':
      case 'successful':
        return 'Đã thanh toán';
      case 'pending':
      case 'processing':
        return 'Chờ xử lý';
      case 'failed':
        return 'Thanh toán thất bại';
      case 'refunded':
        return 'Đã hoàn tiền';
      default:
        return 'Không xác định';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (navigation as any)?.goBack?.()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử thanh toán</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IconColors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {(!payments || payments.length === 0) && !loading ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="card-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Chưa có giao dịch</Text>
            <Text style={styles.emptyDesc}>Bạn chưa có thanh toán nào được ghi nhận</Text>
          </View>
        ) : (
          payments.map((p) => {
            const color = getStatusColor(p.status);
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.paymentItem}
                activeOpacity={0.8}
                onPress={() => {
                  if (p.appointmentId) {
                    (navigation as any)?.navigate?.('AppointmentDetail', {
                      appointmentId: p.appointmentId,
                      appointment: p.appointment,
                    });
                  }
                }}
              >
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentTitle} numberOfLines={1}>{p.description}</Text>
                  <Text style={[styles.paymentAmount, { color: IconColors.primary }]}>{formatVnd(p.amount)}</Text>
                </View>
                <View style={styles.paymentMeta}>
                  <View style={styles.metaLeft}>
                    <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                    <Text style={styles.metaText}>
                      {(() => {
                        if (!p.date) return '—';
                        try {
                          const date = new Date(p.date);
                          if (isNaN(date.getTime())) return '—';
                          return date.toLocaleString('vi-VN');
                        } catch (e) {
                          return '—';
                        }
                      })()}
                    </Text>
                  </View>
                  {p.method ? (
                    <View style={styles.metaLeft}>
                      <Ionicons name="wallet-outline" size={14} color="#6b7280" />
                      <Text style={styles.metaText}>{formatPaymentMethod(p.method)}</Text>
                    </View>
                  ) : null}
                {formatBillType(p.billType) ? (
                  <View style={styles.metaLeft}>
                    <Ionicons name="document-text-outline" size={14} color="#6b7280" />
                    <Text style={styles.metaText}>{formatBillType(p.billType)}</Text>
                  </View>
                ) : null}
                {p.transactionId ? (
                  <View style={styles.metaLeft}>
                    <Ionicons name="receipt-outline" size={14} color="#6b7280" />
                    <Text style={styles.metaText}>Mã GD: {p.transactionId}</Text>
                  </View>
                ) : null}
                {p.paymentNumber ? (
                  <View style={styles.metaLeft}>
                    <Ionicons name="pricetag-outline" size={14} color="#6b7280" />
                    <Text style={styles.metaText}>Số phiếu: {p.paymentNumber}</Text>
                  </View>
                ) : null}
                  {p.status ? (
                    <View style={[styles.statusBadge, { backgroundColor: `${color}15` }]}> 
                      <View style={[styles.statusDot, { backgroundColor: color }]} />
                      <Text style={[styles.statusText, { color }]}>
                        {formatStatusLabel(p.status)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  header: {
    backgroundColor: '#90CAF9',
    paddingTop: 50,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  backButton: { position: 'absolute', top: 50, left: 20, zIndex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  emptyWrap: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyDesc: { marginTop: 4, fontSize: 14, color: '#6b7280' },
  paymentItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  paymentTitle: { flex: 1, marginRight: 12, fontSize: 15, fontWeight: '700', color: '#111827' },
  paymentAmount: { fontSize: 16, fontWeight: '800' },
  paymentMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginTop: 2 },
  metaText: { marginLeft: 6, fontSize: 12, color: '#6b7280' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
});


