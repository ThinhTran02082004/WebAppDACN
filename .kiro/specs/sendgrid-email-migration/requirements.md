# Tài liệu Yêu cầu - Chuyển đổi Hệ thống Email sang SendGrid

## Giới thiệu

Dự án hiện đang sử dụng Nodemailer với Gmail SMTP để gửi email. Tính năng này sẽ chuyển đổi toàn bộ hệ thống gửi email sang sử dụng SendGrid API để cải thiện độ tin cậy, khả năng mở rộng và tính năng theo dõi email.

## Thuật ngữ

- **EmailService**: Module dịch vụ email hiện tại tại `server/services/emailService.js`
- **SendGrid**: Dịch vụ email transactional của Twilio
- **Nodemailer**: Thư viện Node.js hiện tại đang được sử dụng để gửi email
- **Transporter**: Đối tượng Nodemailer được sử dụng để gửi email
- **API Key**: Khóa xác thực để sử dụng SendGrid API
- **Template Email**: Các loại email khác nhau như OTP, xác thực tài khoản, xác nhận đặt lịch, v.v.

## Yêu cầu

### Yêu cầu 1: Cài đặt và Cấu hình SendGrid

**User Story:** Là một developer, tôi muốn cài đặt và cấu hình SendGrid SDK để có thể sử dụng dịch vụ SendGrid thay thế cho Nodemailer.

#### Tiêu chí chấp nhận

1. WHEN cài đặt dependencies, THE System SHALL thêm package `@sendgrid/mail` vào `server/package.json`
2. WHEN cấu hình biến môi trường, THE System SHALL thêm biến `SENDGRID_API_KEY` vào file `server/.env`
3. WHEN cấu hình biến môi trường, THE System SHALL giữ lại các biến `EMAIL_USER` để sử dụng làm địa chỉ email người gửi
4. THE System SHALL loại bỏ biến `EMAIL_PASSWORD` khỏi file `.env` sau khi chuyển đổi hoàn tất

### Yêu cầu 2: Chuyển đổi Module EmailService

**User Story:** Là một developer, tôi muốn chuyển đổi module EmailService từ Nodemailer sang SendGrid để tất cả các chức năng gửi email sử dụng SendGrid API.

#### Tiêu chí chấp nhận

1. WHEN khởi tạo EmailService, THE System SHALL sử dụng SendGrid client thay vì Nodemailer transporter
2. WHEN khởi tạo SendGrid client, THE System SHALL sử dụng `SENDGRID_API_KEY` từ biến môi trường
3. THE System SHALL loại bỏ tất cả code liên quan đến Nodemailer transporter
4. THE System SHALL loại bỏ chức năng tạo tài khoản test Ethereal
5. THE System SHALL loại bỏ hàm `initializeEmailTransport` và thay thế bằng khởi tạo SendGrid client đơn giản

### Yêu cầu 3: Chuyển đổi Hàm Gửi Email OTP

**User Story:** Là một người dùng, tôi muốn nhận email OTP qua SendGrid để có thể đặt lại mật khẩu của mình.

#### Tiêu chí chấp nhận

1. WHEN gọi hàm `sendOtpEmail`, THE System SHALL sử dụng SendGrid API để gửi email
2. WHEN gửi email OTP, THE System SHALL giữ nguyên nội dung HTML hiện tại
3. WHEN gửi email OTP, THE System SHALL sử dụng địa chỉ email từ biến `EMAIL_USER` làm người gửi
4. WHEN gửi email thành công, THE System SHALL log message ID từ SendGrid response
5. IF gửi email thất bại, THEN THE System SHALL throw error với thông tin chi tiết

### Yêu cầu 4: Chuyển đổi Hàm Gửi Email Xác Thực Tài Khoản

**User Story:** Là một người dùng mới, tôi muốn nhận email xác thực tài khoản qua SendGrid để có thể kích hoạt tài khoản của mình.

#### Tiêu chí chấp nhận

1. WHEN gọi hàm `sendVerificationEmail`, THE System SHALL sử dụng SendGrid API để gửi email
2. WHEN gửi email xác thực, THE System SHALL giữ nguyên nội dung HTML và link xác thực hiện tại
3. WHEN gửi email xác thực, THE System SHALL bao gồm tên đầy đủ của người dùng trong nội dung email
4. WHEN gửi email thành công, THE System SHALL log message ID từ SendGrid response
5. IF gửi email thất bại, THEN THE System SHALL throw error với thông tin chi tiết

### Yêu cầu 5: Chuyển đổi Hàm Gửi Email Xác Nhận Đặt Lịch

**User Story:** Là một bệnh nhân, tôi muốn nhận email xác nhận đặt lịch khám qua SendGrid để có thông tin chi tiết về lịch hẹn của mình.

#### Tiêu chí chấp nhận

