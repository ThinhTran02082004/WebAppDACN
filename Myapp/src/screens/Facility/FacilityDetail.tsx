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
import { apiService, Hospital, ServiceItem, Specialty } from '../../services/api';
import { AppIcons, IconColors, IconSizes } from '../../config/icons';
import { useAuth } from '../../contexts/AuthContext';
import { SpecialtyCard } from '../../components/SpecialtyCard';
import ServiceCard from '../../components/ServiceCard';

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
          setHospital(res.data);
        }
      } catch (error) {
        // Error loading hospital
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
        // Error loading hospital tabs
      } finally {
        setLoadingTabs(false);
      }
    };
    loadHospitalTabs();
  }, [id]);

  const handleCall = () => {
    if (hospital?.contactInfo?.phone) {
      const phoneUrl = `tel:${hospital.contactInfo.phone}`;
      Linking.openURL(phoneUrl).catch(err => {
        // Error opening phone URL
      });
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
                    {hospital.workingHours.tuesday && (
                      <View style={styles.workingHoursRow}>
                        <Text style={styles.workingHoursDay}>Thứ 3</Text>
                        <Text style={styles.workingHoursTime}>
                          {hospital.workingHours.tuesday.isOpen
                            ? `${hospital.workingHours.tuesday.open} - ${hospital.workingHours.tuesday.close}`
                            : 'Đóng cửa'}
                        </Text>
                      </View>
                    )}
                    {hospital.workingHours.wednesday && (
                      <View style={styles.workingHoursRow}>
                        <Text style={styles.workingHoursDay}>Thứ 4</Text>
                        <Text style={styles.workingHoursTime}>
                          {hospital.workingHours.wednesday.isOpen
                            ? `${hospital.workingHours.wednesday.open} - ${hospital.workingHours.wednesday.close}`
                            : 'Đóng cửa'}
                        </Text>
                      </View>
                    )}
                    {hospital.workingHours.thursday && (
                      <View style={styles.workingHoursRow}>
                        <Text style={styles.workingHoursDay}>Thứ 5</Text>
                        <Text style={styles.workingHoursTime}>
                          {hospital.workingHours.thursday.isOpen
                            ? `${hospital.workingHours.thursday.open} - ${hospital.workingHours.thursday.close}`
                            : 'Đóng cửa'}
                        </Text>
                      </View>
                    )}
                    {hospital.workingHours.friday && (
                      <View style={styles.workingHoursRow}>
                        <Text style={styles.workingHoursDay}>Thứ 6</Text>
                        <Text style={styles.workingHoursTime}>
                          {hospital.workingHours.friday.isOpen
                            ? `${hospital.workingHours.friday.open} - ${hospital.workingHours.friday.close}`
                            : 'Đóng cửa'}
                        </Text>
                      </View>
                    )}
                    {hospital.workingHours.saturday && (
                      <View style={styles.workingHoursRow}>
                        <Text style={styles.workingHoursDay}>Thứ 7</Text>
                        <Text style={styles.workingHoursTime}>
                          {hospital.workingHours.saturday.isOpen
                            ? `${hospital.workingHours.saturday.open} - ${hospital.workingHours.saturday.close}`
                            : 'Đóng cửa'}
                        </Text>
                      </View>
                    )}
                    {hospital.workingHours.sunday && (
                      <View style={styles.workingHoursRow}>
                        <Text style={styles.workingHoursDay}>Chủ nhật</Text>
                        <Text style={styles.workingHoursTime}>
                          {hospital.workingHours.sunday.isOpen
                            ? `${hospital.workingHours.sunday.open} - ${hospital.workingHours.sunday.close}`
                            : 'Đóng cửa'}
                        </Text>
                      </View>
                    )}
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
          <View style={styles.tabContent}>
            {loadingTabs ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={IconColors.primary} />
                <Text style={styles.loadingText}>Đang tải chuyên khoa...</Text>
              </View>
            ) : specialties.length > 0 ? (
              <View style={styles.listContainer}>
                {specialties.map((specialty: Specialty, index: number) => (
                  <View key={specialty._id} style={[styles.listItem, index % 2 === 0 && styles.listItemLeft]}>
                    <SpecialtyCard
                      specialty={specialty}
                      onPress={(sp) => navigation.navigate('SpecialtyDetail', { specialtyId: sp._id })}
                      onBookingPress={(sp) => {
                        if (!user) {
                          navigation.navigate('Login');
                        } else {
                          navigation.navigate('Booking', {
                            specialtyId: sp._id,
                            hospitalId: id,
                          });
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name={AppIcons.specialtyOutline} size={IconSizes.xxl} color={IconColors.light} />
                <Text style={styles.emptyText}>Chưa có chuyên khoa</Text>
                <Text style={styles.emptySubtext}>Vui lòng quay lại sau</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.tabContent}>
            {loadingTabs ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={IconColors.primary} />
                <Text style={styles.loadingText}>Đang tải dịch vụ...</Text>
              </View>
            ) : services.length > 0 ? (
              <View style={styles.listContainer}>
                {services.map((service: ServiceItem, index: number) => (
                  <View key={service._id} style={[styles.listItem, index % 2 === 0 && styles.listItemLeft]}>
                    <ServiceCard
                      service={service}
                      onPress={(sv) => navigation.navigate('ServiceDetail', { serviceId: sv._id })}
                      onBookingPress={(sv) => {
                        if (!user) {
                          navigation.navigate('Login');
                        } else {
                          const specialtyId = typeof sv.specialtyId === 'object'
                            ? sv.specialtyId._id
                            : sv.specialtyId;
                          navigation.navigate('Booking', {
                            serviceId: sv._id,
                            specialtyId: specialtyId || undefined,
                            hospitalId: id,
                          });
                        }
                      }}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name={AppIcons.serviceOutline} size={IconSizes.xxl} color={IconColors.light} />
                <Text style={styles.emptyText}>Chưa có dịch vụ</Text>
                <Text style={styles.emptySubtext}>Vui lòng quay lại sau</Text>
              </View>
            )}
          </View>
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
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop: 24,
  },
  backButton: {
    padding: 8,
  },
  favoriteButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: width,
    height: 240,
    backgroundColor: '#f0f0f0',
  },
  hospitalImage: {
    width: '100%',
    height: '100%',
  },
  defaultImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hospitalCard: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  hospitalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  address: {
    flex: 1,
    fontSize: 15,
    color: '#666',
    marginLeft: 8,
    lineHeight: 22,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff9500',
    marginLeft: 6,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: '#666',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickActionButton: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0a84ff',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#0a84ff',
    fontWeight: '600',
  },
  tabContent: {
    backgroundColor: '#f8f9fa',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
    marginLeft: 8,
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  workingHoursCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  workingHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  workingHoursDay: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  workingHoursTime: {
    fontSize: 15,
    color: '#0a84ff',
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  specialtyCard: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  specialtyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  specialtyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  specialtyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  specialtyDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  serviceCard: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceHeaderText: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34c759',
  },
  serviceDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  noServices: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  noServicesText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginBottom: 48,
  },
  bookButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#0a84ff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0a84ff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listItem: {
    width: (width - 48) / 2, // 2 cards per row: (screen width - padding 32 - gap 16) / 2
    marginBottom: 18,
  },
  listItemLeft: {
    marginRight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});


