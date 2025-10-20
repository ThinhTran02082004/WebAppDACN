import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  // Dimensions,
} from 'react-native';
import { Doctor } from '../services/api';
import Ionicons from '@react-native-vector-icons/ionicons';

// const { width } = Dimensions.get('window');
// const cardWidth = width - 32; // Full width minus padding

type Props = {
  doctor: Doctor;
  onConsultPress?: (doctor: Doctor) => void;
  onCardPress?: (doctor: Doctor) => void;
  vertical?: boolean;
};

export default function DoctorCard({ doctor, onConsultPress, onCardPress, vertical = false }: Props) {
  console.log('Rendering DoctorCard with doctor:', doctor);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleConsultPress = () => {
    onConsultPress?.(doctor);
  };

  const handleCardPress = () => {
    onCardPress?.(doctor);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  if (vertical) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.containerVertical]}
        onPress={handleCardPress}
        activeOpacity={0.8}
      >
        <View style={styles.avatarContainerVertical}>
          {imageLoading && (
            <ActivityIndicator 
              size="small" 
              color="#0a84ff" 
              style={styles.loadingIndicator}
            />
          )}
          <Image
            source={{ 
              uri: imageError 
                ? 'https://via.placeholder.com/160x120/0a84ff/ffffff?text=BS' 
                : doctor.user?.avatarUrl || 'https://via.placeholder.com/160x120/0a84ff/ffffff?text=BS'
            }}
            style={styles.avatarVertical}
            onLoad={handleImageLoad}
            onError={handleImageError}
            resizeMode="cover"
          />
        </View>

        <View style={styles.verticalContent}>
          <Text style={styles.doctorNameVertical} numberOfLines={1}>
            {doctor.title || 'BS.'} {doctor.user?.fullName || 'Chưa cập nhật'}
          </Text>

          <Text style={styles.specialtyVertical} numberOfLines={1}>
            {doctor.specialtyId?.name || 'Đang cập nhật chuyên khoa'}
          </Text>

          <View style={styles.ratingContainerVertical}>
            <Ionicons name="star" size={12} color="#ff9500" />
            <Text style={styles.rating}>
              {doctor.averageRating ? Number(doctor.averageRating).toFixed(1) : 'N/A'}
            </Text>
            <Text style={styles.experience}>
              • {typeof doctor.experience === 'number' ? `${doctor.experience} năm` : 'Chưa cập nhật'}
            </Text>
          </View>

          <View style={styles.verticalFooter}>
            <Text style={styles.feeVertical}>
              {typeof doctor.consultationFee === 'number' ? `${doctor.consultationFee.toLocaleString('vi-VN')}đ` : 'Liên hệ'}
            </Text>
            <TouchableOpacity
              style={styles.consultButtonVertical}
              onPress={handleConsultPress}
              activeOpacity={0.8}
            >
              <Text style={styles.consultButtonText}>Tư vấn</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <View style={styles.avatarContainer}>
            {imageLoading && (
              <ActivityIndicator 
                size="small" 
                color="#0a84ff" 
                style={styles.loadingIndicator}
              />
            )}
            <Image
              source={{ 
                uri: imageError 
                  ? 'https://via.placeholder.com/60x60/0a84ff/ffffff?text=BS' 
                  : doctor.user?.avatarUrl || 'https://via.placeholder.com/60x60/0a84ff/ffffff?text=BS'
              }}
              style={styles.avatar}
              onLoad={handleImageLoad}
              onError={handleImageError}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={styles.middleSection}>
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
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity
            style={styles.consultButton}
            onPress={handleConsultPress}
            activeOpacity={0.8}
          >
            <Text style={styles.consultButtonText}>Tư vấn ngay</Text>
          </TouchableOpacity>
          
          <Text style={styles.fee}>
            {(doctor.consultationFee || 0).toLocaleString('vi-VN')}đ
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 16,
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
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  leftSection: {
    marginRight: 12,
  },
  avatarContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0a84ff',
    backgroundColor: '#f0f0f0',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    zIndex: 1,
  },
  middleSection: {
    flex: 1,
    marginRight: 12,
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
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  rating: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '600',
    marginRight: 8,
  },
  experience: {
    fontSize: 12,
    color: '#666',
  },
  rightSection: {
    alignItems: 'center',
  },
  consultButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
  },
  consultButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  fee: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  /* Vertical styles */
  containerVertical: {
    width: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginHorizontal: 0,
    marginBottom: 0,
    elevation: 3,
  },
  avatarContainerVertical: {
    position: 'relative',
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatarVertical: {
    width: '100%',
    height: 120,
  },
  verticalContent: {
    padding: 12,
  },
  doctorNameVertical: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  specialtyVertical: {
    fontSize: 13,
    color: '#0a84ff',
    marginBottom: 6,
  },
  ratingContainerVertical: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeVertical: {
    fontSize: 13,
    color: '#333',
    fontWeight: '700',
  },
  consultButtonVertical: {
    backgroundColor: '#0a84ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  verticalFooter: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
