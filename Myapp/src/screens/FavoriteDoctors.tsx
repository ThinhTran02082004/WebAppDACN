import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { apiService, Doctor } from '../services/api';
import DoctorCard from '../components/DoctorCard';

export default function FavoriteDoctorsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const loadFavoriteDoctors = useCallback(async () => {
    if (!user) {
      (navigation as any).navigate('Login');
      return;
    }
    setLoading(true);
    try {
      const res = await apiService.getFavoriteDoctors();
      if (res && !res.success) {
        // Check if it's an authentication error
        const errorMessage = (res as any)?.message || '';
        if (errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
          // Token may be expired, redirect to login
          console.warn('Authentication required for favorites');
          setDoctors([]);
          return;
        }
      }
      const data = (res?.data as any);
      const list: Doctor[] = Array.isArray(data) ? data : (data?.doctors || []);
      setDoctors(list);
    } catch (error: any) {
      console.error('Error loading favorite doctors:', error);
      // Check if it's a 401 or authentication error
      const errorMessage = error?.message || error?.response?.data?.message || '';
      if (error?.response?.status === 401 || errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
        // Authentication error - token expired or invalid
        console.warn('Authentication required, token may be expired');
        setDoctors([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadFavoriteDoctors();
    }, [loadFavoriteDoctors])
  );

  const handleBack = () => (navigation as any).goBack();
  const handleCardPress = (doc: any) => (navigation as any).navigate('DoctorDetail', { id: doc._id });
  const handleConsultPress = (doc: any) => {
    // Navigate to booking screen with pre-filled doctor data
    const specialtyId = typeof doc.specialtyId === 'object' 
      ? doc.specialtyId._id 
      : doc.specialtyId;
    const hospitalId = typeof doc.hospitalId === 'object' 
      ? doc.hospitalId._id 
      : doc.hospitalId;
    
    (navigation as any).navigate('Booking', {
      doctorId: doc._id,
      specialtyId: specialtyId || undefined,
      hospitalId: hospitalId || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bác sĩ yêu thích</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a84ff" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {doctors && doctors.length > 0 ? (
            <View style={styles.listWrap}>
              {doctors.map((doctor) => (
                <View key={doctor._id} style={styles.cardWrap}>
                  <DoctorCard doctor={doctor as any} onConsultPress={handleConsultPress} onCardPress={handleCardPress} vertical={true} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="heart-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Chưa có bác sĩ yêu thích</Text>
              <Text style={styles.emptyDesc}>Hãy thêm bác sĩ vào danh sách yêu thích để dễ dàng theo dõi</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: '#90CAF9',
    paddingTop: 50,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  backButton: { position: 'absolute', top: 50, left: 20, zIndex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 80 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  listWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  cardWrap: { width: 160, marginRight: 16, marginBottom: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, backgroundColor: '#fff', margin: 16, borderRadius: 12 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#666' },
  emptyDesc: { marginTop: 4, fontSize: 14, color: '#999', textAlign: 'center', paddingHorizontal: 16 },
});


