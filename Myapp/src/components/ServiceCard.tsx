import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { ServiceItem } from '../services/api';

type Props = {
  service: ServiceItem;
  onPress?: (service: ServiceItem) => void;
  onBookingPress?: (service: ServiceItem) => void;
};

export default function ServiceCard({ service, onPress, onBookingPress }: Props) {
  const [imageError, setImageError] = useState(false);

  const handleCardPress = () => {
    onPress?.(service);
  };

  const handleBookingPress = () => {
    onBookingPress?.(service);
  };

  const imageUri = service.imageUrl || (service as any).image?.secureUrl;
  const hasImage = imageUri && !imageError;

  return (
    <TouchableOpacity
      key={service._id}
      style={styles.serviceCard}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      {hasImage ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.serviceImage}
          onError={() => setImageError(true)}
          onLoadStart={() => setImageError(false)}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="medical-outline" size={40} color="#999" />
        </View>
      )}
      <View style={styles.serviceContent}>
        <View style={styles.textContainer}>
          <Text numberOfLines={2} style={styles.serviceName}>
            {service.name}
          </Text>
          <View style={styles.descriptionContainer}>
            {(service.description || service.shortDescription) ? (
              <Text numberOfLines={2} style={styles.serviceDescription}>
                {service.description || service.shortDescription}
              </Text>
            ) : (
              <Text style={styles.serviceDescriptionPlaceholder}> </Text>
            )}
          </View>
          <Text style={styles.servicePrice}>
            {(service.price || 0).toLocaleString('vi-VN')}đ
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bookingButton}
          onPress={(e) => {
            e.stopPropagation();
            handleBookingPress();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.bookingButtonText}>Đặt khám</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  serviceCard: {
    width: 170,
    height: 280,
    marginRight: 16,
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
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
    minHeight: 36, // 2 lines * 18 lineHeight
  },
  descriptionContainer: {
    minHeight: 28, // 2 lines * 14 lineHeight
    marginBottom: 6,
    justifyContent: 'flex-start',
  },
  serviceDescription: {
    fontSize: 11,
    color: '#666',
    lineHeight: 14,
  },
  serviceDescriptionPlaceholder: {
    fontSize: 11,
    lineHeight: 14,
    color: 'transparent',
  },
  servicePrice: {
    fontSize: 13,
    color: '#0a84ff',
    fontWeight: '700',
    marginTop: 'auto',
  },
  bookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});


