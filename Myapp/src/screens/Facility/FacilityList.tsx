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
import { Hospital, apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: any;
};

export default function FacilityListScreen({ navigation }: Props) {
  const { user } = useAuth();
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
        <TouchableOpacity 
          style={styles.bookingButton} 
          onPress={() => {
            if (!user) {
              Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để đặt khám', [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Đăng nhập', onPress: () => navigation.navigate('Login') },
              ]);
            } else {
              // Navigate to booking screen with pre-filled hospital
              navigation.navigate('Booking', {
                hospitalId: hospital._id,
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
  // giữ nguyên toàn bộ styles từ file gốc
});


