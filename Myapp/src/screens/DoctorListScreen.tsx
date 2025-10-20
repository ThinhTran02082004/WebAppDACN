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
import { Doctor, apiService } from '../services/api';

type Props = {
  navigation: any;
};

export default function DoctorListScreen({ navigation }: Props) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [specialties, setSpecialties] = useState<string[]>([]);

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    filterDoctors();
  }, [searchQuery, selectedFilter, selectedSpecialty, doctors]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      console.log('Loading doctors...');
      const response = await apiService.getDoctors({ limit: 100 });
      console.log('Doctors response:', response);
      
      if (response.success && response.data) {
        // Handle different response structures
        let doctorsData = [];
        if ('doctors' in response.data) {
          doctorsData = response.data.doctors || [];
        } else if ('data' in response.data) {
          doctorsData = response.data.data || [];
        } else if (Array.isArray(response.data)) {
          doctorsData = response.data;
        }
        
        console.log('Doctors data:', doctorsData);
        setDoctors(doctorsData);
        
        // Extract unique specialties
        const uniqueSpecialties = [...new Set(
          doctorsData
            .map(d => d.specialtyId?.name)
            .filter(Boolean)
        )];
        setSpecialties(['all', ...uniqueSpecialties]);
      } else {
        console.log('No doctors data found');
        // Create mock data for testing
        const mockDoctors = [
          {
            _id: '1',
            title: 'BS.',
            user: {
              _id: '1',
              fullName: 'Nguyễn Văn A',
              email: 'doctor1@example.com',
              avatarUrl: 'https://placehold.co/200x200'
            },
            specialtyId: { _id: '1', name: 'Nội khoa' },
            hospitalId: { _id: '1', name: 'Bệnh viện Chợ Rẫy' },
            averageRating: 4.5,
            experience: 10,
            consultationFee: 300000
          },
          {
            _id: '2',
            title: 'TS.',
            user: {
              _id: '2',
              fullName: 'Trần Thị B',
              email: 'doctor2@example.com',
              avatarUrl: 'https://placehold.co/200x200'
            },
            specialtyId: { _id: '2', name: 'Tim mạch' },
            hospitalId: { _id: '2', name: 'Bệnh viện 115' },
            averageRating: 4.8,
            experience: 15,
            consultationFee: 500000
          },
          {
            _id: '3',
            title: 'BS.',
            user: {
              _id: '3',
              fullName: 'Lê Văn C',
              email: 'doctor3@example.com',
              avatarUrl: 'https://placehold.co/200x200'
            },
            specialtyId: { _id: '3', name: 'Nhi khoa' },
            hospitalId: { _id: '3', name: 'Bệnh viện Nhi Đồng' },
            averageRating: 4.3,
            experience: 8,
            consultationFee: 250000
          }
        ];
        setDoctors(mockDoctors);
        setSpecialties(['all', 'Nội khoa', 'Tim mạch', 'Nhi khoa']);
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
      // Create mock data for testing
      const mockDoctors = [
        {
          _id: '1',
          title: 'BS.',
          user: {
            _id: '1',
            fullName: 'Nguyễn Văn A',
            email: 'doctor1@example.com',
            avatarUrl: 'https://placehold.co/200x200'
          },
          specialtyId: { _id: '1', name: 'Nội khoa' },
          hospitalId: { _id: '1', name: 'Bệnh viện Chợ Rẫy' },
          averageRating: 4.5,
          experience: 10,
          consultationFee: 300000
        },
        {
          _id: '2',
          title: 'TS.',
          user: {
            _id: '2',
            fullName: 'Trần Thị B',
            email: 'doctor2@example.com',
            avatarUrl: 'https://placehold.co/200x200'
          },
          specialtyId: { _id: '2', name: 'Tim mạch' },
          hospitalId: { _id: '2', name: 'Bệnh viện 115' },
          averageRating: 4.8,
          experience: 15,
          consultationFee: 500000
        },
        {
          _id: '3',
          title: 'BS.',
          user: {
            _id: '3',
            fullName: 'Lê Văn C',
            email: 'doctor3@example.com',
            avatarUrl: 'https://placehold.co/200x200'
          },
          specialtyId: { _id: '3', name: 'Nhi khoa' },
          hospitalId: { _id: '3', name: 'Bệnh viện Nhi Đồng' },
          averageRating: 4.3,
          experience: 8,
          consultationFee: 250000
        }
      ];
      setDoctors(mockDoctors);
      setSpecialties(['all', 'Nội khoa', 'Tim mạch', 'Nhi khoa']);
    } finally {
      setLoading(false);
    }
  };

  const filterDoctors = () => {
    let filtered = doctors;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(doctor =>
        doctor.user?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialtyId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.hospitalId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by active status
    if (selectedFilter === 'active') {
      filtered = filtered.filter(doctor => doctor.isActive !== false);
    }

    // Filter by specialty
    if (selectedSpecialty !== 'all') {
      filtered = filtered.filter(doctor => doctor.specialtyId?.name === selectedSpecialty);
    }

    setFilteredDoctors(filtered);
  };

  const handleDoctorPress = (doctor: Doctor) => {
    console.log('Doctor pressed:', doctor.user?.fullName);
    // TODO: Navigate to doctor detail
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const renderDoctorCard = (doctor: Doctor) => (
    <TouchableOpacity
      key={doctor._id}
      style={styles.doctorCard}
      onPress={() => handleDoctorPress(doctor)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {doctor.user?.avatarUrl ? (
          <Image
            source={{ uri: doctor.user.avatarUrl }}
            style={styles.doctorAvatar}
            defaultSource={{ uri: 'https://placehold.co/200x200' }}
          />
        ) : (
          <View style={styles.defaultAvatar}>
            <Ionicons name="person" size={40} color="#0a84ff" />
          </View>
        )}
      </View>
      <View style={styles.doctorContent}>
        <Text style={styles.doctorName} numberOfLines={1}>
          {doctor.title || 'BS.'} {doctor.user?.fullName || 'Chưa cập nhật'}
        </Text>
        <Text style={styles.specialty} numberOfLines={1}>
          {doctor.specialtyId?.name || 'Đang cập nhật chuyên khoa'}
        </Text>
        <Text style={styles.hospital} numberOfLines={1}>
          {doctor.hospitalId?.name || 'Đang cập nhật bệnh viện'}
        </Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={12} color="#ff9500" />
          <Text style={styles.rating}>
            {doctor.averageRating ? Number(doctor.averageRating).toFixed(1) : 'N/A'}
          </Text>
          <Text style={styles.experience}>
            • {typeof doctor.experience === 'number' ? `${doctor.experience} năm kinh nghiệm` : 'Chưa cập nhật'}
          </Text>
        </View>
        <View style={styles.feeContainer}>
          <Text style={styles.consultationFee}>
            {doctor.consultationFee ? `${doctor.consultationFee.toLocaleString('vi-VN')}đ` : 'Liên hệ'}
          </Text>
        </View>
        <TouchableOpacity style={styles.consultButton}>
          <Text style={styles.consultButtonText}>Tư vấn ngay</Text>
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
        <Text style={styles.headerTitle}>Danh sách bác sĩ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm bác sĩ..."
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

      {/* Specialty Filter */}
      <View style={styles.specialtyFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {specialties.map((specialty) => (
            <TouchableOpacity
              key={specialty}
              style={[
                styles.filterButton,
                selectedSpecialty === specialty && styles.filterButtonActive
              ]}
              onPress={() => setSelectedSpecialty(specialty)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedSpecialty === specialty && styles.filterButtonTextActive
              ]}>
                {specialty === 'all' ? 'Tất cả chuyên khoa' : specialty}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredDoctors.length} bác sĩ
        </Text>
      </View>

      {/* Doctor List */}
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
          {filteredDoctors.length > 0 ? (
            filteredDoctors.map(renderDoctorCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="person" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Không tìm thấy bác sĩ nào</Text>
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
  specialtyFilterContainer: {
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
  doctorCard: {
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
    minHeight: 140,
  },
  avatarContainer: {
    width: 100,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
  },
  doctorAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
  },
  defaultAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a84ff',
  },
  doctorContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  doctorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  specialty: {
    fontSize: 14,
    color: '#0a84ff',
    marginBottom: 2,
  },
  hospital: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rating: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '600',
    marginLeft: 4,
    marginRight: 8,
  },
  experience: {
    fontSize: 12,
    color: '#666',
  },
  feeContainer: {
    marginBottom: 8,
  },
  consultationFee: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  consultButton: {
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
  consultButtonText: {
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
