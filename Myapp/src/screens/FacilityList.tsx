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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Hospital, apiService } from '../services/api';

type Props = {
  navigation: any;
};

export default function FacilityListScreen({ navigation }: Props) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<Hospital[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [provinces, setProvinces] = useState<string[]>([]);

  useEffect(() => {
    loadHospitals();
  }, []);

  useEffect(() => {
    filterHospitals();
  }, [searchQuery, selectedProvince, hospitals]);

  const loadHospitals = async () => {
    try {
      setLoading(true);
      const response = await apiService.getHospitals({ limit: 100 });
      if (response.success && response.data) {
        setHospitals(response.data.hospitals);
        
        // Extract unique provinces from address
        const uniqueProvinces = [...new Set(
          response.data.hospitals
            .map(h => {
              // Extract province from address (simple approach)
              const addressParts = h.address.split(',');
              return addressParts[addressParts.length - 1]?.trim();
            })
            .filter(Boolean)
        )];
        setProvinces(['all', ...uniqueProvinces]);
      }
    } catch (error) {
      console.error('Error loading hospitals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterHospitals = () => {
    let filtered = hospitals;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(hospital =>
        hospital.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hospital.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by province
    if (selectedProvince !== 'all') {
      filtered = filtered.filter(hospital => {
        const addressParts = hospital.address.split(',');
        const province = addressParts[addressParts.length - 1]?.trim();
        return province === selectedProvince;
      });
    }

    setFilteredHospitals(filtered);
  };

  const handleHospitalPress = (hospital: Hospital) => {
    console.log('Hospital pressed:', hospital.name);
    navigation.navigate('FacilityDetail', { id: hospital._id });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const renderHospitalCard = (hospital: Hospital) => (
    <TouchableOpacity
      key={hospital._id}
      style={styles.hospitalCard}
      onPress={() => handleHospitalPress(hospital)}
      activeOpacity={0.7}
    >
      <Image
        source={{
          uri: hospital.imageUrl || hospital.image?.secureUrl || 'https://placehold.co/200x120',
        }}
        style={styles.hospitalImage}
        defaultSource={{ uri: 'https://placehold.co/200x120' }}
      />
      <View style={styles.hospitalContent}>
        <Text style={styles.hospitalName} numberOfLines={2}>
          {hospital.name}
        </Text>
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={12} color="#666" />
          <Text style={styles.hospitalAddress} numberOfLines={2}>
            {hospital.address}
          </Text>
        </View>
        {hospital.address && (
          <Text style={styles.province}>
            {hospital.address.split(',')[hospital.address.split(',').length - 1]?.trim()}
          </Text>
        )}
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={12} color="#ff9500" />
          <Text style={styles.rating}>4.5</Text>
          <Text style={styles.reviewCount}>(0 đánh giá)</Text>
        </View>
        <TouchableOpacity style={styles.bookingButton} onPress={() => navigation.navigate('Booking')}>
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
        <Text style={styles.headerTitle}>Danh sách chi nhánh</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm chi nhánh..."
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
          {provinces.map((province) => (
            <TouchableOpacity
              key={province}
              style={[
                styles.filterButton,
                selectedProvince === province && styles.filterButtonActive
              ]}
              onPress={() => setSelectedProvince(province)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedProvince === province && styles.filterButtonTextActive
              ]}>
                {province === 'all' ? 'Tất cả' : province}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredHospitals.length} chi nhánh
        </Text>
      </View>

      {/* Hospital List */}
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
          {filteredHospitals.length > 0 ? (
            filteredHospitals.map(renderHospitalCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="business" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Không tìm thấy chi nhánh nào</Text>
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
  },
  hospitalCard: {
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
  },
  hospitalImage: {
    width: 120,
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  hospitalContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  hospitalAddress: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  province: {
    fontSize: 12,
    color: '#0a84ff',
    fontWeight: '500',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rating: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '600',
    marginLeft: 4,
    marginRight: 8,
  },
  reviewCount: {
    fontSize: 12,
    color: '#666',
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
