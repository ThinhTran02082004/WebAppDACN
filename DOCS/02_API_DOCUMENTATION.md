# API DOCUMENTATION

## 📌 BASE URL
- Development: `http://localhost:5000/api`
- Production: `[Your production URL]/api`

## 🔑 AUTHENTICATION
Hầu hết API đều yêu cầu JWT token trong header:
```
Authorization: Bearer <token>
```

---

## 👤 AUTH ROUTES (`/api/auth`)

### User Authentication

#### POST `/api/auth/register`
Đăng ký tài khoản mới
```json
Request Body:
{
  "fullName": "Nguyễn Văn A",
  "email": "user@example.com",
  "password": "password123",
  "phoneNumber": "0123456789",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "address": "123 ABC Street"
}

Response: 201 Created
{
  "message": "Registration successful. Please check your email for verification.",
  "userId": "user_id"
}
```

#### POST `/api/auth/verify-otp`
Xác thực OTP
```json
Request Body:
{
  "email": "user@example.com",
  "otp": "123456"
}

Response: 200 OK
{
  "message": "Email verified successfully",
  "token": "jwt_token"
}
```

#### POST `/api/auth/login`
Đăng nhập
```json
Request Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "token": "jwt_token",
  "user": {
    "_id": "user_id",
    "fullName": "Nguyễn Văn A",
    "email": "user@example.com",
    "roleType": "user"
  }
}
```

#### GET `/api/auth/google`
Khởi tạo Google OAuth

#### GET `/api/auth/google/callback`
Callback sau khi đăng nhập Google

#### GET `/api/auth/facebook`
Khởi tạo Facebook OAuth

#### GET `/api/auth/facebook/callback`
Callback sau khi đăng nhập Facebook

#### POST `/api/auth/forgot-password`
Quên mật khẩu
```json
Request Body:
{
  "email": "user@example.com"
}

Response: 200 OK
{
  "message": "Password reset link sent to email"
}
```

#### POST `/api/auth/reset-password/:token`
Reset mật khẩu
```json
Request Body:
{
  "password": "new_password"
}

Response: 200 OK
{
  "message": "Password reset successful"
}
```

#### GET `/api/auth/profile`
Lấy thông tin profile (requires auth)
```json
Response: 200 OK
{
  "user": {
    "_id": "user_id",
    "fullName": "Nguyễn Văn A",
    "email": "user@example.com",
    ...
  }
}
```

#### PUT `/api/auth/profile`
Cập nhật profile (requires auth)
```json
Request Body:
{
  "fullName": "Nguyễn Văn B",
  "phoneNumber": "0987654321",
  ...
}

Response: 200 OK
{
  "message": "Profile updated successfully",
  "user": {...}
}
```

---

## 👨‍⚕️ DOCTOR ROUTES

### Doctor Authentication (`/api/doctor-auth`)

#### POST `/api/doctor-auth/login`
Đăng nhập bác sĩ
```json
Request Body:
{
  "email": "doctor@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "token": "jwt_token",
  "doctor": {...}
}
```

### Doctor Management (`/api/doctors`)

#### GET `/api/doctors`
Lấy danh sách bác sĩ
```
Query params:
- page: số trang (default: 1)
- limit: số lượng/trang (default: 10)
- specialty: lọc theo chuyên khoa
- hospital: lọc theo bệnh viện
- search: tìm kiếm theo tên

Response: 200 OK
{
  "doctors": [...],
  "totalPages": 10,
  "currentPage": 1
}
```

#### GET `/api/doctors/:id`
Lấy thông tin chi tiết bác sĩ
```json
Response: 200 OK
{
  "doctor": {
    "_id": "doctor_id",
    "fullName": "BS. Nguyễn Văn A",
    "specialty": {...},
    "qualifications": "Bác sĩ chuyên khoa I",
    "experience": "10 năm kinh nghiệm",
    "averageRating": 4.5,
    "reviewCount": 100
  }
}
```

#### PUT `/api/doctors/profile`
Cập nhật profile bác sĩ (requires auth - doctor role)

#### GET `/api/doctors/:id/schedules`
Lấy lịch làm việc của bác sĩ
```
Query params:
- date: ngày cụ thể
- month: tháng
- year: năm

Response: 200 OK
{
  "schedules": [...]
}
```

#### GET `/api/doctors/:id/reviews`
Lấy đánh giá của bác sĩ

---

## 📅 APPOINTMENT ROUTES (`/api/appointments`)

