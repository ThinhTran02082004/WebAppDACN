import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Specialty, Doctor, ServiceItem, apiService } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { AppIcons } from '../config/icons';

const { width } = Dimensions.get('window');

export default function SpecialtyDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { specialtyId } = route.params as { specialtyId: string };
  const insets = useSafeAreaInsets();
  
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'doctors' | 'services'>('details');

  useEffect(() => {
    loadSpecialtyDetail();
  }, [specialtyId]);

  const loadSpecialtyDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all data in parallel
      const [specialtiesResponse, doctorsResponse, servicesResponse] = await Promise.all([
        apiService.getSpecialties({ limit: 1000 }),
        apiService.getDoctors({}),
        apiService.getServices({ limit: 1000, isActive: true })
      ]);
      
      // Process specialty data
      if (specialtiesResponse.success && specialtiesResponse.data) {
        let specialtiesData: Specialty[] = [];
        if ('specialties' in specialtiesResponse.data) {
          specialtiesData = (specialtiesResponse.data as any).specialties || [];
        } else if ('data' in specialtiesResponse.data) {
          specialtiesData = (specialtiesResponse.data as any).data || [];
        } else if (Array.isArray(specialtiesResponse.data)) {
          specialtiesData = specialtiesResponse.data as Specialty[];
        }
        
        const foundSpecialty = specialtiesData.find((item: Specialty) => item._id === specialtyId);
        if (foundSpecialty) {
          setSpecialty(foundSpecialty);
        } else {
          setError('Không tìm thấy chuyên khoa');
        }
      } else {
        setError('Không thể tải chuyên khoa');
      }

      // Process doctors data
      if (doctorsResponse.success && doctorsResponse.data) {
        let doctorsData: Doctor[] = [];
        if ('doctors' in doctorsResponse.data) {
          doctorsData = (doctorsResponse.data as any).doctors || [];
        } else if ('data' in doctorsResponse.data) {
          doctorsData = (doctorsResponse.data as any).data || [];
        } else if (Array.isArray(doctorsResponse.data)) {
          doctorsData = doctorsResponse.data as Doctor[];
        }
        setDoctors(doctorsData);
      }

      // Process services data
      if (servicesResponse.success && servicesResponse.data) {
        let servicesData: ServiceItem[] = [];
        if ('services' in servicesResponse.data) {
          servicesData = (servicesResponse.data as any).services || [];
        } else if ('data' in servicesResponse.data) {
          servicesData = (servicesResponse.data as any).data || [];
        } else if (Array.isArray(servicesResponse.data)) {
          servicesData = servicesResponse.data as ServiceItem[];
        }
        setServices(servicesData);
      }
    } catch (error) {
      console.error('Error loading specialty detail:', error);
      setError('Có lỗi xảy ra khi tải chuyên khoa');
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('vi-VN') + 'đ';
  };

  const getFilteredDoctors = () => {
    if (!specialty) return doctors;
    return doctors.filter(doctor => {
      const doctorSpecialtyId = typeof doctor.specialtyId === 'string' 
        ? doctor.specialtyId 
        : doctor.specialtyId?._id;
      return doctorSpecialtyId === specialty._id;
    });
  };

  const getFilteredServices = () => {
    if (!specialty) return services;
    return services.filter(service => {
      const serviceSpecialtyId = typeof service.specialtyId === 'string' 
        ? service.specialtyId 
        : service.specialtyId?._id;
      return serviceSpecialtyId === specialty._id;
    });
  };

  const renderDoctorCard = (doctor: Doctor) => (
    <TouchableOpacity
      key={doctor._id}
      style={styles.doctorCard}
      onPress={() => navigation.navigate('DoctorDetail', { id: doctor._id })}
      activeOpacity={0.7}
    >
      <Image
        source={{ 
          uri: doctor.user.avatarUrl || 'https://placehold.co/60x60' 
        }}
        style={styles.doctorAvatar}
        defaultSource={{ uri: 'https://placehold.co/60x60' }}
      />
      <View style={styles.doctorInfo}>
        <Text style={styles.doctorName} numberOfLines={1}>
          {doctor.user.fullName}
        </Text>
        <Text style={styles.doctorTitle} numberOfLines={1}>
          {doctor.title}
        </Text>
        <Text style={styles.doctorSpecialty} numberOfLines={1}>
          {doctor.specialtyId.name}
        </Text>
        <View style={styles.doctorRating}>
          <Ionicons name="star" size={14} color="#ffa500" />
          <Text style={styles.ratingText}>
            {doctor.averageRating ? doctor.averageRating.toFixed(1) : '4.5'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderServiceCard = (service: ServiceItem) => (
    <TouchableOpacity
      key={service._id}
      style={styles.serviceCard}
      onPress={() => navigation.navigate('ServiceDetail', { serviceId: service._id })}
      activeOpacity={0.7}
    >
      <View style={styles.serviceImageContainer}>
        {service.image?.secureUrl || service.imageUrl ? (
          <Image
            source={{ 
              uri: service.image?.secureUrl || service.imageUrl || 'https://placehold.co/100x60' 
            }}
            style={styles.serviceImage}
            defaultSource={{ uri: 'https://placehold.co/100x60' }}
          />
        ) : (
          <View style={styles.serviceImagePlaceholder}>
            <Ionicons name={AppIcons.serviceOutline} size={32} color="#ccc" />
          </View>
        )}
      </View>
      <View style={styles.serviceContent}>
        <Text style={styles.serviceName} numberOfLines={2}>
          {service.name}
        </Text>
        {(service.shortDescription || service.description) && (
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {service.shortDescription || service.description}
          </Text>
        )}
        <Text style={styles.servicePrice}>
          {formatPrice(service.price)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      );
    }

    if (error || !specialty) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error || 'Không tìm thấy chuyên khoa'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSpecialtyDetail}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <ScrollView 
          style={[
            styles.scrollView, 
            { marginBottom: insets.bottom + 100 }
          ]} 
          showsVerticalScrollIndicator={false}
        >
          {/* Specialty Image */}
          <View style={styles.imageContainer}>
            {typeof specialty.image === 'string' && specialty.image ? (
              <Image 
                source={{ uri: specialty.image }} 
                style={styles.specialtyImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="medical" size={64} color="#ccc" />
              </View>
            )}
          </View>

          {/* Specialty Content */}
          <View style={styles.contentContainer}>
            {/* Title and Description */}
            <View style={styles.titleContainer}>
              <Text style={styles.specialtyTitle}>{specialty.name}</Text>
            </View>

            {specialty.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionText}>{specialty.description}</Text>
              </View>
            )}

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'details' && styles.tabActive]}
                onPress={() => setActiveTab('details')}
              >
                <Ionicons 
                  name="information-circle-outline" 
                  size={20} 
                  color={activeTab === 'details' ? '#0a84ff' : '#666'} 
                />
                <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
                  Giới thiệu
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'doctors' && styles.tabActive]}
                onPress={() => setActiveTab('doctors')}
              >
                <Ionicons 
                  name="people-outline" 
                  size={20} 
                  color={activeTab === 'doctors' ? '#0a84ff' : '#666'} 
                />
                <Text style={[styles.tabText, activeTab === 'doctors' && styles.tabTextActive]}>
                  Bác sĩ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'services' && styles.tabActive]}
                onPress={() => setActiveTab('services')}
              >
                <Ionicons 
                  name={AppIcons.serviceOutline} 
                  size={20} 
                  color={activeTab === 'services' ? '#0a84ff' : '#666'} 
                />
                <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
                  Dịch vụ
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'details' ? (
              <View style={styles.tabContent}>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="document-text-outline" size={20} color="#333" />
                    <Text style={styles.sectionTitle}>Mô tả chuyên khoa</Text>
                  </View>
                  <Text style={styles.description}>
                    {specialty.description || 'Chuyên khoa với đội ngũ bác sĩ giàu kinh nghiệm và các dịch vụ hiện đại.'}
                  </Text>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="stats-chart-outline" size={20} color="#333" />
                    <Text style={styles.sectionTitle}>Thống kê</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="people" size={20} color="#0a84ff" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Số bác sĩ</Text>
                      <Text style={styles.detailValue}>{getFilteredDoctors().length} bác sĩ</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name={AppIcons.serviceOutline} size={20} color="#0a84ff" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Số dịch vụ</Text>
                      <Text style={styles.detailValue}>{getFilteredServices().length} dịch vụ</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : activeTab === 'doctors' ? (
              <View style={styles.tabContent}>
                <View style={styles.section}>
                  {getFilteredDoctors().length > 0 ? (
                    getFilteredDoctors().map(renderDoctorCard)
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="person" size={48} color="#ccc" />
                      <Text style={styles.emptyText}>
                        Chưa có bác sĩ
                      </Text>
                      <Text style={styles.emptySubtext}>
                        Vui lòng quay lại sau
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.tabContent}>
                <View style={styles.section}>
                  {getFilteredServices().length > 0 ? (
                    getFilteredServices().map(renderServiceCard)
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Ionicons name={AppIcons.serviceOutline} size={48} color="#ccc" />
                      <Text style={styles.emptyText}>
                        Chưa có dịch vụ
                      </Text>
                      <Text style={styles.emptySubtext}>
                        Vui lòng quay lại sau
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Fixed Booking Button */}
        <View style={[styles.fixedBookingContainer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity 
            style={styles.fixedBookingButton}
            onPress={() => navigation.navigate('Booking')}
          >
            <Ionicons name="calendar" size={20} color="#fff" />
            <Text style={styles.bookingButtonText}>Đặt khám ngay</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết chuyên khoa</Text>
        <View style={styles.shareButton} />
      </View>

      {/* Content */}
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginLeft: -40,
  },
  shareButton: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0a84ff',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  specialtyImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    padding: 16,
  },
  titleContainer: {
    marginBottom: 12,
  },
  specialtyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 32,
  },
  descriptionContainer: {
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  // Tab styles
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
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // Doctor card styles
  doctorCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  doctorAvatar: {
    width: 60,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
  },
  doctorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doctorTitle: {
    fontSize: 14,
    color: '#0a84ff',
    marginBottom: 2,
  },
  doctorSpecialty: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  doctorRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  // Service card styles
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceImageContainer: {
    width: 100,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  serviceImage: {
    width: 100,
    height: 80,
  },
  serviceImagePlaceholder: {
    width: 100,
    height: 80,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  serviceContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  // Fixed booking button styles
  fixedBookingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  fixedBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a84ff',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 28,
    minHeight: 56,
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

