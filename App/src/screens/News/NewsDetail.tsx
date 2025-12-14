import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { NewsItem, apiService } from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';


export default function NewsDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { newsId } = route.params as { newsId: string };
  
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNewsDetail();
  }, [newsId]);

  const loadNewsDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getNews({ limit: 1000, isPublished: true as any });
      
      if (response.success && response.data) {
        let newsData: NewsItem[] = [];
        if ('news' in response.data) {
          newsData = (response.data as any).news || [];
        } else if ('data' in response.data) {
          newsData = (response.data as any).data || [];
        } else if (Array.isArray(response.data)) {
          newsData = response.data as NewsItem[];
        }
        
        const foundNews = newsData.find((item: NewsItem) => item._id === newsId);
        if (foundNews) {
          setNews(foundNews);
        } else {
          setError('Không tìm thấy tin tức');
        }
      } else {
        setError('Không thể tải tin tức');
      }
    } catch (error) {
      console.error('Error loading news detail:', error);
      setError('Có lỗi xảy ra khi tải tin tức');
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };


  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNewsDetail}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!news) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="newspaper" size={64} color="#ccc" />
          <Text style={styles.errorText}>Không tìm thấy tin tức</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* News Image */}
        <View style={styles.imageContainer}>
          {news.image?.secureUrl ? (
            <Image 
              source={{ uri: news.image.secureUrl }} 
              style={styles.newsImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="newspaper" size={48} color="#ccc" />
            </View>
          )}
        </View>

        {/* News Content */}
        <View style={styles.contentContainer}>
          {/* Title */}
          <Text style={styles.newsTitle}>{news.title}</Text>

          {/* Meta Information */}
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.metaText}>
                {formatDate(news.publishDate || news.createdAt || new Date())}
              </Text>
            </View>
            
            {news.category && (
              <View style={styles.metaItem}>
                <Ionicons name="folder-outline" size={16} color="#666" />
                <Text style={styles.metaText}>{news.category}</Text>
              </View>
            )}
          </View>

          {/* Summary */}
          {news.summary && (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryText}>{news.summary}</Text>
            </View>
          )}

          {/* Content */}
          {news.content && (
            <View style={styles.contentTextContainer}>
              <Text style={styles.contentText}>{news.content}</Text>
            </View>
          )}

          {/* Author */}
          {news.author && (
            <View style={styles.authorContainer}>
              <Ionicons name="person-outline" size={16} color="#666" />
              <Text style={styles.authorText}>
                Tác giả: {typeof news.author === 'string' ? news.author : news.author.fullName}
              </Text>
            </View>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tin tức</Text>
        <View style={styles.shareButton} />
      </View>

      {/* Content */}
      {renderContent()}
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
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  newsImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '100%',
  },
  newsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    lineHeight: 32,
    marginBottom: 16,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0a84ff',
  },
  summaryText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  contentTextContainer: {
    marginBottom: 20,
  },
  contentText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 26,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  authorText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0a84ff',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
