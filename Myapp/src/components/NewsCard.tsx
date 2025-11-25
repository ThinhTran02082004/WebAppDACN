import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { NewsItem } from '../services/api';

interface NewsCardProps {
  newsItem: NewsItem;
  onPress: (newsItem: NewsItem) => void;
}

export default function NewsCard({ newsItem, onPress }: NewsCardProps) {
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <TouchableOpacity
      style={styles.newsCard}
      onPress={() => onPress(newsItem)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {newsItem.image?.secureUrl ? (
          <Image 
            source={{ uri: newsItem.image.secureUrl }} 
            style={styles.newsImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="newspaper" size={32} color="#ccc" />
          </View>
        )}
      </View>
      
      <View style={styles.newsContent}>
        <Text style={styles.newsTitle} numberOfLines={2}>
          {newsItem.title}
        </Text>
        
        {newsItem.summary && (
          <Text style={styles.newsSummary} numberOfLines={3}>
            {newsItem.summary}
          </Text>
        )}
        
        <View style={styles.newsFooter}>
          <View style={styles.newsDate}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.newsDateText}>
              {formatDate(newsItem.publishDate || newsItem.createdAt || new Date())}
            </Text>
          </View>
          
          {newsItem.author && (
            <View style={styles.newsAuthor}>
              <Ionicons name="person-outline" size={14} color="#666" />
              <Text style={styles.newsAuthorText}>
                {typeof newsItem.author === 'string' ? newsItem.author : newsItem.author.fullName}
              </Text>
            </View>
          )}
        </View>
        
        {newsItem.category && (
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryText}>{newsItem.category}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  newsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
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
  imageContainer: {
    width: '100%',
    height: 180,
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
  newsContent: {
    padding: 16,
  },
  newsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  newsSummary: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newsDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newsDateText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  newsAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newsAuthorText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  categoryContainer: {
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: '#0a84ff',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '500',
  },
});
