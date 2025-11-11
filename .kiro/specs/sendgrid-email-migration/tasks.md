# Kế hoạch Triển khai - Chuyển đổi Hệ thống Email sang SendGrid

## Danh sách Tasks

- [x] 1. Chuẩn bị môi trường và cài đặt dependencies


  - Cài đặt package `@sendgrid/mail` vào project
  - Thêm biến môi trường `SENDGRID_API_KEY` vào file `.env` với giá trị placeholder
  - Thêm comment hướng dẫn cách lấy API key từ SendGrid dashboard
  - _Requirements: 1.1, 1.2_

- [x] 2. Chuyển đổi phần khởi tạo và helper functions


  - [x] 2.1 Thay thế import Nodemailer bằng SendGrid


    - Import `@sendgrid/mail` thay vì `nodemailer`
    - Loại bỏ biến `transporter` và các hàm liên quan đến Nodemailer
    - _Requirements: 2.1, 2.3_
  


  - [ ] 2.2 Tạo hàm khởi tạo SendGrid
    - Viết hàm `initializeSendGrid()` để cấu hình SendGrid client
    - Kiểm tra và validate các biến môi trường bắt buộc (SENDGRID_API_KEY, EMAIL_USER)
    - Gọi hàm khởi tạo khi module được import

    - _Requirements: 2.2, 9.4_

  
  - [ ] 2.3 Tạo helper function để gửi email
    - Viết hàm `sendEmailViaSendGrid(mailOptions)` để wrap SendGrid API

    - Implement error handling và logging chi tiết

    - Return object với messageId và statusCode
    - _Requirements: 2.1, 9.1, 9.2_


  
  - [ ] 2.4 Loại bỏ code không cần thiết
    - Xóa hàm `createTestAccount()`
    - Xóa hàm `initializeEmailTransport()`
    - Xóa tất cả code liên quan đến Ethereal test account

    - _Requirements: 2.4, 2.5, 9.5_


- [ ] 3. Chuyển đổi hàm sendOtpEmail
  - Thay thế logic gửi email bằng `sendEmailViaSendGrid()`
  - Giữ nguyên HTML template và nội dung email


  - Loại bỏ check transporter và code Ethereal
  - Update error handling theo SendGrid format
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Chuyển đổi hàm sendVerificationEmail

  - Thay thế logic gửi email bằng `sendEmailViaSendGrid()`

  - Giữ nguyên HTML template, verification URL và tham số fullName
  - Loại bỏ check transporter và code Ethereal
  - Update error handling theo SendGrid format
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_



- [ ] 5. Chuyển đổi hàm sendAppointmentConfirmationEmail
  - Thay thế logic gửi email bằng `sendEmailViaSendGrid()`
  - Giữ nguyên HTML template với tất cả thông tin lịch hẹn (bookingCode, doctorName, hospitalName, appointmentDate, startTime, endTime, roomName, queueNumber, specialtyName, serviceName)
  - Loại bỏ logic re-initialize transporter (không cần với SendGrid)


  - Update error handling theo SendGrid format
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6. Chuyển đổi hàm sendAppointmentReminderEmail
  - Thay thế logic gửi email bằng `sendEmailViaSendGrid()`
  - Giữ nguyên HTML template với link đến trang quản lý lịch hẹn

  - Loại bỏ check transporter và code Ethereal

  - Update error handling theo SendGrid format
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_




- [-] 7. Chuyển đổi hàm sendAppointmentRescheduleEmail

  - Thay thế logic gửi email bằng `sendEmailViaSendGrid()`
  - Giữ nguyên HTML template với thông tin lịch cũ và mới
  - Đảm bảo hiển thị đúng các thay đổi về ngày giờ và phòng khám
  - Update error handling theo SendGrid format
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_


- [ ] 8. Chuyển đổi hàm sendDoctorAppointmentNotificationEmail
  - Thay thế logic gửi email bằng `sendEmailViaSendGrid()`
  - Giữ nguyên HTML template với thông tin bệnh nhân và lịch hẹn
  - Giữ nguyên logic phân biệt lịch hẹn mới và đổi lịch (isRescheduled)
  - Loại bỏ logic re-initialize transporter

  - Update return format: `{success: true, messageId}` hoặc `{success: false, error}`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_




- [ ] 9. Cập nhật module exports
  - Loại bỏ export của `initializeEmailTransport`
  - Giữ nguyên tất cả exports của các hàm gửi email
  - Đảm bảo không có breaking changes cho code sử dụng module này
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 10. Testing và verification
  - [ ] 10.1 Kiểm tra từng hàm gửi email
    - Test sendOtpEmail với email thật
    - Test sendVerificationEmail với email thật
    - Test sendAppointmentConfirmationEmail với email thật
    - Test sendAppointmentReminderEmail với email thật
    - Test sendAppointmentRescheduleEmail với email thật
    - Test sendDoctorAppointmentNotificationEmail với email thật
    - _Requirements: 10.4_
  
  - [ ] 10.2 Kiểm tra error handling
    - Test với API key không hợp lệ
    - Test với email người gửi chưa verify
    - Verify logging cho cả success và error cases
    - _Requirements: 9.2, 9.3_
  
  - [ ] 10.3 Kiểm tra tương thích ngược
    - Verify tất cả controllers sử dụng emailService vẫn hoạt động bình thường
    - Không có breaking changes trong function signatures
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 11. Cleanup và documentation
  - Loại bỏ dependency `nodemailer` khỏi `package.json`
  - Loại bỏ biến `EMAIL_PASSWORD` khỏi file `.env`
  - Thêm comment trong code về cách sử dụng SendGrid
  - Update README nếu có hướng dẫn về email configuration
  - _Requirements: 1.4, 10.5_

## Ghi chú

- Mỗi task nên được test ngay sau khi hoàn thành để phát hiện lỗi sớm
- Giữ lại code Nodemailer trong Git history để có thể rollback nếu cần
- Đảm bảo có SENDGRID_API_KEY hợp lệ trước khi bắt đầu testing
- Email người gửi (EMAIL_USER) phải được verify trong SendGrid dashboard trước khi gửi email thật
