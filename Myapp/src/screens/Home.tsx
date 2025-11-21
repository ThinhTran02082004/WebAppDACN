import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { SpecialtyCard } from '../components/SpecialtyCard';
import HeaderSearch from '../components/HeaderSearch';
import QuickAccess from '../components/QuickAccess';
import DoctorCard from '../components/DoctorCard';
import Banner from '../components/Banner';
import { apiService, Hospital, Doctor, ServiceItem, NewsItem } from '../services/api';
import type { Specialty } from '../types/specialty';
import { API_BASE, clearApiHost, resetApiHost } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppIcons, IconColors, IconSizes } from '../config/icons';

// const { width } = Dimensions.get('window');

const quickAccessItems = [
  { 
    id: '1', 
    title: 'Chi nhánh', 
    icon: AppIcons.hospital,
  },
  { 
    id: '2',
    title: 'Chuyên khoa', 
    icon: AppIcons.specialtyOutline,
  },
  { 
    id: '3',
    title: 'Video call', 
    icon: AppIcons.video,
  },
  { 
    id: '4',
    title: 'Bác sĩ', 
    icon: AppIcons.usersOutline,
  },
  { 
    id: '6',
    title: 'Tin tức', 
    icon: AppIcons.news,
  },
  { 
    id: '7',
    title: 'Dịch vụ', 
    icon: AppIcons.service,
  },

];

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

type Props = {
  navigation: HomeScreenNavigationProp;
};

