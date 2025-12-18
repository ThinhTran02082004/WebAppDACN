import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { NewsItem, apiService } from '../../services/api';

type Props = {
  navigation: any;
};

export default function NewsListScreen({ navigation }: Props) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    loadNews();
  }, []);

  useEffect(() => {
    filterNews();
  }, [searchQuery, selectedFilter, news]);

  const loadNews = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNews({ limit: 100, isPublished: true as any });
      if (response.success && (response as any).data) {
        // Handle different response structures (API có thể trả về nhiều dạng)
        let newsData: NewsItem[] = [];
        const respData: any = (response as any).data;

        if (respData && 'news' in respData) {
          newsData = respData.news || [];
        } else if (respData && 'data' in respData) {
          newsData = respData.data || [];
        } else if (Array.isArray(respData)) {
          newsData = respData as NewsItem[];
        }
        
        setNews(newsData);
      } else {
        setNews([]);
      }
    } catch (error) {
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const filterNews = () => {
    let filtered = news;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filter by published status
    if (selectedFilter === 'published') {
      filtered = filtered.filter(item => item.isPublished !== false);
    }

    setFilteredNews(filtered);
  };

  const handleNewsPress = (newsItem: NewsItem) => {
    navigation.navigate('NewsDetail', { newsId: newsItem._id });
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const renderNewsCard = (newsItem: NewsItem) => (
    <TouchableOpacity
      key={newsItem._id}
      style={styles.newsListCard}
      activeOpacity={0.8}
      onPress={() => handleNewsPress(newsItem)}
    >
      {newsItem.image?.secureUrl ? (
        <Image
          source={{ uri: newsItem.image.secureUrl }}
          style={styles.newsListImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.newsListImagePlaceholder}>
          <Ionicons name="newspaper-outline" size={28} color="#a0aec0" />
        </View>
      )}
      <View style={styles.newsListContent}>
        <Text style={styles.newsListDate}>{formatDate(newsItem.createdAt || new Date())}</Text>
        <Text style={styles.newsListTitle} numberOfLines={2}>
          {newsItem.title}
        </Text>
        {newsItem.summary ? (
          <Text style={styles.newsListSummary} numberOfLines={3}>
            {newsItem.summary}
          </Text>
        ) : null}
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
        <Text style={styles.headerTitle}>Tin tức</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm tin tức..."
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
              selectedFilter === 'published' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('published')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'published' && styles.filterButtonTextActive
            ]}>
              Đã xuất bản
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {filteredNews.length} tin tức
        </Text>
      </View>

      {/* News List */}
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
          {filteredNews.length > 0 ? (
            filteredNews.map(renderNewsCard)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Không tìm thấy tin tức nào</Text>
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
  newsListCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  newsListImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#e5e7eb',
  },
  newsListImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f1f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsListContent: {
    padding: 16,
  },
  newsListDate: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 6,
  },
  newsListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 24,
  },
  newsListSummary: {
    marginTop: 8,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
});

