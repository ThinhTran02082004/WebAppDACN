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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { ServiceItem, apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: any;
};

export default function ServiceListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [searchQuery, selectedFilter, priceRange, services]);

  const loadServices = async () => {
    try {
      setLoading(true);
      console.log('Loading services...');
      const response = await apiService.getServices({ limit: 100 });
      console.log('Services response:', response);
      
      if (response.success && response.data) {
        // Handle different response structures
        let servicesData: ServiceItem[] = [];
        if ('services' in response.data) {
          servicesData = response.data.services || [];
        } else if ('data' in response.data) {
          servicesData = response.data.data || [];
        } else if (Array.isArray(response.data)) {
          servicesData = response.data;
        }
        
        console.log('Services data:', servicesData);
        setServices(servicesData);
      } else {
        console.log('No services data found');
        setServices([]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách dịch vụ. Vui lòng thử lại.');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = services;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (service.shortDescription && service.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by active status
    if (selectedFilter === 'active') {
      filtered = filtered.filter(service => service.isActive !== false);
    }

    // Filter by price range
    if (priceRange !== 'all') {
      switch (priceRange) {
        case 'low':
          filtered = filtered.filter(service => service.price < 500000);
          break;
        case 'medium':
          filtered = filtered.filter(service => service.price >= 500000 && service.price < 2000000);
          break;
        case 'high':
          filtered = filtered.filter(service => service.price >= 2000000);
          break;
      }
    }

    setFilteredServices(filtered);
  };

  const handleServicePress = (service: ServiceItem) => {
    console.log('Service pressed:', service.name);
    navigation.navigate('ServiceDetail', { serviceId: service._id });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const renderServiceCard = (service: ServiceItem) => (
    <TouchableOpacity
      key={service._id}
      style={styles.serviceCard}
      onPress={() => handleServicePress(service)}
      activeOpacity={0.7}
    >
      <Image
        source={{
          uri: service.imageUrl || service.image?.secureUrl || 'https://placehold.co/200x120',
        }}
        style={styles.serviceImage}
        defaultSource={{ uri: 'https://placehold.co/200x120' }}
      />
      <View style={styles.serviceContent}>
        <Text style={styles.serviceName} numberOfLines={2}>
          {service.name}
        </Text>
        {(service.description || service.shortDescription) && (
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {service.description || service.shortDescription}
          </Text>
        )}
        <View style={styles.priceContainer}>
          <Text style={styles.servicePrice}>
            {service.price.toLocaleString('vi-VN')}đ
          </Text>
          {service.specialtyId && (
            <Text style={styles.specialtyName}>
              {typeof service.specialtyId === 'string' ? service.specialtyId : service.specialtyId.name}
            </Text>
          )}
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
              // Navigate to booking screen with pre-filled service data
              const specialtyId = typeof service.specialtyId === 'object' 
                ? service.specialtyId._id 
                : service.specialtyId;
              
              navigation.navigate('Booking', {
                serviceId: service._id,
                specialtyId: specialtyId || undefined,
              });
            }
          }}
        >
          <Text style={styles.bookingButtonText}>Đặt khám ngay</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Danh sách dịch vụ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm dịch vụ..."
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

      {/* Filters */}
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

      {/* Price Range Filter */}
      <View style={styles.priceFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              priceRange === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setPriceRange('all')}
          >
            <Text style={[
              styles.filterButtonText,
              priceRange === 'all' && styles.filterButtonTextActive
            ]}>
              Tất cả giá
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              priceRange === 'low' && styles.filterButtonActive
            ]}
            onPress={() => setPriceRange('low')}
          >
            <Text style={[
              styles.filterButtonText,
              priceRange === 'low' && styles.filterButtonTextActive
            ]}>
              Dưới 500k
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              priceRange === 'medium' && styles.filterButtonActive
            ]}
            onPress={() => setPriceRange('medium')}
          >
            <Text style={[
              styles.filterButtonText,
              priceRange === 'medium' && styles.filterButtonTextActive
            ]}>
              500k - 2tr
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredServices.length} dịch vụ
        </Text>
      </View>

      {/* Service List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredServices.length > 0 ? (
            filteredServices.map(renderServiceCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="construct" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Không tìm thấy dịch vụ nào</Text>
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
  priceFilterContainer: {
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
  },
  serviceCard: {
    flexDirection: 'row',
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
    minHeight: 120,
  },
  serviceImage: {
    width: 120,
    height: 155,
    backgroundColor: '#f0f0f0',
    alignSelf: 'center',
  },
  serviceContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  specialtyName: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    shadowColor: '#0a84ff',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 13,
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
