# Tài liệu Thiết kế - Chuyển đổi Hệ thống Email sang SendGrid

## Tổng quan

Thiết kế này mô tả cách chuyển đổi hệ thống email từ Nodemailer/Gmail SMTP sang SendGrid API. Việc chuyển đổi sẽ giữ nguyên tất cả các function signatures và behavior để đảm bảo tương thích ngược với code hiện tại.

## Kiến trúc

### Kiến trúc hiện tại

```
┌─────────────────┐
│   Controllers   │
│  (authController│
│  appointmentCtrl│
│      etc.)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  emailService   │
│   (Nodemailer)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Gmail SMTP     │
│   Server        │
└─────────────────┘
```

### Kiến trúc mới

```
┌─────────────────┐
│   Controllers   │
│  (authController│
│  appointmentCtrl│
│      etc.)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  emailService   │
│   (SendGrid)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SendGrid API   │
│   (REST API)    │
└─────────────────┘
```

## Thành phần và Giao diện

### 1. Dependencies

**Thêm mới:**
```json
{
  "@sendgrid/mail": "^8.1.0"
}
```

**Loại bỏ (sau khi testing):**
```json
{
  "nodemailer": "^6.10.0"
}
```

### 2. Biến môi trường

**File: `server/.env`**

Thêm mới:
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Giữ lại:
```env
EMAIL_USER=chatgpt03012004@gmail.com
```

Loại bỏ (sau khi chuyển đổi):
```env
EMAIL_PASSWORD=bdkzjlmfjmtiupve
EMAIL_SERVICE=gmail
```

### 3. Module EmailService

**File: `server/services/emailService.js`**

#### 3.1. Khởi tạo SendGrid Client

```javascript
const sgMail = require('@sendgrid/mail');

// Khởi tạo SendGrid với API key
const initializeSendGrid = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY không được cấu hình trong file .env');
  }
  
  if (!process.env.EMAIL_USER) {
    throw new Error('EMAIL_USER không được cấu hình trong file .env');
  }
  
  sgMail.setApiKey(apiKey);
  console.log('SendGrid đã được khởi tạo thành công');
};

// Khởi tạo khi module được import
initializeSendGrid();
```

#### 3.2. Helper Function để gửi email

```javascript
/**
 * Helper function để gửi email qua SendGrid
 * @param {Object} mailOptions - Tùy chọn email
 * @returns {Promise<Object>} - Response từ SendGrid
 */
const sendEmailViaSendGrid = async (mailOptions) => {
  try {
    const msg = {
      to: mailOptions.to,
      from: mailOptions.from,
      subject: mailOptions.subject,
      html: mailOptions.html
    };
    
    const response = await sgMail.send(msg);
    console.log('Email gửi thành công qua SendGrid:', response[0].statusCode);
    
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      statusCode: response[0].statusCode
    };
  } catch (error) {
    console.error('Lỗi gửi email qua SendGrid:', error);
    
    if (error.response) {
      console.error('SendGrid error body:', error.response.body);
    }
    
    throw error;
  }
};
```

#### 3.3. Cấu trúc các hàm gửi email

Mỗi hàm sẽ có cấu trúc tương tự:

