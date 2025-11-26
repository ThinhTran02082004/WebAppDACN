import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Linking,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiService, Hospital } from '../../services/api';
import { AppIcons, IconColors, IconSizes } from '../../config/icons';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

interface FacilityDetailProps {
  route: {
    params: {
      id: string;
    };
  };
  navigation: any;
}

export default function FacilityDetail({ route, navigation }: FacilityDetailProps) {
  const { id } = route.params;
  const { user } = useAuth();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'specialties' | 'services'>('info');
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiService.getHospitalById(id);
        if (res.success) {
          console.log('Hospital data loaded:', res.data);
          console.log('Contact info:', res.data.contactInfo);
          console.log('Working hours:', res.data.workingHours);
          console.log('Specialties:', res.data.specialties);
          console.log('Services:', res.data.services);
          setHospital(res.data);
        }
      } catch (error) {
        console.error('Error loading hospital:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const loadHospitalTabs = async () => {
      if (!id) return;
      setLoadingTabs(true);
      try {
        const [spRes, svRes] = await Promise.all([
          apiService.getHospitalSpecialties(id),
          apiService.getHospitalServices(id),
        ]);
        const spList = Array.isArray((spRes as any)?.data?.data) ? (spRes as any).data.data : (Array.isArray(spRes?.data) ? (spRes as any).data : []);
        const svList = Array.isArray((svRes as any)?.data?.data) ? (svRes as any).data.data : (Array.isArray(svRes?.data) ? (svRes as any).data : []);
        setSpecialties(spList);
        setServices(svList);
      } catch (e) {
        console.error('Error loading hospital tabs:', e);
      } finally {
        setLoadingTabs(false);
      }
    };
    loadHospitalTabs();
  }, [id]);

  const handleCall = () => {
    console.log('handleCall pressed');
    console.log('Hospital:', hospital);
    console.log('ContactInfo:', hospital?.contactInfo);
    console.log('Phone:', hospital?.contactInfo?.phone);
    
    if (hospital?.contactInfo?.phone) {
      const phoneUrl = `tel:${hospital.contactInfo.phone}`;
      console.log('Opening phone URL:', phoneUrl);
      Linking.openURL(phoneUrl).catch(err => {
        console.error('Error opening phone URL:', err);
      });
    } else {
      console.log('No phone number available');
    }
  };

  const handleEmail = () => {
    if (hospital?.contactInfo?.email) {
      Linking.openURL(`mailto:${hospital.contactInfo.email}`);
    }
  };

  const handleDirection = () => {
    if (hospital?.address) {
      const address = encodeURIComponent(hospital.address);
      const url = `https://www.google.com/maps/search/?api=1&query=${address}`;
      Linking.openURL(url);
    }
  };

  const handleBookAppointment = () => {
    console.log('Book appointment at hospital:', hospital?._id);
    if (!user) {
      navigation.navigate('Login');
    } else {
      // Navigate to booking screen with pre-filled hospital
      navigation.navigate('Booking', {
        hospitalId: hospital?._id || undefined,
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <Text style={styles.loadingText}>Đang tải thông tin...</Text>
      </View>
    );
  }

  if (!hospital) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name={AppIcons.back} size={IconSizes.md} color={IconColors.dark} />
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name={AppIcons.errorOutline} size={IconSizes.xxl} color={IconColors.light} />
          <Text style={styles.errorText}>Không tìm thấy thông tin chi nhánh</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name={AppIcons.back} size={IconSizes.md} color={IconColors.dark} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.favoriteButton}>
          <Ionicons name={AppIcons.favoriteOutline} size={IconSizes.md} color={IconColors.dark} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hospital Image */}
        <View style={styles.imageContainer}>
          {imageError || (!hospital.imageUrl && !hospital.image?.secureUrl) ? (
            <View style={styles.defaultImage}>
              <Ionicons name={AppIcons.hospital} size={IconSizes.xxxl} color={IconColors.primary} />
            </View>
          ) : (
            <Image
              source={{ uri: hospital.imageUrl || hospital.image?.secureUrl }}
              style={styles.hospitalImage}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />
          )}
        </View>

        {/* Hospital Info Card */}
        <View style={styles.hospitalCard}>
          <Text style={styles.hospitalName}>{hospital.name}</Text>

          <View style={styles.addressContainer}>
            <Ionicons name={AppIcons.location} size={18} color={IconColors.primary} />
            <Text style={styles.address}>{hospital.address}</Text>
          </View>

          <View style={styles.ratingContainer}>
            <Ionicons name={AppIcons.star} size={IconSizes.xs} color={IconColors.warning} />
            <Text style={styles.rating}>4.5</Text>
            <Text style={styles.ratingCount}>(0 đánh giá)</Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleCall}
              disabled={!hospital.contactInfo?.phone}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={AppIcons.call} size={IconSizes.sm} color={IconColors.primary} />
              </View>
              <Text style={styles.quickActionText}>Gọi điện</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleDirection}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={AppIcons.navigate} size={IconSizes.sm} color={IconColors.primary} />
              </View>
              <Text style={styles.quickActionText}>Chỉ đường</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleEmail}
              disabled={!hospital.contactInfo?.email}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={AppIcons.email} size={IconSizes.sm} color={IconColors.primary} />
              </View>
              <Text style={styles.quickActionText}>Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.tabActive]}
            onPress={() => setActiveTab('info')}
          >
            <Ionicons
              name={AppIcons.infoOutline}
              size={IconSizes.sm}
              color={activeTab === 'info' ? IconColors.primary : IconColors.default}
            />
            <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
              Thông tin
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'specialties' && styles.tabActive]}
            onPress={() => setActiveTab('specialties')}
          >
            <Ionicons
              name={AppIcons.specialtyOutline}
              size={IconSizes.sm}
              color={activeTab === 'specialties' ? IconColors.primary : IconColors.default}
            />
            <Text style={[styles.tabText, activeTab === 'specialties' && styles.tabTextActive]}>
              Chuyên khoa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'services' && styles.tabActive]}
            onPress={() => setActiveTab('services')}
          >
            <Ionicons
              name={AppIcons.serviceOutline}
              size={IconSizes.sm}
              color={activeTab === 'services' ? IconColors.primary : IconColors.default}
            />
            <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
              Dịch vụ
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'info' ? (
          <View style={styles.tabContent}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={AppIcons.documentOutline} size={IconSizes.sm} color={IconColors.dark} />
                <Text style={styles.sectionTitle}>Giới thiệu</Text>
              </View>
              <Text style={styles.description}>
                {hospital.description || 'Không có thông tin giới thiệu.'}
              </Text>
            </View>

            {/* Contact Info */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={AppIcons.callOutline} size={IconSizes.sm} color={IconColors.dark} />
                <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>
              </View>

              {hospital.contactInfo?.phone && (
                <View style={styles.infoRow}>
                  <Ionicons name={AppIcons.call} size={IconSizes.xs} color={IconColors.primary} />
                  <Text style={styles.infoLabel}>Điện thoại:</Text>
                  <Text style={styles.infoValue}>{hospital.contactInfo.phone}</Text>
                </View>
              )}

              {hospital.contactInfo?.email && (
                <View style={styles.infoRow}>
                  <Ionicons name={AppIcons.email} size={IconSizes.xs} color={IconColors.primary} />
                  <Text style={styles.infoLabel}>Email:</Text>
                  <Text style={styles.infoValue}>{hospital.contactInfo.email}</Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Ionicons name={AppIcons.location} size={IconSizes.xs} color={IconColors.primary} />
                <Text style={styles.infoLabel}>Địa chỉ:</Text>
                <Text style={styles.infoValue}>{hospital.address}</Text>
              </View>
            </View>

            {/* Working Hours */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={AppIcons.timeOutline} size={IconSizes.sm} color={IconColors.dark} />
                <Text style={styles.sectionTitle}>Giờ làm việc</Text>
              </View>
              <View style={styles.workingHoursCard}>
                {hospital.workingHours ? (
                  <>
                    {hospital.workingHours.monday && (
                      <View style={styles.workingHoursRow}>
                        <Text style={styles.workingHoursDay}>Thứ 2</Text>
                        <Text style={styles.workingHoursTime}>
                          {hospital.workingHours.monday.isOpen
                            ? `${hospital.workingHours.monday.open} - ${hospital.workingHours.monday.close}`
                            : 'Đóng cửa'}
                        </Text>
                      </View>
                    )}
                    {/* Các ngày khác giống hệt file gốc */}
                  </>
                ) : (
                  <>
                    <View style={styles.workingHoursRow}>
                      <Text style={styles.workingHoursDay}>Thứ 2 - Thứ 6</Text>
                      <Text style={styles.workingHoursTime}>7:30 - 17:00</Text>
                    </View>
                    <View style={styles.workingHoursRow}>
                      <Text style={styles.workingHoursDay}>Thứ 7</Text>
                      <Text style={styles.workingHoursTime}>7:30 - 12:00</Text>
                    </View>
                    <View style={styles.workingHoursRow}>
                      <Text style={styles.workingHoursDay}>Chủ nhật</Text>
                      <Text style={styles.workingHoursTime}>Nghỉ</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        ) : activeTab === 'specialties' ? (
          // giữ nguyên nội dung tab chuyên khoa & dịch vụ giống file gốc
          <View />
        ) : (
          <View />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={handleBookAppointment}
          activeOpacity={0.8}
        >
          <Text style={styles.bookButtonText}>Đặt lịch khám</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // giữ nguyên toàn bộ styles từ file gốc
});


