import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator } from 'react-native';
import { apiService, Doctor } from '../services/api';

export default function DoctorDetail({ route }: any) {
  const { id } = route.params;
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiService.getDoctorById(id);
        if (res.success) setDoctor(res.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <ActivityIndicator style={{ flex: 1 } as any} />;

  if (!doctor) return <View style={styles.container}><Text>Không tìm thấy bác sĩ</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={{ uri: doctor.user.avatarUrl || 'https://placehold.co/160x160' }} style={styles.avatar} />
      <Text style={styles.name}>{doctor.title} {doctor.user.fullName}</Text>
      <Text style={styles.specialty}>{doctor.specialtyId.name}</Text>
      <Text style={styles.hospital}>{doctor.hospitalId.name}</Text>
      <Text style={styles.sectionTitle}>Mô tả</Text>
      <Text style={styles.description}>{doctor.description || 'Không có mô tả'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  content: { alignItems: 'center', padding: 16 },
  avatar: { width: 160, height: 160, borderRadius: 80, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700', color: '#222' },
  specialty: { fontSize: 16, color: '#0a84ff', marginTop: 6 },
  hospital: { fontSize: 14, color: '#666', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 12, alignSelf: 'flex-start' },
  description: { fontSize: 14, color: '#444', marginTop: 8, textAlign: 'left' },
});