```javascript
const sendXxxEmail = async (email, ...params) => {
  try {
    // Chuẩn bị nội dung email
    const mailOptions = {
      from: `"Hệ thống Bệnh viện" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '...',
      html: `...`
    };
    
    // Gửi email qua SendGrid
    const result = await sendEmailViaSendGrid(mailOptions);
    console.log('Email xxx gửi thành công:', result.messageId);
    
    return true;
  } catch (error) {
    console.error('Lỗi gửi email xxx:', error);
    throw error;
  }
};
```

### 4. Danh sách các hàm cần chuyển đổi

1. **sendOtpEmail(email, otp)**
   - Gửi mã OTP để đặt lại mật khẩu
   - Giữ nguyên HTML template hiện tại

2. **sendVerificationEmail(email, verificationToken, fullName)**
   - Gửi email xác thực tài khoản
   - Giữ nguyên HTML template và verification URL

3. **sendAppointmentConfirmationEmail(email, patientName, appointmentInfo)**
   - Gửi email xác nhận đặt lịch khám
   - Giữ nguyên HTML template với tất cả thông tin lịch hẹn
   - Xử lý trường hợp transporter chưa khởi tạo (không cần nữa với SendGrid)

4. **sendAppointmentReminderEmail(email, patientName, appointmentInfo)**
   - Gửi email nhắc nhở lịch khám
   - Giữ nguyên HTML template

5. **sendAppointmentRescheduleEmail(email, patientName, appointmentInfo, oldAppointmentInfo)**
   - Gửi email thông báo đổi lịch
   - Giữ nguyên HTML template với thông tin lịch cũ và mới

6. **sendDoctorAppointmentNotificationEmail(email, doctorName, appointmentInfo, patientInfo)**
   - Gửi email thông báo cho bác sĩ
   - Giữ nguyên HTML template
   - Return object với `{success, messageId}` hoặc `{success: false, error}`

### 5. Loại bỏ các hàm không cần thiết

- `createTestAccount()` - Không cần với SendGrid
- `initializeEmailTransport()` - Thay bằng `initializeSendGrid()`
- Tất cả code liên quan đến Ethereal test account
- Tất cả code liên quan đến Nodemailer transporter

## Mô hình Dữ liệu

### SendGrid Message Object

```javascript
{
  to: 'recipient@example.com',           // Email người nhận
  from: 'sender@example.com',            // Email người gửi (đã verify với SendGrid)
  subject: 'Email subject',              // Tiêu đề email
  html: '<html>...</html>'               // Nội dung HTML
}
```

### SendGrid Response Object

```javascript
{
  statusCode: 202,                       // HTTP status code
  headers: {
    'x-message-id': 'xxx-xxx-xxx',      // Message ID từ SendGrid
    ...
  },
  body: ''
}
```

## Xử lý Lỗi

### 1. Lỗi cấu hình

```javascript
// Thiếu API key
if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY không được cấu hình trong file .env');
}

// Thiếu email người gửi
if (!process.env.EMAIL_USER) {
  throw new Error('EMAIL_USER không được cấu hình trong file .env');
}
```

### 2. Lỗi gửi email

```javascript
try {
  await sgMail.send(msg);
} catch (error) {
  console.error('Lỗi gửi email qua SendGrid:', error);
  
  // Log chi tiết lỗi từ SendGrid
  if (error.response) {
    console.error('Status code:', error.response.statusCode);
    console.error('Error body:', error.response.body);
    console.error('Error headers:', error.response.headers);
  }
  
  throw error;
}
```

### 3. Các loại lỗi phổ biến từ SendGrid

| Status Code | Ý nghĩa | Xử lý |
|------------|---------|-------|
| 400 | Bad Request - Dữ liệu không hợp lệ | Kiểm tra format email, subject, content |
| 401 | Unauthorized - API key không hợp lệ | Kiểm tra SENDGRID_API_KEY |
| 403 | Forbidden - Email người gửi chưa verify | Verify email trong SendGrid dashboard |
| 413 | Payload Too Large - Email quá lớn | Giảm kích thước content |
| 429 | Too Many Requests - Vượt quá rate limit | Implement retry logic |
| 500 | Internal Server Error | Retry sau một khoảng thời gian |

## Chiến lược Testing

### 1. Unit Testing (Optional)

Tạo mock cho SendGrid client:

```javascript
jest.mock('@sendgrid/mail');

describe('EmailService', () => {
  it('should send OTP email successfully', async () => {
    const mockSend = jest.fn().mockResolvedValue([{
      statusCode: 202,
      headers: { 'x-message-id': 'test-id' }
    }]);
    
    sgMail.send = mockSend;
    
    await sendOtpEmail('test@example.com', '123456');
    
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('OTP')
      })
    );
  });
});
```

### 2. Integration Testing

Test với SendGrid sandbox mode hoặc test API key:

```javascript
// Sử dụng email test của SendGrid
const testEmail = 'test@sink.sendgrid.net';

