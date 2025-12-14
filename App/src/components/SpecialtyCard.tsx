import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Specialty } from '../types/specialty';
import Ionicons from '@react-native-vector-icons/ionicons';
import { AppIcons, IconColors, IconSizes } from '../config/icons';

interface SpecialtyCardProps {
  specialty: Specialty;
  onPress?: (specialty: Specialty) => void;
  onBookingPress?: (specialty: Specialty) => void;
}

export const SpecialtyCard = ({ specialty, onPress, onBookingPress }: SpecialtyCardProps) => {
  const [imageError, setImageError] = useState(false);

  const getImageUri = () => {
    if (typeof (specialty as any).image === 'string' && (specialty as any).image) {
      return (specialty as any).image;
    }
    if (typeof (specialty as any).imageUrl === 'string' && (specialty as any).imageUrl) {
      return (specialty as any).imageUrl;
    }
    if ((specialty as any).image && typeof (specialty as any).image === 'object') {
      const secureUrl = (specialty as any).image?.secureUrl;
      if (typeof secureUrl === 'string' && secureUrl) {
        return secureUrl;
      }
    }
    return null;
  };

  const imageUri = getImageUri();
  const hasImage = imageUri && !imageError;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(specialty)}
      activeOpacity={0.7}
    >
      {hasImage ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.specialtyImage}
          onError={() => setImageError(true)}
          onLoadStart={() => setImageError(false)}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name={AppIcons.specialtyOutline as any} size={IconSizes.lg} color={IconColors.primary} />
        </View>
      )}
      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {specialty.name}
          </Text>
          {specialty.description && (
            <Text style={styles.description} numberOfLines={2}>
              {specialty.description}
            </Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.bookingButton} 
          onPress={(e) => {
            e.stopPropagation();
            onBookingPress ? onBookingPress(specialty) : onPress?.(specialty);
          }}
        >
          <Text style={styles.bookingButtonText}>Đặt khám ngay</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: 170,
    height: 245,
    marginRight: 16,
    marginBottom: 18,
    overflow: 'hidden',
  },
  specialtyImage: {
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
  contentContainer: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  bookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'stretch',
    marginTop: 'auto',
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});