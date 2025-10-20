import React from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

type Props = {
  userName?: string;
  isLoggedIn?: boolean;
  avatarUrl?: string;
};

export default function HeaderSearch({ userName, isLoggedIn = false, avatarUrl }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarRow}>
        <Image
          source={{ uri: (avatarUrl && avatarUrl.length) ? avatarUrl : 'https://placehold.co/64x64' }}
          style={styles.avatar}
        />
        <Text style={styles.greeting}>
          {isLoggedIn && userName ? `Xin chào, ${userName}` : 'Xin chào'}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Tìm CSYT/bác sĩ/chuyên khoa/dịch vụ"
            style={styles.input}
            placeholderTextColor="#666"
          />
          <TouchableOpacity style={styles.searchIconContainer} activeOpacity={0.7}>
            <Ionicons name="search" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 30, 
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  greeting: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
  },
  searchIconContainer: {
    padding: 4,
  },
  searchIcon: {
    color: '#666',
    fontSize: 16,
  },
});