import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, StatusBar, SafeAreaView, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { getAvatarUrl, handleAvatarError } from '../utils/avatarUtils';
import * as ImagePicker from 'react-native-image-picker';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    email: '',
    phoneNumber: '',
    address: '',
  });

  React.useEffect(() => {
    if (!user) {
      // Redirect unauthenticated users to Login
      (navigation as any).navigate('Login');
    } else {
      // Initialize form data with user data
      setFormData({
        fullName: user.fullName || '',
        dateOfBirth: user.dateOfBirth ? (() => {
          const dateStr = user.dateOfBirth;
          if (dateStr.includes('/')) return dateStr;
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('vi-VN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
              });
            }
          } catch (e) {}
          return dateStr;
        })() : '',
        gender: user.gender || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: (user as any)?.address || '',
      });
    }
  }, [user]);

  const handleBack = () => navigation.goBack();

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    // Reset form data to original user data
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        dateOfBirth: user.dateOfBirth ? (() => {
          const dateStr = user.dateOfBirth;
          if (dateStr.includes('/')) return dateStr;
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('vi-VN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
              });
            }
          } catch (e) {}
          return dateStr;
        })() : '',
        gender: user.gender || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: (user as any)?.address || '',
      });
    }
    setIsEditing(false);
  };

  const formatDateInput = (text: string) => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');
    
    // Format as DD/MM/YYYY
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
  };

  const handleDateOfBirthChange = (text: string) => {
    const formatted = formatDateInput(text);
    if (formatted.length <= 10) {
      setFormData({ ...formData, dateOfBirth: formatted });
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Convert dateOfBirth from DD/MM/YYYY to ISO format if needed
      let dateOfBirthISO = formData.dateOfBirth;
      if (formData.dateOfBirth && formData.dateOfBirth.includes('/')) {
        const [day, month, year] = formData.dateOfBirth.split('/');
        if (day && month && year && day.length === 2 && month.length === 2 && year.length === 4) {
          dateOfBirthISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          Alert.alert('Lỗi', 'Ngày sinh không đúng định dạng. Vui lòng nhập DD/MM/YYYY');
          setLoading(false);
          return;
        }
      } else if (formData.dateOfBirth) {
        // If already in ISO format, keep it
        dateOfBirthISO = formData.dateOfBirth;
      }

      // Validate required fields
      if (!formData.fullName || formData.fullName.trim() === '') {
        Alert.alert('Lỗi', 'Vui lòng nhập họ và tên');
        setLoading(false);
        return;
      }

      const updateData: any = {
        fullName: formData.fullName.trim(),
      };

      if (dateOfBirthISO) {
        updateData.dateOfBirth = dateOfBirthISO;
      }
      if (formData.gender) {
        updateData.gender = formData.gender;
      }
      if (formData.phoneNumber) {
        updateData.phoneNumber = formData.phoneNumber.trim();
      }
      if (formData.address) {
        updateData.address = formData.address.trim();
      }

      const response = await apiService.updateProfile(updateData);

      if (response.success && response.data) {
        // Update user in context
        updateUser(response.data);
        setIsEditing(false);
        Alert.alert('Thành công', 'Cập nhật thông tin thành công!');
      } else {
        throw new Error(response.message || 'Không thể cập nhật thông tin');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      const errorMessage = error.response?.data?.message || error.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert(
      'Thay đổi ảnh đại diện',
      'Chọn ảnh từ thư viện:',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Chọn ảnh',
          onPress: () => {
            ImagePicker.launchImageLibrary(
              {
                mediaType: 'photo' as ImagePicker.MediaType,
                quality: 0.8,
                maxWidth: 1024,
                maxHeight: 1024,
              },
              (response: ImagePicker.ImagePickerResponse) => {
                if (response.assets && response.assets[0]) {
                  handleImageSelected(response.assets[0]);
                }
              }
            );
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleImageSelected = async (asset: any) => {
    if (!asset.uri) return;

    try {
      setAvatarLoading(true);

      // Determine file type
      const fileType = asset.type || 'image/jpeg';
      const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;

      // Upload avatar
      // For Android, keep the full URI (including file:// if present)
      // For iOS, remove file:// prefix
      const imageUri = Platform.OS === 'ios' 
        ? asset.uri.replace('file://', '') 
        : asset.uri;
      
      const response = await apiService.uploadAvatar(
        imageUri,
        fileType,
        fileName
      );

      if (response.success && response.data) {
        // Update user in context
        updateUser(response.data);
        Alert.alert('Thành công', 'Cập nhật ảnh đại diện thành công!');
      } else {
        throw new Error(response.message || 'Không thể cập nhật ảnh đại diện');
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setAvatarLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
        {isEditing ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelHeaderButton}>
              <Text style={styles.cancelHeaderButtonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSave} 
              style={[styles.saveHeaderButton, loading && styles.saveHeaderButtonDisabled]}
              disabled={loading}
            >
              <Text style={styles.saveHeaderButtonText}>
                {loading ? 'Đang lưu...' : 'Lưu'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            {avatarLoading ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="large" color="#0a84ff" />
              </View>
            ) : null}
            <Image
              source={{ 
                uri: getAvatarUrl(user?.avatarUrl, user?.fullName || 'User')
              }}
              style={styles.avatar}
              onError={() => {
                // Fallback is handled by getAvatarUrl if avatarUrl is null/undefined
              }}
              defaultSource={{ uri: handleAvatarError(user?.fullName || 'User') }}
            />
          </View>
          <Text style={styles.nameText}>{user?.fullName || 'Chưa cập nhật'}</Text>
          <Text style={styles.roleText}>{user?.roleType === 'doctor' ? 'Bác sĩ' : user?.roleType === 'admin' ? 'Quản trị' : 'Người dùng'}</Text>
          {!isEditing && (
            <TouchableOpacity 
              onPress={handleAvatarPress} 
              style={styles.changeAvatarButton}
              disabled={avatarLoading}
            >
              <Ionicons name="camera-outline" size={18} color="#0a84ff" />
              <Text style={styles.changeAvatarButtonText}>Chỉnh sửa ảnh đại diện</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
            {!isEditing && (
              <TouchableOpacity onPress={handleEditProfile} style={styles.editButton}>
                <Ionicons name="create-outline" size={18} color="#0a84ff" />
                <Text style={styles.editButtonText}>Chỉnh sửa</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.itemRow}>
            <Ionicons name="person-outline" size={18} color="#0a84ff" />
            <Text style={styles.itemLabel}>Họ và tên</Text>
            {isEditing ? (
              <TextInput
                style={styles.itemInput}
                value={formData.fullName}
                onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                placeholder="Nhập họ và tên"
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.itemValue}>{user?.fullName || 'Chưa cập nhật'}</Text>
            )}
          </View>
          <View style={styles.itemRow}>
            <Ionicons name="calendar-outline" size={18} color="#0a84ff" />
            <Text style={styles.itemLabel}>Ngày sinh</Text>
            {isEditing ? (
              <TextInput
                style={styles.itemInput}
                value={formData.dateOfBirth}
                onChangeText={handleDateOfBirthChange}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={10}
              />
            ) : (
              <Text style={styles.itemValue}>
                {user?.dateOfBirth 
                  ? (() => {
                      // Handle DD/MM/YYYY format or ISO date string
                      const dateStr = user.dateOfBirth;
                      if (dateStr.includes('/')) {
                        // Already in DD/MM/YYYY format
                        return dateStr;
                      }
                      try {
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString('vi-VN', { 
                            year: 'numeric', 
                            month: '2-digit', 
                            day: '2-digit' 
                          });
                        }
                      } catch (e) {
                        // If parsing fails, return as is
                      }
                      return dateStr;
                    })()
                  : 'Chưa cập nhật'}
              </Text>
            )}
          </View>
          <View style={styles.itemRow}>
            <Ionicons name="male-female-outline" size={18} color="#0a84ff" />
            <Text style={styles.itemLabel}>Giới tính</Text>
            {isEditing ? (
              <View style={styles.genderContainerInline}>
                <TouchableOpacity
                  style={[
                    styles.genderButtonInline,
                    formData.gender === 'male' && styles.genderButtonSelectedInline
                  ]}
                  onPress={() => setFormData({ ...formData, gender: 'male' })}
                >
                  <Text style={[
                    styles.genderButtonTextInline,
                    formData.gender === 'male' && styles.genderButtonTextSelectedInline
                  ]}>
                    Nam
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButtonInline,
                    formData.gender === 'female' && styles.genderButtonSelectedInline
                  ]}
                  onPress={() => setFormData({ ...formData, gender: 'female' })}
                >
                  <Text style={[
                    styles.genderButtonTextInline,
                    formData.gender === 'female' && styles.genderButtonTextSelectedInline
                  ]}>
                    Nữ
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButtonInline,
                    formData.gender === 'other' && styles.genderButtonSelectedInline
                  ]}
                  onPress={() => setFormData({ ...formData, gender: 'other' })}
                >
                  <Text style={[
                    styles.genderButtonTextInline,
                    formData.gender === 'other' && styles.genderButtonTextSelectedInline
                  ]}>
                    Khác
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.itemValue}>
                {user?.gender === 'male' 
                  ? 'Nam' 
                  : user?.gender === 'female' 
                  ? 'Nữ' 
                  : user?.gender === 'other'
                  ? 'Khác'
                  : 'Chưa cập nhật'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liên hệ</Text>
          <View style={styles.itemRow}>
            <Ionicons name="mail-outline" size={18} color="#0a84ff" />
            <Text style={styles.itemLabel}>Email</Text>
            {isEditing ? (
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.itemInput, { backgroundColor: '#f9f9f9', color: '#999' }]}
                  value={formData.email}
                  editable={false}
                  placeholder="Email"
                  placeholderTextColor="#999"
                />
                <Text style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Email không thể thay đổi</Text>
              </View>
            ) : (
              <Text style={styles.itemValue}>{user?.email || 'Chưa cập nhật'}</Text>
            )}
          </View>
          <View style={styles.itemRow}>
            <Ionicons name="call-outline" size={18} color="#0a84ff" />
            <Text style={styles.itemLabel}>Điện thoại</Text>
            {isEditing ? (
              <TextInput
                style={styles.itemInput}
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.itemValue}>{user?.phoneNumber || 'Chưa cập nhật'}</Text>
            )}
          </View>
          <View style={[styles.itemRow, isEditing && { alignItems: 'flex-start' }]}>
            <Ionicons name="home-outline" size={18} color="#0a84ff" />
            <Text style={styles.itemLabel}>Địa chỉ</Text>
            {isEditing ? (
              <TextInput
                style={[styles.itemInput, styles.itemTextArea]}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="Nhập địa chỉ"
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.itemValue}>{(user as any)?.address || 'Chưa cập nhật'}</Text>
            )}
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
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
  profileCard: { backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', paddingVertical: 24, marginBottom: 12 },
  avatarWrap: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', borderWidth: 3, borderColor: '#0a84ff', marginBottom: 12, position: 'relative' },
  avatar: { width: '100%', height: '100%' },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  nameText: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 4 },
  roleText: { fontSize: 13, color: '#666' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  editButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  editButtonText: { fontSize: 14, color: '#0a84ff', fontWeight: '600', marginLeft: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemLabel: { marginLeft: 8, width: 100, color: '#555', fontSize: 14 },
  itemValue: { flex: 1, color: '#111', fontSize: 14, fontWeight: '600' },
  itemInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 40,
  },
  itemTextArea: {
    minHeight: 60,
    paddingTop: 8,
  },
  genderContainerInline: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  genderButtonInline: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  genderButtonSelectedInline: {
    backgroundColor: '#e3f2fd',
    borderColor: '#0a84ff',
  },
  genderButtonTextInline: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  genderButtonTextSelectedInline: {
    color: '#0a84ff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    position: 'absolute',
    right: 20,
    top: 50,
  },
  cancelHeaderButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cancelHeaderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  saveHeaderButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0a84ff',
  },
  saveHeaderButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  saveHeaderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  changeAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#0a84ff',
  },
  changeAvatarButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#0a84ff',
    fontWeight: '600',
  },
});


