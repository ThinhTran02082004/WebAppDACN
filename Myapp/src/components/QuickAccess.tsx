import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, FlatList } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

const { width } = Dimensions.get('window');
const PAGE_ITEMS = 8; 
const COLS = 4;
const GAP = 0;
const ITEM_WIDTH = (width - 40 - (COLS - 1) * GAP) / COLS;

type QuickAccessItem = {
  id: string;
  title: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
};

type Props = {
  items: QuickAccessItem[];
  onItemPress?: (item: QuickAccessItem) => void;
};

export default function QuickAccess({ items, onItemPress }: Props) {
  const pages = useMemo(() => {
    const p: QuickAccessItem[][] = [];
    for (let i = 0; i < items.length; i += PAGE_ITEMS) {
      p.push(items.slice(i, i + PAGE_ITEMS));
    }
    return p;
  }, [items]);

  const [activePage, setActivePage] = useState(0);

  return (
    <View style={styles.container}>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, idx) => `page-${idx}`}
        onMomentumScrollEnd={(ev) => {
          const page = Math.round(ev.nativeEvent.contentOffset.x / width);
          setActivePage(page);
        }}
         renderItem={({ item: pageItems }) => (
           <View style={styles.page}>
             {/* first row - 4 items */}
             <View style={styles.row}>
               {Array.from({ length: COLS }).map((_, colIdx) => {
                 const it = pageItems[colIdx];
                 return (
                   <TouchableOpacity key={`f-${colIdx}`} style={styles.item} onPress={() => it && onItemPress?.(it)} activeOpacity={0.8}>
                     <Ionicons name={it?.icon as any || 'help'} size={25} color="#0a84ff" />
                     <Text style={styles.title} numberOfLines={2}>{it?.title || ''}</Text>
                   </TouchableOpacity>
                 );
               })}
             </View>

             {/* second row - remaining items */}
             <View style={styles.row}>
               {Array.from({ length: COLS }).map((_, colIdx) => {
                 const it = pageItems[COLS + colIdx];
                 return (
                   <TouchableOpacity key={`s-${colIdx}`} style={styles.item} onPress={() => it && onItemPress?.(it)} activeOpacity={0.8}>
                     <Ionicons name={it?.icon as any || 'help'} size={25} color="#0a84ff" />
                     <Text style={styles.title} numberOfLines={2}>{it?.title || ''}</Text>
                   </TouchableOpacity>
                 );
               })}
             </View>
           </View>
         )}
      />

      <View style={styles.dots}>
        {pages.map((_, i) => (
          <View key={`dot-${i}`} style={[styles.dot, activePage === i ? styles.dotActive : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 30,
    padding: 0,
    paddingTop: 16, // Increased padding top
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 3,
  },
  page: {
    width,
    paddingHorizontal: 2, 
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    paddingVertical: 24, // Increased padding vertical
    marginRight: 1, 
  },
  title: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
    lineHeight: 14,
    marginTop: 2, 
    fontWeight: '500',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  dotActive: {
    backgroundColor: '#0a84ff',
  },
});