#### POST `/api/appointments`
Đặt lịch hẹn (requires auth)
```json
Request Body:
{
  "doctorId": "doctor_id",
  "scheduleId": "schedule_id",
  "serviceId": "service_id",
  "appointmentDate": "2024-01-15",
  "appointmentTime": "09:00",
  "reason": "Khám định kỳ",
  "notes": "Ghi chú thêm",
  "paymentMethod": "paypal"
}

Response: 201 Created
{
  "message": "Appointment created successfully",
  "appointment": {...},
  "paymentUrl": "paypal_payment_url"
}
```

#### GET `/api/appointments`
Lấy danh sách lịch hẹn (requires auth)
```
Query params:
- status: lọc theo trạng thái (pending, confirmed, completed, cancelled)
- date: lọc theo ngày
- page, limit: phân trang

Response: 200 OK
{
  "appointments": [...],
  "totalPages": 5,
  "currentPage": 1
}
```

#### GET `/api/appointments/:id`
Lấy chi tiết lịch hẹn (requires auth)

#### PUT `/api/appointments/:id/status`
Cập nhật trạng thái lịch hẹn (requires auth - doctor/admin)
```json
Request Body:
{
  "status": "confirmed",
  "notes": "Ghi chú"
}

Response: 200 OK
{
  "message": "Status updated",
  "appointment": {...}
}
```

#### PUT `/api/appointments/:id/reschedule`
Đặt lại lịch hẹn (requires auth)
```json
Request Body:
{
  "newScheduleId": "schedule_id",
  "newDate": "2024-01-20",
  "newTime": "10:00",
  "reason": "Lý do đổi lịch"
}
```

#### DELETE `/api/appointments/:id`
Hủy lịch hẹn (requires auth)

---

## 🗓️ SCHEDULE ROUTES (`/api/schedules`)

#### GET `/api/schedules`
Lấy danh sách lịch làm việc
```
Query params:
- doctorId: lọc theo bác sĩ
- hospitalId: lọc theo bệnh viện
- date: lọc theo ngày
- available: chỉ lấy lịch còn chỗ (true/false)
```

#### POST `/api/schedules`
Tạo lịch làm việc (requires auth - doctor/admin)
```json
Request Body:
{
  "doctorId": "doctor_id",
  "hospitalId": "hospital_id",
  "roomId": "room_id",
  "date": "2024-01-15",
  "shift": "morning",
  "startTime": "08:00",
  "endTime": "12:00",
  "maxPatients": 20
}

Response: 201 Created
{
  "message": "Schedule created",
  "schedule": {...}
}
```

#### PUT `/api/schedules/:id`
Cập nhật lịch làm việc (requires auth - doctor/admin)

#### DELETE `/api/schedules/:id`
Xóa lịch làm việc (requires auth - doctor/admin)

---

## 🏥 HOSPITAL ROUTES (`/api/hospitals`)

#### GET `/api/hospitals`
Lấy danh sách bệnh viện/chi nhánh
```json
Response: 200 OK
{
  "hospitals": [
    {
      "_id": "hospital_id",
      "name": "Bệnh viện ABC - Chi nhánh Quận 1",
      "address": "123 Nguyễn Huệ",
      "phone": "0123456789",
      "facilities": ["Phòng khám", "Phòng mổ", ...],
      "images": [...]
    }
  ]
}
```

#### GET `/api/hospitals/:id`
Lấy chi tiết bệnh viện

#### POST `/api/hospitals`
Tạo bệnh viện (requires auth - admin)

#### PUT `/api/hospitals/:id`
Cập nhật bệnh viện (requires auth - admin)

#### DELETE `/api/hospitals/:id`
Xóa bệnh viện (requires auth - admin)

---

## 🩺 SERVICE ROUTES (`/api/services`)

#### GET `/api/services`
Lấy danh sách dịch vụ

#### GET `/api/services/:id`
Lấy chi tiết dịch vụ

#### POST `/api/services`
Tạo dịch vụ (requires auth - admin)
```json
Request Body:
{
  "name": "Khám tổng quát",
  "description": "Mô tả dịch vụ",
  "price": 200000,
  "duration": 30,
  "image": "image_url"
}
```

#### PUT `/api/services/:id`
Cập nhật dịch vụ (requires auth - admin)

#### DELETE `/api/services/:id`
Xóa dịch vụ (requires auth - admin)

---

## 🎯 SPECIALTY ROUTES (`/api/specialties`)

#### GET `/api/specialties`
Lấy danh sách chuyên khoa

#### GET `/api/specialties/:id`
Lấy chi tiết chuyên khoa

#### POST `/api/specialties`
Tạo chuyên khoa (requires auth - admin)

