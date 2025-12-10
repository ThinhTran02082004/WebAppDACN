import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type PrescriptionStatusKey =
  | 'all'
  | 'pending'
  | 'approved'
  | 'verified'
  | 'dispensed'
  | 'completed'
  | 'cancelled';

interface PrescriptionItem {
  _id: string;
  diagnosis?: string;
  prescriptionOrder?: number;
  isHospitalization?: boolean;
  status?: string;
  totalAmount?: number;
  createdAt?: string;
  medicationsCount?: number;
}

interface PrescriptionRecord {
  appointmentId?: string;
  appointmentDate?: string;
  bookingCode?: string;
  specialty?: string;
  doctor?: string;
  prescriptions: PrescriptionItem[];
}

const STATUS_FILTERS: Array<{ key: PrescriptionStatusKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'approved', label: 'Đã kê đơn' },
  { key: 'dispensed', label: 'Đã cấp thuốc' },
];

const PAGE_SIZE = 10;

const MedsScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [records, setRecords] = useState<PrescriptionRecord[]>([]);
  const [error, setError] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<PrescriptionStatusKey>('all');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Không xác định';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Không xác định';
    try {
      return new Date(dateStr).toLocaleString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  const formatStatus = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending':
        return 'Chờ xử lý';
      case 'approved':
        return 'Đã kê đơn';
      case 'verified':
        return 'Đã phê duyệt';
      case 'dispensed':
        return 'Đã cấp thuốc';
      case 'completed':
        return 'Hoàn thành';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status || 'Không xác định';
    }
  };

  const getStatusBadgeStyle = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending':
        return { backgroundColor: '#fef3c7', color: '#b45309' };
      case 'approved':
        return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
      case 'verified':
        return { backgroundColor: '#ede9fe', color: '#6d28d9' };
      case 'dispensed':
      case 'completed':
        return { backgroundColor: '#dcfce7', color: '#15803d' };
      case 'cancelled':
        return { backgroundColor: '#fee2e2', color: '#b91c1c' };
      default:
        return { backgroundColor: '#e5e7eb', color: '#374151' };
    }
  };

  const formatCurrency = (value?: number) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    try {
      return value.toLocaleString('vi-VN') + ' ₫';
    } catch {
      return `${value} ₫`;
    }
  };

  const fetchHistory = useCallback(
    async (
      requestedPage: number,
      append = false,
      filterKey: PrescriptionStatusKey = statusFilter
    ) => {
      if (!user) {
        setRecords([]);
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await apiService.getUserPrescriptionHistory({
          page: requestedPage,
          limit: PAGE_SIZE,
          status: filterKey !== 'all' ? filterKey : undefined,
        });

        const payload = (response?.data as any) || {};
        const newRecords: PrescriptionRecord[] = Array.isArray(payload.records) ? payload.records : [];
        const currentPage = payload.pagination?.page || requestedPage;
        const maxPages = payload.pagination?.totalPages || 1;

        setTotalPages(maxPages);
        setPage(currentPage);
        setRecords((prev) => (append ? [...prev, ...newRecords] : newRecords));
        setError('');
      } catch (err: any) {
        console.error('Failed to load prescription history:', err);
        const message = err?.message || 'Không thể tải lịch sử đơn thuốc.';
        setError(message);
        if (!append) {
          setRecords([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [statusFilter, user]
  );

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        setRefreshing(false);
        fetchHistory(1, false);
      }
    }, [authLoading, fetchHistory])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory(1, false);
  };

  const handleLoadMore = () => {
    if (loadingMore || loading) return;
    if (page >= totalPages) return;
    fetchHistory(page + 1, true);
  };

  const handleChangeFilter = (nextFilter: PrescriptionStatusKey) => {
    if (statusFilter === nextFilter) return;
    setStatusFilter(nextFilter);
    setPage(1);
    setRefreshing(false);
    setRecords([]);
    setTotalPages(1);
    setLoading(true);
    setError('');
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.centerContent, { paddingTop: insets.top + 20 }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Đang tải lịch sử đơn thuốc...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.centerContent, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="lock-closed-outline" size={48} color="#9ca3af" style={{ marginBottom: 12 }} />
        <Text style={styles.emptyTitle}>Vui lòng đăng nhập</Text>
        <Text style={styles.emptyDesc}>Bạn cần đăng nhập để xem lịch sử đơn thuốc của mình.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đơn thuốc của bạn</Text>
        <Text style={styles.headerSubtitle}>Xem lại tất cả đơn thuốc đã được kê</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => handleChangeFilter(filter.key)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={40} color="#ef4444" style={{ marginBottom: 12 }} />
            <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!error && records.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="file-tray-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Chưa có đơn thuốc</Text>
            <Text style={styles.emptyDesc}>Các đơn thuốc của bạn sẽ xuất hiện tại đây sau khi được bác sĩ kê.</Text>
          </View>
        ) : null}

        {records.map((record) => (
          <View key={record.appointmentId || Math.random().toString()} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{record.specialty || 'Đơn thuốc'}</Text>
                <Text style={styles.cardSubtitle}>{record.doctor || 'Bác sĩ'}</Text>
              </View>
              <View style={styles.cardBadge}>
                <Ionicons name="calendar-outline" size={14} color="#2563eb" />
                <Text style={styles.cardBadgeText}>{formatDate(record.appointmentDate)}</Text>
              </View>
            </View>
            {record.bookingCode ? (
              <View style={styles.cardMetaRow}>
                <Ionicons name="receipt-outline" size={14} color="#6b7280" />
                <Text style={styles.cardMetaText}>Mã đặt lịch: {record.bookingCode}</Text>
              </View>
            ) : null}

            {record.prescriptions.map((item) => {
              const badgeStyle = getStatusBadgeStyle(item.status);
              return (
                <View key={item._id} style={styles.prescriptionItem}>
                  <View style={styles.prescriptionItemHeader}>
                    <Text style={styles.prescriptionTitle}>
                      Đơn thuốc {item.prescriptionOrder ? `đợt ${item.prescriptionOrder}` : ''}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: badgeStyle.backgroundColor }]}> 
                      <Text style={[styles.statusBadgeText, { color: badgeStyle.color }]}>
                        {formatStatus(item.status)}
                      </Text>
                    </View>
                  </View>
                  {item.diagnosis ? (
                    <Text style={styles.prescriptionDiagnosis}>Chẩn đoán: {item.diagnosis}</Text>
                  ) : null}
                  <View style={styles.prescriptionMetaRow}>
                    <Ionicons name="time-outline" size={14} color="#6b7280" />
                    <Text style={styles.prescriptionMetaText}>Ngày kê: {formatDateTime(item.createdAt)}</Text>
                  </View>
                  <View style={styles.prescriptionMetaRow}>
                    <Ionicons name="medkit-outline" size={14} color="#6b7280" />
                    <Text style={styles.prescriptionMetaText}>Số thuốc: {item.medicationsCount ?? 0}</Text>
                  </View>
                  {typeof item.totalAmount === 'number' ? (
                    <View style={styles.prescriptionMetaRow}>
                      <Ionicons name="wallet-outline" size={14} color="#6b7280" />
                      <Text style={styles.prescriptionMetaText}>Chi phí: {formatCurrency(item.totalAmount)}</Text>
                    </View>
                  ) : null}
                  {item.isHospitalization ? (
                    <View style={styles.hospitalizationTag}>
                      <Ionicons name="bed-outline" size={14} color="#6d28d9" />
                      <Text style={styles.hospitalizationTagText}>Đơn thuốc nội trú</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}

        {records.length > 0 && page < totalPages ? (
          <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <ActivityIndicator color="#2563eb" />
            ) : (
              <Text style={styles.loadMoreText}>Tải thêm</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default MedsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  centerContent: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  filterRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#4b5563',
  },
  prescriptionItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#f9fafb',
  },
  prescriptionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  prescriptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  prescriptionDiagnosis: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
  },
  prescriptionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  prescriptionMetaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  hospitalizationTag: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  hospitalizationTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6d28d9',
  },
  loadMoreButton: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#e0ecff',
    borderRadius: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 13,
    color: '#7f1d1d',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ef4444',
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