1. WHEN gọi hàm `sendAppointmentConfirmationEmail`, THE System SHALL sử dụng SendGrid API để gửi email
2. WHEN gửi email xác nhận, THE System SHALL giữ nguyên nội dung HTML với tất cả thông tin lịch hẹn
3. WHEN gửi email xác nhận, THE System SHALL bao gồm mã đặt lịch, tên bác sĩ, bệnh viện, ngày giờ khám, phòng khám và số thứ tự
4. WHEN transporter chưa được khởi tạo, THE System SHALL khởi tạo SendGrid client tự động
5. IF gửi email thất bại, THEN THE System SHALL throw error với thông tin chi tiết

### Yêu cầu 6: Chuyển đổi Hàm Gửi Email Nhắc Nhở Lịch Khám

**User Story:** Là một bệnh nhân, tôi muốn nhận email nhắc nhở về lịch khám sắp tới qua SendGrid để không bỏ lỡ cuộc hẹn.

#### Tiêu chí chấp nhận

1. WHEN gọi hàm `sendAppointmentReminderEmail`, THE System SHALL sử dụng SendGrid API để gửi email
2. WHEN gửi email nhắc nhở, THE System SHALL giữ nguyên nội dung HTML với thông tin lịch hẹn
3. WHEN gửi email nhắc nhở, THE System SHALL bao gồm link đến trang quản lý lịch hẹn
4. WHEN gửi email thành công, THE System SHALL log message ID từ SendGrid response
5. IF gửi email thất bại, THEN THE System SHALL throw error với thông tin chi tiết

### Yêu cầu 7: Chuyển đổi Hàm Gửi Email Thông Báo Đổi Lịch

**User Story:** Là một bệnh nhân, tôi muốn nhận email thông báo khi lịch khám được đổi qua SendGrid để biết thông tin lịch hẹn mới.

#### Tiêu chí chấp nhận

1. WHEN gọi hàm `sendAppointmentRescheduleEmail`, THE System SHALL sử dụng SendGrid API để gửi email
2. WHEN gửi email đổi lịch, THE System SHALL hiển thị cả thông tin lịch hẹn cũ và mới
3. WHEN gửi email đổi lịch, THE System SHALL làm nổi bật các thay đổi về ngày giờ và phòng khám
4. WHEN gửi email thành công, THE System SHALL log message ID từ SendGrid response
5. IF gửi email thất bại, THEN THE System SHALL throw error với thông tin chi tiết

### Yêu cầu 8: Chuyển đổi Hàm Gửi Email Thông Báo Cho Bác Sĩ

**User Story:** Là một bác sĩ, tôi muốn nhận email thông báo về lịch hẹn mới hoặc thay đổi qua SendGrid để quản lý lịch làm việc của mình.

#### Tiêu chí chấp nhận

1. WHEN gọi hàm `sendDoctorAppointmentNotificationEmail`, THE System SHALL sử dụng SendGrid API để gửi email
2. WHEN gửi email cho bác sĩ, THE System SHALL bao gồm thông tin đầy đủ về bệnh nhân và lịch hẹn
3. WHEN lịch hẹn là đổi lịch, THE System SHALL hiển thị thông tin về thay đổi
4. WHEN transporter chưa được khởi tạo, THE System SHALL khởi tạo SendGrid client tự động
5. IF gửi email thất bại, THEN THE System SHALL return object với `success: false` và thông tin lỗi

### Yêu cầu 9: Xử lý Lỗi và Logging

**User Story:** Là một developer, tôi muốn có logging chi tiết và xử lý lỗi tốt để dễ dàng debug và theo dõi các vấn đề về email.

#### Tiêu chí chấp nhận

1. WHEN gửi email thành công, THE System SHALL log message ID và địa chỉ email người nhận
2. WHEN gửi email thất bại, THE System SHALL log error code, error message và stack trace
3. IF SendGrid API key không hợp lệ, THEN THE System SHALL throw error với thông báo rõ ràng
4. IF thiếu biến môi trường bắt buộc, THEN THE System SHALL throw error khi khởi tạo
5. THE System SHALL loại bỏ tất cả code liên quan đến Ethereal test account

### Yêu cầu 10: Tương thích ngược và Testing

**User Story:** Là một developer, tôi muốn đảm bảo tất cả các controller và service hiện tại vẫn hoạt động bình thường sau khi chuyển đổi.

#### Tiêu chí chấp nhận

1. THE System SHALL giữ nguyên tất cả function signatures của EmailService
2. THE System SHALL giữ nguyên tất cả return values và error handling behavior
3. THE System SHALL không yêu cầu thay đổi code ở các controller sử dụng EmailService
4. WHEN chuyển đổi hoàn tất, THE System SHALL có thể gửi tất cả loại email thành công
5. THE System SHALL loại bỏ dependency `nodemailer` khỏi `package.json` sau khi testing hoàn tất
