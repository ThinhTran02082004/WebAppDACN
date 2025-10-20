import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  name: string;
  logo?: any;
  tag?: string;
  onPress?: () => void;
};

export default function FeaturedCard({ name, logo, tag, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <Image source={logo || { uri: 'https://placehold.co/120x60' }} style={styles.logo} />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {tag ? <Text style={styles.tag}>{tag}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f2f2f2',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  tag: {
    marginTop: 4,
    color: '#0a84ff',
  },
});
