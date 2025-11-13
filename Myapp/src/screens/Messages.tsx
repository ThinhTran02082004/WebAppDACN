import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';

export default function MessagesScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
        <Text style={styles.headerSubtitle}>Trao đổi nhanh với bác sĩ của bạn</Text>
      </View>

      <View style={styles.emptyState}>
        <Ionicons name="chatbubble-ellipses-outline" size={72} color="#a5b4fc" />
        <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
        <Text style={styles.emptyText}>
          Tin nhắn sẽ xuất hiện ở đây khi bạn trao đổi với bác sĩ hoặc nhân viên hỗ trợ.
        </Text>
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => (navigation as any)?.navigate?.('Home')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.exploreButtonText}>Tìm bác sĩ để trò chuyện</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
    backgroundColor: '#4c6ef5',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#e0e7ff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: -24,
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4c6ef5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    elevation: 2,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

