import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { Hospital } from '../services/api';

type Props = {
  facility: Hospital;
  onPress?: (facility: Hospital) => void;
  onBookingPress?: (facility: Hospital) => void;
};

export default function FacilityCard({ facility, onPress, onBookingPress }: Props) {
  const handlePress = () => {
    onPress?.(facility);
  };

  const handleBookingPress = () => {
    onBookingPress?.(facility);
  };

  return (
    <TouchableOpacity
      style={styles.facilityItem}
      onPress={handlePress}
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
        <View style={styles.textContainer}>
          <Text style={styles.facilityName} numberOfLines={2}>
            {facility.name}
          </Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={10} color="#666" />
            <Text style={styles.facilityAddress} numberOfLines={1}>
              {facility.address}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.facilityBookingButton}
          onPress={(e) => {
            e.stopPropagation();
            handleBookingPress();
          }}
        >
          <Text style={styles.facilityBookingButtonText}>Đặt khám ngay</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  facilityItem: {
    width: 170,
    height: 255,
    marginRight: 16,
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
    justifyContent: 'space-between',
  },
  textContainer: {
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
    marginTop: 'auto',
    alignSelf: 'stretch',
  },
  facilityBookingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

