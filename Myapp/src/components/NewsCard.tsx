import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { NewsItem } from '../services/api';

type Props = {
  news: NewsItem;
  onPress?: (news: NewsItem) => void;
};

export default function NewsCard({ news, onPress }: Props) {
  const handlePress = () => {
    onPress?.(news);
  };

  return (
    <TouchableOpacity
      style={styles.newsCard}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {news.image?.secureUrl ? (
        <Image
          source={{ uri: news.image.secureUrl }}
          style={styles.newsImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.newsImagePlaceholder}>
          <Ionicons name="newspaper" size={24} color="#ccc" />
        </View>
      )}
      <Text style={styles.newsTitle} numberOfLines={2}>
        {news.title}
      </Text>
      {news.summary ? (
        <Text style={styles.newsSummary} numberOfLines={2}>
          {news.summary}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  newsCard: {
    width: 170,
    height: 200,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  newsImage: {
    height: 100,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginBottom: 8,
  },
  newsImagePlaceholder: {
    height: 100,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  newsSummary: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
});