#### PUT `/api/specialties/:id`
Cập nhật chuyên khoa (requires auth - admin)

#### DELETE `/api/specialties/:id`
Xóa chuyên khoa (requires auth - admin)

---

## 📋 MEDICAL RECORD ROUTES (`/api/medical-records`)

#### GET `/api/medical-records`
Lấy danh sách bệnh án (requires auth)
```
Query params:
- patientId: lọc theo bệnh nhân
- doctorId: lọc theo bác sĩ
```

#### GET `/api/medical-records/:id`
Lấy chi tiết bệnh án (requires auth)

#### POST `/api/medical-records`
Tạo bệnh án (requires auth - doctor)
```json
Request Body:
{
  "appointmentId": "appointment_id",
  "patientId": "patient_id",
  "diagnosis": "Chẩn đoán",
  "symptoms": "Triệu chứng",
  "testResults": "Kết quả xét nghiệm",
  "prescriptions": [
    {
      "medication": "medication_id",
      "dosage": "2 viên/ngày",
      "duration": "7 ngày",
      "instructions": "Uống sau ăn"
    }
  ],
  "notes": "Ghi chú thêm",
  "attachments": ["file_url"]
}

Response: 201 Created
{
  "message": "Medical record created",
  "record": {...}
}
```

#### PUT `/api/medical-records/:id`
Cập nhật bệnh án (requires auth - doctor)

---

## 💳 PAYMENT ROUTES (`/api/payments`)

#### POST `/api/payments/create-payment`
Tạo thanh toán PayPal
```json
Request Body:
{
  "appointmentId": "appointment_id",
  "amount": 200000,
  "couponCode": "DISCOUNT10"
}

Response: 200 OK
{
  "paymentId": "paypal_payment_id",
  "approvalUrl": "paypal_approval_url"
}
```

#### GET `/api/payments/execute-payment`
Thực hiện thanh toán sau khi approve
```
Query params:
- paymentId: PayPal payment ID
- PayerID: PayPal payer ID

Response: 200 OK
{
  "message": "Payment successful",
  "payment": {...}
}
```

#### GET `/api/payments`
Lấy lịch sử thanh toán (requires auth)

#### GET `/api/payments/:id`
Lấy chi tiết thanh toán (requires auth)

#### POST `/api/payments/:id/refund`
Hoàn tiền (requires auth - admin)

---

## 🎟️ COUPON ROUTES (`/api/coupons`)

#### GET `/api/coupons`
Lấy danh sách mã giảm giá (requires auth - admin)

#### POST `/api/coupons/validate`
Kiểm tra mã giảm giá
```json
Request Body:
{
  "code": "DISCOUNT10",
  "userId": "user_id",
  "amount": 200000
}

Response: 200 OK
{
  "valid": true,
  "discount": 20000,
  "finalAmount": 180000
}
```

#### POST `/api/coupons`
Tạo mã giảm giá (requires auth - admin)
```json
Request Body:
{
  "code": "DISCOUNT10",
  "discountType": "percentage",
  "discountValue": 10,
  "minAmount": 100000,
  "maxDiscount": 50000,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "usageLimit": 100
}
```

---

## ⭐ REVIEW ROUTES (`/api/reviews`)

#### GET `/api/reviews`
Lấy danh sách đánh giá
```
Query params:
- doctorId: lọc theo bác sĩ
- hospitalId: lọc theo bệnh viện
- rating: lọc theo số sao
```

#### POST `/api/reviews`
Tạo đánh giá (requires auth)
```json
Request Body:
{
  "appointmentId": "appointment_id",
  "doctorId": "doctor_id",
  "rating": 5,
  "comment": "Bác sĩ rất tận tâm",
  "recommend": true
}

Response: 201 Created
{
  "message": "Review submitted",
  "review": {...}
}
```

#### PUT `/api/reviews/:id`
Cập nhật đánh giá (requires auth)

#### DELETE `/api/reviews/:id`
Xóa đánh giá (requires auth - admin)

#### POST `/api/reviews/:id/reply`
Trả lời đánh giá (requires auth - doctor/admin)
```json
Request Body:
{
  "reply": "Cảm ơn bạn đã đánh giá"
}
```

---

## 💬 CHAT ROUTES (`/api/chat`)

#### GET `/api/chat/conversations`
Lấy danh sách cuộc trò chuyện (requires auth)

#### POST `/api/chat/conversations`
Tạo cuộc trò chuyện mới (requires auth)
```json
Request Body:
{
  "participantId": "doctor_id or user_id"
}
```

