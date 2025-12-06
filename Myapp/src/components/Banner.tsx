import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Image, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  TouchableOpacity,
  Text 
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Cấu hình tốc độ banner
const BANNER_CONFIG = {
  AUTO_SCROLL_INTERVAL: 5000, 
  SCROLL_ANIMATION_DURATION: 1000,
  SNAP_THRESHOLD: 0.1, 
};

// Sử dụng ảnh local - Bỏ comment dòng require và thay URL
const bannerData = [
  {
    id: 1,
    imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=200&fit=crop',
    title: 'Khám sức khỏe tổng quát',
    subtitle: 'Đặt lịch khám ngay hôm nay'
  },
  {
    id: 2,
    imageUrl: require('../../backgrounds/tuvan.jpg'),
    title: 'Tư vấn trực tuyến',
    subtitle: 'Bác sĩ chuyên khoa 24/7'
  },
  {
    id: 3,
    imageUrl: require('../../backgrounds/vaccine-cho-tre-em.jpg'), 
    title: 'Tiêm vaccine cho trẻ em ',
    subtitle: 'Gói khám cao cấp'
  },
  {
    id: 4,
    imageUrl: require('../../backgrounds/chatbot-ai-support.png'), 
    title: 'Chatbot hỗ trợ tư vấn',
    subtitle: 'Gói khám ưu đãi đặc biệt'
  }
];

export default function Banner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto scroll functionality
  useEffect(() => {
    const startAutoScroll = () => {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % bannerData.length;
          const bannerWidth = screenWidth - 32; // Width của banner item
          scrollViewRef.current?.scrollTo({
            x: nextIndex * bannerWidth,
            animated: true,
          });
          return nextIndex;
        });
      }, BANNER_CONFIG.AUTO_SCROLL_INTERVAL);
    };

    startAutoScroll();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const bannerWidth = screenWidth - 32; // Width của banner item
    const index = Math.round(contentOffsetX / bannerWidth);
    setCurrentIndex(index);
  };

  const handleScrollEnd = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const bannerWidth = screenWidth - 32;
    
    // Tính toán index dựa trên vị trí hiện tại
    const currentPosition = contentOffsetX / bannerWidth;
    const currentIndex = Math.floor(currentPosition);
    const remainder = currentPosition - currentIndex;
    
    let targetIndex;
    
    // Sử dụng SNAP_THRESHOLD để quyết định snap
    if (remainder < BANNER_CONFIG.SNAP_THRESHOLD) {
      // Snap về ảnh hiện tại
      targetIndex = currentIndex;
    } else if (remainder > (1 - BANNER_CONFIG.SNAP_THRESHOLD)) {
      // Snap đến ảnh tiếp theo
      targetIndex = currentIndex + 1;
    } else {
      // Snap đến ảnh gần nhất
      targetIndex = Math.round(currentPosition);
    }
    
    // Đảm bảo index trong phạm vi hợp lệ
    const clampedIndex = Math.max(0, Math.min(targetIndex, bannerData.length - 1));
    
    // Snap to nearest banner
    scrollViewRef.current?.scrollTo({
      x: clampedIndex * bannerWidth,
      animated: true,
    });
    setCurrentIndex(clampedIndex);
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    const bannerWidth = screenWidth - 32; // Width của banner item
    scrollViewRef.current?.scrollTo({
      x: index * bannerWidth,
      animated: true,
    });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled={false} // Tắt pagingEnabled để tự kiểm soát scroll
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScrollEnd} // Snap to nearest khi kết thúc scroll
          scrollEventThrottle={16}
          decelerationRate="fast"
          style={styles.scrollView}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {bannerData.map((banner, index) => (
            <TouchableOpacity key={banner.id} style={styles.bannerItem} activeOpacity={0.9}>
              <Image
                source={
                  typeof banner.imageUrl === 'number' 
                    ? banner.imageUrl 
                    : { uri: banner.imageUrl as string }
                }
                style={styles.bannerImage}
                resizeMode="cover"
                onError={() => console.log('Failed to load image:', banner.imageUrl)}
                defaultSource={{ uri: 'https://placehold.co/400x200/cccccc/666666?text=Image+Not+Found' }}
              />
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      {/* Dots indicator */}
      <View style={styles.dotsContainer}>
        {bannerData.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dot,
              currentIndex === index && styles.activeDot
            ]}
            onPress={() => handleDotPress(index)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 12,
  },
  container: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollView: {
    height: 180,
  },
  bannerItem: {
    width: screenWidth - 32, 
    height: 180,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#0a84ff',
    width: 10,
  },
});