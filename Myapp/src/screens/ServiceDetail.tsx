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
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { ServiceItem, Doctor, apiService } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

const { width } = Dimensions.get('window');

// type ServiceDetailRouteProp = RouteProp<RootStackParamList, 'ServiceDetail'>;

export default function ServiceDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { serviceId } = route.params as { serviceId: string };
  const insets = useSafeAreaInsets();
  
  const [service, setService] = useState<ServiceItem | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'doctors'>('details');

  useEffect(() => {
    loadServiceDetail();
  }, [serviceId]);

  const loadServiceDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load service and doctors in parallel
      const [servicesResponse, doctorsResponse] = await Promise.all([
        apiService.getServices({ limit: 1000, isActive: true }),
        apiService.getDoctors({})
      ]);
      
      // Process service data
      if (servicesResponse.success && servicesResponse.data) {
        let servicesData: ServiceItem[] = [];
        if ('services' in servicesResponse.data) {
          servicesData = (servicesResponse.data as any).services || [];
        } else if ('data' in servicesResponse.data) {
          servicesData = (servicesResponse.data as any).data || [];
        } else if (Array.isArray(servicesResponse.data)) {
          servicesData = servicesResponse.data as ServiceItem[];
        }
        
        const foundService = servicesData.find((item: ServiceItem) => item._id === serviceId);
        if (foundService) {
          setService(foundService);
        } else {
          setError('Không tìm thấy dịch vụ');
        }
      } else {
        setError('Không thể tải dịch vụ');
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
    } catch (error) {
      console.error('Error loading service detail:', error);
      setError('Có lỗi xảy ra khi tải dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleBookService = () => {
    (navigation as any).navigate('Booking');
  };


  const formatPrice = (price: number) => {
    return price.toLocaleString('vi-VN') + 'đ';
  };

  const getServiceDuration = (service: ServiceItem) => {
    // Lấy thời gian thực hiện từ database nếu có
    if (service.duration) {
      return service.duration;
    }
    
    // Fallback: Dựa vào tên dịch vụ nếu không có trong database
    const name = service.name.toLowerCase();
    if (name.includes('khám tổng quát') || name.includes('khám sức khỏe')) {
      return '45-60 phút';
    } else if (name.includes('xét nghiệm') || name.includes('xét máu')) {
      return '15-30 phút';
    } else if (name.includes('siêu âm')) {
      return '20-40 phút';
    } else if (name.includes('chụp x-quang') || name.includes('chụp xquang')) {
      return '10-20 phút';
    } else if (name.includes('nội soi')) {
      return '30-45 phút';
    } else if (name.includes('ct') || name.includes('mri')) {
      return '20-30 phút';
    } else {
      return '30-45 phút'; // Mặc định
    }
  };

  const getFilteredDoctors = () => {
    if (!service || !service.specialtyId) return doctors;
    
    const specialtyId = typeof service.specialtyId === 'string' 
      ? service.specialtyId 
      : service.specialtyId._id;
    
    return doctors.filter(doctor => 
      doctor.specialtyId._id === specialtyId && doctor.isAvailable
    );
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
      <View style={styles.doctorPrice}>
        <Text style={styles.priceText}>
          {doctor.consultationFee.toLocaleString('vi-VN')}đ
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

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadServiceDetail}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!service) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="construct" size={64} color="#ccc" />
          <Text style={styles.errorText}>Không tìm thấy dịch vụ</Text>
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
          {/* Service Image */}
          <View style={styles.imageContainer}>
            {service.image?.secureUrl || service.imageUrl ? (
              <Image 
                source={{ 
                  uri: service.image?.secureUrl || service.imageUrl || 'https://placehold.co/400x300'
                }} 
                style={styles.serviceImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="construct" size={48} color="#ccc" />
              </View>
            )}
          </View>

          {/* Service Content */}
          <View style={styles.contentContainer}>
            {/* Title and Price */}
            <View style={styles.titleContainer}>
              <Text style={styles.serviceTitle}>{service.name}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.servicePrice}>{formatPrice(service.price)}</Text>
            </View>

            {/* Specialty */}
            {service.specialtyId && (
              <View style={styles.specialtyContainer}>
                <Ionicons name="medical" size={16} color="#0a84ff" />
                <Text style={styles.specialtyText}>
                  {typeof service.specialtyId === 'string' ? service.specialtyId : service.specialtyId.name}
                </Text>
              </View>
            )}

            {/* Status */}
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusBadge,
                { backgroundColor: service.isActive !== false ? '#e8f5e8' : '#ffe8e8' }
              ]}>
                <Ionicons 
                  name={service.isActive !== false ? "checkmark-circle" : "close-circle"} 
                  size={16} 
                  color={service.isActive !== false ? "#4caf50" : "#f44336"} 
                />
                <Text style={[
                  styles.statusText,
                  { color: service.isActive !== false ? "#4caf50" : "#f44336" }
                ]}>
                  {service.isActive !== false ? "Đang hoạt động" : "Tạm ngưng"}
                </Text>
              </View>
            </View>

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
                  Thông tin chi tiết
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
                  Bác sĩ thực hiện
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'details' ? (
              <View style={styles.tabContent}>
                {/* Description */}
                {(service.description || service.shortDescription) && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="document-text-outline" size={20} color="#333" />
                      <Text style={styles.sectionTitle}>Mô tả dịch vụ</Text>
                    </View>
                    <Text style={styles.description}>
                      {service.description || service.shortDescription}
                    </Text>
                  </View>
                )}

                {/* Service Details */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="list-outline" size={20} color="#333" />
                    <Text style={styles.sectionTitle}>Thông tin chi tiết</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="cash" size={20} color="#0a84ff" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Giá dịch vụ</Text>
                      <Text style={styles.detailValue}>{formatPrice(service.price)}</Text>
                    </View>
                  </View>

                  {service.specialtyId && (
                    <View style={styles.detailRow}>
                      <Ionicons name="medical" size={20} color="#0a84ff" />
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Chuyên khoa</Text>
                        <Text style={styles.detailValue}>
                          {typeof service.specialtyId === 'string' ? service.specialtyId : service.specialtyId.name}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={20} color="#0a84ff" />
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Thời gian thực hiện</Text>
                      <Text style={styles.detailValue}>{getServiceDuration(service)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.tabContent}>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                  </View>
                  {getFilteredDoctors().length > 0 ? (
                    getFilteredDoctors().map(renderDoctorCard)
                  ) : (
                    <View style={styles.emptyDoctorsContainer}>
                      <Ionicons name="person" size={48} color="#ccc" />
                      <Text style={styles.emptyDoctorsText}>
                        Chưa có bác sĩ phù hợp
                      </Text>
                      <Text style={styles.emptyDoctorsSubtext}>
                        Vui lòng liên hệ để được tư vấn
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
            style={[
              styles.fixedBookingButton,
              service.isActive === false && styles.bookingButtonDisabled
            ]}
            onPress={handleBookService}
            disabled={service.isActive === false}
          >
            <Ionicons name="calendar" size={20} color="#fff" />
            <Text style={styles.bookingButtonText}>
              {service.isActive === false ? 'Dịch vụ tạm ngưng' : 'Đặt lịch ngay'}
            </Text>
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
        <Text style={styles.headerTitle}>Chi tiết dịch vụ</Text>
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
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44,
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
  },
  shareButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  serviceImage: {
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
    padding: 20,
    backgroundColor: '#fff',
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '100%',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 32,
  },
  priceContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  servicePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  specialtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  specialtyText: {
    fontSize: 14,
    color: '#0a84ff',
    marginLeft: 6,
    fontWeight: '500',
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  detailsContainer: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  bookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a84ff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: '#0a84ff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookingButtonDisabled: {
    backgroundColor: '#ccc',  
    shadowOpacity: 0,
    elevation: 0,
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
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
  // Doctor card styles
  doctorCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
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
  doctorPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  emptyDoctorsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDoctorsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 12,
  },
  emptyDoctorsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
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
});
