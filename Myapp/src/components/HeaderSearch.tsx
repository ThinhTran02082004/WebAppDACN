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
  onAvatarPress?: () => void;
};

export default function HeaderSearch({ userName, isLoggedIn = false, avatarUrl, onAvatarPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarRow}>
        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
          <Image
            source={{ uri: (avatarUrl && avatarUrl.length) ? avatarUrl : 'https://placehold.co/64x64' }}
            style={styles.avatar}
          />
        </TouchableOpacity>
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>
            {isLoggedIn && userName ? 'Xin chào,' : 'Xin chào,'}
          </Text>
          {isLoggedIn && userName && (
            <Text style={styles.userName}>
              {userName}
            </Text>
          )}
        </View>
      </View>

      {/* Search removed as requested */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: 12,
    backgroundColor: '#BBDEFB', 
    paddingTop: 40, 
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 0, 
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
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
    fontSize: 22,
  },
});