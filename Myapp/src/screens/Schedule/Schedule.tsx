import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  StatusBar,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { AppIcons, IconColors } from '../../config/icons';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Appointment {
  _id: string;
  bookingCode?: string;
  appointmentDate: string;
  timeSlot?: {
    startTime: string;
    endTime: string;
  };
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled' | 'no-show' | 'rejected';
  appointmentType?: string;
  symptoms?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  totalAmount?: number;
  paymentMethod?: string;
  queueNumber?: number;
  doctorId?: {
    _id: string;
    user?: {
      fullName: string;
      avatarUrl?: string;
    };
    specialtyId?: {
      name: string;
    };
    consultationFee?: number;
  };
  hospitalId?: {
    _id: string;
    name: string;
    address?: string;
  };
  roomId?: {
    _id?: string;
    name?: string;
    number?: string;
    floor?: string | number;
  } | string;
  specialtyId?: {
    _id: string;
    name: string;
  };
  serviceId?: {
    _id: string;
    name: string;
    price?: number;
  };
  bill?: {
    _id?: string;
    billNumber?: string;
    consultationStatus?: 'pending' | 'paid' | 'cancelled' | 'refunded' | 'failed';
    medicationStatus?: 'pending' | 'paid' | 'cancelled';
    hospitalizationStatus?: 'pending' | 'paid' | 'cancelled';
    overallStatus?: 'unpaid' | 'partial' | 'paid';
    consultationAmount?: number;
    medicationAmount?: number;
    hospitalizationAmount?: number;
    totalAmount?: number;
    paidAmount?: number;
    remainingAmount?: number;
    medicationBill?: {
      amount?: number;
      status?: 'pending' | 'paid' | 'cancelled';
      prescriptionIds?: string[];
      prescriptionPayments?: Array<{
        prescriptionId?: string;
        amount?: number;
        status?: 'pending' | 'paid' | 'cancelled';
      }>;
    };
  };
}