// Test gửi email thực tế
await sendOtpEmail(testEmail, '123456');
```

### 3. Manual Testing Checklist

- [ ] Gửi email OTP thành công
- [ ] Gửi email xác thực tài khoản thành công
- [ ] Gửi email xác nhận đặt lịch thành công
- [ ] Gửi email nhắc nhở lịch khám thành công
- [ ] Gửi email thông báo đổi lịch thành công
- [ ] Gửi email thông báo cho bác sĩ thành công
- [ ] Xử lý lỗi khi API key không hợp lệ
- [ ] Xử lý lỗi khi email người gửi chưa verify
- [ ] Logging hoạt động đúng cho cả success và error cases

## Migration Plan

### Phase 1: Chuẩn bị (5 phút)

1. Đăng ký tài khoản SendGrid (nếu chưa có)
2. Tạo API key trong SendGrid dashboard
3. Verify email người gửi trong SendGrid
4. Thêm SENDGRID_API_KEY vào file `.env`

### Phase 2: Cài đặt Dependencies (2 phút)

1. Cài đặt `@sendgrid/mail`
2. Giữ lại `nodemailer` tạm thời để rollback nếu cần

### Phase 3: Chuyển đổi Code (30 phút)

1. Thay thế phần khởi tạo
2. Tạo helper function `sendEmailViaSendGrid`
3. Chuyển đổi từng hàm gửi email
4. Loại bỏ code không cần thiết

### Phase 4: Testing (15 phút)

1. Test từng loại email
2. Kiểm tra error handling
3. Verify logging

### Phase 5: Cleanup (5 phút)

1. Loại bỏ `nodemailer` khỏi dependencies
2. Loại bỏ `EMAIL_PASSWORD` khỏi `.env`
3. Update documentation

## Rollback Plan

Nếu có vấn đề với SendGrid:

1. Revert file `emailService.js` về version cũ
2. Loại bỏ `@sendgrid/mail` dependency
3. Restore biến `EMAIL_PASSWORD` trong `.env`
4. Restart server

## Performance Considerations

### SendGrid vs Nodemailer/Gmail

| Tiêu chí | Nodemailer/Gmail | SendGrid |
|----------|------------------|----------|
| Tốc độ gửi | ~1-2s/email | ~0.5-1s/email |
| Rate limit | 500 emails/day (free Gmail) | 100 emails/day (free tier) |
| Deliverability | Phụ thuộc Gmail reputation | Cao hơn với dedicated IP |
| Tracking | Không có | Có (opens, clicks, bounces) |
| Retry logic | Tự implement | Built-in |
| Error handling | Basic | Chi tiết với status codes |

## Security Considerations

1. **API Key Security**
   - Không commit API key vào Git
   - Sử dụng environment variables
   - Rotate API key định kỳ
   - Sử dụng API key với quyền hạn tối thiểu (chỉ Mail Send)

2. **Email Verification**
   - Verify email người gửi trong SendGrid dashboard
   - Sử dụng domain authentication (SPF, DKIM, DMARC) cho production

3. **Rate Limiting**
   - Monitor SendGrid usage dashboard
   - Implement queue system nếu cần gửi nhiều email
   - Handle 429 errors gracefully

## Monitoring và Logging

### 1. Application Logs

```javascript
// Success
console.log('Email gửi thành công:', {
  type: 'OTP',
  recipient: email,
  messageId: result.messageId,
  timestamp: new Date().toISOString()
});

// Error
console.error('Lỗi gửi email:', {
  type: 'OTP',
  recipient: email,
  error: error.message,
  statusCode: error.response?.statusCode,
  timestamp: new Date().toISOString()
});
```

### 2. SendGrid Dashboard

Monitor các metrics:
- Delivery rate
- Bounce rate
- Spam reports
- Open rate (nếu enable tracking)
- Click rate (nếu enable tracking)

## Tài liệu tham khảo

- [SendGrid Node.js Library](https://github.com/sendgrid/sendgrid-nodejs)
- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference/mail-send/mail-send)
- [SendGrid Error Codes](https://docs.sendgrid.com/api-reference/mail-send/errors)