export default function Home({ navigation }: Props) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [_loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // Initialize API configuration on app start
    const initApiConfig = async () => {
      try {
        await clearApiHost(); // Clear any cached configuration
        resetApiHost(); // Reset to default configuration
        
        // Wait a moment for configuration to be applied, then load data
        setTimeout(() => {
          loadData();
        }, 100);
      } catch (error) {
        // Still try to load data even if config fails
        loadData();
      }
    };
    
    initApiConfig();
    // TODO: Check authentication status
    // checkAuthStatus();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setDoctors([]);
       
            const [hospitalsResponse, doctorsResponse, specialtiesResponse, servicesResponse, newsResponse] = await Promise.all([
        apiService.getHospitals({ limit: 10, isActive: true }),
        apiService.getDoctors({}),
        apiService.getSpecialties({ limit: 12, isActive: true }),
        apiService.getServices({ limit: 12, isActive: true }),
        apiService.getNews({ limit: 6, isPublished: true as any })
      ]);
      
      // Defensive: API may return unexpected shapes or undefined data
      const hospitalsList = hospitalsResponse && (hospitalsResponse as any).data && (hospitalsResponse as any).data.hospitals
        ? (hospitalsResponse as any).data.hospitals
        : [];


      let doctorsList: Doctor[] = [];

      
      if (doctorsResponse?.data?.doctors) {
        doctorsList = doctorsResponse.data.doctors;

      } else if (Array.isArray(doctorsResponse?.data)) {
        // Trường hợp API trả về trực tiếp mảng
        doctorsList = doctorsResponse.data;
      }

      

      const specialtiesList = specialtiesResponse && (specialtiesResponse as any).data && (specialtiesResponse as any).data.specialties
        ? (specialtiesResponse as any).data.specialties
        : [];

      // Services controller may return shape { data: ServiceItem[] } or nested
      let servicesList: ServiceItem[] = [];
      if ((servicesResponse as any)?.data) {
        const data = (servicesResponse as any).data;
        if (Array.isArray((data as any).data)) servicesList = (data as any).data as ServiceItem[];
        else if (Array.isArray((data as any).services)) servicesList = (data as any).services as ServiceItem[];
        else if (Array.isArray(data)) servicesList = data as ServiceItem[];
      }

      const newsList = newsResponse && (newsResponse as any).data && Array.isArray((newsResponse as any).data.news)
        ? (newsResponse as any).data.news
        : [];


      setHospitals(hospitalsList);
      setDoctors(doctorsList);
      // Enrich specialties with counts and normalized image for cards
      const enrichedSpecialties: Specialty[] = (Array.isArray(specialtiesList) ? specialtiesList : []).map((sp: any) => {
        const doctorCount = doctorsList.filter((d: any) => d?.specialtyId?._id === sp._id || d?.specialtyId === sp._id).length;
        const serviceCount = servicesList.filter((sv: any) => (sv?.specialtyId?._id || sv?.specialtyId) === sp._id).length;
        const normalizedImage = sp.image || sp.imageUrl || sp.image?.secureUrl || (sp.image && sp.image.secureUrl) || undefined;
        return { ...sp, doctorCount, serviceCount, image: normalizedImage } as Specialty;
      });
      setSpecialties(enrichedSpecialties);
      setServices(servicesList);
      setNews(newsList);
    } catch (error) {
      const errMsg = (error as any)?.message || String(error);
      
      // If network error, try to clear cache and reset API host
      if (errMsg.toLowerCase().includes('cannot reach backend') || errMsg.toLowerCase().includes('network error')) {
        try {
          await clearApiHost();
          resetApiHost();
          console.log('[Home] API cache cleared, current API_BASE:', typeof API_BASE === 'function' ? API_BASE() : API_BASE);
        } catch (cacheError) {
          console.error('[Home] Failed to clear API cache:', cacheError);
        }
      }
      
      const guidance = errMsg.toLowerCase().includes('cannot reach backend') || errMsg.toLowerCase().includes('network error')
        ? '\nKiểm tra:\n• Server có đang chạy không (http://10.0.188.228:5000/health)\n• Địa chỉ IP đã được cập nhật thành 10.0.188.228\n• Windows Firewall có cho phép cổng 5000 không\n• Thử reload app để áp dụng cấu hình mới'
        : '';
      Alert.alert('Lỗi', `Không thể tải dữ liệu: ${errMsg}${guidance}`);
    } finally {
      setLoading(false);
    }
  };

  const { user } = useAuth();
  // reflect login state in header
  useEffect(() => {
    setIsLoggedIn(!!user);
    setUserName(user ? (user.fullName || user.email || '') : '');
  }, [user]);

  const requireLogin = (action: () => void) => {
    if (!user) {
      Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để sử dụng chức năng này', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    action();
  };

  const handleAvatarPress = () => {
    // Navigate to Account screen (same screen as the one in bottom tabs)
    navigation.navigate('Home', { screen: 'Account' });
  };

  const handleQuickAccessPress = (item: any) => {
    console.log('Quick access pressed:', item.title);

    // Bỏ yêu cầu đăng nhập - cho phép truy cập trực tiếp
    switch (item.id) {
      case '1':
        // Đặt khám tại cơ sở
        navigation.navigate('FacilityList');
        break;
      case '2':
        // Đặt khám chuyên khoa
        navigation.navigate('SpecialtyList');
        break;
      case '3':
        break;
      case '4':
        // Đặt lịch khám với bác sĩ
        navigation.navigate('DoctorList');
        break;
      case '6':
        // Tin tức
        navigation.navigate('NewsList');
        break;
      case '7':
        // Dịch vụ
        navigation.navigate('ServiceList');
        break;
      default:
        console.log('Unknown function');
    }
  };

  const handleFacilityPress = (facility: Hospital) => {
    navigation.navigate('FacilityDetail', { id: facility._id });
  };

  const handleFacilityBookingPress = (facility: Hospital) => {
    if (!user) {
      navigation.navigate('Login');
    } else {
      navigation.navigate('Booking');
    }
  };

  const handleSpecialtyBookingPress = (specialty: Specialty) => {
    if (!user) {
      navigation.navigate('Login');
    } else {
      navigation.navigate('Booking');
    }
  };

  const handleDoctorConsultPress = (doctor: any) => {
    requireLogin(() => {
      navigation.navigate('Booking');
    });
  };

  const handleDoctorCardPress = (doctor: any) => {
    // Card details should be viewable without login
    navigation.navigate('DoctorDetail', { id: doctor._id });
  };


  return (
    <View style={styles.container}>
      <HeaderSearch 
        userName={userName} 
        isLoggedIn={isLoggedIn}
        avatarUrl={user?.avatarUrl}
        onAvatarPress={handleAvatarPress}
      />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

      <QuickAccess 
        items={quickAccessItems} 
        onItemPress={handleQuickAccessPress}
      />

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chi nhánh</Text>
          <TouchableOpacity onPress={() => navigation.navigate('FacilityList')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.facilityListContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.facilityScrollContent}
          >
            {hospitals.map((facility) => (
              <TouchableOpacity
                key={facility._id}
                style={styles.facilityItem}
                onPress={() => handleFacilityPress(facility)}
                activeOpacity={0.7}
              >
                <Image
                  source={{
                    uri: facility.imageUrl || facility.image?.secureUrl || 'https://placehold.co/160x120',
                  }}
                  style={styles.facilityImage}
                  defaultSource={{ uri: 'https://placehold.co/160x120' }}
                />
                <View style={styles.facilityContent}>
                  <Text style={styles.facilityName} numberOfLines={2}>
                    {facility.name}
                  </Text>
                  <View style={styles.locationContainer}>
                    <Ionicons name="location" size={10} color="#666" />
                    <Text style={styles.facilityAddress} numberOfLines={1}>
                      {facility.address}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.facilityBookingButton} 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleFacilityBookingPress(facility);
                    }}
                  >
                    <Text style={styles.facilityBookingButtonText}>Đặt khám ngay</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <Banner />

      {/* Specialties */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chuyên khoa</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SpecialtyList')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        {specialties && specialties.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
            {specialties.map((specialty) => (
              <View key={specialty._id} style={styles.specialtyCardContainer}>
                <SpecialtyCard
                  specialty={specialty}
                  onPress={(specialty) => {
                    navigation.navigate('SpecialtyDetail', { specialtyId: specialty._id });
                  }}
                  onBookingPress={handleSpecialtyBookingPress}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name={AppIcons.specialtyOutline} size={IconSizes.xl} color={IconColors.default} />
            <Text style={styles.emptyTitle}>Chưa có chuyên khoa</Text>
            <Text style={styles.emptyDesc}>Hiện tại chưa có chuyên khoa. Vui lòng quay lại sau. </Text>
          </View>
        )}
      </View>

      {/* Services */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dịch vụ</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ServiceList')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        {services && services.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
            {services.map((sv) => (
              <TouchableOpacity 
                key={sv._id} 
                style={styles.serviceCard}
                onPress={() => navigation.navigate('ServiceDetail', { serviceId: sv._id })}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: sv.imageUrl || sv.image?.secureUrl || 'https://placehold.co/160x120' }}
                  style={styles.serviceImage}
                  defaultSource={{ uri: 'https://placehold.co/160x120' }}
                />
                <View style={styles.serviceContent}>
                  <Text numberOfLines={2} style={styles.serviceName}>{sv.name}</Text>
                  {sv.description && (
                    <Text numberOfLines={2} style={styles.serviceDescription}>{sv.description}</Text>
                  )}
                  <Text style={styles.servicePrice}>{(sv.price || 0).toLocaleString('vi-VN')}đ</Text>
                  <TouchableOpacity 
                    style={styles.bookingButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!user) {
                        navigation.navigate('Login');
                      } else {
                        navigation.navigate('Booking');
                      }
                    }}
                  >
                    <Text style={styles.bookingButtonText}>Đặt khám</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name={AppIcons.serviceOutline} size={IconSizes.xl} color={IconColors.default} />
            <Text style={styles.emptyTitle}>Chưa có dịch vụ</Text>
            <Text style={styles.emptyDesc}>Hiện tại chưa có dịch vụ nào. Vui lòng quay lại sau.</Text>
          </View>
        )}
      </View>

      {/* Doctors */}
      <View style={styles.doctorsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh sách bác sĩ</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DoctorList')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.doctorsContainer}>
          {doctors && doctors.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.doctorsScrollContent}
            >
              {doctors.map((doctor: any) => (
                <View key={doctor._id} style={styles.doctorCardContainer}>
                  <DoctorCard
                    doctor={doctor}
                    onConsultPress={handleDoctorConsultPress}
                    onCardPress={handleDoctorCardPress}
                    vertical={true}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name={AppIcons.doctorOutline} size={IconSizes.xl} color={IconColors.default} />
              <Text style={styles.emptyTitle}>Chưa có bác sĩ </Text>
              <Text style={styles.emptyDesc}>Hiện tại chưa có bác sĩ nào. Vui lòng quay lại sau.</Text>
            </View>
          )}
        </View>
      </View>

      {/* News */}
      <View style={[styles.sectionBlock, { paddingBottom: 20 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tin tức</Text>
          <TouchableOpacity onPress={() => navigation.navigate('NewsList')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
          {news.map((n) => (
            <TouchableOpacity 
              key={n._id} 
              style={styles.newsCard}
              onPress={() => navigation.navigate('NewsDetail', { newsId: n._id })}
              activeOpacity={0.7}
            >
              {n.image?.secureUrl ? (
                <Image 
                  source={{ uri: n.image.secureUrl }} 
                  style={styles.newsImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.newsImage}>
                  <Ionicons name="newspaper" size={24} color="#ccc" />
                </View>
              )}
              <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
              {n.summary ? (<Text style={styles.newsSummary} numberOfLines={2}>{n.summary}</Text>) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3F2FD',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 120, // Reduced space for smaller fixed header
  },
  sectionBlock: {
    marginTop: 16,
  },
  doctorsSection: {
    marginTop: 16,
    backgroundColor: '#E3F2FD',
    paddingTop: 16,
    paddingBottom: 8,
  },
  doctorsContainer: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#0a84ff',
    fontWeight: '600',
  },
  hScrollContent: {
    paddingHorizontal: 16,
  },
  serviceCard: {
    width: 160,
    height: 280,
    marginRight: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  serviceImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  serviceContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  serviceDescription: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    lineHeight: 14,
  },
  servicePrice: {
    fontSize: 13,
    color: '#0a84ff',
    fontWeight: '700',
    marginBottom: 8,
  },
  bookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignSelf: 'stretch',
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  doctorsScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doctorCardContainer: {
    width: 160,
    marginRight: 12,
  },
  specialtyCardContainer: {
    width: 160,
    marginRight: 12,
  },
  emptyWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyDesc: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  newsCard: {
    width: 160,
    height: 200,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  newsImage: {
    height: 100,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  newsSummary: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  facilityListContainer: {
    marginBottom: 8,
  },
  facilityScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  facilityItem: {
    width: 160,
    height: 255,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  facilityImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  facilityContent: {
    padding: 12,
    flex: 1,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  facilityAddress: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    marginLeft: 4,
  },
  facilityBookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  facilityBookingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});