export default function AppointmentScheduleScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const isHistory = route?.params?.completedOnly === true;
  const [refreshing, setRefreshing] = useState(false);
  const [mainFilter, setMainFilter] = useState<'all' | 'completed' | 'cancelled'>(route?.params?.completedOnly ? 'completed' : 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rescheduled'>('all');
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const loadAppointments = async () => {
    try {
      // Build query params based on filters
      const params: { page?: number; limit?: number; status?: string } = {
        limit: 100, // Increase limit to get more appointments
      };
      
      // Apply status filter if not 'all'
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      // Apply main filter (completed/cancelled) as status if applicable
      if (mainFilter === 'completed') {
        params.status = 'completed';
      } else if (mainFilter === 'cancelled') {
        params.status = 'cancelled';
      }
      
      const response = await apiService.getUserAppointments(params);
      if (response && !response.success) {
        // Check if it's an authentication error
        const errorMessage = (response as any)?.message || '';
        if (errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
          // Token may be expired, but don't show error if user exists (let AuthContext handle it)
          if (!user) {
            }
          setAppointments([]);
          return;
        }
      }
      const data = (response as any)?.data?.appointments || (response as any)?.data || [];
      setAppointments(Array.isArray(data) ? data : []);
      } catch (error: any) {
      // Check if it's a 401 or authentication error
      const errorMessage = error?.message || error?.response?.data?.message || '';
      if (error?.response?.status === 401 || errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
        // Authentication error - token expired or invalid
        // AuthContext will handle logout when it detects user is null
        }
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadAppointments();
      } else {
        setLoading(false);
        setAppointments([]);
      }
    }, [user, statusFilter, mainFilter])
  );

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      loadAppointments();
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const opts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('vi-VN', opts);
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatHourRange = (start?: string, end?: string) => {
    if (!start || !end) return '';
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const formatVnd = (amount?: number) => {
    if (typeof amount !== 'number') return '0 đ';
    try {
      return amount.toLocaleString('vi-VN') + ' ₫';
    } catch {
      return `${amount} ₫`;
    }
  };

  // Helper function to calculate remaining medication amount
  const getRemainingMedicationAmount = (appointment: Appointment): number => {
    if (!appointment.bill || !appointment.bill.medicationAmount) {
      return 0;
    }

    const totalMedicationAmount = appointment.bill.medicationAmount || 0;
    
    // Calculate paid amount from prescriptionPayments
    const prescriptionPayments = appointment.bill.medicationBill?.prescriptionPayments || [];
    const paidAmount = prescriptionPayments
      .filter((payment: any) => payment.status === 'paid')
      .reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);

    // If medication status is 'paid' and we've calculated all payments, no remaining amount
    if (appointment.bill.medicationStatus === 'paid' && paidAmount >= totalMedicationAmount) {
      return 0;
    }

    // Return remaining amount
    return Math.max(0, totalMedicationAmount - paidAmount);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'pending_payment':
        return '#f97316';
      case 'completed':
        return '#2563eb';
      case 'cancelled':
      case 'rejected':
        return '#ef4444';
      case 'rescheduled':
        return '#8b5cf6';
      case 'no-show':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return 'Đã xác nhận';
      case 'pending':
        return 'Chờ xác nhận';
      case 'pending_payment':
        return 'Chờ thanh toán';
      case 'completed':
        return 'Đã hoàn thành';
      case 'cancelled':
        return 'Đã hủy';
      case 'rejected':
        return 'Đã từ chối';
      case 'rescheduled':
        return 'Đã đổi lịch';
      case 'no-show':
        return 'Không đến';
      default:
        return 'Chưa xác định';
    }
  };

  const isPastAppointment = (dateStr: string, timeStr?: string) => {
    if (!dateStr) return false;
    try {
      const appointmentDate = new Date(dateStr);
      if (timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        appointmentDate.setHours(h || 0, m || 0, 0, 0);
      }
      return appointmentDate < new Date();
    } catch {
      return false;
    }
  };

  // Appointments are already filtered by server, but we still need to handle rejected status for cancelled filter
  const filteredAppointments = appointments.filter((apt) => {
    // If main filter is "Đã hủy", include both cancelled and rejected
    if (mainFilter === 'cancelled') {
      return apt.status === 'cancelled' || apt.status === 'rejected';
    }
    // For other filters, server already filtered correctly, so return all
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.appointmentDate).getTime();
    const dateB = new Date(b.appointmentDate).getTime();
    return dateB - dateA; // Most recent first
  });

  const openCancelModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCancellationReason('');
    setCancellationError('');
    setCancelModalVisible(true);
  };

  const closeCancelModal = () => {
    setCancelModalVisible(false);
    setSelectedAppointment(null);
    setCancellationReason('');
    setCancellationError('');
  };

  const handleConfirmCancelAppointment = async () => {
    if (!selectedAppointment) {
      return;
    }

    if (!cancellationReason.trim()) {
      setCancellationError('Vui lòng nhập lý do hủy lịch');
      return;
    }

    setCancellationError('');
    setIsCancelling(true);
    try {
      await apiService.cancelAppointment(selectedAppointment._id, cancellationReason.trim());
      Alert.alert('Thành công', 'Đã hủy lịch hẹn thành công.');
      setMainFilter('cancelled');
      closeCancelModal();
      loadAppointments();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Không thể hủy lịch hẹn. Vui lòng thử lại.';
      Alert.alert('Lỗi', message);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleViewDetails = (appointment: Appointment) => {
    if ((navigation as any)?.navigate) {
      (navigation as any).navigate('AppointmentDetail', { appointment });
    }
  };

  const handleReschedule = (appointmentId: string) => {
    const apt = appointments.find(a => a._id === appointmentId);
    if (!apt) return;
    if (apt.status !== 'pending' && apt.status !== 'rescheduled') {
      Alert.alert('Không thể đổi lịch', 'Chỉ có thể đổi lịch khi đang chờ xác nhận.');
      return;
    }
    if ((navigation as any)?.navigate) {
      (navigation as any).navigate('Reschedule', {
        appointmentId: apt._id,
        doctorId: (apt.doctorId as any)?._id || apt.doctorId,
        currentDate: apt.appointmentDate,
      });
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  // Hiển thị màn hình yêu cầu đăng nhập nếu chưa đăng nhập
  if (!user) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
        <View style={styles.header}>
          {navigation?.canGoBack() && (
            <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{isHistory ? 'Lịch sử khám' : 'Lịch hẹn của tôi'}</Text>
        </View>

        {/* Empty state - Yêu cầu đăng nhập */}
        <View style={styles.emptyContainer}>
          <View style={styles.loginIconContainer}>
            <Ionicons name="lock-closed-outline" size={64} color={IconColors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Vui lòng đăng nhập</Text>
          <Text style={styles.emptyDesc}>
            Bạn cần đăng nhập để xem và quản lý lịch hẹn của mình
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => {
              if ((navigation as any)?.navigate) {
                (navigation as any).navigate('Login');
              }
            }}
          >
            <Text style={styles.loginButtonText}>Đăng nhập ngay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => {
              if ((navigation as any)?.navigate) {
                (navigation as any).navigate('Register');
              }
            }}
          >
            <Text style={styles.registerButtonText}>Chưa có tài khoản? Đăng ký</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
      <View style={styles.header}>
        {navigation?.canGoBack() && (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{isHistory ? 'Lịch sử khám' : 'Lịch hẹn của tôi'}</Text>
      </View>

      {/* Main Filter Tabs - Top Row */}
      <View style={styles.mainFilterContainer}>
        <TouchableOpacity
          style={[styles.mainFilterTab, mainFilter === 'all' && styles.mainFilterTabActive]}
          onPress={() => setMainFilter('all')}
        >
          <Text style={[styles.mainFilterText, mainFilter === 'all' && styles.mainFilterTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainFilterTab, mainFilter === 'completed' && styles.mainFilterTabActive]}
          onPress={() => setMainFilter('completed')}
        >
          <Text style={[styles.mainFilterText, mainFilter === 'completed' && styles.mainFilterTextActive]}>
            Đã hoàn thành
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainFilterTab, mainFilter === 'cancelled' && styles.mainFilterTabActive]}
          onPress={() => setMainFilter('cancelled')}
        >
          <Text style={[styles.mainFilterText, mainFilter === 'cancelled' && styles.mainFilterTextActive]}>
            Đã hủy
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter Tabs - Bottom Row - Only show when mainFilter is 'all' */}
      {mainFilter === 'all' && (
        <View style={styles.statusFilterContainer}>
          <TouchableOpacity
            style={[styles.statusFilterTab, statusFilter === 'all' && styles.statusFilterTabActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[styles.statusFilterText, statusFilter === 'all' && styles.statusFilterTextActive]}>
              Tất cả
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusFilterTab, statusFilter === 'pending' && styles.statusFilterTabActive]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text style={[styles.statusFilterText, statusFilter === 'pending' && styles.statusFilterTextActive]}>
              Chờ xác nhận
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusFilterTab, statusFilter === 'confirmed' && styles.statusFilterTabActive]}
            onPress={() => setStatusFilter('confirmed')}
          >
            <Text style={[styles.statusFilterText, statusFilter === 'confirmed' && styles.statusFilterTextActive]}>
              Đã xác nhận
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusFilterTab, statusFilter === 'rescheduled' && styles.statusFilterTabActive]}
            onPress={() => setStatusFilter('rescheduled')}
          >
            <Text style={[styles.statusFilterText, statusFilter === 'rescheduled' && styles.statusFilterTextActive]}>
              Đã đổi lịch
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Appointments List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IconColors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>
              Chưa có lịch hẹn
            </Text>
            <Text style={styles.emptyDesc}>
              Không có lịch hẹn nào phù hợp với bộ lọc bạn đã chọn
            </Text>
            {mainFilter === 'all' && statusFilter === 'all' && (
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => {
                  if ((navigation as any)?.navigate) {
                    (navigation as any).navigate('Booking');
                  }
                }}
              >
                <Text style={styles.bookButtonText}>Đặt lịch ngay</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredAppointments.map((appointment) => {
            const isPast = isPastAppointment(appointment.appointmentDate, appointment.timeSlot?.startTime);
            const statusColor = getStatusColor(appointment.status);
            const room = appointment.roomId && typeof appointment.roomId === 'object' ? appointment.roomId : null;
            const roomName = room?.name ? String(room.name).trim() : '';
            const roomNumber = room?.number !== undefined && room?.number !== null ? String(room.number).trim() : '';
            const roomFloor = room?.floor !== undefined && room?.floor !== null ? String(room.floor).trim() : '';
            const roomHasInfo = !!room && (roomName !== '' || roomNumber !== '' || roomFloor !== '');
            const roomParts: string[] = [];
            if (roomFloor) roomParts.push(`Tầng ${roomFloor}`);
            if (roomNumber) roomParts.push(`Phòng ${roomNumber}`);
            let roomDisplay = '';
            if (roomParts.length > 0) {
              roomDisplay = roomParts.join(', ');
              if (roomName && !roomDisplay.toLowerCase().includes(roomName.toLowerCase())) {
                roomDisplay += ` (${roomName})`;
              }
            } else if (roomName) {
              roomDisplay = roomName;
            }
            if (!roomDisplay) {
              roomDisplay = 'Đang cập nhật';
            }
            
            return (
              <TouchableOpacity
                key={appointment._id}
                style={styles.appointmentCard}
                activeOpacity={0.9}
                onPress={() => {
                  // Always navigate to AppointmentDetail
                  handleViewDetails(appointment);
                }}
              >
                {/* Header với mã đặt lịch và status */}
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeft}>
                    <View style={styles.bookingCodeContainer}>
                      <Ionicons name="receipt-outline" size={16} color="#6b7280" />
                      <Text style={styles.bookingCode}>
                        {appointment.bookingCode || `#${appointment._id.substring(0, 8).toUpperCase()}`}
                      </Text>
                    </View>
                    {appointment.queueNumber && (
                      <View style={styles.queueNumberContainer}>
                        <Ionicons name="list-outline" size={14} color="#6b7280" />
                        <Text style={styles.queueNumberText}>
                          Số thứ tự: {appointment.queueNumber}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusText(appointment.status)}
                    </Text>
                  </View>
                </View>

                {/* Thông tin bác sĩ */}
                {appointment.doctorId && (
                  <View style={styles.doctorInfo}>
                    {appointment.doctorId.user?.avatarUrl ? (
                      <Image
                        source={{ uri: appointment.doctorId.user.avatarUrl }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={24} color="#9ca3af" />
                      </View>
                    )}
                    <View style={styles.doctorDetails}>
                      <Text style={styles.doctorName}>
                        {appointment.doctorId.user?.fullName || 'Bác sĩ'}
                      </Text>
                      {appointment.doctorId.specialtyId && (
                        <Text style={styles.specialtyName}>
                          {appointment.doctorId.specialtyId.name}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Thông tin lịch hẹn */}
                <View style={styles.appointmentDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                    <Text style={styles.detailText}>
                      {formatDate(appointment.appointmentDate)}
                    </Text>
                  </View>
                  {appointment.timeSlot && (
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={18} color="#6b7280" />
                      <Text style={styles.detailText}>
                        {formatHourRange(appointment.timeSlot.startTime, appointment.timeSlot.endTime)}
                      </Text>
                    </View>
                  )}
                  {appointment.hospitalId && (
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={18} color="#6b7280" />
                      <Text style={styles.detailText} numberOfLines={2}>
                        {appointment.hospitalId.name}
                      </Text>
                    </View>
                  )}
                  {roomHasInfo && (
                    <View style={styles.detailRow}>
                      <Ionicons name="business-outline" size={18} color="#6b7280" />
                      <Text style={styles.detailText}>{`Phòng khám: ${roomDisplay}`}</Text>
                    </View>
                  )}
                  {appointment.serviceId && (
                    <View style={styles.detailRow}>
                      <Ionicons name="medical-outline" size={18} color="#6b7280" />
                      <Text style={styles.detailText}>{appointment.serviceId.name}</Text>
                    </View>
                  )}
                  {isHistory && (
                    <>
                      <View style={styles.detailRow}>
                        <Ionicons name="git-branch-outline" size={18} color="#6b7280" />
                        <Text style={styles.detailText}>
                          Chuyên khoa: {appointment?.doctorId?.specialtyId?.name || (typeof appointment.specialtyId === 'object' ? appointment.specialtyId?.name : '')}
                        </Text>
                      </View>
                      { (appointment as any)?.medicalRecord?.diagnosis || (appointment as any)?.diagnosis ? (
                        <View style={styles.detailRow}>
                          <Ionicons name="document-text-outline" size={18} color="#6b7280" />
                          <Text style={styles.detailText}>
                            Chẩn đoán: {(appointment as any)?.medicalRecord?.diagnosis || (appointment as any)?.diagnosis}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>

                {/* Tổng tiền và trạng thái thanh toán - ẩn trong lịch sử khám */}
                {!isHistory && (appointment.bill?.totalAmount || appointment.totalAmount || appointment.doctorId?.consultationFee || appointment.serviceId?.price) && (
                  <View style={styles.paymentSection}>
                    <Text style={styles.paymentLabel}>Tổng tiền</Text>
                    <Text style={styles.paymentAmount}>
                      {formatVnd(appointment.bill?.totalAmount || appointment.totalAmount || 
                        ((appointment.doctorId?.consultationFee || 0) + (appointment.serviceId?.price || 0)))}
                    </Text>
                    
                    {/* Hiển thị trạng thái thanh toán từ bill nếu có */}
                    {appointment.bill ? (
                      <>
                        {appointment.status === 'pending' ? (
                          <View style={styles.paymentStatusBadge}>
                            <Ionicons name="time-outline" size={14} color="#f59e0b" />
                            <Text style={styles.paymentStatusText}>Chưa thanh toán</Text>
                          </View>
                        ) : (
                          <>
                            {/* Show "paid" status only if appointment is confirmed/completed, not pending */}
                            {appointment.bill.overallStatus === 'paid' && (
                              <View style={[styles.paymentStatusBadge, { backgroundColor: '#d1fae515' }]}>
                                <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                                <Text style={[styles.paymentStatusText, { color: '#10b981' }]}>Đã thanh toán</Text>
                              </View>
                            )}
                            {appointment.bill.overallStatus === 'partial' && (
                              <View style={[styles.paymentStatusBadge, { backgroundColor: '#fef3c715' }]}>
                                <Ionicons name="time-outline" size={14} color="#f59e0b" />
                                <Text style={[styles.paymentStatusText, { color: '#f59e0b' }]}>
                                  Đã thanh toán một phần ({Math.round((appointment.bill.paidAmount || 0) / (appointment.bill.totalAmount || 1) * 100)}%)
                                </Text>
                              </View>
                            )}
                            {appointment.bill.overallStatus === 'unpaid' && (
                              <View style={styles.paymentStatusBadge}>
                                <Ionicons name="time-outline" size={14} color="#f59e0b" />
                                <Text style={styles.paymentStatusText}>Chưa thanh toán</Text>
                              </View>
                            )}
                          </>
                        )}
                        
                        {/* Hiển thị breakdown phí khám và phí thuốc */}
                        {(appointment.bill.consultationAmount || appointment.bill.medicationAmount) && (
                          <View style={styles.paymentBreakdown}>
                            {(appointment.bill.consultationAmount || 0) > 0 && (
                              <View style={styles.paymentBreakdownRow}>
                                <View style={styles.paymentBreakdownLabel}>
                                  <Ionicons 
                                    name={appointment.bill.consultationStatus === 'paid' && appointment.status !== 'pending' ? 'checkmark-circle' : 'time-outline'} 
                                    size={14} 
                                    color={appointment.bill.consultationStatus === 'paid' && appointment.status !== 'pending' ? '#10b981' : '#f59e0b'} 
                                  />
                                  <Text style={styles.paymentBreakdownText}>Phí khám:</Text>
                                </View>
                                <Text style={styles.paymentBreakdownAmount}>
                                  {formatVnd(appointment.bill.consultationAmount || 0)}
                                </Text>
                              </View>
                            )}
                            {(appointment.bill.medicationAmount || 0) > 0 && (() => {
                              const totalMedicationAmount = appointment.bill.medicationAmount || 0;
                              const remainingMedicationAmount = getRemainingMedicationAmount(appointment);
                              const isFullyPaid = appointment.bill.medicationStatus === 'paid' && appointment.status !== 'pending';

                              // Nếu đã thanh toán hết tiền thuốc -> hiển thị dòng với dấu check
                              if (isFullyPaid) {
                                return (
                                  <View style={styles.paymentBreakdownRow}>
                                    <View style={styles.paymentBreakdownLabel}>
                                      <Ionicons
                                        name="checkmark-circle"
                                        size={14}
                                        color="#10b981"
                                      />
                                      <Text style={styles.paymentBreakdownText}>Tiền thuốc:</Text>
                                    </View>
                                    <Text style={styles.paymentBreakdownAmount}>
                                      {formatVnd(totalMedicationAmount)}
                                    </Text>
                                  </View>
                                );
                              }

                              // Nếu đã thanh toán một phần -> hiển thị số tiền còn lại
                              if (remainingMedicationAmount < totalMedicationAmount && remainingMedicationAmount > 0) {
                                return (
                                  <View style={styles.paymentBreakdownRow}>
                                    <View style={styles.paymentBreakdownLabel}>
                                      <Ionicons 
                                        name="time-outline" 
                                        size={14} 
                                        color="#f59e0b" 
                                      />
                                      <Text style={styles.paymentBreakdownText}>Tiền thuốc còn lại:</Text>
                                    </View>
                                    <Text style={styles.paymentBreakdownAmount}>
                                      {formatVnd(remainingMedicationAmount)}
                                    </Text>
                                  </View>
                                );
                              }
                              
                              // Nếu chưa thanh toán -> hiển thị tổng tiền thuốc
                              return (
                                <View style={styles.paymentBreakdownRow}>
                                  <View style={styles.paymentBreakdownLabel}>
                                    <Ionicons 
                                      name="time-outline" 
                                      size={14} 
                                      color="#f59e0b" 
                                    />
                                    <Text style={styles.paymentBreakdownText}>Tiền thuốc:</Text>
                                  </View>
                                  <Text style={styles.paymentBreakdownAmount}>
                                    {formatVnd(totalMedicationAmount)}
                                  </Text>
                                </View>
                              );
                            })()}
                          </View>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Fallback to old paymentStatus if bill is not available */}
                        {/* Show "paid" status only if appointment is confirmed/completed, not pending */}
                        {(appointment.paymentStatus === 'pending' || appointment.status === 'pending') ? (
                          <View style={styles.paymentStatusBadge}>
                            <Ionicons name="time-outline" size={14} color="#f59e0b" />
                            <Text style={styles.paymentStatusText}>Chờ thanh toán</Text>
                          </View>
                        ) : (appointment.paymentStatus === 'paid' && (appointment.status === 'confirmed' || appointment.status === 'completed')) ? (
                          <View style={[styles.paymentStatusBadge, { backgroundColor: '#d1fae515' }]}>
                            <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
                            <Text style={[styles.paymentStatusText, { color: '#10b981' }]}>Đã thanh toán</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                )}

                {/* Action Buttons */}
                {!isPast && appointment.status !== 'cancelled' && appointment.status !== 'completed' && appointment.status !== 'rejected' && appointment.status !== 'confirmed' && (
                  <View style={styles.actionButtonsContainer}>
                    {((appointment as any)?.rescheduleCount || 0) >= 2 ? (
                      <View style={[styles.rescheduleButton, { backgroundColor: '#e5e7eb', borderColor: '#e5e7eb' }]}> 
                        <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
                        <Text style={[styles.rescheduleButtonText, { color: '#9ca3af' }]}>Đã hết lượt</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.rescheduleButton}
                        onPress={() => handleReschedule(appointment._id)}
                      >
                        <Ionicons name="calendar-outline" size={16} color={IconColors.primary} />
                        <Text style={styles.rescheduleButtonText}>Đổi lịch</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.cancelScheduleButton}
                      onPress={() => openCancelModal(appointment)}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                      <Text style={styles.cancelScheduleButtonText}>Hủy lịch</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      {cancelModalVisible && selectedAppointment && (
        <Modal
          visible={cancelModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeCancelModal}
        >
          <View style={styles.cancelModalOverlay}>
            <View style={styles.cancelModalContainer}>
              <View style={styles.cancelModalHeader}>
                <Ionicons name="close-circle-outline" size={22} color="#fff" />
                <Text style={styles.cancelModalHeaderText}>Xác nhận hủy lịch hẹn</Text>
              </View>
              <View style={styles.cancelModalBody}>
                <View style={styles.cancelModalInfoBox}>
                  {selectedAppointment.bookingCode ? (
                    <View style={styles.cancelModalInfoRow}>
                      <Ionicons name="pricetag-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                      <Text style={styles.cancelModalInfoValue}>
                        Mã đặt lịch: <Text style={{ fontWeight: '700' }}>{selectedAppointment.bookingCode}</Text>
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.cancelModalInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={IconColors.primary} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={styles.cancelModalInfoLabel}>Ngày hẹn</Text>
                      <Text style={styles.cancelModalInfoValue}>{formatDate(selectedAppointment.appointmentDate)}</Text>
                    </View>
                  </View>
                  {selectedAppointment.timeSlot ? (
                    <View style={styles.cancelModalInfoRow}>
                      <Ionicons name="time-outline" size={18} color={IconColors.primary} style={{ marginRight: 8 }} />
                      <View>
                        <Text style={styles.cancelModalInfoLabel}>Giờ hẹn</Text>
                        <Text style={styles.cancelModalInfoValue}>
                          {formatHourRange(selectedAppointment.timeSlot.startTime, selectedAppointment.timeSlot.endTime)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cancelModalLabel}>Lý do hủy lịch</Text>
                <TextInput
                  style={styles.cancelModalTextarea}
                  placeholder="Vui lòng cho chúng tôi biết lý do bạn muốn hủy lịch..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                  value={cancellationReason}
                  onChangeText={(text) => {
                    setCancellationReason(text);
                    if (cancellationError) {
                      setCancellationError('');
                    }
                  }}
                />
                {cancellationError ? (
                  <Text style={styles.cancelModalErrorText}>{cancellationError}</Text>
                ) : null}
                <View style={styles.cancelModalNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
                  <Text style={styles.cancelModalNoteText}>
                    Thao tác này không thể hoàn tác. Bạn có thể đặt lại lịch bất cứ lúc nào trong tương lai.
                  </Text>
                </View>
              </View>
              <View style={styles.cancelModalFooter}>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalSecondaryButton]}
                  onPress={closeCancelModal}
                  disabled={isCancelling}
                >
                  <Text style={[styles.cancelModalButtonText, { color: '#374151' }]}>Quay lại</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.cancelModalButton,
                    styles.cancelModalPrimaryButton,
                    (isCancelling || !cancellationReason.trim()) && styles.cancelModalPrimaryButtonDisabled,
                  ]}
                  onPress={handleConfirmCancelAppointment}
                  disabled={isCancelling || !cancellationReason.trim()}
                >
                  {isCancelling ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.cancelModalButtonText}>Xác nhận hủy</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: { width: 32 },
  // Main Filter Container (Top Row) - White rounded container
  mainFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  mainFilterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mainFilterTabActive: {
    backgroundColor: IconColors.primary,
    borderColor: IconColors.primary,
  },
  mainFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  mainFilterTextActive: {
    color: '#fff',
  },
  // Status Filter Container (Bottom Row) - Individual buttons
  statusFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statusFilterTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    marginBottom: 8,
  },
  statusFilterTabActive: {
    backgroundColor: '#eff6ff',
    borderColor: IconColors.primary,
  },
  statusFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusFilterTextActive: {
    color: IconColors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  bookButton: {
    backgroundColor: IconColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  loginIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: IconColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  registerButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  registerButtonText: {
    color: IconColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flex: 1,
  },
  bookingCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bookingCode: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  queueNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  queueNumberText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  specialtyName: {
    fontSize: 13,
    color: '#6b7280',
  },
  appointmentDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  pendingNoteText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#f59e0b',
    fontStyle: 'italic',
  },
  // Payment Section
  paymentSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: IconColors.primary,
    marginBottom: 8,
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c715',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  paymentStatusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  paymentBreakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  paymentBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentBreakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentBreakdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  paymentBreakdownAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  // Action Buttons
  actionButtonsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
  },
  rescheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IconColors.primary,
    marginRight: 8,
  },
  rescheduleButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: IconColors.primary,
  },
  cancelScheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelScheduleButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cancelModalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
  },
  cancelModalHeader: {
    backgroundColor: '#f87171',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelModalHeaderText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  cancelModalBody: {
    padding: 16,
  },
  cancelModalInfoBox: {
    backgroundColor: '#fff1f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  cancelModalInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cancelModalInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  cancelModalInfoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  cancelModalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cancelModalTextarea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  cancelModalErrorText: {
    color: '#dc2626',
    fontSize: 12,
    marginBottom: 8,
  },
  cancelModalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginTop: 8,
  },
  cancelModalNoteText: {
    flex: 1,
    color: '#1e3a8a',
    fontSize: 12,
    lineHeight: 18,
  },
  cancelModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelModalButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalSecondaryButton: {
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  cancelModalPrimaryButton: {
    backgroundColor: '#dc2626',
  },
  cancelModalPrimaryButtonDisabled: {
    backgroundColor: '#fca5a5',
  },
  cancelModalButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});


