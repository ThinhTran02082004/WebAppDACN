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

export default function TermsOfServiceScreen({ navigation }: any) {
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
        <Text style={styles.headerTitle}>Điều khoản dịch vụ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Giới thiệu dịch vụ</Text>
          <Text style={styles.paragraph}>
            Ứng dụng đặt lịch khám bệnh cung cấp các dịch vụ:{'\n'}
            • Đặt lịch khám với bác sĩ chuyên khoa{'\n'}
            • Tư vấn y tế trực tuyến{'\n'}
            • Quản lý hồ sơ bệnh án{'\n'}
            • Thanh toán dịch vụ y tế{'\n'}
            • Nhận thông báo và nhắc nhở
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Điều kiện sử dụng</Text>
          <Text style={styles.paragraph}>
            • Bạn phải từ 18 tuổi trở lên hoặc có sự đồng ý của phụ huynh{'\n'}
            • Cung cấp thông tin chính xác và cập nhật{'\n'}
            • Không sử dụng dịch vụ cho mục đích bất hợp pháp{'\n'}
            • Tuân thủ các quy định của pháp luật Việt Nam
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Dịch vụ y tế</Text>
          <Text style={styles.paragraph}>
            • Ứng dụng chỉ là công cụ hỗ trợ, không thay thế khám bệnh trực tiếp{'\n'}
            • Kết quả tư vấn trực tuyến chỉ mang tính tham khảo{'\n'}
            • Trong trường hợp khẩn cấp, hãy liên hệ cơ sở y tế gần nhất{'\n'}
            • Chất lượng dịch vụ phụ thuộc vào từng bác sĩ và cơ sở y tế
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Thanh toán và hoàn tiền</Text>
          <Text style={styles.paragraph}>
            • Phí dịch vụ được tính theo bảng giá của từng cơ sở y tế{'\n'}
            • Thanh toán được thực hiện trước khi khám bệnh{'\n'}
            • Hoàn tiền trong trường hợp bác sĩ hủy lịch{'\n'}
            • Phí giao dịch không được hoàn lại
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Trách nhiệm và giới hạn</Text>
          <Text style={styles.paragraph}>
            • Chúng tôi không chịu trách nhiệm về kết quả điều trị{'\n'}
            • Không đảm bảo 100% tính khả dụng của hệ thống{'\n'}
            • Người dùng tự chịu trách nhiệm về việc sử dụng dịch vụ{'\n'}
            • Giới hạn trách nhiệm theo quy định pháp luật
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Thay đổi và chấm dứt</Text>
          <Text style={styles.paragraph}>
            • Chúng tôi có quyền thay đổi điều khoản với thông báo trước{'\n'}
            • Có thể chấm dứt dịch vụ nếu vi phạm điều khoản{'\n'}
            • Người dùng có thể hủy tài khoản bất kỳ lúc nào{'\n'}
            • Dữ liệu sẽ được xóa sau 30 ngày kể từ khi hủy tài khoản
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Liên hệ hỗ trợ</Text>
          <Text style={styles.paragraph}>
            Để được hỗ trợ về dịch vụ:{'\n'}
            • Email: service@datlichkham.com{'\n'}
            • Hotline: 1900-xxxx{'\n'}
            • Chat trực tuyến: 24/7{'\n'}
            • Thời gian: 8:00 - 22:00 (Thứ 2 - Chủ nhật)
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

