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
import FacilityList from '../components/FacilityList';
import DoctorCard from '../components/DoctorCard';
import Banner from '../components/Banner';
import { apiService, Hospital, Doctor, ServiceItem, NewsItem } from '../services/api';
import type { Specialty } from '../types/specialty';
import { API_BASE, clearApiHost, resetApiHost } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { StackNavigationProp } from '@react-navigation/stack';

// const { width } = Dimensions.get('window');

const quickAccessItems = [
  { 
    id: '1', 
    title: 'Đặt khám tại\ncơ sở', 
    icon: 'medical',
  },
  { 
    id: '2',
    title: 'Đặt khám\nchuyên khoa', 
    icon: 'medical-outline',
  },
  { 
    id: '3',
    title: 'Gọi video\nvới bác sĩ', 
    icon: 'videocam',
  },
  { 
    id: '4',
    title: 'Đặt lịch khám\nvới bác sĩ', 
    icon: 'person',
  },
  { 
    id: '5',
    title: 'Thanh toán', 
    icon: 'card',
  },
  { 
    id: '6',
    title: 'Tin tức', 
    icon: 'newspaper',
  },
  { 
    id: '7',
    title: 'Dịch vụ', 
    icon: 'construct',
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
        console.log('[Home] Initializing API configuration...');
        await clearApiHost(); // Clear any cached configuration
        resetApiHost(); // Reset to default configuration
        console.log('[Home] API configuration initialized, current API_BASE:', typeof API_BASE === 'function' ? API_BASE() : API_BASE);
        
        // Wait a moment for configuration to be applied, then load data
        setTimeout(() => {
          loadData();
        }, 100);
      } catch (error) {
        console.error('[Home] Failed to initialize API configuration:', error);
        // Still try to load data even if config fails
        loadData();
      }
    };
    
    initApiConfig();
    // TODO: Check authentication status
    // checkAuthStatus();
  }, []);

  const loadData = async () => {
    console.log('Loading data...');
    try {
      setLoading(true);
      setDoctors([]);
      
      // Load data in parallel
      console.log('Fetching data...');
      console.log('API Base URL:', typeof API_BASE === 'function' ? API_BASE() : API_BASE);
      
            const [hospitalsResponse, doctorsResponse, specialtiesResponse, servicesResponse, newsResponse] = await Promise.all([
        apiService.getHospitals({ limit: 10, isActive: true }),
        apiService.getDoctors({}),
        apiService.getSpecialties({ limit: 12, isActive: true }),
        apiService.getServices({ limit: 12, isActive: true }),
        apiService.getNews({ limit: 6, isPublished: true as any })
      ]);
      console.log('Data fetched successfully');
      
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
      console.log('Specialties response:', specialtiesResponse);
      console.log('Specialties list:', specialtiesList);

      // Services controller may return shape { data: ServiceItem[] } or nested
      let servicesList: ServiceItem[] = [];
      if ((servicesResponse as any)?.data) {
        const data = (servicesResponse as any).data;
        if (Array.isArray((data as any).data)) servicesList = (data as any).data as ServiceItem[];
        else if (Array.isArray((data as any).services)) servicesList = (data as any).services as ServiceItem[];
        else if (Array.isArray(data)) servicesList = data as ServiceItem[];
      }
      console.log('Services response:', servicesResponse);
      console.log('Services list:', servicesList);

      const newsList = newsResponse && (newsResponse as any).data && Array.isArray((newsResponse as any).data.news)
        ? (newsResponse as any).data.news
        : [];

      if (!Array.isArray(hospitalsList)) {
        console.warn('Unexpected hospitals shape', hospitalsResponse);
      }
      if (!Array.isArray(doctorsList)) {
        console.warn('Unexpected doctors shape', doctorsResponse);
      } else {
        console.log('Doctors data:', doctorsList);
      }
      if (!Array.isArray(specialtiesList)) {
        console.warn('Unexpected specialties shape', specialtiesResponse);
      }
      if (!Array.isArray(servicesList)) {
        console.warn('Unexpected services shape', servicesResponse);
      }
      if (!Array.isArray(newsList)) {
        console.warn('Unexpected news shape', newsResponse);
      }

      setHospitals(hospitalsList);
      setDoctors(doctorsList);
      setSpecialties(specialtiesList);
      setServices(servicesList);
      setNews(newsList);
    } catch (error) {
      console.error('Error loading data:', error);
      const errMsg = (error as any)?.message || String(error);
      
      // If network error, try to clear cache and reset API host
      if (errMsg.toLowerCase().includes('cannot reach backend') || errMsg.toLowerCase().includes('network error')) {
        console.log('[Home] Network error detected, clearing API cache...');
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

  const handleQuickAccessPress = (item: any) => {
    console.log('Quick access pressed:', item.title);

    requireLogin(() => {
      switch (item.id) {
        case '1':
          console.log('Navigate to facility booking');
          break;
        case '2':
          console.log('Navigate to specialty booking');
          break;
        case '3':
          console.log('Navigate to video call');
          break;
        case '4':
          console.log('Navigate to doctor appointment');
          break;
        case '5':
          console.log('Navigate to payment');
          break;
        case '6':
          console.log('Navigate to news');
          break;
        case '7':
          console.log('Navigate to services');
          break;
        default:
          console.log('Unknown function');
      }
    });
  };

  const handleFacilityPress = (facility: Hospital) => {
    console.log('Facility pressed:', facility.name);
    // Xử lý navigation đến chi tiết bệnh viện
  };

  const handleDoctorConsultPress = (doctor: any) => {
    requireLogin(() => {
      console.log('Doctor consult pressed:', doctor.user.fullName);
      // TODO: navigation to consult/booking
    });
  };

  const handleDoctorCardPress = (doctor: any) => {
    // Card details should be viewable without login
    console.log('Doctor card pressed:', doctor.user.fullName);
    navigation.navigate('DoctorDetail', { id: doctor._id });
  };

  console.log('Home render - doctors:', doctors?.length);

  return (
    <View style={styles.container}>
      <HeaderSearch 
        userName={userName} 
        isLoggedIn={isLoggedIn}
        avatarUrl={user?.avatarUrl}
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
          <TouchableOpacity onPress={() => console.log('View all facilities')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        <FacilityList 
          facilities={hospitals} 
          onFacilityPress={handleFacilityPress}
        />
      </View>

      <Banner />

      {/* Specialties */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chuyên khoa</Text>
          <TouchableOpacity onPress={() => console.log('View all specialties')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        {specialties && specialties.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
            {specialties.map((specialty) => (
              <View key={specialty._id} style={styles.specialtyCardContainer}>
                <SpecialtyCard
                  specialty={specialty}
                  size="medium"
                  onPress={(specialty) => {
                    navigation.navigate('SpecialtyDetail', { specialtyId: specialty._id });
                  }}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="medical" size={40} color="#666" />
            <Text style={styles.emptyTitle}>Chưa có chuyên khoa</Text>
            <Text style={styles.emptyDesc}>Hiện tại chưa có chuyên khoa. Vui lòng quay lại sau. </Text>
          </View>
        )}
      </View>

      {/* Services */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dịch vụ</Text>
          <TouchableOpacity onPress={() => console.log('View all services')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        {services && services.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
            {services.map((sv) => (
              <View key={sv._id} style={styles.serviceCard}>
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
                  <TouchableOpacity style={styles.bookingButton}>
                    <Text style={styles.bookingButtonText}>Đặt khám</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="construct" size={40} color="#666" />
            <Text style={styles.emptyTitle}>Chưa có dịch vụ</Text>
            <Text style={styles.emptyDesc}>Hiện tại chưa có dịch vụ nào. Vui lòng quay lại sau.</Text>
          </View>
        )}
      </View>

      {/* Doctors */}
      <View style={styles.doctorsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh sách bác sĩ</Text>
          <TouchableOpacity onPress={() => console.log('View all doctors')}>
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
              <Ionicons name="person" size={40} color="#666" />
              <Text style={styles.emptyTitle}>Chưa có bác sĩ </Text>
              <Text style={styles.emptyDesc}>Hiện tại chưa có bác sĩ nào. Vui lòng quay lại sau.</Text>
            </View>
          )}
        </View>
      </View>

      {/* News */}
      <View style={[styles.sectionBlock, { paddingBottom: 20 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tin tá»©c</Text>
          <TouchableOpacity onPress={() => console.log('View all news')}>
            <Text style={styles.viewAllText}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
          {news.map((n) => (
            <View key={n._id} style={styles.newsCard}>
              <View style={styles.newsImage} />
              <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
              {n.summary ? (<Text style={styles.newsSummary} numberOfLines={2}>{n.summary}</Text>) : null}
            </View>
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
    backgroundColor: '#f7f7f7',
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
    backgroundColor: '#f7f7f7',
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
  },
  newsImage: {
    height: 100,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginBottom: 8,
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
});


