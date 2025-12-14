import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import ToastService from '../services/ToastService';

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation();

  const handleLogout = async () => {
    Alert.alert('Xác nhận', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { 
        text: 'Đăng xuất', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await signOut();
            ToastService.show('success', 'Đăng xuất thành công', 'Bạn đã đăng xuất khỏi tài khoản');
          } catch (e: any) {
            ToastService.show('error', 'Lỗi đăng xuất', e.message || 'Không thể đăng xuất');
          }
        } 
      }
    ]);
  };

  const handleLogin = () => {
    navigation.navigate('Login' as never);
  };

  const handleRegister = () => {
    navigation.navigate('Register' as never);
  };

  const menuItems = [
    {
      id: '1',
      title: 'Thông tin cá nhân',
      icon: 'person',
      iconColor: '#3498DB',
      onPress: () => {
        if (user) {
          navigation.navigate('Profile' as never);
        } else {
          navigation.navigate('Login' as never);
        }
      },
    },
    {
      id: '2',
      title: 'Bác sĩ yêu thích',
      icon: 'heart',
      iconColor: '#E74C3C',
      onPress: () => {
        if (user) {
          navigation.navigate('FavoriteDoctors' as never);
        } else {
          navigation.navigate('Login' as never);
        }
      },
    },
    {
      id: 'payment_history',
      title: 'Lịch sử thanh toán',
      icon: 'card',
      iconColor: '#2ECC71',
      onPress: () => {
        if (user) {
          navigation.navigate('PaymentHistory' as never);
        } else {
          navigation.navigate('Login' as never);
        }
      },
    },
    {
      id: 'video_call_history',
      title: 'Lịch sử Videocall',
      icon: 'videocam',
      iconColor: '#E74C3C',
      onPress: () => {
        if (user) {
          navigation.navigate('VideoCallHistory' as never);
        } else {
          navigation.navigate('Login' as never);
        }
      },
    },
    {
      id: '3',
      title: 'Đổi mật khẩu',
      icon: 'key',
      iconColor: '#F39C12',
      onPress: () => {
        if (user) {
          navigation.navigate('ChangePassword' as never);
        } else {
          navigation.navigate('Login' as never);
        }
      },
    },
    {
      id: '4',
      title: 'Quy định sử dụng',
      icon: 'shield-checkmark',
      iconColor: '#4A90E2',
      onPress: () => navigation.navigate('UsageRegulations' as never),
    },
    {
      id: '5',
      title: 'Chính sách bảo mật',
      icon: 'lock-closed',
      iconColor: '#9B59B6',
      onPress: () => navigation.navigate('PrivacyPolicy' as never),
    },
    {
      id: '6',
      title: 'Điều khoản dịch vụ',
      icon: 'document-text',
      iconColor: '#E67E22',
      onPress: () => navigation.navigate('TermsOfService' as never),
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />
      
      {/* Header Section */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (navigation as any)?.goBack?.() || (navigation as any)?.navigate?.('Home')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ 
                uri: user?.avatarUrl || 'https://placehold.co/120x120' 
              }}
              style={styles.avatar}
              defaultSource={{ uri: 'https://placehold.co/120x120' }}
            />
          </View>
          
          <Text style={styles.userName}>
            {user ? (user.fullName || user.email || 'User') : 'Guest User'}
          </Text>
          
          {user ? (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Đăng xuất</Text>
              <Ionicons name="chevron-forward" size={16} color="#007AFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.authButtonsContainer}>
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Đăng nhập</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
                <Text style={styles.registerButtonText}>Đăng ký</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Content Section */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Điều khoản và quy định</Text>
          
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.iconColor }]}>
                <Ionicons name={item.icon as any} size={20} color="#fff" />
              </View>
              
              <Text style={styles.menuTitle}>{item.title}</Text>
              
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    backgroundColor: '#90CAF9',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  logoutButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  authButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  loginButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  loginButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  contentContainer: {
    paddingBottom: 80,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
});
