import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

export default function PrivacyPolicyScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chính sách bảo mật</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Thu thập thông tin</Text>
          <Text style={styles.paragraph}>
            Chúng tôi thu thập các thông tin sau để cung cấp dịch vụ tốt nhất:{'\n'}
            • Thông tin cá nhân: Họ tên, email, số điện thoại{'\n'}
            • Thông tin y tế: Lịch sử khám bệnh, kết quả xét nghiệm{'\n'}
            • Thông tin thiết bị: Địa chỉ IP, loại thiết bị, hệ điều hành
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Sử dụng thông tin</Text>
          <Text style={styles.paragraph}>
            Thông tin của bạn được sử dụng để:{'\n'}
            • Cung cấp dịch vụ đặt lịch khám bệnh{'\n'}
            • Liên lạc về lịch hẹn và thông báo quan trọng{'\n'}
            • Cải thiện chất lượng dịch vụ{'\n'}
            • Tuân thủ các quy định pháp luật
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Bảo mật dữ liệu</Text>
          <Text style={styles.paragraph}>
            • Tất cả dữ liệu được mã hóa SSL/TLS{'\n'}
            • Hệ thống bảo mật đa lớp với firewall{'\n'}
            • Chỉ nhân viên được ủy quyền mới có thể truy cập{'\n'}
            • Sao lưu dữ liệu định kỳ và an toàn
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Chia sẻ thông tin</Text>
          <Text style={styles.paragraph}>
            Chúng tôi KHÔNG chia sẻ thông tin cá nhân với bên thứ ba, trừ khi:{'\n'}
            • Có sự đồng ý rõ ràng từ bạn{'\n'}
            • Yêu cầu của cơ quan pháp luật{'\n'}
            • Cần thiết để bảo vệ quyền lợi của bạn
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Quyền của người dùng</Text>
          <Text style={styles.paragraph}>
            Bạn có quyền:{'\n'}
            • Truy cập và chỉnh sửa thông tin cá nhân{'\n'}
            • Yêu cầu xóa tài khoản và dữ liệu{'\n'}
            • Nhận báo cáo về việc sử dụng dữ liệu{'\n'}
            • Từ chối nhận thông báo marketing
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Liên hệ về bảo mật</Text>
          <Text style={styles.paragraph}>
            Nếu bạn có thắc mắc về chính sách bảo mật:{'\n'}
            • Email: privacy@datlichkham.com{'\n'}
            • Hotline: 1900-xxxx{'\n'}
            • Địa chỉ: [Địa chỉ công ty]{'\n'}
            • Cập nhật lần cuối: [Ngày tháng năm]
          </Text>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
});
