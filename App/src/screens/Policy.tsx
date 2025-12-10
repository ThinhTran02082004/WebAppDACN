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

export default function UsageRegulationsScreen({ navigation }: any) {
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
        <Text style={styles.headerTitle}>Quy định sử dụng</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Điều khoản chung</Text>
          <Text style={styles.paragraph}>
            Ứng dụng đặt lịch khám bệnh được thiết kế để hỗ trợ người dùng trong việc đặt lịch khám bệnh một cách thuận tiện và hiệu quả. Khi sử dụng ứng dụng, bạn đồng ý tuân thủ các quy định sau đây.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Quyền và nghĩa vụ của người dùng</Text>
          <Text style={styles.paragraph}>
            • Cung cấp thông tin chính xác và đầy đủ khi đăng ký tài khoản{'\n'}
            • Sử dụng ứng dụng một cách hợp pháp và không vi phạm pháp luật{'\n'}
            • Không chia sẻ tài khoản với người khác{'\n'}
            • Báo cáo ngay lập tức nếu phát hiện vi phạm bảo mật
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Đặt lịch khám bệnh</Text>
          <Text style={styles.paragraph}>
            • Bạn có thể đặt lịch khám với bác sĩ có sẵn trong hệ thống{'\n'}
            • Lịch khám có thể được hủy hoặc thay đổi trước 24 giờ{'\n'}
            • Phí khám bệnh sẽ được thanh toán theo quy định của cơ sở y tế{'\n'}
            • Thông tin khám bệnh sẽ được bảo mật tuyệt đối
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Thanh toán</Text>
          <Text style={styles.paragraph}>
            • Hệ thống hỗ trợ thanh toán qua thẻ ngân hàng, ví điện tử{'\n'}
            • Thông tin thanh toán được mã hóa và bảo mật{'\n'}
            • Hoàn tiền sẽ được thực hiện theo chính sách của cơ sở y tế
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Bảo mật thông tin</Text>
          <Text style={styles.paragraph}>
            • Tất cả thông tin cá nhân và y tế được bảo mật tuyệt đối{'\n'}
            • Chỉ có bác sĩ được chỉ định mới có thể truy cập hồ sơ bệnh án{'\n'}
            • Dữ liệu được lưu trữ trên hệ thống bảo mật cao
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Liên hệ hỗ trợ</Text>
          <Text style={styles.paragraph}>
            Nếu bạn có bất kỳ thắc mắc nào về quy định sử dụng, vui lòng liên hệ:{'\n'}
            • Email: support@datlichkham.com{'\n'}
            • Hotline: 1900-xxxx{'\n'}
            • Thời gian hỗ trợ: 8:00 - 22:00 hàng ngày
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
