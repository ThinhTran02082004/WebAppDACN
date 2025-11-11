# Hướng dẫn Testing - SendGrid Email Migration

## Chuẩn bị

### 1. Lấy SendGrid API Key

1. Đăng ký tài khoản miễn phí tại [SendGrid](https://sendgrid.com)
2. Đăng nhập và vào **Settings > API Keys**
3. Click **Create API Key**
4. Chọn **Restricted Access** và bật quyền **Mail Send** (Full Access)
5. Đặt tên cho API key (ví dụ: "Hospital System")
6. Click **Create & View**
7. **QUAN TRỌNG**: Copy API key ngay (bạn sẽ không thể xem lại)

### 2. Verify Email Người Gửi

1. Vào **Settings > Sender Authentication**
2. Click **Verify a Single Sender**
3. Điền thông tin:
   - From Name: `Hệ thống Bệnh viện`
   - From Email Address: Email của bạn (phải giống `EMAIL_USER` trong `.env`)
   - Reply To: Cùng email
   - Các thông tin khác: Điền tùy ý
4. Click **Create**
5. Kiểm tra email và click link xác thực

### 3. Cấu hình .env

Mở file `server/.env` và cập nhật:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email người gửi (phải đã verify trong SendGrid)
EMAIL_USER=your-verified-email@example.com

# Email để test (có thể là email khác)
TEST_EMAIL=your-test-email@example.com
```

## Chạy Tests

### Option 1: Chạy tất cả tests tự động

```bash
cd server
node scripts/testSendGridEmail.js
```

Script này sẽ test tất cả 6 hàm gửi email:
1. ✅ sendOtpEmail
2. ✅ sendVerificationEmail
3. ✅ sendAppointmentConfirmationEmail
4. ✅ sendAppointmentReminderEmail
5. ✅ sendAppointmentRescheduleEmail
6. ✅ sendDoctorAppointmentNotificationEmail

### Option 2: Test thủ công từng hàm

Tạo file test riêng hoặc sử dụng Node REPL:

```bash
cd server
node
```

Trong Node REPL:

```javascript
require('dotenv').config();
const { sendOtpEmail } = require('./services/emailService');

// Test gửi OTP
sendOtpEmail('your-email@example.com', '123456')
  .then(() => console.log('✅ Success'))
  .catch(err => console.error('❌ Error:', err));
```

### Option 3: Test qua API endpoints

Khởi động server và test qua các API endpoints hiện có:

```bash
npm run dev
```

Sau đó test các endpoints như:
- POST `/api/auth/forgot-password` - Test sendOtpEmail
- POST `/api/auth/register` - Test sendVerificationEmail
- POST `/api/appointments` - Test sendAppointmentConfirmationEmail

## Kiểm tra Kết quả

### 1. Trong Console

Bạn sẽ thấy logs như:

```
SendGrid đã được khởi tạo thành công
Email người gửi: your-email@example.com
Đang gửi email đến test@example.com với subject: Mã xác nhận đặt lại mật khẩu
Email gửi thành công qua SendGrid
- Status Code: 202
- Message ID: xxx-xxx-xxx
Email OTP gửi thành công: xxx-xxx-xxx
```

### 2. Trong Email Inbox

Kiểm tra inbox của `TEST_EMAIL`:
- Tất cả 6 emails nên được nhận trong vòng vài phút
- Kiểm tra cả spam folder nếu không thấy
- Verify HTML formatting hiển thị đúng

### 3. Trong SendGrid Dashboard

1. Vào **Activity Feed** trong SendGrid dashboard
2. Bạn sẽ thấy tất cả emails đã gửi với status:
   - **Processed**: Email đã được SendGrid nhận
   - **Delivered**: Email đã được gửi đến inbox
   - **Opened**: Người nhận đã mở email (nếu bật tracking)

## Xử lý Lỗi Thường Gặp

### Lỗi 401: Unauthorized

```
Error: Unauthorized
Status Code: 401
```

**Nguyên nhân**: API key không hợp lệ

**Giải pháp**:
1. Kiểm tra `SENDGRID_API_KEY` trong `.env`
2. Đảm bảo không có khoảng trắng thừa
3. Tạo API key mới nếu cần

### Lỗi 403: Forbidden

```
Error: Forbidden
Status Code: 403
```

**Nguyên nhân**: Email người gửi chưa được verify

**Giải pháp**:
1. Vào SendGrid dashboard > Sender Authentication
2. Verify email trong `EMAIL_USER`
3. Kiểm tra email và click link xác thực

### Lỗi 400: Bad Request

```
Error: Bad Request
Status Code: 400
```

**Nguyên nhân**: Dữ liệu email không hợp lệ

**Giải pháp**:
1. Kiểm tra format email (phải có @ và domain)
2. Kiểm tra subject không rỗng
3. Kiểm tra HTML content hợp lệ

### Lỗi 429: Too Many Requests

```
Error: Too Many Requests
Status Code: 429
```

**Nguyên nhân**: Vượt quá rate limit (100 emails/day với free tier)

**Giải pháp**:
1. Đợi 24 giờ để reset quota
2. Upgrade plan SendGrid nếu cần gửi nhiều hơn
3. Thêm delay giữa các test emails

### Module not found: @sendgrid/mail

```
Error: Cannot find module '@sendgrid/mail'
```

**Giải pháp**:
```bash
cd server
npm install @sendgrid/mail
```

## Checklist Testing

Sau khi chạy tests, verify các điểm sau:

- [ ] Tất cả 6 emails được gửi thành công
- [ ] Emails hiển thị đúng trong inbox (không bị spam)
- [ ] HTML formatting hiển thị đẹp trên desktop và mobile
- [ ] Các links trong email hoạt động (verification URL, manage appointments)
- [ ] Thông tin động hiển thị đúng (tên, ngày, giờ, phòng, v.v.)
- [ ] Console logs hiển thị message IDs
- [ ] SendGrid dashboard hiển thị status "Delivered"
- [ ] Không có errors trong console

## Testing với Production

**CẢNH BÁO**: Không test với production API key và email thật của khách hàng!

Để test an toàn:
1. Sử dụng SendGrid sandbox mode (nếu có)
2. Hoặc tạo API key riêng cho testing
3. Chỉ gửi đến email test của bạn
4. Không commit API key vào Git

## Next Steps

Sau khi tất cả tests pass:

1. ✅ Verify tất cả controllers vẫn hoạt động bình thường
2. ✅ Test end-to-end flows (đăng ký, đặt lịch, v.v.)
3. ✅ Cleanup: Xóa `nodemailer` khỏi dependencies
4. ✅ Update documentation
5. ✅ Deploy lên staging/production

## Rollback Plan

Nếu có vấn đề:

1. Revert file `emailService.js` về version cũ
2. Restore `EMAIL_PASSWORD` trong `.env`
3. Restart server
4. Investigate issues và fix

## Support

Nếu gặp vấn đề:
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid Support](https://support.sendgrid.com/)
- [SendGrid Status Page](https://status.sendgrid.com/)
