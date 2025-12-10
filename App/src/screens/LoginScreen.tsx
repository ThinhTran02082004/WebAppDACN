import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { ToastService } from '../services/ToastService';
import Ionicons from '@react-native-vector-icons/ionicons';
import { signInWithGoogle as expoGoogleSignIn } from '../config/googleConfig';

type Props = {
  navigation: any;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { signIn } = useAuth();
  const { signInWithGoogle } = useAuth();

  // Google Sign-In already configured above

  const handleLogin = async () => {
    if (!email || !password) {
      ToastService.show('error', 'Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    try {
      setLoading(true);
      await signIn(email, password, rememberMe);
      // show success and navigate to Home (reset stack so user can't go back to Login)
      ToastService.show('success', 'Thành công', 'Đăng nhập thành công');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (error: any) {
      if (error?.needVerification) {
        ToastService.show('info', 'Tài khoản chưa xác thực', error.message || 'Tài khoản cần xác thực. Vui lòng kiểm tra email.');
      } else {
        ToastService.show('error', 'Lỗi', error.message || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // Perform Google Sign-In using expo-auth-session
      console.log('[GoogleSignin] Starting Google Sign-In with expo-auth-session');
      const result = await expoGoogleSignIn();
      console.log('[GoogleSignin] Sign-In result:', result);
      
      // Get idToken or accessToken from result
      const idToken = result.idToken;
      const accessToken = result.accessToken;
      
      if (!idToken && !accessToken) {
        throw new Error('Không thể lấy token từ Google. Vui lòng kiểm tra cấu hình Google OAuth.');
      }
      
      // Prefer idToken, fallback to accessToken
      if (idToken) {
        console.log('[GoogleSignin] Using idToken for authentication');
        await signInWithGoogle(idToken, 'idToken', rememberMe);
      } else if (accessToken) {
        console.log('[GoogleSignin] Falling back to accessToken for authentication');
        await signInWithGoogle(accessToken, 'accessToken', rememberMe);
      }
      
      ToastService.show('success', 'Thành công', 'Đăng nhập bằng Google thành công');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      
      if (error.message?.includes('cancelled') || error.message?.includes('cancel')) {
        // User cancelled the sign-in process
        console.log('User cancelled Google Sign-In');
        // Don't show error for cancellation
      } else if (error.message?.includes('DEVELOPER_ERROR')) {
        ToastService.show('error', 'Lỗi cấu hình', 'Lỗi cấu hình Google OAuth. Vui lòng kiểm tra cấu hình.');
      } else {
        ToastService.show('error', 'Lỗi', error.message || 'Đăng nhập Google thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      // TODO: Implement Facebook Sign-In
      Alert.alert('Thông báo', 'Tính năng đăng nhập Facebook sẽ được cập nhật sớm');
    } catch {
      Alert.alert('Lỗi', 'Đăng nhập Facebook thất bại');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={{ uri: 'https://placehold.co/100x100' }}
            style={styles.logo}
          />
          <Text style={styles.title}>Đăng nhập</Text>
          <Text style={styles.subtitle}>Chào mừng bạn quay trở lại!</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập email của bạn"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.rowBelowPassword}>
            <TouchableOpacity style={styles.forgotPassword} onPress={() => { /* keep behavior */ }}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <View style={styles.rememberRowInline}>
              <TouchableOpacity onPress={() => setRememberMe(!rememberMe)} style={styles.checkboxSmall}>
                <Text>{rememberMe ? '☑' : '☐'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRememberMe(!rememberMe)}>
                <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Hoặc</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={[styles.socialButton, styles.googleButton]} onPress={handleGoogleLogin}>
              <View style={{ flexDirection: 'row', alignItems: 'center' } as any}>
                <Ionicons name="logo-google" size={18} color="#DB4437" />
                <Text style={[styles.socialButtonLabel, { color: '#333' } as any]}>  Google</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialButton, styles.facebookButton]} onPress={handleFacebookLogin}>
              <View style={{ flexDirection: 'row', alignItems: 'center' } as any}>
                <Ionicons name="logo-facebook" size={18} color="#fff" />
                <Text style={[styles.socialButtonLabel, { color: '#fff' } as any]}>  Facebook</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Đăng ký ngay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#0a84ff',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  facebookButton: {
    backgroundColor: '#1877f2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  facebookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  rowBelowPassword: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rememberRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxSmall: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  socialButtonLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rememberText: {
    color: '#333',
    fontSize: 14,
  },
  socialButton: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 16,
  },
  registerLink: {
    color: '#0a84ff',
    fontSize: 16,
    fontWeight: '600',
  },
});
