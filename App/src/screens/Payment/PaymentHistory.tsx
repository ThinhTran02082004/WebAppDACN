import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, FlatList, ScrollView, RefreshControl, Modal, Platform, TextInput, ActivityIndicator } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';
import { IconColors } from '../../config/icons';
import { useAuth } from '../../contexts/AuthContext';

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDateInput, setTempDateInput] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;

  const formatVnd = (amount?: number) => {
    if (typeof amount !== 'number') return '0 ₫';
    try {
      return amount.toLocaleString('vi-VN') + ' ₫';
    } catch {
      return `${amount} ₫`;
    }
  };

  const loadPayments = async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const resp = await apiService.getPaymentHistory({ page: pageNum, limit: PAGE_SIZE });
      const payload: any = resp?.data || resp;
      const rawList = (payload?.data ?? payload?.records ?? payload) as any[];
      
      // Check if there are more pages
      const totalItems = payload?.total || payload?.totalCount;
      if (totalItems !== undefined) {
        const currentItems = append ? payments.length + rawList.length : rawList.length;
        setHasMore(currentItems < totalItems);
      } else {
        // If no total provided, assume more pages if we got full page size
        setHasMore(rawList.length === PAGE_SIZE);
      }
      const entries: PaymentEntry[] = (Array.isArray(rawList) ? rawList : []).map((item, index) => {
        const amount = Number(item?.amount || 0);
        const appointment = item?.appointmentId || {};
        const doctorName = appointment?.doctorId?.user?.fullName;
        const serviceName = appointment?.serviceId?.name;
        const specialtyName = appointment?.specialtyId?.name;
        
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
      
      if (append) {
        setPayments(prev => [...prev, ...entries]);
      } else {
        setPayments(entries);
      }
      
      setPage(pageNum);
    } catch (e) {
      if (!append) {
        setPayments([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };
  
  const loadMore = () => {
    if (!loadingMore && hasMore && !loading && !selectedDate) {
      // Only load more if no date filter is applied
      loadPayments(page + 1, true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        setPage(1);
        setHasMore(true);
        loadPayments(1, false);
      } else {
        setLoading(false);
        setPayments([]);
        setPage(1);
        setHasMore(true);
      }
    }, [user])
  );

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      setPage(1);
      setHasMore(true);
      loadPayments(1, false);
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

  // Format date to YYYY-MM-DD for comparison
  const formatDateForComparison = (date: Date | string): string => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  // Check if two dates are on the same day
  const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
    const d1 = formatDateForComparison(date1);
    const d2 = formatDateForComparison(date2);
    return d1 !== '' && d2 !== '' && d1 === d2;
  };

  // Filter payments by selected date
  const filteredPayments = useMemo(() => {
    if (!selectedDate) return payments;
    return payments.filter((payment) => {
      if (!payment.date) return false;
      return isSameDay(payment.date, selectedDate);
    });
  }, [payments, selectedDate]);

  // Handle date selection from input (DD/MM/YYYY or YYYY-MM-DD)
  const handleDateInput = (input: string) => {
    setTempDateInput(input);
    
    // Try to parse different date formats
    let parsedDate: Date | null = null;
    
    // Format: DD/MM/YYYY
    const ddmmyyyy = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Format: YYYY-MM-DD
    const yyyymmdd = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd && !parsedDate) {
      const [, year, month, day] = yyyymmdd;
      parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Validate parsed date
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      // Check if date is reasonable (not too far in future/past)
      const now = new Date();
      const minDate = new Date(2020, 0, 1);
      const maxDate = new Date(now.getFullYear() + 1, 11, 31);
      
      if (parsedDate >= minDate && parsedDate <= maxDate) {
        setSelectedDate(parsedDate);
      }
    }
  };

  // Handle date picker confirm
  const handleDatePickerConfirm = () => {
    if (tempDateInput) {
      handleDateInput(tempDateInput);
    }
    setShowDatePicker(false);
  };

  // Clear date filter
  const clearDateFilter = () => {
    setSelectedDate(null);
    setTempDateInput('');
  };

  // Format selected date for display (DD/MM/YYYY)
  const formatSelectedDateDisplay = (date: Date | null): string => {
    if (!date) return '';
    try {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
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

      {/* Date Search Bar */}
      <View style={styles.searchContainer}>
        <TouchableOpacity
          style={styles.dateSearchButton}
          onPress={() => {
            if (selectedDate) {
              setTempDateInput(formatSelectedDateDisplay(selectedDate));
            }
            setShowDatePicker(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={20} color={IconColors.primary} />
          <Text style={styles.dateSearchText}>
            {selectedDate ? formatSelectedDateDisplay(selectedDate) : 'Tìm theo ngày'}
          </Text>
          {selectedDate && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                clearDateFilter();
              }}
              style={styles.clearDateButton}
            >
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngày</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Nhập ngày (Định dạng: DD/MM/YYYY)</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="VD: 25/12/2024"
                placeholderTextColor="#9ca3af"
                value={tempDateInput || formatSelectedDateDisplay(selectedDate)}
                onChangeText={setTempDateInput}
                keyboardType="numeric"
              />
              <View style={styles.quickDateButtons}>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const today = new Date();
                    const formatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
                    setTempDateInput(formatted);
                    setSelectedDate(today);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>Hôm nay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const formatted = `${String(yesterday.getDate()).padStart(2, '0')}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${yesterday.getFullYear()}`;
                    setTempDateInput(formatted);
                    setSelectedDate(yesterday);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>Hôm qua</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickDateButton}
                  onPress={() => {
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    const formatted = `${String(weekAgo.getDate()).padStart(2, '0')}/${String(weekAgo.getMonth() + 1).padStart(2, '0')}/${weekAgo.getFullYear()}`;
                    setTempDateInput(formatted);
                    setSelectedDate(weekAgo);
                  }}
                >
                  <Text style={styles.quickDateButtonText}>7 ngày trước</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setTempDateInput('');
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleDatePickerConfirm}
              >
                <Text style={styles.modalConfirmButtonText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading && payments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IconColors.primary} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (!filteredPayments || filteredPayments.length === 0) ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="card-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>
            {selectedDate ? 'Không có giao dịch trong ngày này' : 'Chưa có giao dịch'}
          </Text>
          <Text style={styles.emptyDesc}>
            {selectedDate
              ? `Không tìm thấy thanh toán nào vào ngày ${formatSelectedDateDisplay(selectedDate)}`
              : 'Bạn chưa có thanh toán nào được ghi nhận'}
          </Text>
          {selectedDate && (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={clearDateFilter}
            >
              <Text style={styles.clearFilterButtonText}>Xóa bộ lọc</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredPayments}
          keyExtractor={(item) => item.id}
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IconColors.primary} />}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color={IconColors.primary} />
                <Text style={styles.loadMoreText}>Đang tải thêm...</Text>
              </View>
            ) : !hasMore && payments.length > 0 && !selectedDate ? (
              <View style={styles.loadMoreContainer}>
                <Text style={styles.loadMoreText}>Đã hiển thị tất cả</Text>
              </View>
            ) : null
          }
          renderItem={({ item: p }) => {
            const color = getStatusColor(p.status);
            return (
              <TouchableOpacity
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
          }}
        />
      )}
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
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateSearchText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  clearDateButton: {
    marginLeft: 8,
    padding: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyDesc: { marginTop: 4, fontSize: 14, color: '#6b7280', textAlign: 'center', paddingHorizontal: 32 },
  clearFilterButton: {
    marginTop: 16,
    backgroundColor: IconColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  clearFilterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  quickDateButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  quickDateButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: IconColors.primary,
    marginRight: 8,
    marginBottom: 8,
  },
  quickDateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: IconColors.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  modalConfirmButton: {
    backgroundColor: IconColors.primary,
  },
  modalConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
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


