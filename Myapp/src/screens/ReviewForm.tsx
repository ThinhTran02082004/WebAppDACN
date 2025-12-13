import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiService } from '../services/api';
import { IconColors } from '../config/icons';

type ReviewTargetType = 'doctor' | 'hospital';

interface ReviewFormScreenProps {
  route: {
    params: {
      appointmentId: string;
      targetType: ReviewTargetType;
      appointment?: AppointmentSummary | null;
    };
  };
  navigation: any;
}

interface AppointmentSummary {
  _id: string;
  doctorId?:
    | {
        _id: string;
        title?: string;
        name?: string;
        specialty?: { name?: string };
        specialtyId?: { name?: string };
        user?: { fullName?: string; avatarUrl?: string; avatar?: string };
      }
    | string;
  hospitalId?:
    | {
        _id: string;
        name?: string;
        imageUrl?: string;
        image?: { secureUrl?: string };
        logo?: string;
      }
    | string;
  doctorName?: string;
  hospitalName?: string;
  specialtyName?: string;
}

const ratingLabels: Record<number, string> = {
  1: 'Rất tệ',
  2: 'Tệ',
  3: 'Bình thường',
  4: 'Tốt',
  5: 'Rất tốt',
};

export default function ReviewFormScreen({ route, navigation }: ReviewFormScreenProps) {
  const insets = useSafeAreaInsets();
  const { appointmentId, targetType, appointment: initialAppointment } = route.params || {};

  const [appointment, setAppointment] = useState<AppointmentSummary | null>(initialAppointment || null);
  const [loading, setLoading] = useState(!initialAppointment);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setLoading(true);
      const res = await apiService.getAppointmentById(appointmentId);
      if (res?.success && res?.data) {
        setAppointment(res.data);
        setError(null);
      } else {
        setError('Không thể tải thông tin lịch hẹn. Vui lòng thử lại sau.');
      }
    } catch (err: any) {
      console.error('[ReviewForm] Failed to fetch appointment:', err);
      setError(err?.response?.data?.message || 'Không thể tải thông tin lịch hẹn. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (!appointment) {
      fetchAppointment();
    }
  }, [appointment, fetchAppointment]);

  const doctorInfo = useMemo(() => {
    if (!appointment) return null;
    if (appointment.doctorId && typeof appointment.doctorId === 'object') {
      const doctor = appointment.doctorId;
      return {
        id: doctor._id,
        name: doctor.user?.fullName || doctor.name || appointment.doctorName || 'Bác sĩ',
        avatar: doctor.user?.avatarUrl || doctor.user?.avatar || null,
        specialty: doctor.specialty?.name || doctor.specialtyId?.name || appointment.specialtyName || '',
        title: doctor.title || '',
      };
    }
    if (appointment.doctorName) {
      return {
        id: typeof appointment.doctorId === 'string' ? appointment.doctorId : '',
        name: appointment.doctorName,
        avatar: null,
        specialty: appointment.specialtyName || '',
        title: '',
      };
    }
    return null;
  }, [appointment]);

  const hospitalInfo = useMemo(() => {
    if (!appointment) return null;
    if (appointment.hospitalId && typeof appointment.hospitalId === 'object') {
      const hospital = appointment.hospitalId;
      return {
        id: hospital._id || '',
        name: hospital.name || appointment.hospitalName || 'Chi nhánh',
        logo: hospital.imageUrl || hospital.image?.secureUrl || hospital.logo || null,
      };
    }
    if (appointment.hospitalName) {
      return {
        id: typeof appointment.hospitalId === 'string' ? appointment.hospitalId : '',
        name: appointment.hospitalName,
        logo: null,
      };
    }
    return null;
  }, [appointment]);

  const targetInfo = targetType === 'doctor' ? doctorInfo : hospitalInfo;

  const validateForm = () => {
    if (!appointment) {
      Alert.alert('Thông báo', 'Không tìm thấy thông tin lịch hẹn.');
      return false;
    }
    if (!targetInfo?.id) {
      Alert.alert('Thông báo', `Không tìm thấy thông tin ${targetType === 'doctor' ? 'bác sĩ' : 'chi nhánh'} để đánh giá.`);
      return false;
    }
    if (!content.trim() || content.trim().length < 3) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung đánh giá (tối thiểu 3 ký tự).');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const payload: any = {
        appointmentId,
        rating,
        content: content.trim(),
      };
      let response;
      if (targetType === 'doctor') {
        payload.doctorId = targetInfo?.id;
        response = await apiService.createDoctorReview(payload);
      } else {
        payload.hospitalId = targetInfo?.id;
        response = await apiService.createHospitalReview(payload);
      }
      if (response?.success) {
        Alert.alert('Thành công', `Đã gửi đánh giá ${targetType === 'doctor' ? 'bác sĩ' : 'chi nhánh'} thành công.`, [
          {
            text: 'OK',
            onPress: () => {
              navigation.goBack();
            },
          },
        ]);
      } else {
        Alert.alert('Lỗi', response?.message || 'Không thể gửi đánh giá. Vui lòng thử lại sau.');
      }
    } catch (err: any) {
      console.error('[ReviewForm] Failed to submit review:', err);
      const message = err?.response?.data?.message || err?.message || 'Không thể gửi đánh giá. Vui lòng thử lại sau.';
      Alert.alert('Lỗi', message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <TouchableOpacity key={value} onPress={() => setRating(value)} style={styles.starButton}>
            <Ionicons
              name={value <= rating ? 'star' : 'star-outline'}
              size={32}
              color={value <= rating ? '#fbbf24' : '#d1d5db'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTargetAvatar = () => {
    if (!targetInfo) {
      return (
        <View style={[styles.avatarPlaceholder, { backgroundColor: targetType === 'doctor' ? '#dbeafe' : '#d1fae5' }]}>
          <Ionicons
            name={targetType === 'doctor' ? 'person-outline' : 'business-outline'}
            size={32}
            color={targetType === 'doctor' ? '#1d4ed8' : '#047857'}
          />
        </View>
      );
    }
    if (targetType === 'doctor') {
      const avatar = (targetInfo as any).avatar || null;
      const source = avatar ? { uri: avatar } : null;
      return source ? (
        <Image source={source} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: '#dbeafe' }]}>
          <Ionicons name="person-outline" size={32} color="#1d4ed8" />
        </View>
      );
    }
    const source = (targetInfo as any).logo ? { uri: (targetInfo as any).logo } : null;
    return source ? (
      <Image source={source} style={styles.avatarImage} />
    ) : (
      <View style={[styles.avatarPlaceholder, { backgroundColor: '#d1fae5' }]}>
        <Ionicons name="business-outline" size={32} color="#047857" />
      </View>
    );
  };

  const contentInset = { top: insets.top + 16, bottom: insets.bottom + 16 };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đánh giá lịch khám</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={IconColors.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text style={styles.errorTitle}>Đã xảy ra lỗi</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAppointment}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} contentInset={contentInset}>
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {targetType === 'doctor' ? 'Đánh giá bác sĩ' : 'Đánh giá chi nhánh'}
              </Text>
              <Text style={styles.sectionSubtitle}>Chia sẻ trải nghiệm của bạn</Text>
            </View>

            <View style={styles.targetSection}>
              <View style={[styles.avatarWrapper, targetType === 'doctor' ? styles.avatarBorderDoctor : styles.avatarBorderHospital]}>
                {renderTargetAvatar()}
              </View>
              <Text style={[styles.targetName, targetType === 'doctor' ? styles.textDoctor : styles.textHospital]}>
                {targetInfo?.name || (targetType === 'doctor' ? 'Bác sĩ' : 'Chi nhánh')}
              </Text>
              {targetType === 'doctor' && doctorInfo?.specialty ? (
                <View style={styles.targetMetaRow}>
                  <Ionicons name="medal-outline" size={16} color="#2563eb" />
                  <Text style={styles.targetMetaText}>{doctorInfo.specialty}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Đánh giá của bạn</Text>
              {renderStars()}
              <Text style={styles.ratingLabel}>{ratingLabels[rating]}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Nhận xét</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Chia sẻ trải nghiệm của bạn (tối thiểu 3 ký tự)"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={5}
                value={content}
                onChangeText={setContent}
                maxLength={500}
              />
              <Text style={styles.charCounter}>{content.length}/500 ký tự</Text>
            </View>

            <View style={styles.footerActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()} disabled={submitting}>
                <Ionicons name="arrow-back" size={18} color="#374151" />
                <Text style={styles.secondaryButtonText}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, targetType === 'doctor' ? styles.primaryDoctor : styles.primaryHospital, submitting && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Gửi đánh giá</Text>
                    <Ionicons name="paper-plane-outline" size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  targetSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 999,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarBorderDoctor: {
    borderColor: '#bfdbfe',
  },
  avatarBorderHospital: {
    borderColor: '#bbf7d0',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 999,
  },
  targetName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  textDoctor: {
    color: '#1d4ed8',
  },
  textHospital: {
    color: '#047857',
  },
  targetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  targetMetaText: {
    fontSize: 13,
    color: '#4b5563',
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#f59e0b',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    color: '#111827',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCounter: {
    textAlign: 'right',
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#374151',
    fontWeight: '600',
    marginLeft: 6,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryDoctor: {
    backgroundColor: '#2563eb',
  },
  primaryHospital: {
    backgroundColor: '#0f766e',
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#4b5563',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    color: '#b91c1c',
  },
  errorText: {
    color: '#4b5563',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: IconColors.primary,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});


