import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import type { ServiceItem } from '../services/api';

type Props = {
  service: ServiceItem;
  onPress?: (service: ServiceItem) => void;
  onBookingPress?: (service: ServiceItem) => void;
};

export default function ServiceCard({ service, onPress, onBookingPress }: Props) {
  const handleCardPress = () => {
    onPress?.(service);
  };

  const handleBookingPress = () => {
    onBookingPress?.(service);
  };

  return (
    <TouchableOpacity
      key={service._id}
      style={styles.serviceCard}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: service.imageUrl || (service as any).image?.secureUrl || 'https://placehold.co/160x120' }}
        style={styles.serviceImage}
        defaultSource={{ uri: 'https://placehold.co/160x120' }}
      />
      <View style={styles.serviceContent}>
        <Text numberOfLines={2} style={styles.serviceName}>
          {service.name}
        </Text>
        {service.description && (
          <Text numberOfLines={2} style={styles.serviceDescription}>
            {service.description}
          </Text>
        )}
        <Text style={styles.servicePrice}>
          {(service.price || 0).toLocaleString('vi-VN')}đ
        </Text>
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
});


