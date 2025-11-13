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

type Props = {
  navigation: any;
};

type UserData = {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
};

export default function RegisterScreen({ navigation }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  // Hàm validate ngày sinh
  const validateDateOfBirth = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return '';
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '❌ Định dạng không hợp lệ';
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Kiểm tra ngày hợp lệ
    if (isNaN(day) || isNaN(month) || isNaN(year)) return '❌ Định dạng không hợp lệ';
    if (day < 1 || day > 31) return '❌ Ngày không hợp lệ';
    if (month < 1 || month > 12) return '❌ Tháng không hợp lệ';
    if (year < 1900 || year > new Date().getFullYear()) return '❌ Năm không hợp lệ';
    
    // Kiểm tra ngày có tồn tại không
    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return '❌ Ngày không tồn tại';
    }
    
    // Kiểm tra tuổi
    const now = new Date();
    const age = now.getFullYear() - year;
    if (age < 1) return '❌ Tuổi phải từ 1 tuổi trở lên';
    if (age > 120) return '❌ Tuổi không được vượt quá 120';
    
    return '✅ Ngày sinh hợp lệ';
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!userData.fullName || !userData.dateOfBirth || !userData.gender) {
        Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin bắt buộc');
        return;
      }
      
      // Kiểm tra ngày sinh có hợp lệ không
      const dateValidation = validateDateOfBirth(userData.dateOfBirth);
      if (dateValidation && !dateValidation.includes('✅')) {
        Alert.alert('Lỗi', 'Vui lòng nhập ngày sinh hợp lệ');
        return;
      }
      
      setStep(2);
    }
  };

  const handleBackStep = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const { signUp } = useAuth();

  const handleRegister = async () => {
    console.log('Register button pressed');
    console.log('User data:', userData);
    
    if (!userData.email || !userData.phoneNumber || !userData.password || !userData.confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (userData.password !== userData.confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }

    if (!userData.agreeToTerms) {
      Alert.alert('Lỗi', 'Vui lòng đồng ý với điều khoản sử dụng');
      return;
    }

    // Kiểm tra ngày sinh trước khi gửi
    const dateValidation = validateDateOfBirth(userData.dateOfBirth);
    if (dateValidation && !dateValidation.includes('')) {
      Alert.alert('Lỗi', 'Vui lòng nhập ngày sinh hợp lệ');
      return;
    }

    try {
      setLoading(true);
      console.log('Sending registration data...');
      
      await signUp({
        fullName: userData.fullName,
        email: userData.email,
        password: userData.password,
        phoneNumber: userData.phoneNumber,
        dateOfBirth: userData.dateOfBirth,
        gender: userData.gender,
        address: userData.address,
      });
      
      console.log('Registration successful');
      Alert.alert('Thành công', 'Đăng ký thành công!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert('Lỗi', error.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const updateUserData = (field: keyof UserData, value: string | boolean) =>
    setUserData(prev => ({ ...prev, [field]: value }));

  const renderStep1 = () => (
    <View style={styles.form}>
      <Text style={styles.stepTitle}>Bước 1: Thông tin cá nhân</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Họ và tên *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập họ và tên"
          value={userData.fullName}
          onChangeText={(value) => updateUserData('fullName', value)}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Ngày sinh *</Text>
        <TextInput
          style={styles.input}
          placeholder="DD/MM/YYYY"
          value={userData.dateOfBirth}
          onChangeText={(value) => {
            // Tự động format ngày sinh
            let formatted = value.replace(/[^0-9]/g, ''); // Chỉ giữ lại số
            
            // Tự động thêm dấu / sau 2 và 4 ký tự
            if (formatted.length >= 3) {
              formatted = formatted.substring(0, 2) + '/' + formatted.substring(2);
            }
            if (formatted.length >= 6) {
              formatted = formatted.substring(0, 5) + '/' + formatted.substring(5, 9);
            }
            
            // Giới hạn độ dài
            if (formatted.length > 10) {
              formatted = formatted.substring(0, 10);
            }
            
            updateUserData('dateOfBirth', formatted);
          }}
          keyboardType="numeric"
          maxLength={10}
        />
        <Text style={styles.helperText}>Ví dụ: 15/03/1990</Text>
        {userData.dateOfBirth && userData.dateOfBirth.length === 10 && (
          <Text style={styles.validationText}>
            {validateDateOfBirth(userData.dateOfBirth)}
          </Text>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Giới tính *</Text>
        <View style={styles.genderContainer}>
          <TouchableOpacity
            style={[
              styles.genderButton,
              userData.gender === 'male' && styles.genderButtonSelected
            ]}
            onPress={() => updateUserData('gender', 'male')}
          >
            <Text style={[
              styles.genderButtonText,
              userData.gender === 'male' && styles.genderButtonTextSelected
            ]}>Nam</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.genderButton,
              userData.gender === 'female' && styles.genderButtonSelected
            ]}
            onPress={() => updateUserData('gender', 'female')}
          >
            <Text style={[
              styles.genderButtonText,
              userData.gender === 'female' && styles.genderButtonTextSelected
            ]}>Nữ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.genderButton,
              userData.gender === 'other' && styles.genderButtonSelected
            ]}
            onPress={() => updateUserData('gender', 'other')}
          >
            <Text style={[
              styles.genderButtonText,
              userData.gender === 'other' && styles.genderButtonTextSelected
            ]}>Khác</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Địa chỉ</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập địa chỉ (tùy chọn)"
          value={userData.address}
          onChangeText={(value) => updateUserData('address', value)}
        />
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
        <Text style={styles.nextButtonText}>Tiếp theo</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.form}>
      <Text style={styles.stepTitle}>Bước 2: Thông tin đăng nhập</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập email"
          value={userData.email}
          onChangeText={(value) => updateUserData('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Số điện thoại *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập số điện thoại"
          value={userData.phoneNumber}
          onChangeText={(value) => updateUserData('phoneNumber', value)}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Mật khẩu *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập mật khẩu"
          value={userData.password}
          onChangeText={(value) => updateUserData('password', value)}
          secureTextEntry
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Xác nhận mật khẩu *</Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập lại mật khẩu"
          value={userData.confirmPassword}
          onChangeText={(value) => updateUserData('confirmPassword', value)}
          secureTextEntry
        />
      </View>

      <View style={styles.termsContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => updateUserData('agreeToTerms', !userData.agreeToTerms)}
        >
          <Text style={styles.checkboxText}>
            {userData.agreeToTerms ? '☑' : '☐'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.termsText}>
          Tôi đồng ý với{' '}
          <Text style={styles.termsLink}>điều khoản sử dụng</Text>
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackStep}>
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.registerButton, 
            loading && styles.registerButtonDisabled,
            !userData.agreeToTerms && styles.registerButtonDisabled
          ]}
          onPress={() => {
            console.log('Register button onPress triggered');
            console.log('Loading state:', loading);
            console.log('Agree to terms:', userData.agreeToTerms);
            handleRegister();
          }}
          disabled={loading || !userData.agreeToTerms}
        >
          <Text style={[
            styles.registerButtonText,
            (!userData.agreeToTerms || loading) && styles.registerButtonTextDisabled
          ]}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
          <Text style={styles.title}>Đăng ký tài khoản</Text>
          <Text style={styles.subtitle}>Tạo tài khoản mới để sử dụng dịch vụ</Text>
        </View>

        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        </View>

        {step === 1 ? renderStep1() : renderStep2()}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Đã có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Đăng nhập</Text>
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
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  stepDotActive: {
    backgroundColor: '#0a84ff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  stepLineActive: {
    backgroundColor: '#0a84ff',
  },
  form: {
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
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
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  validationText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  genderButtonSelected: {
    backgroundColor: '#0a84ff',
    borderColor: '#0a84ff',
  },
  genderButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  genderButtonTextSelected: {
    color: '#fff',
  },
  nextButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxText: {
    fontSize: 16,
  },
  termsText: {
    flex: 1,
    color: '#333',
    fontSize: 14,
  },
  termsLink: {
    color: '#0a84ff',
    textDecorationLine: 'underline',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    flex: 1,
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  registerButtonDisabled: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButtonTextDisabled: {
    color: '#999',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 16,
  },
  loginLink: {
    color: '#0a84ff',
    fontSize: 16,
    fontWeight: '600',
  },
});