import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { AppIcons, IconColors } from '../../config/icons';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface PrescriptionMedication {
  medicationId?: {
    name?: string;
    unitTypeDisplay?: string;
  };
  medicationName?: string;
  quantity?: number;
  dosage?: string;
  usage?: string;
  duration?: string;
  totalPrice?: number;
  notes?: string;
}

interface Prescription {
  _id: string;
  prescriptionOrder?: number;
  status?: string;
  totalAmount?: number;
  diagnosis?: string;
  isHospitalization?: boolean;
  medications?: PrescriptionMedication[];
  notes?: string;
  createdAt?: string;
}

interface HospitalizationRoomEntry {
  roomNumber?: string;
  roomType?: string;
  checkInTime?: string;
  checkOutTime?: string;
  hours?: number;
  amount?: number;
  hourlyRate?: number;
}

interface HospitalizationInfo {
  status?: string;
  totalAmount?: number;
  currentInfo?: {
    currentCost?: number;
  };
  admissionDate?: string;
  dischargeDate?: string;
  inpatientRoomId?: {
    roomNumber?: string;
    type?: string;
  };
  roomHistory?: HospitalizationRoomEntry[];
}

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
  medicalHistory?: string;
  notes?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  totalAmount?: number;
  consultationFee?: number;
  serviceFee?: number;
  paymentMethod?: string;
  queueNumber?: number;
  clinicRoom?: string;
  doctorId?: {
    _id: string;
    title?: string;
    user?: {
      fullName: string;
      avatarUrl?: string;
      phoneNumber?: string;
      email?: string;
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
    contactInfo?: {
      phone?: string;
      email?: string;
    };
  };
  specialtyId?: {
    _id: string;
    name: string;
  };
  serviceId?: {
    _id: string;
    name: string;
    price?: number;
  };
  roomId?: {
    _id?: string;
    floor?: number | string;
    roomName?: string;
    name?: string;
    number?: string | number;
  } | string;
  roomInfo?: string;
  hospitalization?: HospitalizationInfo;
  prescriptions?: Prescription[];
  isReviewed?: boolean;
  rescheduleCount?: number;
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

interface AppointmentDetailScreenProps {
  route: {
    params: {
      appointment?: Appointment;
      appointmentId?: string;
      fromPayment?: boolean;
    };
  };
  navigation: any;
}

export default function AppointmentDetailScreen({ route, navigation }: AppointmentDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { appointment: initialAppointment, appointmentId, fromPayment } = route.params;
  const [appointment, setAppointment] = useState<Appointment | null>(initialAppointment || null);
  const [appointmentBill, setAppointmentBill] = useState<any | null>(initialAppointment?.bill || null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shouldRetryRefresh, setShouldRetryRefresh] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationError, setCancellationError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isJoiningVideoCall, setIsJoiningVideoCall] = useState(false);
  const [reviewSelectionVisible, setReviewSelectionVisible] = useState(false);
  const [selectedConsultationMethod, setSelectedConsultationMethod] = useState<'momo' | 'paypal'>('momo');
  const [selectedMedicationMethod, setSelectedMedicationMethod] = useState<'momo' | 'paypal'>('momo');
  const hasRefreshedRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshAppointmentRef = useRef<((delay?: number, retryCount?: number, forceRetry?: boolean) => Promise<void>) | null>(null);

  // Helper function to check if consultation fee is paid
  // Consistent with client web app - checks bill status directly
  const isConsultationFeePaid = useCallback((appt: Appointment | null): boolean => {
    if (!appt) return false;
    
    if (!appt.bill) {
      // If no bill exists, check old paymentStatus field
      return appt.paymentStatus === 'paid';
    }
    
    const bill = appt.bill;
    const consultationStatus = bill.consultationStatus || 'pending';
    const consultationAmount = bill.consultationAmount || 0;
    
    return consultationAmount === 0 || consultationStatus === 'paid';
  }, []);


  const isPaymentFullyPaidForActions = useCallback((appt: Appointment | null): boolean => {
    if (!appt) return false;
    
    const appointmentStatus = appt.status || 'pending';
    
    if (appointmentStatus === 'pending') {
      return false;
    }
    
    if (!appt.bill) {
      // If no bill exists, check old paymentStatus field
      return appt.paymentStatus === 'paid';
    }
    
    const bill = appt.bill;
    
    // Use flattened fields from server response (consultationStatus, medicationStatus, hospitalizationStatus)
    const consultationStatus = bill.consultationStatus || 'pending';
    const medicationStatus = bill.medicationStatus || 'pending';
    const hospitalizationStatus = bill.hospitalizationStatus || 'pending';
    
    const consultationPaid = consultationStatus === 'paid';
    const medicationPaid = medicationStatus === 'paid';
    const hospitalizationPaid = hospitalizationStatus === 'paid';
    
    // Get amounts (use flattened fields from server)
    const consultationAmount = bill.consultationAmount || 0;
    const medicationAmount = bill.medicationAmount || 0;
    const hospitalizationAmount = bill.hospitalizationAmount || 0;
    
    // Check if all applicable fees are paid
    const allPaid = (consultationAmount === 0 || consultationPaid) && 
                    (medicationAmount === 0 || medicationPaid) &&
                    (hospitalizationAmount === 0 || hospitalizationPaid);
    
    // Also check overallStatus
    const overallStatus = bill.overallStatus || 'unpaid';
    
    return allPaid && overallStatus === 'paid';
  }, []);


  const isPaymentFullyPaid = useCallback((appt: Appointment | null): boolean => {
    if (!appt) return false;
    
    const appointmentStatus = appt.status || 'pending';
    

    if (appointmentStatus === 'pending') {
      return false;
    }
    
    if (!appt.bill) {

      return appt.paymentStatus === 'paid';
    }
    
    const bill = appt.bill;

    const consultationStatus = bill.consultationStatus || 'pending';
    const medicationStatus = bill.medicationStatus || 'pending';
    const hospitalizationStatus = bill.hospitalizationStatus || 'pending';
    
    const consultationPaid = consultationStatus === 'paid';
    const medicationPaid = medicationStatus === 'paid';
    const hospitalizationPaid = hospitalizationStatus === 'paid';
    
    // Get amounts (use flattened fields from server)
    const consultationAmount = bill.consultationAmount || 0;
    const medicationAmount = bill.medicationAmount || 0;
    const hospitalizationAmount = bill.hospitalizationAmount || 0;
    

    const allPaid = (consultationAmount === 0 || consultationPaid) && 
                    (medicationAmount === 0 || medicationPaid) &&
                    (hospitalizationAmount === 0 || hospitalizationPaid);
    
    // Also check overallStatus, but only if it's explicitly 'paid' (not 'partial' or 'unpaid')
    const overallStatus = bill.overallStatus || 'unpaid';
    
    return allPaid && overallStatus === 'paid';
  }, []);

  // Refresh appointment data from server with retry logic
  const refreshAppointment = useCallback(async (delay = 0, retryCount = 0, forceRetry = false) => {
    const targetId = appointment?._id || appointmentId;
    if (!targetId) return;
    
    try {
      if (delay > 0) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), delay));
      }
      if (retryCount === 0) {
        setRefreshing(true);
      }
      
      const response = await apiService.getAppointmentById(targetId);
      if (response?.success && response?.data) {
        const updatedAppointment = response.data as Appointment;

        setAppointment(prev => {
          const base = prev || null;
          const merged: Appointment = {
            ...(base || ({} as Appointment)),
            ...updatedAppointment,
          };

          return merged;
        });
        
        
        // Update local bill if available from appointment response
        if ((updatedAppointment as any).bill) {
          setAppointmentBill((updatedAppointment as any).bill);
        }

        // Check if payment is fully paid using the same logic as client
        const isFullyPaid = isPaymentFullyPaid(updatedAppointment);
        
        // Check if bill status is still not fully paid after payment
        // If so, retry after a delay to allow server to process
        if (forceRetry && retryCount < 5 && !isFullyPaid) {
          // Retry after 2 seconds
          setTimeout(() => {
            refreshAppointment(0, retryCount + 1, forceRetry);
          }, 2000);
          return; // Don't set refreshing to false yet
        }
        
        // If payment is now fully paid, clear retry flag
        if (isFullyPaid) {
          setShouldRetryRefresh(false);
        }
        
        // Stop refreshing if payment is complete or we've exhausted retries
        if (retryCount === 0 || isFullyPaid || retryCount >= 5) {
          setRefreshing(false);
          setShouldRetryRefresh(false);
        }
      } else {
        if (retryCount === 0) {
          setRefreshing(false);
        }
      }
    } catch (error: any) {
      // Don't retry on network errors - they're usually temporary connection issues
      const errorMessage = error?.message || '';
      if (errorMessage.includes('Network Error') || errorMessage.includes('Cannot reach backend')) {
        if (retryCount === 0) {
          setRefreshing(false);
        }
        return;
      }
      // Retry on other errors if forceRetry is true
      if (forceRetry && retryCount < 5) {
        setTimeout(() => {
          refreshAppointment(1000, retryCount + 1, forceRetry);
        }, 2000);
        return;
      }
      if (retryCount === 0) {
        setRefreshing(false);
      }
    }
  }, [appointment?._id, appointmentId, isPaymentFullyPaid]);

  // Store refreshAppointment in ref to avoid dependency issues
  useEffect(() => {
    refreshAppointmentRef.current = refreshAppointment;
  }, [refreshAppointment]);

  // Fetch bill separately like web client (UserBilling) so billing section always has data
  useEffect(() => {
    const targetId = appointment?._id || appointmentId;
    if (!targetId) return;

    let cancelled = false;

    const fetchBill = async () => {
      try {
        const res = await apiService.getAppointmentBill(targetId);
        if (res?.success && res.data && !cancelled) {
          setAppointmentBill(res.data);
        }
      } catch (e) {
        // Failed to fetch appointment bill
      }
    };

    fetchBill();

    return () => {
      cancelled = true;
    };
  }, [appointment?._id, appointmentId]);

  // Handle coming from payment - force refresh with retry (only once)
  useEffect(() => {
    if (fromPayment && !hasRefreshedRef.current && refreshAppointmentRef.current) {
      hasRefreshedRef.current = true;
      const refreshFn = refreshAppointmentRef.current;
      // Refresh with longer delay and more retries to ensure server has processed payment
      refreshFn(2000, 0, true); // First refresh after 2 seconds with forceRetry (will retry up to 5 times)
      
      return () => {
        // Cleanup handled by refreshAppointment itself
      };
    }
  }, [fromPayment]);

  // Initial load: fetch appointment if only appointmentId is provided
  useEffect(() => {
    if (!appointment && appointmentId && refreshAppointmentRef.current) {
      const refreshFn = refreshAppointmentRef.current;
      refreshFn(0, 0, false);
    }
  }, [appointment, appointmentId]);

  // Refresh when screen comes into focus (e.g., returning from payment)
  useFocusEffect(
    useCallback(() => {
      // Skip refresh on initial load, only refresh when returning from other screens
      if (isInitialLoad) {
        setIsInitialLoad(false);
        return;
      }
      // If coming from payment, it's already handled by useEffect above
      if (fromPayment) {
        return;
      }
      // Only refresh once per focus, not continuously
      if (hasRefreshedRef.current || !refreshAppointmentRef.current) {
        return;
      }
      hasRefreshedRef.current = true;
      const refreshFn = refreshAppointmentRef.current;
      // Refresh appointment data when screen is focused (e.g., after payment)
      // Add a delay to ensure server has processed the payment
      refreshFn(500, 0, false); // Start with 0.5 second delay, no force retry
      
      // Reset flag after a delay to allow refresh on next focus
      setTimeout(() => {
        hasRefreshedRef.current = false;
      }, 2000);
    }, [isInitialLoad, fromPayment])
  );

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

  const formatVnd = (amount?: number | string | null) => {
    const numericAmount = typeof amount === 'string' ? Number(amount) : amount;
    if (typeof numericAmount !== 'number' || Number.isNaN(numericAmount)) return '0 ₫';
    try {
      return numericAmount.toLocaleString('vi-VN') + ' ₫';
    } catch {
      return `${numericAmount} ₫`;
    }
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
      case 'hospitalized':
        return '#0ea5e9';
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
        return 'Không đến khám';
      case 'hospitalized':
        return 'Đang nằm viện';
      default:
        return 'Không xác định';
    }
  };

  const getPaymentStatusText = (status?: string) => {
    switch (status) {
      case 'pending':
        return 'Chưa thanh toán';
      case 'paid':
        return 'Đã thanh toán';
      case 'failed':
        return 'Thanh toán thất bại';
      case 'refunded':
        return 'Đã hoàn tiền';
      default:
        return 'Chưa thanh toán';
    }
  };

  const getAppointmentTypeText = (type?: string) => {
    if (!type) return '';
    const lowerType = type.toLowerCase();
    switch (lowerType) {
      case 'first-visit':
      case 'first_visit':
      case 'first':
        return 'Khám lần đầu';
      case 'follow-up':
      case 'followup':
      case 'follow_up':
        return 'Tái khám';
      case 'consultation':
        return 'Tư vấn';
      case 'checkup':
      case 'check-up':
        return 'Khám tổng quát';
      case 'emergency':
        return 'Khám cấp cứu';
      // Nếu đã là tiếng Việt thì giữ nguyên
      case 'khám lần đầu':
        return 'Khám lần đầu';
      case 'tái khám':
        return 'Tái khám';
      case 'tư vấn':
        return 'Tư vấn';
      case 'khám tổng quát':
        return 'Khám tổng quát';
      case 'khám cấp cứu':
        return 'Khám cấp cứu';
      default:
        return type; // Trả về giá trị gốc nếu không match
    }
  };

  const getPaymentMethodText = (method?: string) => {
    if (!method) return '';
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Tiền mặt';
      case 'card':
      case 'credit_card':
      case 'creditcard':
        return 'Thẻ tín dụng';
      case 'paypal':
        return 'PayPal';
      case 'momo':
        return 'MoMo';
      case 'bank_transfer':
      case 'banktransfer':
        return 'Chuyển khoản ngân hàng';
      case 'vnpay':
        return 'VNPay';
      default:
        return method; // Trả về giá trị gốc nếu không match
    }
  };

  const getHospitalizationStatusText = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'admitted':
        return 'Đang nằm viện';
      case 'transferred':
        return 'Đã chuyển phòng';
      case 'discharged':
        return 'Đã xuất viện';
      case 'pending':
        return 'Chờ nhập viện';
      case 'cancelled':
        return 'Đã hủy';
      default:
        if (!status) return 'Chưa cập nhật';
        return status;
    }
  };

  const getPrescriptionStatusInfo = (status?: string) => {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'approved':
        return { label: 'Đã kê đơn', backgroundColor: '#dbeafe', color: '#1d4ed8' };
      case 'verified':
        return { label: 'Đã phê duyệt', backgroundColor: '#ccfbf1', color: '#0f766e' };
      case 'dispensed':
        return { label: 'Đã cấp thuốc', backgroundColor: '#dcfce7', color: '#15803d' };
      case 'completed':
        return { label: 'Hoàn thành', backgroundColor: '#e0f2fe', color: '#0369a1' };
      case 'pending':
        return { label: 'Chờ xử lý', backgroundColor: '#fef3c7', color: '#b45309' };
      default:
        return { label: status || 'Không xác định', backgroundColor: '#e5e7eb', color: '#374151' };
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  // Helper function to check if prescription is paid
  const isPrescriptionPaid = useCallback((prescriptionId: string): boolean => {
    if (!appointment?.bill?.medicationBill?.prescriptionPayments) return false;
    const payment = appointment.bill.medicationBill.prescriptionPayments.find(
      (p: any) => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === prescriptionId
    );
    return payment?.status === 'paid';
  }, [appointment?.bill]);

  // Function to pay for a specific prescription
  const startPrescriptionPayment = async (prescriptionId: string, method: 'momo' | 'paypal' = 'momo') => {
    try {
      if (!appointment?._id) return;
      
      // Find prescription from appointment data
      const allPrescriptions = [
        ...(Array.isArray(appointment.prescriptions) ? appointment.prescriptions : []),
        ...(Array.isArray((appointment as any)?.bill?.medicationBill?.prescriptionIds) 
          ? (appointment as any).bill.medicationBill.prescriptionIds 
          : []),
      ];
      const prescription = allPrescriptions.find((p: any) => 
        (p._id?.toString() || p.toString()) === prescriptionId
      );
      
      if (!prescription) {
        Alert.alert('Lỗi', 'Không tìm thấy đơn thuốc.');
        return;
      }
      
      const prescriptionAmount = prescription.totalAmount || 0;
      if (prescriptionAmount <= 0) {
        Alert.alert('Lỗi', 'Số tiền đơn thuốc không hợp lệ.');
        return;
      }

      // Check if already paid
      if (isPrescriptionPaid(prescriptionId)) {
        Alert.alert('Thông báo', 'Đơn thuốc này đã được thanh toán.');
        return;
      }

      if (method === 'momo') {
        const redirectUrl = 'https://mymobileapp.local/payment/result';
        const prescriptionOrder = prescription.prescriptionOrder || 1;
        const paymentParams = {
          appointmentId: appointment._id,
          amount: Number(prescriptionAmount),
          billType: 'medication',
          prescriptionId: prescriptionId,
          orderInfo: `Thanh toán đơn thuốc đợt ${prescriptionOrder} - Lịch hẹn #${appointment.bookingCode || appointment._id.substring(0, 8)}`,
          redirectUrl,
        };
        const created = await apiService.createMomoPayment(paymentParams);
        const payUrl = (created?.data as any)?.payUrl;
        if (payUrl) {
          setAppointment(prev =>
            prev
              ? {
                  ...prev,
                  paymentMethod: 'momo',
                }
              : prev
          );
          navigation.navigate('PaymentWebView', { url: payUrl, mode: 'momo', appointmentId: appointment._id, appointment });
        } else {
          Alert.alert('Lỗi', 'Không thể khởi tạo thanh toán MoMo.');
        }
      } else if (method === 'paypal') {
        await startPaypalPayment({ billType: 'medication', prescriptionId });
        return;
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể khởi tạo thanh toán.');
    }
  };

  const startPaypalPayment = async (options?: { billType?: 'consultation' | 'medication'; prescriptionId?: string }) => {
    try {
      if (!appointment?._id) return;

      const billTypeOverride = options?.billType || 'consultation';

      let amount = 0;
      let targetPrescription: Prescription | null = null;

      if (billTypeOverride === 'medication') {
        targetPrescription =
          getPrescriptionById(options?.prescriptionId || null) ||
          findMedicationPaymentTarget();

        if (!targetPrescription?._id) {
          Alert.alert('Lỗi', 'Không tìm thấy đơn thuốc cần thanh toán.');
          return;
        }

        amount = targetPrescription.totalAmount || 0;
        if (amount <= 0) {
          Alert.alert('Lỗi', 'Số tiền đơn thuốc không hợp lệ.');
          return;
        }
      } else {
        if (bill) {
          amount = consultationBillAmount;
        } else {
          amount = appointment.totalAmount || (consultationFee + serviceFee);
        }

        if (amount <= 0) {
          Alert.alert('Thông báo', 'Không có khoản phí khám cần thanh toán.');
          return;
        }
      }

      const paymentPayload: {
        appointmentId: string;
        amount: number;
        billType?: string;
        prescriptionId?: string;
      } = {
        appointmentId: appointment._id,
        amount: Number(amount),
        billType: billTypeOverride,
      };

      if (billTypeOverride === 'medication' && targetPrescription?._id) {
        paymentPayload.prescriptionId = targetPrescription._id;
      }

      const created = await apiService.createPaypalPayment(paymentPayload);
      const approvalUrl = (created?.data as any)?.approvalUrl;
      if (approvalUrl) {
        setAppointment(prev =>
          prev
            ? {
                ...prev,
                paymentMethod: 'paypal',
              }
            : prev
        );
        navigation.navigate('PaymentWebView', { url: approvalUrl, mode: 'paypal', appointmentId: appointment._id, appointment });
      } else {
        Alert.alert('Lỗi', 'Không thể khởi tạo thanh toán PayPal.');
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể khởi tạo thanh toán PayPal.');
    }
  };

  const startMomoPayment = async (billTypeOverride?: 'consultation' | 'medication') => {
    try {
      if (!appointment?._id) return;
      
      let amount = 0;
      let billType: 'consultation' | 'medication' | 'hospitalization' = 'consultation';
      let orderInfo = `Thanh toán lịch hẹn #${appointment._id.substring(0, 8)}`;
      let targetPrescription: Prescription | null = null;

      // Ưu tiên dùng bill từ API /billing/appointment (appointmentBill), fallback về appointment.bill
      const rawBill: any = appointmentBill || (appointment as any).bill || null;

      if (rawBill) {
        // Hỗ trợ cả dạng flatten (consultationAmount) và dạng nested (consultationBill.amount) giống web
        const consultationAmount: number =
          (rawBill.consultationAmount as number | undefined) ??
          (rawBill.consultationBill?.amount as number | undefined) ??
          0;
        const medicationAmount: number =
          (rawBill.medicationAmount as number | undefined) ??
          (rawBill.medicationBill?.amount as number | undefined) ??
          0;
        const hospitalizationAmount: number =
          (rawBill.hospitalizationAmount as number | undefined) ??
          (rawBill.hospitalizationBill?.amount as number | undefined) ??
          0;
        const remainingAmount: number =
          (rawBill.remainingAmount as number | undefined) ??
          Math.max(
            ((rawBill.totalAmount as number | undefined) ?? consultationAmount + medicationAmount + hospitalizationAmount) -
              ((rawBill.paidAmount as number | undefined) ?? 0),
            0
          );

        if (billTypeOverride === 'consultation') {
          amount = consultationAmount;
          billType = 'consultation';
          orderInfo = `Thanh toán phí khám - Lịch hẹn #${appointment.bookingCode || appointment._id.substring(0, 8)}`;
        } else if (billTypeOverride === 'medication') {
          targetPrescription = findMedicationPaymentTarget();
          if (!targetPrescription?._id) {
            Alert.alert('Lỗi', 'Không tìm thấy đơn thuốc cần thanh toán.');
            return;
          }
          amount = targetPrescription.totalAmount || medicationAmount;
          billType = 'medication';
          orderInfo = `Thanh toán đơn thuốc đợt ${targetPrescription.prescriptionOrder || 1} - Lịch hẹn #${appointment.bookingCode || appointment._id.substring(0, 8)}`;
        } else {
          if (remainingAmount > 0) {
            amount = remainingAmount;
          } else {
            amount = (rawBill.totalAmount as number | undefined) ?? 0;
          }
        }
      } else if (billTypeOverride === 'medication') {
        targetPrescription = findMedicationPaymentTarget();
        if (!targetPrescription?._id) {
          Alert.alert('Lỗi', 'Không tìm thấy đơn thuốc cần thanh toán.');
          return;
        }
        amount = targetPrescription.totalAmount || 0;
        billType = 'medication';
        orderInfo = `Thanh toán đơn thuốc đợt ${targetPrescription.prescriptionOrder || 1} - Lịch hẹn #${appointment.bookingCode || appointment._id.substring(0, 8)}`;
      } else {
        amount = appointment.totalAmount || (appointment.consultationFee || 0) + (appointment.serviceFee || 0);
        billType = 'consultation';
      }
      
      if (amount <= 0) {
        Alert.alert('Thông báo', 'Không có khoản thanh toán nào còn lại.');
        return;
      }
      
      const redirectUrl = 'https://mymobileapp.local/payment/result';
      const paymentParams: {
        appointmentId: string;
        amount: number;
        billType: 'consultation' | 'medication' | 'hospitalization';
        orderInfo: string;
        redirectUrl: string;
        prescriptionId?: string;
      } = {
        appointmentId: appointment._id,
        amount: Number(amount),
        billType: billType,
        orderInfo: orderInfo,
        redirectUrl,
      };

      if (billType === 'medication' && targetPrescription?._id) {
        paymentParams.prescriptionId = targetPrescription._id;
      }
      const created = await apiService.createMomoPayment(paymentParams);
      const payUrl = (created?.data as any)?.payUrl;
      if (payUrl) {
        // Reflect the user's chosen payment method immediately in the UI
        setAppointment(prev =>
          prev
            ? {
                ...prev,
                paymentMethod: 'momo',
              }
            : prev
        );
        navigation.navigate('PaymentWebView', { url: payUrl, mode: 'momo', appointmentId: appointment._id, appointment });
      } else {
        Alert.alert('Lỗi', 'Không thể khởi tạo thanh toán MoMo.');
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể khởi tạo thanh toán MoMo.');
    }
  };

  const openCancelModal = () => {
    setCancellationReason('');
    setCancellationError('');
    setCancelModalVisible(true);
  };

  const closeCancelModal = () => {
    setCancelModalVisible(false);
    setCancellationReason('');
    setCancellationError('');
  };

  const handleCancelAppointment = () => {
    if (!appointment) return;
    // Only allow cancel for pending appointments (Chờ xác nhận)
    if (isPastAppointment(appointment) || appointment.status !== 'pending') {
      Alert.alert('Không thể hủy lịch', 'Chỉ có thể hủy lịch khi lịch hẹn đang chờ xác nhận.');
      return;
    }
    openCancelModal();
  };

  const handleConfirmCancelAppointment = async () => {
    if (!appointment) return;
    if (!cancellationReason.trim()) {
      setCancellationError('Vui lòng nhập lý do hủy lịch');
      return;
    }
    setCancellationError('');
    setIsCancelling(true);
    try {
      await apiService.cancelAppointment(appointment._id, cancellationReason.trim());
      if (refreshAppointmentRef.current) {
        await refreshAppointmentRef.current(0, 0, true);
      } else {
        setAppointment((prev) =>
          prev ? { ...prev, status: 'cancelled', cancellationReason: cancellationReason.trim() } : prev
        );
      }
      closeCancelModal();
      Alert.alert('Thành công', 'Đã hủy lịch hẹn thành công.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Không thể hủy lịch hẹn. Vui lòng thử lại.';
      Alert.alert('Lỗi', message);
    } finally {
      setIsCancelling(false);
    }
  };

  const openReviewSelectionModal = () => {
    if (!appointment) return;
    if (!appointment.doctorId && !appointment.hospitalId) {
      Alert.alert('Thông báo', 'Không tìm thấy thông tin bác sĩ hoặc chi nhánh để đánh giá.');
      return;
    }
    setReviewSelectionVisible(true);
  };

  const closeReviewSelectionModal = () => {
    setReviewSelectionVisible(false);
  };

  const handleSelectReviewTarget = (target: 'doctor' | 'hospital') => {
    closeReviewSelectionModal();
    if (!appointment) return;

    if (target === 'doctor' && !appointment.doctorId) {
      Alert.alert('Thông báo', 'Không tìm thấy thông tin bác sĩ để đánh giá.');
      return;
    }

    if (target === 'hospital' && !appointment.hospitalId) {
      Alert.alert('Thông báo', 'Không tìm thấy thông tin chi nhánh để đánh giá.');
      return;
    }

    navigation.navigate('ReviewForm', {
      appointmentId: appointment._id,
      targetType: target,
      appointment,
    });
  };

  const canRescheduleAppointment = (appt: Appointment | null) => {
    if (!appt) return false;
    if (isPastAppointment(appt)) return false;
    // Only allow reschedule for pending appointments (Chờ xác nhận)
    return appt.status === 'pending';
  };

  const handleReschedule = (appt: Appointment) => {
    if (!canRescheduleAppointment(appt)) {
      Alert.alert('Không thể đổi lịch', 'Chỉ có thể đổi lịch khi lịch hẹn đang chờ xác nhận.');
      return;
    }
    navigation.navigate('Reschedule', {
      appointmentId: appt._id,
      doctorId: (appt.doctorId as any)?._id || appt.doctorId,
      currentDate: appt.appointmentDate,
    });
  };

  const handleChatWithDoctor = async () => {
    try {
      if (!appointment) return;
      
      // Get doctor's user ID
      const doctorUser = appointment?.doctorId?.user || (appointment?.doctorId as any)?.user;
      const doctorUserId = (doctorUser as any)?._id || doctorUser;
      
      if (!doctorUserId) {
        Alert.alert('Lỗi', 'Không thể tìm thấy thông tin bác sĩ');
        return;
      }

      // Create or get existing conversation
      const response = await apiService.createConversation({
        participantId: doctorUserId,
        appointmentId: appointment._id
      });

      if (response?.success && response?.data?._id) {
        // Get doctor's full name from appointment
        const doctorFullName = appointment.doctorId?.user?.fullName || 
                              (appointment.doctorId as any)?.user?.fullName ||
                              'Bác sĩ';
        const doctorTitle = appointment.doctorId?.title || '';
        const doctorDisplayName = doctorTitle ? `${doctorTitle} ${doctorFullName}` : doctorFullName;
        const doctorAvatarUrl = appointment.doctorId?.user?.avatarUrl || 
                               (appointment.doctorId as any)?.user?.avatarUrl;
        
        // Get doctor's user ID for online status check
        // Use the same ID that was used to create conversation
        const doctorUserForOnlineCheck = doctorUserId;
        
        // Navigate to ChatDetail screen with doctor info
        navigation.navigate('ChatDetail', {
          conversationId: response.data._id,
          conversation: response.data,
          doctorInfo: {
            fullName: doctorDisplayName,
            avatarUrl: doctorAvatarUrl,
            roleType: 'doctor',
            _id: doctorUserForOnlineCheck // Pass doctor's user ID for online status check
          }
        });
      } else {
        Alert.alert('Lỗi', response?.message || 'Không thể bắt đầu trò chuyện. Vui lòng thử lại sau.');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error?.response?.data?.message || 'Không thể bắt đầu trò chuyện. Vui lòng thử lại sau.');
    }
  };

  const handleVideoCall = async () => {
    if (!appointment || isJoiningVideoCall) return;

    try {
      setIsJoiningVideoCall(true);

      const eligibleStatuses = ['confirmed', 'completed'];
      if (!eligibleStatuses.includes(appointment.status)) {
        Alert.alert('Thông báo', 'Chỉ có thể gọi video khi lịch hẹn đã được xác nhận.');
        return;
      }

      let activeRoom: any | null = null;

      try {
        const existingRoomResponse = await apiService.getVideoRoomByAppointment(appointment._id);
        if (
          existingRoomResponse?.success &&
          existingRoomResponse.data &&
          ['waiting', 'active'].includes(existingRoomResponse.data.status)
        ) {
          activeRoom = existingRoomResponse.data;
        }
      } catch (roomLookupError) {
        // Failed to check existing video room
      }

      if (!activeRoom) {
        const createResponse = await apiService.createVideoRoom(appointment._id);

        if (!createResponse?.success || !createResponse.data) {
          Alert.alert('Lỗi', createResponse?.message || 'Không thể tạo phòng video. Vui lòng thử lại.');
          return;
        }

        activeRoom = createResponse.data;
      }

      const roomId = activeRoom?._id || activeRoom?.roomId;

      if (!roomId) {
        Alert.alert('Lỗi', 'Không thể xác định phòng video.');
        return;
      }

      const joinResponse = await apiService.joinVideoRoom(roomId);

      if (!joinResponse?.success || !joinResponse.data) {
        Alert.alert('Lỗi', joinResponse?.message || 'Không thể tham gia phòng video. Vui lòng thử lại.');
        return;
      }

      const { token, wsUrl, roomName, role, appointmentInfo } = joinResponse.data;

      if (!token || !wsUrl) {
        Alert.alert('Lỗi', 'Thiếu thông tin kết nối phòng video.');
        return;
      }

      navigation.navigate('VideoCall', {
        roomId,
        roomName: roomName || activeRoom?.roomName || `Phòng ${appointment.bookingCode || ''}`,
        token,
        wsUrl,
        role,
        appointmentInfo
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Không thể bắt đầu cuộc gọi video. Vui lòng thử lại sau.';
      Alert.alert('Lỗi', message);
    } finally {
      setIsJoiningVideoCall(false);
    }
  };

  const handleShareToChat = async () => {
    try {
      if (!appointment) return;
      
      const doctorUser = appointment?.doctorId?.user || (appointment?.doctorId as any)?.user;
      const doctorUserId = (doctorUser as any)?._id || doctorUser;
      
      if (!doctorUserId) {
        Alert.alert('Lỗi', 'Không thể tìm thấy thông tin bác sĩ');
        return;
      }

      // Create or get conversation
      const response = await apiService.createConversation({
        participantId: doctorUserId,
        appointmentId: appointment._id
      });

      if (response?.success && response?.data?._id) {
        const conversationId = response.data._id;
        
        // Send appointment to chat
        const shareResponse = await apiService.sendAppointmentToChat(conversationId, appointment._id);
        
        if (shareResponse?.success) {
          Alert.alert('Thành công', 'Đã chia sẻ lịch hẹn vào chat', [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to ChatDetail screen
                navigation.navigate('ChatDetail', {
                  conversationId: conversationId,
                  conversation: response.data
                });
              },
            },
          ]);
        } else {
          Alert.alert('Lỗi', 'Không thể chia sẻ lịch hẹn');
        }
      } else {
        Alert.alert('Lỗi', response?.message || 'Không thể tạo cuộc trò chuyện');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể chia sẻ lịch hẹn');
    }
  };

  const isPastAppointment = (appt: Appointment | null) => {
    if (!appt?.appointmentDate) return false;
    try {
      const appointmentDate = new Date(appt.appointmentDate);
      if (appt.timeSlot?.startTime) {
        const [h, m] = appt.timeSlot.startTime.split(':').map(Number);
        appointmentDate.setHours(h || 0, m || 0, 0, 0);
      }
      return appointmentDate < new Date();
    } catch {
      return false;
    }
  };

  // Early return if appointment is not loaded yet
  if (!appointment) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={IconColors.primary} />
        <Text style={{ marginTop: 16, color: '#6b7280' }}>Đang tải thông tin lịch hẹn...</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(appointment.status);
  const isPast = isPastAppointment(appointment);
  const consultationFee = appointment.consultationFee || appointment.doctorId?.consultationFee || 0;
  const serviceFee = appointment.serviceFee || appointment.serviceId?.price || 0;
  const totalAmount = appointment.totalAmount || (consultationFee + serviceFee);
  const bill = appointmentBill || (appointment as any).bill || null;
  const consultationBillAmount =
    (bill?.consultationAmount as number | undefined) ??
    (bill?.consultationBill?.amount as number | undefined) ??
    0;
  const medicationBillAmount =
    (bill?.medicationAmount as number | undefined) ??
    (bill?.medicationBill?.amount as number | undefined) ??
    0;
  const hospitalizationBillAmount =
    (bill?.hospitalizationAmount as number | undefined) ??
    (bill?.hospitalizationBill?.amount as number | undefined) ??
    0;
  const consultationBillStatus =
    (bill?.consultationStatus as string | undefined) ??
    (bill?.consultationBill?.status as string | undefined) ??
    'pending';
  const medicationBillStatus =
    (bill?.medicationStatus as string | undefined) ??
    (bill?.medicationBill?.status as string | undefined) ??
    'pending';
  const hospitalizationBillStatus =
    (bill?.hospitalizationStatus as string | undefined) ??
    (bill?.hospitalizationBill?.status as string | undefined) ??
    'pending';
  const overallBillStatus =
    (bill?.overallStatus as string | undefined) ??
    (bill?.status as string | undefined) ??
    'unpaid';
  const billTotalAmount =
    (bill?.totalAmount as number | undefined) ??
    (consultationBillAmount + medicationBillAmount + hospitalizationBillAmount);
  const billPaidAmount = (bill?.paidAmount as number | undefined) ?? 0;
  const billRemainingAmount =
    (bill?.remainingAmount as number | undefined) ??
    Math.max(billTotalAmount - billPaidAmount, 0);
  const consultationPaymentDate: string | null =
    (bill?.consultationBill?.paymentDate as string | undefined) ??
    (bill?.consultationPaymentDate as string | undefined) ??
    null;
  const consultationPaymentMethod: string | null =
    (bill?.consultationBill?.paymentMethod as string | undefined) ??
    (bill?.consultationPaymentMethod as string | undefined) ??
    null;
  const medicationPaymentDate: string | null =
    (bill?.medicationBill?.paymentDate as string | undefined) ??
    (bill?.medicationPaymentDate as string | undefined) ??
    null;
  const medicationPaymentMethod: string | null =
    (bill?.medicationBill?.paymentMethod as string | undefined) ??
    (bill?.medicationPaymentMethod as string | undefined) ??
    null;
  const rescheduleCount = appointment.rescheduleCount ?? ((appointment as any)?.rescheduleCount ?? 0);
  const hasReachedRescheduleLimit = rescheduleCount >= 2;
  // Allow reschedule and cancel only for pending appointments (Chờ xác nhận)
  // Show buttons for pending status regardless of whether it's past or not
  const canModifyAppointment = appointment.status === 'pending';
  const hospitalization = appointment.hospitalization;
  const roomInfoText = getRoomInfo(appointment);
  const prescriptionMap = new Map<string, Prescription>();

  const upsertPrescription = (raw: any) => {
    if (!raw) return;
    const hasEmbeddedPrescription = raw.prescriptionId && typeof raw.prescriptionId === 'object';
    const normalizedSource = hasEmbeddedPrescription
      ? {
          ...raw.prescriptionId,
          totalAmount: raw.prescriptionId?.totalAmount ?? raw.amount,
          status: raw.prescriptionId?.status ?? raw.paymentStatus,
        }
      : raw;
    const source = normalizedSource;
    if (!source) return;
    const normalizedPrescriptionId =
      typeof raw.prescriptionId === 'string'
        ? raw.prescriptionId
        : raw.prescriptionId?._id;
    const generatedId = source._id || normalizedPrescriptionId || raw._id || raw.id;
    const id = generatedId ? String(generatedId) : `pres-${prescriptionMap.size + 1}`;
    const existing = prescriptionMap.get(id) || ({ _id: id } as Prescription);

    const normalizedMedications = Array.isArray(source.medications) && source.medications.length > 0
      ? source.medications
      : existing.medications || [];

    const normalized: Prescription = {
      ...existing,
      ...(source as Prescription),
      _id: id,
      prescriptionOrder: source.prescriptionOrder ?? existing.prescriptionOrder,
      status: source.status ?? (raw.paymentStatus as string) ?? existing.status,
      totalAmount: source.totalAmount ?? (raw.amount as number) ?? existing.totalAmount,
      diagnosis: source.diagnosis ?? existing.diagnosis,
      isHospitalization: source.isHospitalization ?? existing.isHospitalization,
      medications: normalizedMedications,
      notes: source.notes ?? existing.notes,
      createdAt: source.createdAt ?? raw.createdAt ?? existing.createdAt,
    };

    prescriptionMap.set(id, normalized);
  };

  const initialPrescriptions = Array.isArray(appointment.prescriptions)
    ? appointment.prescriptions
    : [];
  initialPrescriptions.forEach(upsertPrescription);

  const billPrescriptions = (appointment as any)?.bill?.medicationBill?.prescriptionPayments;
  if (Array.isArray(billPrescriptions)) {
    billPrescriptions.forEach(upsertPrescription);
  }

  // Chỉ dùng đơn thuốc trong hồ sơ bệnh án khi không có dữ liệu đơn thuốc chính
  const medicalRecordPrescriptions = (appointment as any)?.medicalRecord?.prescription;
  const hasPrimaryPrescriptions =
    initialPrescriptions.length > 0 ||
    (Array.isArray(billPrescriptions) && billPrescriptions.length > 0);

  if (!hasPrimaryPrescriptions && Array.isArray(medicalRecordPrescriptions)) {
    medicalRecordPrescriptions.forEach(upsertPrescription);
  }

  const combinedPrescriptions = Array.from(prescriptionMap.values());
  const sortedPrescriptions = combinedPrescriptions.sort((a, b) => (a?.prescriptionOrder || 1) - (b?.prescriptionOrder || 1));

  const getPrescriptionById = (id?: string | null): Prescription | null => {
    if (!id) return null;
    const idStr = id.toString();
    return (
      sortedPrescriptions.find(p => p._id === idStr) ||
      prescriptionMap.get(idStr) ||
      null
    );
  };

  const findMedicationPaymentTarget = (): Prescription | null => {
    const billPrescriptionPayments = Array.isArray((appointment as any)?.bill?.medicationBill?.prescriptionPayments)
      ? (appointment as any).bill.medicationBill.prescriptionPayments
      : [];

    for (const payment of billPrescriptionPayments) {
      const paymentStatus = payment?.status || payment?.paymentStatus;
      if (paymentStatus === 'paid') continue;
      const candidateId =
        payment?.prescriptionId?._id?.toString() ||
        payment?.prescriptionId?.toString() ||
        payment?._id?.toString();
      const candidate = getPrescriptionById(candidateId);
      if (candidate) {
        return candidate;
      }
    }

    return sortedPrescriptions.find(p => !isPrescriptionPaid(p._id)) || sortedPrescriptions[0] || null;
  };

  // Helper function to get room information
  function getRoomInfo(appt: Appointment | null) {
    if (!appt) return 'Đang cập nhật';
    const fallback = 'Đang cập nhật';
    if (appt.roomInfo && appt.roomInfo.trim()) return appt.roomInfo.trim();
    if (appt.clinicRoom && appt.clinicRoom.trim()) return appt.clinicRoom.trim();

    const room = appt.roomId && typeof appt.roomId === 'object' ? appt.roomId : null;
    if (room) {
      const roomName = (room.roomName || room.name || '').trim();
      const roomNumber = room.number !== undefined && room.number !== null ? String(room.number).trim() : '';
      const floor = room.floor !== undefined && room.floor !== null ? String(room.floor).trim() : '';

      const parts: string[] = [];
      if (floor) parts.push(`Tầng ${floor}`);
      if (roomNumber) parts.push(`Phòng ${roomNumber}`);

      let display = parts.join(', ');

      if (!display && roomName) {
        display = roomName;
      } else if (roomName && display && !display.toLowerCase().includes(roomName.toLowerCase())) {
        display = `${display} (${roomName})`;
      }

      return display || fallback;
    }

    return fallback;
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name={AppIcons.chevronBack as any} size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết lịch hẹn</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hospitalization Section - First (if exists) */}
        {hospitalization && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.sectionHeaderPurple]}>
              <Ionicons name="bed-outline" size={20} color="#fff" />
              <Text style={[styles.sectionTitle, styles.sectionTitleWhite]}>Thông tin nằm viện</Text>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phòng hiện tại</Text>
                <Text style={styles.infoValue}>
                  {hospitalization.inpatientRoomId?.roomNumber
                    ? `Phòng ${hospitalization.inpatientRoomId.roomNumber}${hospitalization.inpatientRoomId?.type ? ` (${hospitalization.inpatientRoomId.type})` : ''}`
                    : 'Đang cập nhật'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Trạng thái</Text>
                <Text style={styles.infoValue}>{getHospitalizationStatusText(hospitalization.status)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {hospitalization.status === 'discharged' ? 'Tổng chi phí' : 'Chi phí hiện tại'}
                </Text>
                <Text style={styles.infoValue}>{formatVnd(hospitalization.totalAmount ?? hospitalization.currentInfo?.currentCost ?? 0)}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.hospitalizationDateRow}>
                <View style={styles.hospitalizationDateItem}>
                  <Text style={styles.infoLabel}>Ngày nhập viện</Text>
                  <Text style={styles.infoValueMultiline}>{formatDateTime(hospitalization.admissionDate)}</Text>
                </View>
                {hospitalization.dischargeDate ? (
                  <View style={styles.hospitalizationDateItem}>
                    <Text style={styles.infoLabel}>Ngày xuất viện</Text>
                    <Text style={styles.infoValueMultiline}>{formatDateTime(hospitalization.dischargeDate)}</Text>
                  </View>
                ) : null}
              </View>
              {hospitalization.roomHistory && hospitalization.roomHistory.length > 0 && (
                <View style={styles.roomHistoryContainer}>
                  <Text style={[styles.infoLabel, { marginBottom: 8 }]}>Lịch sử chuyển phòng</Text>
                  {hospitalization.roomHistory.map((entry, idx) => (
                    <View key={`${entry.roomNumber || idx}-${idx}`} style={styles.roomHistoryItem}>
                      <Text style={styles.roomHistoryTitle}>
                        {entry.roomNumber ? `Phòng ${entry.roomNumber}` : 'Phòng không xác định'}
                        {entry.roomType ? ` (${entry.roomType})` : ''}
                      </Text>
                      <Text style={styles.roomHistoryMeta}>Vào: {formatDateTime(entry.checkInTime)}</Text>
                      <Text style={styles.roomHistoryMeta}>Ra: {entry.checkOutTime ? formatDateTime(entry.checkOutTime) : 'Đang ở'}</Text>
                      {entry.hours ? (
                        <Text style={styles.roomHistoryMeta}>Thời gian: {entry.hours} giờ</Text>
                      ) : null}
                      {entry.amount ? (
                        <Text style={styles.roomHistoryMeta}>Chi phí: {formatVnd(entry.amount)}</Text>
                      ) : null}
                      {entry.hourlyRate ? (
                        <Text style={styles.roomHistoryMeta}>Giá/giờ: {formatVnd(entry.hourlyRate)}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Prescriptions Section - Second (if exists) */}
        {sortedPrescriptions.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.sectionHeaderGreen]}>
              <Ionicons name="medkit-outline" size={20} color="#fff" />
              <Text style={[styles.sectionTitle, styles.sectionTitleWhite]}>Đơn thuốc</Text>
            </View>
            <View style={styles.infoCard}>
              {sortedPrescriptions.map((prescription) => {
                const statusInfo = getPrescriptionStatusInfo(prescription.status);
                return (
                  <View key={prescription._id} style={styles.prescriptionCard}>
                    <View style={styles.prescriptionHeader}>
                      <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Đợt {prescription.prescriptionOrder || 1}</Text>
                        </View>
                        {prescription.isHospitalization && (
                          <View style={[styles.badge, styles.badgeSecondary]}>
                            <Text style={[styles.badgeText, styles.badgeSecondaryText]}>Nội trú</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.prescriptionStatusBadge, { backgroundColor: statusInfo.backgroundColor }]}>
                        <Text style={[styles.prescriptionStatusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                      </View>
                    </View>

                    {prescription.diagnosis ? (
                      <Text style={styles.prescriptionMeta}>Chẩn đoán: {prescription.diagnosis}</Text>
                    ) : null}

                    {Array.isArray(prescription.medications) && prescription.medications.length > 0 && (
                      <View>
                        {prescription.medications.map((med, index) => (
                          <View key={`${prescription._id}-med-${index}`} style={styles.medicationItem}>
                            <Text style={styles.medicationName}>{med.medicationId?.name || med.medicationName || 'Thuốc'}</Text>
                            <Text style={styles.medicationDetail}>Số lượng: {med.quantity ?? '—'} {med.medicationId?.unitTypeDisplay || ''}</Text>
                            <Text style={styles.medicationDetail}>Liều lượng: {med.dosage || '—'}</Text>
                            <Text style={styles.medicationDetail}>Cách dùng: {med.usage || '—'}</Text>
                            <Text style={styles.medicationDetail}>Thời gian: {med.duration || '—'}</Text>
                            {med.totalPrice ? (
                              <Text style={styles.medicationDetail}>Tổng tiền: {formatVnd(med.totalPrice)}</Text>
                            ) : null}
                            {med.notes ? (
                              <Text style={styles.medicationNote}>{med.notes}</Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    )}

                    {prescription.totalAmount ? (
                      <View style={styles.prescriptionAmountRow}>
                        <Text style={styles.prescriptionMeta}>Tổng tiền đơn thuốc: </Text>
                        <Text style={styles.prescriptionAmount}>{formatVnd(prescription.totalAmount)}</Text>
                      </View>
                    ) : null}

                    {prescription.notes ? (
                      <Text style={styles.prescriptionMeta}>Ghi chú: {prescription.notes}</Text>
                    ) : null}

                    {prescription.createdAt ? (
                      <View style={styles.prescriptionFooter}>
                        <Text style={styles.prescriptionFooterText}>Ngày kê đơn: {formatDate (prescription.createdAt)}</Text>
                      </View>
                    ) : null}

                    {/* Payment information for prescription */}
                    {prescription.totalAmount && prescription.totalAmount > 0 && (
                      <View style={styles.prescriptionPaymentSection}>
                        {isPrescriptionPaid(prescription._id) && (
                          <View style={styles.prescriptionPaidBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            <Text style={styles.prescriptionPaidText}>Đã thanh toán</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Appointment Header - Third */}
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor === '#f59e0b' ? '#fef3c7' : `${statusColor}15` }]}>
              <Ionicons name="time-outline" size={14} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusText(appointment.status)}
              </Text>
            </View>
            <Text style={styles.bookingCodeText}>
              Mã đặt lịch: {appointment.bookingCode || `#${appointment._id.substring(0, 8).toUpperCase()}`}
            </Text>
          </View>

          <Text style={styles.appointmentTitle}>
            {appointment.serviceId?.name || 'Khám tổng quát'}
          </Text>

          {appointment.queueNumber && (
            <View style={styles.queueBadge}>
              <Ionicons name="list-outline" size={14} color="#3b82f6" />
              <Text style={styles.queueText}>
                Số thứ tự khám: {appointment.queueNumber}
              </Text>
            </View>
          )}

          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeRow}>
              <Ionicons name="calendar-outline" size={18} color={IconColors.primary} />
              <Text style={styles.dateTimeText}>
                {formatDate(appointment.appointmentDate)}
              </Text>
            </View>
            {appointment.timeSlot && (
              <View style={styles.dateTimeRow}>
                <Ionicons name="time-outline" size={18} color={IconColors.primary} />
                <Text style={styles.dateTimeText}>
                  {formatHourRange(appointment.timeSlot.startTime, appointment.timeSlot.endTime)}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons - Horizontal at bottom */}
          <View style={styles.actionButtonsContainer}>
            {/* Chat and Share buttons for pending, confirmed, or completed */}
            {(appointment.status === 'pending' || appointment.status === 'confirmed' || appointment.status === 'completed') && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleChatWithDoctor}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#10b981" />
                  <Text style={styles.actionButtonText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleShareToChat}
                >
                  <Ionicons name="share-outline" size={18} color="#2563eb" />
                  <Text style={styles.actionButtonText}>Chia sẻ</Text>
                </TouchableOpacity>
              </>
            )}
            
            {/* Video Call button for confirmed appointments only */}
            {appointment.status === 'confirmed' && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.actionButtonPurple,
                  isJoiningVideoCall && styles.actionButtonDisabled
                ]}
                onPress={handleVideoCall}
                disabled={isJoiningVideoCall}
              >
                {isJoiningVideoCall ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <>
                    <Ionicons name="videocam-outline" size={18} color="#8b5cf6" />
                    <Text style={[styles.actionButtonText, { color: '#8b5cf6' }]}>Video Call</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            {/* Reschedule and Cancel buttons - align with Schedule screen */}
            {canModifyAppointment && (
              <>
                {hasReachedRescheduleLimit ? (
                  <View style={[styles.actionButton, styles.actionButtonDisabled]}>
                    <Ionicons name="refresh-outline" size={18} color="#9ca3af" />
                    <Text style={[styles.actionButtonText, styles.actionButtonTextDisabled]}>Đã hết lượt</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonBlue]}
                    onPress={() => handleReschedule(appointment)}
                  >
                    <Ionicons name="refresh-outline" size={18} color="#2563eb" />
                    <Text style={[styles.actionButtonText, { color: '#2563eb' }]}>Đổi lịch</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonRed]}
                  onPress={handleCancelAppointment}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Ionicons name="close-outline" size={18} color="#ef4444" />
                      <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Hủy lịch</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
            
            {/* Review button for completed appointments */}
            {appointment.status === 'completed' && !appointment.isReviewed && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonYellow]}
                onPress={openReviewSelectionModal}
              >
                <Ionicons name="star-outline" size={18} color="#f59e0b" />
                <Text style={[styles.actionButtonText, { color: '#f59e0b' }]}>Đánh giá</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Doctor and Hospital Info - Grid Layout */}
        <View style={styles.gridContainer}>
          {/* Doctor Info Section */}
          {appointment.doctorId && (
            <View style={styles.gridItem}>
              <View style={[styles.sectionHeader, styles.sectionHeaderBlue]}>
                <Ionicons name="medical-outline" size={20} color="#fff" />
                <Text style={[styles.sectionTitle, styles.sectionTitleWhite]}>Thông tin bác sĩ</Text>
              </View>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bác sĩ</Text>
                  <Text style={styles.infoValue}>
                    {appointment.doctorId.title || 'BS.'} {appointment.doctorId.user?.fullName || 'Bác sĩ'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Chuyên khoa</Text>
                  <Text style={styles.infoValue}>
                    {appointment.doctorId.specialtyId?.name || appointment.specialtyId?.name || 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Hospital Info Section */}
          {appointment.hospitalId && (
            <View style={styles.gridItem}>
              <View style={[styles.sectionHeader, styles.sectionHeaderBlue]}>
                <Ionicons name="business-outline" size={20} color="#fff" />
                <Text style={[styles.sectionTitle, styles.sectionTitleWhite]}>Thông tin bệnh viện</Text>
              </View>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Bệnh viện</Text>
                  <Text style={styles.infoValue}>{appointment.hospitalId.name}</Text>
                </View>
                {appointment.hospitalId.address && (
                  <View style={styles.infoRow}>
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={16} color={IconColors.primary} />
                      <Text style={styles.infoLabel}>Địa chỉ</Text>
                    </View>
                    <Text style={styles.infoValueMultiline}>{appointment.hospitalId.address}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phòng khám</Text>
                  <Text style={styles.infoValue}>{roomInfoText}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Medical Information Section */}
        {(appointment.serviceId || appointment.appointmentType || appointment.symptoms || appointment.medicalHistory || appointment.notes) && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.sectionHeaderBlue]}>
              <Ionicons name="document-text-outline" size={20} color="#fff" />
              <Text style={[styles.sectionTitle, styles.sectionTitleWhite]}>Thông tin khám bệnh</Text>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.medicalInfoGrid}>
                <View style={styles.medicalInfoColumn}>
                  {appointment.serviceId && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Dịch vụ</Text>
                      <Text style={styles.infoValue}>{appointment.serviceId.name}</Text>
                    </View>
                  )}
                  {appointment.appointmentType && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Loại khám</Text>
                      <Text style={styles.infoValue}>{getAppointmentTypeText(appointment.appointmentType)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.medicalInfoColumn}>
                  {appointment.symptoms ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Triệu chứng</Text>
                      <Text style={styles.infoValueMultiline}>{appointment.symptoms}</Text>
                    </View>
                  ) : null}
                  {appointment.medicalHistory ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Tiền sử bệnh</Text>
                      <Text style={styles.infoValueMultiline}>{appointment.medicalHistory}</Text>
                    </View>
                  ) : null}
                  {appointment.notes ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Ghi chú</Text>
                      <Text style={styles.infoValueMultiline}>{appointment.notes}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Billing Section */}
        {(bill || totalAmount > 0) && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, styles.sectionHeaderBlue]}>
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={[styles.sectionTitle, styles.sectionTitleWhite]}>Thanh Toán</Text>
            </View>
            <View style={styles.paymentCard}>
              {/* Hiển thị thông tin từ bill nếu có */}
              {bill ? (
                <>
                  {/* Phí khám */}
                  {consultationBillAmount > 0 && (
                    <View style={styles.paymentGroup}>
                      <View style={styles.paymentGroupHeaderRow}>
                        <View style={styles.paymentGroupTitleRow}>
                          <Ionicons 
                            name={consultationBillStatus === 'paid' ? 'checkmark-circle' : 'medkit-outline'} 
                            size={18} 
                            color={consultationBillStatus === 'paid' ? '#10b981' : '#2563eb'} 
                          />
                          <Text style={styles.paymentGroupTitle}>Phí Khám Bệnh</Text>
                        </View>
                        <View style={styles.paymentGroupStatusBadge}>
                          <Text style={styles.paymentGroupStatusText}>
                            {consultationBillStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.paymentGroupAmountRow}>
                        <Text style={styles.paymentGroupAmount}>{formatVnd(consultationBillAmount)}</Text>
                        {consultationBillStatus === 'paid' && consultationPaymentDate && (
                          <Text style={styles.paymentGroupMetaText}>
                            Đã thanh toán: {formatDateTime(consultationPaymentDate)}
                          </Text>
                        )}
                        {consultationBillStatus === 'paid' && consultationPaymentMethod && (
                          <Text style={styles.paymentGroupMetaText}>
                            Phương thức: {consultationPaymentMethod === 'momo'
                              ? 'MoMo'
                              : consultationPaymentMethod === 'paypal'
                              ? 'PayPal'
                              : consultationPaymentMethod}
                          </Text>
                        )}
                      </View>

                      {consultationBillStatus !== 'paid' && appointment.status !== 'cancelled' && appointment.status !== 'rejected' && (
                        <View style={styles.paymentActionsRow}>
                          <View style={styles.paymentMethodsRow}>
                            <TouchableOpacity
                              style={[
                                styles.paymentMethodButton,
                                selectedConsultationMethod === 'momo' && styles.paymentMethodButtonSelectedMomo,
                              ]}
                              onPress={() => setSelectedConsultationMethod('momo')}
                              disabled={loading}
                            >
                              <Ionicons name="wallet-outline" size={18} color={selectedConsultationMethod === 'momo' ? '#fff' : '#374151'} style={{ marginRight: 6 }} />
                              <Text
                                style={[
                                  styles.paymentMethodButtonText,
                                  selectedConsultationMethod === 'momo' && styles.paymentMethodButtonTextSelected,
                                ]}
                              >
                                MoMo
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.paymentMethodButton,
                                selectedConsultationMethod === 'paypal' && styles.paymentMethodButtonSelectedPaypal,
                              ]}
                              onPress={() => setSelectedConsultationMethod('paypal')}
                              disabled={loading}
                            >
                              <Ionicons name="logo-paypal" size={18} color={selectedConsultationMethod === 'paypal' ? '#fff' : '#374151'} style={{ marginRight: 6 }} />
                              <Text
                                style={[
                                  styles.paymentMethodButtonText,
                                  selectedConsultationMethod === 'paypal' && styles.paymentMethodButtonTextSelected,
                                ]}
                              >
                                PayPal
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.paymentMainButton,
                              styles.paymentMainButtonBlue,
                              (loading || consultationBillAmount <= 0) && styles.paymentMainButtonDisabled,
                            ]}
                            onPress={() =>
                              selectedConsultationMethod === 'paypal'
                                ? startPaypalPayment({ billType: 'consultation' })
                                : startMomoPayment('consultation')
                            }
                            disabled={loading || consultationBillAmount <= 0}
                          >
                            {loading ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons
                                  name={selectedConsultationMethod === 'paypal' ? 'logo-paypal' : 'wallet-outline'}
                                  size={18}
                                  color="#fff"
                                  style={{ marginRight: 8 }}
                                />
                                <Text style={styles.paymentMainButtonText}>
                                  Thanh toán {formatVnd(consultationBillAmount)}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* Tiền thuốc */}
                  {medicationBillAmount > 0 && (
                    <View style={[styles.paymentGroup, { marginTop: 16 }]}>
                      <View style={styles.paymentGroupHeaderRow}>
                        <View style={styles.paymentGroupTitleRow}>
                          <Ionicons 
                            name={medicationBillStatus === 'paid' ? 'checkmark-circle' : 'leaf-outline'} 
                            size={18} 
                            color={medicationBillStatus === 'paid' ? '#10b981' : '#16a34a'} 
                          />
                          <Text style={styles.paymentGroupTitle}>Tiền Thuốc</Text>
                        </View>
                        <View style={styles.paymentGroupStatusBadge}>
                          <Text style={styles.paymentGroupStatusText}>
                            {medicationBillStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.paymentGroupAmountRow}>
                        <Text style={styles.paymentGroupAmount}>{formatVnd(medicationBillAmount)}</Text>
                        {medicationBillStatus === 'paid' && medicationPaymentDate && (
                          <Text style={styles.paymentGroupMetaText}>
                            Đã thanh toán: {formatDateTime(medicationPaymentDate)}
                          </Text>
                        )}
                        {medicationBillStatus === 'paid' && medicationPaymentMethod && (
                          <Text style={styles.paymentGroupMetaText}>
                            Phương thức: {medicationPaymentMethod === 'momo'
                              ? 'MoMo'
                              : medicationPaymentMethod === 'paypal'
                              ? 'PayPal'
                              : medicationPaymentMethod}
                          </Text>
                        )}
                      </View>

                      {medicationBillStatus !== 'paid' && appointment.status !== 'cancelled' && appointment.status !== 'rejected' && (
                        <View style={styles.paymentActionsRow}>
                          <View style={styles.paymentMethodsRow}>
                            <TouchableOpacity
                              style={[
                                styles.paymentMethodButton,
                                selectedMedicationMethod === 'momo' && styles.paymentMethodButtonSelectedMomo,
                              ]}
                              onPress={() => setSelectedMedicationMethod('momo')}
                              disabled={loading}
                            >
                              <Ionicons name="wallet-outline" size={18} color={selectedMedicationMethod === 'momo' ? '#fff' : '#374151'} style={{ marginRight: 6 }} />
                              <Text
                                style={[
                                  styles.paymentMethodButtonText,
                                  selectedMedicationMethod === 'momo' && styles.paymentMethodButtonTextSelected,
                                ]}
                              >
                                MoMo
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.paymentMethodButton,
                                selectedMedicationMethod === 'paypal' && styles.paymentMethodButtonSelectedPaypal,
                              ]}
                              onPress={() => setSelectedMedicationMethod('paypal')}
                              disabled={loading}
                            >
                              <Ionicons name="logo-paypal" size={18} color={selectedMedicationMethod === 'paypal' ? '#fff' : '#374151'} style={{ marginRight: 6 }} />
                              <Text
                                style={[
                                  styles.paymentMethodButtonText,
                                  selectedMedicationMethod === 'paypal' && styles.paymentMethodButtonTextSelected,
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
                              (loading || medicationBillAmount <= 0) && styles.paymentMainButtonDisabled,
                            ]}
                            onPress={() =>
                              selectedMedicationMethod === 'paypal'
                                ? startPaypalPayment({ billType: 'medication' })
                                : startMomoPayment('medication')
                            }
                            disabled={loading || medicationBillAmount <= 0}
                          >
                            {loading ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons
                                  name={selectedMedicationMethod === 'paypal' ? 'logo-paypal' : 'wallet-outline'}
                                  size={18}
                                  color="#fff"
                                  style={{ marginRight: 8 }}
                                />
                                <Text style={styles.paymentMainButtonText}>
                                  Thanh toán {formatVnd(medicationBillAmount)}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* Phí nằm viện */}
                  {hospitalizationBillAmount > 0 && (
                    <View style={styles.paymentFeeRow}>
                      <View style={styles.paymentFeeLabelRow}>
                        <Ionicons 
                          name={hospitalizationBillStatus === 'paid' ? 'checkmark-circle' : 'time-outline'} 
                          size={16} 
                          color={hospitalizationBillStatus === 'paid' ? '#10b981' : '#f59e0b'} 
                        />
                        <Text style={styles.paymentFeeLabel}>Phí nằm viện</Text>
                      </View>
                      <Text style={styles.paymentFeeAmount}>{formatVnd(hospitalizationBillAmount)}</Text>
                    </View>
                  )}
                  
                  {(consultationBillAmount > 0 || medicationBillAmount > 0 || hospitalizationBillAmount > 0) && (
                    <View>
                      <View style={styles.paymentDivider} />
                      <View style={styles.paymentTotalRow}>
                        <Text style={styles.paymentTotalLabel}>Tổng hóa đơn</Text>
                        <Text style={styles.paymentTotalAmount}>{formatVnd(billTotalAmount)}</Text>
                      </View>
                    </View>
                  )}
                  
                  {overallBillStatus === 'partial' && (
                    <View style={styles.paymentPartialInfo}>
                      <Text style={styles.paymentPartialLabel}>Đã thanh toán: {formatVnd(billPaidAmount)}</Text>
                      <Text style={[styles.paymentPartialLabel, { fontWeight: '700', color: '#dc2626' }]}>Còn lại: {formatVnd(billRemainingAmount)}</Text>
                    </View>
                  )}
                  
                  {overallBillStatus === 'unpaid' && billTotalAmount > 0 && (
                    <View style={styles.paymentPartialInfo}>
                      <Text style={[styles.paymentPartialLabel, { fontWeight: '700', color: '#dc2626' }]}>Số tiền cần thanh toán: {formatVnd(billTotalAmount)}</Text>
                    </View>
                  )}
                  
                  <View style={styles.paymentStatusRow}>
                    <Text style={styles.paymentStatusLabel}>Trạng thái</Text>
                    <View style={[
                      styles.paymentStatusBadge,
                      isPaymentFullyPaid(appointment) && styles.paymentStatusBadgePaid,
                      overallBillStatus === 'partial' && styles.paymentStatusBadgePartial
                    ]}>
                      <Ionicons 
                        name={
                          isPaymentFullyPaid(appointment) ? 'checkmark-circle-outline' : 
                          overallBillStatus === 'partial' ? 'time-outline' : 
                          'time-outline'
                        } 
                        size={14} 
                        color={
                          isPaymentFullyPaid(appointment) ? '#10b981' : 
                          overallBillStatus === 'partial' ? '#f59e0b' : 
                          '#f59e0b'
                        } 
                      />
                      <Text style={[
                        styles.paymentStatusText,
                        isPaymentFullyPaid(appointment) && styles.paymentStatusTextPaid,
                        overallBillStatus === 'partial' && styles.paymentStatusTextPartial
                      ]}>
                        {isPaymentFullyPaid(appointment) ? 'Đã thanh toán' : 
                         overallBillStatus === 'partial' ? 'Đã thanh toán một phần' : 
                         'Chưa thanh toán'}
                      </Text>
                    </View>
                  </View>
                  
                </>
              ) : (
                <>
                  {/* Fallback to old payment display if bill is not available */}
                  {consultationFee > 0 && (
                    <View style={styles.paymentFeeRow}>
                      <Text style={styles.paymentFeeLabel}>Phí tư vấn khám</Text>
                      <Text style={styles.paymentFeeAmount}>{formatVnd(consultationFee)}</Text>
                    </View>
                  )}
                  {serviceFee > 0 && (
                    <View style={styles.paymentFeeRow}>
                      <Text style={styles.paymentFeeLabel}>Phí dịch vụ thêm</Text>
                      <Text style={styles.paymentFeeAmount}>{formatVnd(serviceFee)}</Text>
                    </View>
                  )}
                  {(consultationFee > 0 || serviceFee > 0) && (
                    <View style={styles.paymentDivider} />
                  )}
                  <View style={styles.paymentTotalRow}>
                    <Text style={styles.paymentTotalLabel}>Tổng thanh toán</Text>
                    <Text style={styles.paymentTotalAmount}>{formatVnd(totalAmount)}</Text>
                  </View>
                  <View style={styles.paymentStatusRow}>
                    <Text style={styles.paymentStatusLabel}>Trạng thái</Text>
                    <View style={[
                      styles.paymentStatusBadge,
                      appointment.paymentStatus === 'paid' && styles.paymentStatusBadgePaid
                    ]}>
                      <Ionicons 
                        name={appointment.paymentStatus === 'paid' ? 'checkmark-circle-outline' : 'time-outline'} 
                        size={14} 
                        color={appointment.paymentStatus === 'paid' ? '#10b981' : '#f59e0b'} 
                      />
                      <Text style={[
                        styles.paymentStatusText,
                        appointment.paymentStatus === 'paid' && styles.paymentStatusTextPaid
                      ]}>
                        {getPaymentStatusText(appointment.paymentStatus)}
                      </Text>
                    </View>
                  </View>
                  {appointment.paymentMethod && (
                    <View style={styles.paymentMethodRow}>
                      <Text style={styles.paymentMethodLabel}>Phương thức thanh toán</Text>
                      <Text style={styles.paymentMethodValue}>{getPaymentMethodText(appointment.paymentMethod)}</Text>
                    </View>
                  )}
                  {/* Không hiển thị nút thanh toán tổng trong chế độ fallback */}
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      {reviewSelectionVisible && appointment && (
        <Modal
          visible={reviewSelectionVisible}
          transparent
          animationType="fade"
          onRequestClose={closeReviewSelectionModal}
        >
          <View style={styles.reviewModalOverlay}>
            <View style={styles.reviewModalContainer}>
              <View style={styles.reviewModalHeader}>
                <Text style={styles.reviewModalTitle}>Đánh giá lịch khám</Text>
                <TouchableOpacity onPress={closeReviewSelectionModal} style={styles.reviewModalCloseButton}>
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewModalDescription}>
                Vui lòng chọn đối tượng mà bạn muốn gửi đánh giá cho lịch hẹn này.
              </Text>
              <View style={styles.reviewModalOptions}>
                {appointment.doctorId && (
                  <TouchableOpacity
                    style={styles.reviewOptionButton}
                    onPress={() => handleSelectReviewTarget('doctor')}
                  >
                    <View style={[styles.reviewOptionIcon, { backgroundColor: '#eef2ff' }]}>
                      <Ionicons name="medkit-outline" size={20} color="#4c1d95" />
                    </View>
                    <View style={styles.reviewOptionTextWrapper}>
                      <Text style={styles.reviewOptionTitle}>Đánh giá bác sĩ</Text>
                      <Text style={styles.reviewOptionSubtitle}>
                        {(appointment.doctorId.title ? `${appointment.doctorId.title} ` : '') +
                          (appointment.doctorId.user?.fullName || 'Bác sĩ phụ trách')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
                {appointment.hospitalId && (
                  <TouchableOpacity
                    style={styles.reviewOptionButton}
                    onPress={() => handleSelectReviewTarget('hospital')}
                  >
                    <View style={[styles.reviewOptionIcon, { backgroundColor: '#ecfeff' }]}>
                      <Ionicons name="business-outline" size={20} color="#0f766e" />
                    </View>
                    <View style={styles.reviewOptionTextWrapper}>
                      <Text style={styles.reviewOptionTitle}>Đánh giá chi nhánh</Text>
                      <Text style={styles.reviewOptionSubtitle}>
                        {appointment.hospitalId.name || 'Chi nhánh'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
      {cancelModalVisible && appointment && (
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
                  {appointment.bookingCode ? (
                    <View style={styles.cancelModalInfoRow}>
                      <Ionicons name="pricetag-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                      <Text style={styles.cancelModalInfoValue}>
                        Mã đặt lịch: <Text style={{ fontWeight: '700' }}>{appointment.bookingCode}</Text>
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.cancelModalInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={IconColors.primary} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={styles.cancelModalInfoLabel}>Ngày hẹn</Text>
                      <Text style={styles.cancelModalInfoValue}>{formatDate(appointment.appointmentDate)}</Text>
                    </View>
                  </View>
                  {appointment.timeSlot ? (
                    <View style={styles.cancelModalInfoRow}>
                      <Ionicons name="time-outline" size={18} color={IconColors.primary} style={{ marginRight: 8 }} />
                      <View>
                        <Text style={styles.cancelModalInfoLabel}>Giờ hẹn</Text>
                        <Text style={styles.cancelModalInfoValue}>
                          {formatHourRange(appointment.timeSlot.startTime, appointment.timeSlot.endTime)}
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
    backgroundColor: '#f0f4f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bookingCodeText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  appointmentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 4,
  },
  queueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  dateTimeContainer: {
    marginBottom: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dateTimeText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonBlue: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  actionButtonRed: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  actionButtonYellow: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  actionButtonPurple: {
    backgroundColor: '#ede9fe',
    borderColor: '#8b5cf6',
  },
  actionButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  actionButtonTextDisabled: {
    color: '#9ca3af',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
    minWidth: '48%',
  },
  medicalInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  medicalInfoColumn: {
    flex: 1,
    minWidth: '48%',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionHeaderBlue: {
    backgroundColor: IconColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitleWhite: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: 0,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  infoValueMultiline: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 20,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  sectionHeaderPurple: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionHeaderGreen: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  hospitalizationDateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  hospitalizationDateItem: {
    flex: 1,
  },
  roomHistoryContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  roomHistoryItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roomHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  roomHistoryMeta: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 2,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: 0,
  },
  paymentFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentFeeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentFeeLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  paymentFeeAmount: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  paymentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentTotalLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  paymentTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: IconColors.primary,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentStatusLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 4,
  },
  paymentStatusBadgePaid: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  paymentStatusBadgePartial: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  paymentStatusTextPaid: {
    color: '#10b981',
  },
  paymentStatusTextPartial: {
    color: '#f59e0b',
  },
  paymentPartialInfo: {
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  paymentPartialLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  paymentMethodValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  paymentActionsRow: {
    marginTop: 16,
    gap: 12,
  },
  paymentGroup: {
    paddingVertical: 12,
  },
  paymentGroupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  paymentGroupStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  paymentGroupStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  paymentGroupAmountRow: {
    marginBottom: 4,
  },
  paymentGroupAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  paymentGroupMetaText: {
    marginTop: 2,
    fontSize: 12,
    color: '#4b5563',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethodButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
  },
  paymentMethodButtonSelectedMomo: {
    backgroundColor: '#ea4c89',
  },
  paymentMethodButtonSelectedPaypal: {
    backgroundColor: '#2563eb',
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
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMainButtonBlue: {
    backgroundColor: '#2563eb',
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
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  badgeSecondary: {
    backgroundColor: '#ede9fe',
  },
  badgeSecondaryText: {
    color: '#6d28d9',
  },
  prescriptionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  prescriptionStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  prescriptionStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  prescriptionMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  medicationItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 10,
  },
  medicationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  medicationDetail: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 2,
  },
  medicationNote: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  prescriptionFooter: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  prescriptionFooterText: {
    fontSize: 12,
    color: '#6b7280',
  },
  prescriptionAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  prescriptionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    marginLeft: 4,
  },
  prescriptionPaymentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  prescriptionPaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  prescriptionPaidText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reviewModalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  reviewModalCloseButton: {
    padding: 4,
  },
  reviewModalDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 16,
    lineHeight: 20,
  },
  reviewModalOptions: {
    gap: 12,
  },
  reviewOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  reviewOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewOptionTextWrapper: {
    flex: 1,
  },
  reviewOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  reviewOptionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
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
