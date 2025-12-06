import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function Banner() {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://placehold.co/300x120/ff4444/ffffff?text=Banner+An+Khang' }}
        style={styles.bannerImage}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden', // Để bo góc ảnh
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerImage: {
    width: '100%',
    height: 120,
  },
});