#### GET `/api/chat/conversations/:id/messages`
Lấy tin nhắn trong cuộc trò chuyện (requires auth)

#### POST `/api/chat/messages`
Gửi tin nhắn (requires auth)
```json
Request Body:
{
  "conversationId": "conversation_id",
  "content": "Nội dung tin nhắn",
  "attachments": ["file_url"]
}
```

---

## 🎥 ROOM ROUTES (Video Call) (`/api/rooms`)

#### POST `/api/rooms/create`
Tạo phòng video call (requires auth)
```json
Request Body:
{
  "appointmentId": "appointment_id"
}

Response: 200 OK
{
  "roomName": "room_unique_id",
  "token": "livekit_access_token"
}
```

#### POST `/api/rooms/:roomName/join`
Join phòng video call (requires auth)
```json
Response: 200 OK
{
  "token": "livekit_access_token"
}
```

#### DELETE `/api/rooms/:roomName`
Đóng phòng (requires auth - doctor/admin)

---

## 💊 MEDICATION ROUTES (`/api/medications`)

#### GET `/api/medications`
Lấy danh sách thuốc
```
Query params:
- search: tìm kiếm theo tên
- page, limit: phân trang
```

#### GET `/api/medications/:id`
Lấy chi tiết thuốc

#### POST `/api/medications`
Tạo thuốc (requires auth - admin)
```json
Request Body:
{
  "name": "Paracetamol",
  "ingredient": "Paracetamol 500mg",
  "usage": "Giảm đau, hạ sốt",
  "dosage": "1-2 viên/lần",
  "sideEffects": "Có thể gây buồn ngủ",
  "price": 50000,
  "image": "image_url"
}
```

---

## 📰 NEWS ROUTES (`/api/news`)

#### GET `/api/news`
Lấy danh sách tin tức
```
Query params:
- category: lọc theo danh mục
- page, limit: phân trang
```

#### GET `/api/news/:id`
Lấy chi tiết bài viết

#### POST `/api/news`
Tạo bài viết (requires auth - admin)

#### PUT `/api/news/:id`
Cập nhật bài viết (requires auth - admin)

#### DELETE `/api/news/:id`
Xóa bài viết (requires auth - admin)

---

## 📊 STATISTICS ROUTES (`/api/statistics`)

#### GET `/api/statistics/dashboard`
Lấy thống kê dashboard (requires auth - admin)
```json
Response: 200 OK
{
  "totalUsers": 1000,
  "totalDoctors": 50,
  "totalAppointments": 5000,
  "totalRevenue": 100000000,
  "todayAppointments": 20,
  "monthlyRevenue": [...],
  "appointmentsByStatus": {...},
  "topDoctors": [...],
  "topServices": [...]
}
```

#### GET `/api/statistics/doctor/:doctorId`
Thống kê của bác sĩ (requires auth - doctor)

#### GET `/api/statistics/revenue`
Thống kê doanh thu (requires auth - admin)
```
Query params:
- startDate, endDate: khoảng thời gian
- groupBy: day, month, year
```

---

## 👨‍💼 ADMIN ROUTES (`/api/admin`)

#### GET `/api/admin/users`
Quản lý người dùng (requires auth - admin)

#### PUT `/api/admin/users/:id/status`
Kích hoạt/vô hiệu hóa user (requires auth - admin)

#### DELETE `/api/admin/users/:id`
Xóa user (requires auth - admin)

#### GET `/api/admin/doctors`
Quản lý bác sĩ (requires auth - admin)

#### POST `/api/admin/doctors`
Tạo tài khoản bác sĩ (requires auth - admin)

#### GET `/api/admin/appointments`
Quản lý tất cả lịch hẹn (requires auth - admin)

---

## ❌ ERROR RESPONSES

### Common Error Codes
- `400 Bad Request`: Dữ liệu không hợp lệ
- `401 Unauthorized`: Chưa đăng nhập
- `403 Forbidden`: Không có quyền
- `404 Not Found`: Không tìm thấy
- `409 Conflict`: Dữ liệu trùng lặp
- `500 Internal Server Error`: Lỗi server

### Error Response Format
```json
{
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Email already exists"
    }
  ]
}
```

---

## 🔄 REAL-TIME EVENTS (Socket.io)

### Client Events (Emit)
- `join_conversation`: Join phòng chat
- `send_message`: Gửi tin nhắn
- `typing`: Đang gõ

### Server Events (Listen)
- `new_message`: Tin nhắn mới
- `message_read`: Đã đọc
- `user_typing`: Người khác đang gõ
- `appointment_update`: Cập nhật lịch hẹn
