import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Specialty, apiService, Doctor, ServiceItem } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  navigation: any;
};

export default function SpecialtyListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [filteredSpecialties, setFilteredSpecialties] = useState<Specialty[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    loadSpecialties();
  }, []);

  useEffect(() => {
    filterSpecialties();
  }, [searchQuery, selectedFilter, specialties]);

  const loadSpecialties = async () => {
    try {
      setLoading(true);
      // Load specialties, doctors, and services in parallel
      const [specialtiesResponse, doctorsResponse, servicesResponse] = await Promise.all([
        apiService.getSpecialties({ limit: 100 }),
        apiService.getDoctors({}),
        apiService.getServices({ limit: 1000, isActive: true })
      ]);

      if (specialtiesResponse.success && specialtiesResponse.data) {
        let specialtiesList = specialtiesResponse.data.specialties || [];
        
        // Get doctors and services lists
        let doctorsList: Doctor[] = [];
        if (doctorsResponse?.data?.doctors) {
          doctorsList = doctorsResponse.data.doctors;
        } else if (Array.isArray(doctorsResponse?.data)) {
          doctorsList = doctorsResponse.data;
        }

        let servicesList: ServiceItem[] = [];
        if (servicesResponse?.data) {
          const svcData = servicesResponse.data as any;
          if (Array.isArray(svcData?.data)) {
            servicesList = svcData.data;
          } else if (Array.isArray(svcData?.services)) {
            servicesList = svcData.services;
          } else if (Array.isArray(svcData)) {
            servicesList = svcData;
          }
        }

        // Enrich specialties with counts and normalized image
        const enrichedSpecialties: Specialty[] = specialtiesList.map((sp: any) => {
          const doctorCount = doctorsList.filter((d: any) => 
            d?.specialtyId?._id === sp._id || d?.specialtyId === sp._id
          ).length;
          const serviceCount = servicesList.filter((sv: any) => 
            (sv?.specialtyId?._id || sv?.specialtyId) === sp._id
          ).length;
          
          // Normalize image - ensure it's always a string or undefined
          let normalizedImage: string | undefined = undefined;
          
          if (typeof sp.image === 'string' && sp.image && sp.image.trim()) {
            normalizedImage = sp.image;
            console.log('Normalized image (string):', normalizedImage);
          } else if (typeof sp.imageUrl === 'string' && sp.imageUrl && sp.imageUrl.trim()) {
            normalizedImage = sp.imageUrl;
            console.log('Normalized image (imageUrl):', normalizedImage);
          } else if (sp.image && typeof sp.image === 'object') {
            const secureUrl = sp.image?.secureUrl;
            if (typeof secureUrl === 'string' && secureUrl && secureUrl.trim()) {
              normalizedImage = secureUrl;
              console.log('Normalized image (secureUrl):', normalizedImage);
            }
          }
          
          // Also check if imageUrl exists in raw data
          if (!normalizedImage && sp.imageUrl && typeof sp.imageUrl === 'string' && sp.imageUrl.trim()) {
            normalizedImage = sp.imageUrl;
          }
          
          return { ...sp, doctorCount, serviceCount, image: normalizedImage, imageUrl: normalizedImage || sp.imageUrl } as Specialty;
        });

        setSpecialties(enrichedSpecialties);
      }
    } catch (error) {
      console.error('Error loading specialties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSpecialties = () => {
    let filtered = specialties;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(specialty =>
        specialty.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (specialty.description && specialty.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by active status
    if (selectedFilter === 'active') {
      filtered = filtered.filter(specialty => specialty.isActive !== false);
    }

    setFilteredSpecialties(filtered);
  };

  const handleSpecialtyPress = (specialty: Specialty) => {
    navigation.navigate('SpecialtyDetail', { specialtyId: specialty._id });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const getImageUri = (specialty: Specialty): string => {
    // Debug: log specialty data to see what we're working with
    
    // Try image property first (normalized from loadSpecialties)
    if (typeof specialty.image === 'string' && specialty.image && specialty.image.trim()) {
      return specialty.image;
    }
    
    // Try imageUrl property
    if (typeof specialty.imageUrl === 'string' && specialty.imageUrl && specialty.imageUrl.trim()) {
      return specialty.imageUrl;
    }
    
    // Try image as object with secureUrl
    if (specialty.image && typeof specialty.image === 'object') {
      const secureUrl = (specialty.image as any)?.secureUrl;
      if (typeof secureUrl === 'string' && secureUrl && secureUrl.trim()) {
        return secureUrl;
      }
    }
    
    // Try accessing raw data properties
    const rawData = specialty as any;
    if (rawData.image?.secureUrl && typeof rawData.image.secureUrl === 'string') {
      return rawData.image.secureUrl;
    }
    
    console.log('No valid image found, using placeholder');
    return 'https://placehold.co/200x120';
  };

  const renderSpecialtyCard = (specialty: Specialty) => {
    const imageUri = getImageUri(specialty);
    
    return (
      <TouchableOpacity
        key={specialty._id}
        style={styles.specialtyCard}
        onPress={() => handleSpecialtyPress(specialty)}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.specialtyImage}
              resizeMode="cover"
              onError={(e) => {
                console.log('Image load error for:', imageUri, e.nativeEvent.error);
              }}
              onLoad={() => {
                console.log('Image loaded successfully:', imageUri);
              }}
            />
          ) : (
            <View style={[styles.specialtyImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="medical" size={32} color="#ccc" />
            </View>
          )}
        </View>
      <View style={styles.specialtyContent}>
        <Text style={styles.specialtyName} numberOfLines={2}>
          {specialty.name}
        </Text>
        {specialty.description && (
          <Text style={styles.specialtyDescription} numberOfLines={2}>
            {specialty.description}
          </Text>
        )}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="person" size={14} color="#0a84ff" />
            <Text style={styles.statText}>{specialty.doctorCount || 0} bác sĩ</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="construct" size={14} color="#0a84ff" />
            <Text style={styles.statText}>{specialty.serviceCount || 0} dịch vụ</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.bookingButton}
          onPress={() => {
            if (!user) {
              Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để đặt khám', [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
              ]);
            } else {
              navigation.navigate('Booking');
            }
          }}
        >
          <Text style={styles.bookingButtonText}>Đặt khám ngay</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Danh sách chuyên khoa</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm chuyên khoa..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'all' && styles.filterButtonTextActive
            ]}>
              Tất cả
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedFilter === 'active' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('active')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'active' && styles.filterButtonTextActive
            ]}>
              Đang hoạt động
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredSpecialties.length} chuyên khoa
        </Text>
      </View>

      {/* Specialty List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredSpecialties.length > 0 ? (
            filteredSpecialties.map(renderSpecialtyCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="medical" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Không tìm thấy chuyên khoa nào</Text>
              <Text style={styles.emptySubtext}>
                Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  filterButtonActive: {
    backgroundColor: '#0a84ff',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  resultsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 80,
  },
  specialtyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
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
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  specialtyImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#f0f0f0',
  },
  specialtyContent: {
    padding: 12,
    justifyContent: 'space-between',
  },
  specialtyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  specialtyDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statText: {
    fontSize: 12,
    color: '#1e293b',
    marginLeft: 4,
    fontWeight: '600',
  },
  bookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
