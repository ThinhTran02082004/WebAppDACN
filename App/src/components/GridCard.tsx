import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  title: string;
  icon?: any;
  onPress?: () => void;
};

export default function GridCard({ title, icon, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconWrap}>
        {icon ? (
          <Image source={icon} style={styles.icon} />
        ) : (
          <View style={styles.placeholderIcon} />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    marginBottom: 8,
  },
  icon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  placeholderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
  },
  title: {
    fontSize: 13,
    textAlign: 'center',
  },
});
