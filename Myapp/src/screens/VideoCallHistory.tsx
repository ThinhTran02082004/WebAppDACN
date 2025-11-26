import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, RefreshControl, Modal } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../services/api';
import { IconColors } from '../config/icons';
import { useAuth } from '../contexts/AuthContext';

type VideoCallEntry = {
  id: string;
  roomId: string;
  roomName?: string;
  appointmentId?: string;
  appointment?: any;
  appointmentCode?: string;
  doctorName?: string;
  doctorEmail?: string;
  doctorPhone?: string;
  patientName?: string;
  startTime: string;
  endTime?: string;
  duration?: number; // in seconds
  status: 'completed' | 'ended' | 'missed' | 'cancelled';
  createdAt: string;
  participants?: Array<{
    name: string;
    role: string;
    joinedAt?: string;
    leftAt?: string;
  }>;
};

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export default function VideoCallHistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calls, setCalls] = useState<VideoCallEntry[]>([]);
  const [selectedCall, setSelectedCall] = useState<VideoCallEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const resp = await apiService.getVideoCallHistory({ page: 1, limit: 50 });
      const payload: any = resp?.data || resp;
      const rawList = (payload?.data ?? payload?.records ?? payload) as any[];
      
      // If appointments are not populated, fetch them
      const itemsWithAppointments = await Promise.all(
        (Array.isArray(rawList) ? rawList : []).map(async (item) => {
          // If appointment is just an ID string, fetch the full appointment
          if (typeof item?.appointmentId === 'string' && !item?.appointment) {
            try {
              const appointmentResp = await apiService.getAppointmentById(item.appointmentId);
              const appointmentData = appointmentResp?.data || appointmentResp;
              return {
                ...item,
                appointment: appointmentData,
              };
            } catch (e) {
              console.log('Error fetching appointment:', e);
              return item;
            }
          }
          return item;
        })
      );
      
      const entries: VideoCallEntry[] = itemsWithAppointments.map((item, index) => {
        // Debug: Log first item to see structure
        if (index === 0) {
          console.log('[VideoCallHistory] First item structure:', JSON.stringify(item, null, 2).substring(0, 500));
        }
        
        const startTime = item?.startTime || item?.createdAt || item?.startedAt || '';
        const endTime = item?.endTime || item?.endedAt || '';
        
        // Calculate duration if both start and end times are available
        let duration: number | undefined;
        if (startTime && endTime) {
          try {
            const start = new Date(startTime).getTime();
            const end = new Date(endTime).getTime();
            if (!isNaN(start) && !isNaN(end) && end > start) {
              duration = Math.floor((end - start) / 1000); // Convert to seconds
            }
          } catch (e) {
            console.log('Error calculating duration:', e);
          }
        }
        
        // Get appointment info - handle both object and string ID cases
        const appointment = (typeof item?.appointment === 'object' && item?.appointment !== null) 
          ? item.appointment 
          : (typeof item?.appointmentId === 'object' && item?.appointmentId !== null)
          ? item.appointmentId
          : {};
        
        // Get doctor info from multiple possible sources
        const doctorName = 
          // From populated appointment
          appointment?.doctorId?.user?.fullName ||
          appointment?.doctorId?.fullName ||
          // From item directly (if populated)
          item?.doctorId?.user?.fullName ||
          item?.doctorId?.fullName ||
          item?.doctor?.user?.fullName ||
          item?.doctor?.fullName ||
          // From room if populated
          item?.room?.doctorId?.user?.fullName ||
          item?.room?.doctorId?.fullName ||
          item?.room?.doctor?.user?.fullName ||
          item?.room?.doctor?.fullName ||
          // Direct fields
          item?.doctorName ||
          'Bác sĩ';
        
        const doctorEmail = 
          appointment?.doctorId?.user?.email ||
          item?.doctorId?.user?.email ||
          item?.doctor?.user?.email ||
          item?.room?.doctorId?.user?.email ||
          item?.room?.doctor?.user?.email ||
          '';
        
        const doctorPhone = 
          appointment?.doctorId?.user?.phoneNumber ||
          item?.doctorId?.user?.phoneNumber ||
          item?.doctor?.user?.phoneNumber ||
          item?.room?.doctorId?.user?.phoneNumber ||
          item?.room?.doctor?.user?.phoneNumber ||
          '';
        
        // Get participants
        const participants = item?.participants || item?.members || [];
        
        const patientName = 
          appointment?.patientId?.user?.fullName ||
          appointment?.patientId?.fullName ||
          item?.patientId?.user?.fullName ||
          item?.patientId?.fullName ||
          item?.patient?.user?.fullName ||
          item?.patient?.fullName ||
          item?.patientName ||
          user?.fullName ||
          'Bệnh nhân';
        
        // Get appointment code
        const appointmentCode = 
          appointment?.bookingCode || 
          item?.appointmentCode ||
          (appointment?._id ? `#${appointment._id.substring(0, 8).toUpperCase()}` : undefined) ||
          (typeof item?.appointmentId === 'string' ? `#${item.appointmentId.substring(0, 8).toUpperCase()}` : undefined);

        // Always set status to 'ended' (Đã kết thúc)
        const status: VideoCallEntry['status'] = 'ended';

        const uniqueId = item?._id || item?.id || `call-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;


        return {
          id: String(uniqueId),
          roomId: item?.roomId || item?.room?._id || '',
          appointment: typeof appointment === 'object' ? appointment : undefined,
          appointmentCode,
          doctorName,
          doctorEmail,
          doctorPhone,
          patientName,
          startTime,
          endTime,
          duration,
          status,
          createdAt: item?.createdAt || startTime || '',
          participants: Array.isArray(participants) ? participants.map((p: any) => ({
            name: p?.user?.fullName || p?.name || p?.userId?.fullName || '',
            role: p?.role || 'patient',
            joinedAt: p?.joinedAt || p?.joined || startTime,
            leftAt: p?.leftAt || p?.left || endTime,
          })) : [],
        } as VideoCallEntry;
      });

      // Sort by start time (most recent first)
      entries.sort((a, b) => {
        const timeA = new Date(a.startTime || a.createdAt || 0).getTime();
        const timeB = new Date(b.startTime || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      
      setCalls(entries);
    } catch (e: any) {
      console.error('Error loading video call history:', e);
      setCalls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadCalls();
      } else {
        setLoading(false);
        setCalls([]);
      }
    }, [user])
  );

  const onRefresh = () => {
    if (user) {
      setRefreshing(true);
      loadCalls();
    }
  };

  const getStatusColor = (status: VideoCallEntry['status']) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'ended':
        return '#10b981';
      case 'missed':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const formatStatusLabel = (status: VideoCallEntry['status']) => {
    switch (status) {
      case 'completed':
        return 'Đã hoàn thành';
      case 'ended':
        return 'Đã kết thúc';
      case 'missed':
        return 'Nhỡ cuộc gọi';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return 'Không xác định';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '—';
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      return '—';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (navigation as any)?.goBack?.()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử Videocall</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IconColors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {(!calls || calls.length === 0) && !loading ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="videocam-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Chưa có cuộc gọi</Text>
            <Text style={styles.emptyDesc}>Bạn chưa có cuộc gọi video nào được ghi nhận</Text>
          </View>
        ) : (
          calls.map((call) => {
            const statusColor = getStatusColor(call.status);
            return (
              <TouchableOpacity
                key={call.id}
                style={styles.callItem}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedCall(call);
                  setModalVisible(true);
                }}
              >
                <View style={styles.callHeader}>
                  <View style={styles.callIconContainer}>
                    <Ionicons name="videocam" size={24} color={IconColors.primary} />
                  </View>
                  <View style={styles.callInfo}>
                    <Text style={styles.callTitle} numberOfLines={1}>
                      {call.doctorName || 'Bác sĩ'}
                    </Text>
                    {call.roomName && !call.roomName.startsWith('appointment_') && (
                      <Text style={styles.callSubtitle} numberOfLines={1}>
                        {call.roomName}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {formatStatusLabel(call.status)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.callMeta}>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                    <Text style={styles.metaText}>
                      {formatDateTime(call.startTime)}
                    </Text>
                  </View>
                  {call.duration && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={14} color="#6b7280" />
                      <Text style={styles.metaText}>
                        Thời lượng: {formatDuration(call.duration)}
                      </Text>
                    </View>
                  )}
                  {call.appointmentCode && (
                    <View style={styles.metaRow}>
                      <Ionicons name="document-text-outline" size={14} color="#6b7280" />
                      <Text style={styles.metaText}>
                        Mã lịch hẹn: {call.appointmentCode}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Call Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết cuộc gọi</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedCall && (
              <ScrollView 
                style={styles.modalScroll} 
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Thông tin phòng */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Thông tin phòng</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tên phòng</Text>
                    <Text style={styles.detailValue}>
                      {selectedCall.appointmentCode ? `Mã lịch hẹn: ${selectedCall.appointmentCode}` : '—'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Trạng thái</Text>
                    <View style={[styles.statusBadgeInline, { backgroundColor: `${getStatusColor(selectedCall.status)}15` }]}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedCall.status) }]} />
                      <Text style={[styles.statusTextInline, { color: getStatusColor(selectedCall.status) }]}>
                        {formatStatusLabel(selectedCall.status)}
                      </Text>
                    </View>
                  </View>
                  {selectedCall.appointmentCode && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Mã lịch hẹn</Text>
                      <Text style={styles.detailValue}>{selectedCall.appointmentCode}</Text>
                    </View>
                  )}
                </View>

                {/* Thông tin bác sĩ */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Thông tin bác sĩ</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tên</Text>
                    <Text style={styles.detailValue}>{selectedCall.doctorName || '—'}</Text>
                  </View>
                  {selectedCall.doctorEmail && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Email</Text>
                      <Text style={styles.detailValue}>{selectedCall.doctorEmail}</Text>
                    </View>
                  )}
                  {selectedCall.doctorPhone && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Số điện thoại</Text>
                      <Text style={styles.detailValue}>{selectedCall.doctorPhone}</Text>
                    </View>
                  )}
                </View>

                {/* Thời gian */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Thời gian</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Bắt đầu</Text>
                    <Text style={styles.detailValue}>{formatTime(selectedCall.startTime)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Kết thúc</Text>
                    <Text style={styles.detailValue}>{selectedCall.endTime ? formatTime(selectedCall.endTime) : '—'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Thời lượng</Text>
                    <Text style={styles.detailValue}>
                      {selectedCall.duration ? formatDuration(selectedCall.duration) : 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Danh sách tham gia */}
                {selectedCall.participants && selectedCall.participants.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>
                      Danh sách tham gia ({selectedCall.participants.length})
                    </Text>
                    {selectedCall.participants.map((participant, idx) => (
                      <View key={idx} style={styles.participantItem}>
                        <View style={styles.participantHeader}>
                          <Text style={styles.participantName}>{participant.name || '—'}</Text>
                          <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>
                              {participant.role === 'doctor' ? 'Bác sĩ' : participant.role === 'patient' ? 'Bệnh nhân' : participant.role}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.participantMeta}>
                          <View style={styles.participantMetaRow}>
                            <Text style={styles.participantMetaLabel}>Tham gia</Text>
                            <Text style={styles.participantMetaValue}>
                              {participant.joinedAt ? formatTime(participant.joinedAt) : '—'}
                            </Text>
                          </View>
                          <View style={styles.participantMetaRow}>
                            <Text style={styles.participantMetaLabel}>Rời đi</Text>
                            <Text style={styles.participantMetaValue}>
                              {participant.leftAt ? formatTime(participant.leftAt) : '—'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* Footer Button */}
            {selectedCall?.appointmentId && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.viewAppointmentButton}
                  onPress={() => {
                    setModalVisible(false);
                    (navigation as any)?.navigate?.('AppointmentDetail', {
                      appointmentId: selectedCall.appointmentId,
                      appointment: selectedCall.appointment,
                    });
                  }}
                >
                  <Ionicons name="document-text" size={20} color="#fff" />
                  <Text style={styles.viewAppointmentButtonText}>Xem Lịch hẹn</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  callItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  callIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
    marginRight: 8,
  },
  callTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  callSubtitle: {
    fontSize: 13,
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
    fontSize: 11,
    fontWeight: '600',
  },
  callMeta: {
    flexDirection: 'column',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 2,
  },
  modalScroll: {
    maxHeight: 500,
  },
  detailSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  statusBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTextInline: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  participantItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  roleBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  participantMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  participantMetaRow: {
    flex: 1,
  },
  participantMetaLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  participantMetaValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '500',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  viewAppointmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    gap:6,
  },
  viewAppointmentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

