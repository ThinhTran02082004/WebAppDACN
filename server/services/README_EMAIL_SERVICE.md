# Email Service Documentation

## Tổng quan

Email service sử dụng **SendGrid** để gửi các loại email transactional trong hệ thống bệnh viện.

## Cấu hình

### Biến môi trường bắt buộc

Trong file `server/.env`:

```env
# SendGrid API Key (lấy từ SendGrid dashboard)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email người gửi (phải được verify trong SendGrid)
EMAIL_USER=your-verified-email@example.com

# Frontend URL (để tạo links trong email)
FRONTEND_URL=http://localhost:3000
```

### Lấy SendGrid API Key

1. Đăng ký tại [https://sendgrid.com](https://sendgrid.com)
2. Vào **Settings > API Keys**
3. Tạo API key mới với quyền **Mail Send**
4. Copy và paste vào `.env`

### Verify Email Người Gửi

1. Vào **Settings > Sender Authentication**
2. Click **Verify a Single Sender**
3. Nhập email (phải giống `EMAIL_USER`)
4. Xác thực qua email

## Sử dụng

### Import

```javascript
const {
  sendOtpEmail,
  sendVerificationEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
  sendAppointmentRescheduleEmail,
  sendDoctorAppointmentNotificationEmail
} = require('./services/emailService');
```

### 1. Gửi Email OTP

```javascript
await sendOtpEmail(email, otp);
```

**Parameters:**
- `email` (string): Email người nhận
- `otp` (string): Mã OTP 6 số

**Use case:** Đặt lại mật khẩu

### 2. Gửi Email Xác Thực Tài Khoản

```javascript
await sendVerificationEmail(email, verificationToken, fullName);
```

**Parameters:**
- `email` (string): Email người nhận
- `verificationToken` (string): Token xác thực
- `fullName` (string): Tên đầy đủ người dùng

**Use case:** Xác thực email sau khi đăng ký

### 3. Gửi Email Xác Nhận Đặt Lịch

```javascript
await sendAppointmentConfirmationEmail(email, patientName, appointmentInfo);
```

**Parameters:**
- `email` (string): Email bệnh nhân
- `patientName` (string): Tên bệnh nhân
- `appointmentInfo` (object):
  ```javascript
  {
    bookingCode: 'BK123456',
    doctorName: 'BS. Nguyễn Văn A',
    hospitalName: 'Bệnh viện ABC',
    appointmentDate: '15/11/2025',
    startTime: '09:00',
    endTime: '09:30',
    roomName: 'Phòng 101',
    queueNumber: 5,
    specialtyName: 'Nội khoa',
    serviceName: 'Khám tổng quát'
  }
  ```

**Use case:** Sau khi bệnh nhân đặt lịch thành công

### 4. Gửi Email Nhắc Nhở Lịch Khám

```javascript
await sendAppointmentReminderEmail(email, patientName, appointmentInfo);
```

**Parameters:**
- `email` (string): Email bệnh nhân
- `patientName` (string): Tên bệnh nhân
- `appointmentInfo` (object):
  ```javascript
  {
    bookingCode: 'BK123456',
    doctorName: 'BS. Nguyễn Văn A',
    hospitalName: 'Bệnh viện ABC',
    appointmentDate: '15/11/2025',
    startTime: '09:00',
    endTime: '09:30',
    hospitalAddress: '123 Đường ABC, Quận 1'
  }
  ```

**Use case:** Nhắc nhở trước 24 giờ (chạy bởi cron job)

### 5. Gửi Email Thông Báo Đổi Lịch

```javascript
await sendAppointmentRescheduleEmail(email, patientName, appointmentInfo, oldAppointmentInfo);
```

**Parameters:**
- `email` (string): Email bệnh nhân
- `patientName` (string): Tên bệnh nhân
- `appointmentInfo` (object): Thông tin lịch hẹn mới
- `oldAppointmentInfo` (object): Thông tin lịch hẹn cũ

**Use case:** Sau khi bệnh nhân đổi lịch

### 6. Gửi Email Thông Báo Cho Bác Sĩ

```javascript
const result = await sendDoctorAppointmentNotificationEmail(
  email, 
  doctorName, 
  appointmentInfo, 
  patientInfo
);

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

**Parameters:**
- `email` (string): Email bác sĩ
- `doctorName` (string): Tên bác sĩ
- `appointmentInfo` (object): Thông tin lịch hẹn
- `patientInfo` (object):
  ```javascript
  {
    name: 'Nguyễn Văn A',
    email: 'patient@example.com',
    phone: '0901234567'
  }
  ```

**Returns:** Object với `{success: boolean, messageId?: string, error?: string}`

**Use case:** Thông báo cho bác sĩ khi có lịch hẹn mới hoặc thay đổi

## Error Handling

Tất cả các hàm (trừ `sendDoctorAppointmentNotificationEmail`) sẽ throw error nếu gửi thất bại:

```javascript
try {
  await sendOtpEmail(email, otp);
  console.log('Email sent successfully');
} catch (error) {
  console.error('Failed to send email:', error.message);
  // Handle error (retry, log, notify admin, etc.)
}
```

## Logging

Service tự động log các thông tin:

```
SendGrid đã được khởi tạo thành công
Email người gửi: your-email@example.com
Đang gửi email đến user@example.com với subject: Mã xác nhận đặt lại mật khẩu
Email gửi thành công qua SendGrid
- Status Code: 202
- Message ID: xxx-xxx-xxx
```

## Rate Limits

SendGrid free tier:
- **100 emails/day**
- Nếu vượt quá, sẽ nhận error 429 (Too Many Requests)

Giải pháp:
- Upgrade SendGrid plan
- Implement email queue
- Batch emails

## Testing

Chạy test script:

```bash
cd server
node scripts/testSendGridEmail.js
```

Xem chi tiết trong `TESTING_GUIDE.md`

## Monitoring

### SendGrid Dashboard

1. Vào [https://app.sendgrid.com](https://app.sendgrid.com)
2. Xem **Activity Feed** để theo dõi emails
3. Xem **Stats** để xem metrics

### Metrics quan trọng

- **Delivered**: Số email gửi thành công
- **Bounced**: Số email bị bounce (email không tồn tại)
- **Spam Reports**: Số người đánh dấu spam
- **Opens**: Số lần mở email (nếu bật tracking)
- **Clicks**: Số lần click links (nếu bật tracking)

## Troubleshooting

### Email không được gửi

1. Kiểm tra `SENDGRID_API_KEY` trong `.env`
2. Kiểm tra email người gửi đã verify chưa
3. Xem logs trong console
4. Xem Activity Feed trong SendGrid dashboard

### Email vào spam

1. Verify domain authentication (SPF, DKIM, DMARC)
2. Tránh spam words trong subject/content
3. Maintain good sender reputation
4. Warm up IP address (cho dedicated IP)

### Rate limit exceeded

1. Upgrade SendGrid plan
2. Implement email queue với delay
3. Prioritize critical emails

## Migration từ Nodemailer

Hệ thống đã được migrate từ Nodemailer sang SendGrid. Tất cả function signatures giữ nguyên để đảm bảo backward compatibility.

**Thay đổi:**
- ✅ Không cần `initializeEmailTransport()` nữa
- ✅ Tự động khởi tạo khi import module
- ✅ Không cần `EMAIL_PASSWORD` nữa
- ✅ Sử dụng `SENDGRID_API_KEY` thay thế

## Best Practices

1. **Không hardcode API key** - Luôn dùng environment variables
2. **Validate email addresses** - Trước khi gửi
3. **Handle errors gracefully** - Không để crash app
4. **Log everything** - Để dễ debug
5. **Monitor metrics** - Theo dõi delivery rate
6. **Test thoroughly** - Trước khi deploy
7. **Use templates** - Cho emails phức tạp (optional)

## Support

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid Node.js Library](https://github.com/sendgrid/sendgrid-nodejs)
- [SendGrid Support](https://support.sendgrid.com/)
