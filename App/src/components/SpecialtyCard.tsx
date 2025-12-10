import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Specialty } from '../types/specialty';
import Ionicons from '@react-native-vector-icons/ionicons';
import { AppIcons, IconColors } from '../config/icons';
import { normalizeImageSource } from '../utils/helpers';

interface SpecialtyCardProps {
  specialty: Specialty;
  size?: 'small' | 'medium' | 'large';
  onPress?: (specialty: Specialty) => void;
}

export const SpecialtyCard = ({ specialty, size = 'medium', onPress }: SpecialtyCardProps) => {
  const cardStyle = [
    styles.card,
    size === 'small' && styles.smallCard,
    size === 'large' && styles.largeCard,
  ];

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={() => onPress?.(specialty)}
      activeOpacity={0.7}
    >
      <Image
        source={normalizeImageSource(specialty.image, 'https://placehold.co/160x120')}
        style={styles.specialtyImage}
        defaultSource={{ uri: 'https://placehold.co/160x120' }}
      />
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {specialty.name}
        </Text>
        {size !== 'small' && specialty.description && (
          <Text style={styles.description} numberOfLines={2}>
            {specialty.description}
          </Text>
        )}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name={AppIcons.doctor} size={14} color={IconColors.primary} />
            <Text style={styles.statsText}>{specialty.doctorCount || 0} </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name={AppIcons.service} size={14} color={IconColors.primary} />
            <Text style={styles.statsText}>{specialty.serviceCount || 0} </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bookingButton} onPress={() => onPress?.(specialty)}>
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
    width: 160,
    height: 280,
    marginRight: 12,
    marginBottom: 18,
    overflow: 'hidden',
  },
  smallCard: {
    width: 120,
    height: 140,
  },
  largeCard: {
    width: 160,
    height:280,
  },
  specialtyImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    padding: 12,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statsText: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
    marginLeft: 4,
  },
  bookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
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