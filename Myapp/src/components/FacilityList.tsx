import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  // Dimensions,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

// const { width } = Dimensions.get('window');

type Facility = {
  _id: string;
  name: string;
  address: string;
  imageUrl?: string;
  image?: {
    secureUrl: string;
  };
};

type Props = {
  facilities: Facility[];
  onFacilityPress?: (facility: Facility) => void;
};

export default function FacilityList({ facilities, onFacilityPress }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / 132); // 120 + 12 margin
    setCurrentIndex(index);
  };

  const renderDots = () => {
    const totalPages = Math.ceil(facilities.length / 3); // Show 3 items per page
    return (
      <View style={styles.dotsContainer}>
        {Array.from({ length: totalPages }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index === currentIndex ? '#0a84ff' : '#ddd' } as any,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {facilities.map((facility) => (
          <TouchableOpacity
            key={facility._id}
            style={styles.facilityItem}
            onPress={() => onFacilityPress?.(facility)}
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
              <Text style={styles.facilityName} numberOfLines={2}>
                {facility.name}
              </Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location" size={10} color="#666" />
                <Text style={styles.facilityAddress} numberOfLines={1}>
                  {facility.address}
                </Text>
              </View>
              <TouchableOpacity style={styles.bookingButton} onPress={() => onFacilityPress?.(facility)}>
                <Text style={styles.bookingButtonText}>Đặt khám ngay</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {facilities.length > 3 && renderDots()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  facilityItem: {
    width: 160,
    height: 240,
    marginRight: 12,
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
  },
  locationIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  facilityAddress: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  bookingButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
