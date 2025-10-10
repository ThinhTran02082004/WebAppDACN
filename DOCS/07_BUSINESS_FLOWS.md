# BUSINESS FLOWS & WORKFLOWS

## 🔄 QUY TRÌNH NGHIỆP VỤ CHÍNH

---

## 1. 👤 QUY TRÌNH ĐĂNG KÝ & XÁC THỰC

### A. Đăng ký thông thường (Email/Password)

```
1. User nhập thông tin đăng ký
   ├─ Họ tên
   ├─ Email
   ├─ Mật khẩu
   ├─ Số điện thoại
   └─ Thông tin cá nhân

2. System kiểm tra
   ├─ Email đã tồn tại? → Error
   └─ Validation thông tin

3. System tạo account
   ├─ Hash password
   ├─ Generate OTP (6 digits)
   └─ Lưu database (isVerified = false)

4. System gửi OTP qua email
   └─ OTP có hiệu lực 10 phút

5. User nhập OTP
   ├─ OTP đúng? 
   │  ├─ Yes → isVerified = true
   │  │       Generate JWT token
   │  │       Redirect to dashboard
   │  └─ No → Error message
   └─ OTP hết hạn? → Gửi lại OTP mới
```

### B. Đăng nhập OAuth (Google/Facebook)

```
1. User click "Login with Google/Facebook"

2. Redirect to OAuth provider

3. User authorize

4. Callback với authorization code

5. System exchange code for user info
   ├─ Email
   ├─ Full name
   ├─ Profile picture
   └─ Provider ID

6. System kiểm tra user
   ├─ Đã tồn tại?
   │  └─ Yes → Login
   └─ No → Tạo account mới
            isVerified = true
            authProvider = 'google'/'facebook'

7. Generate JWT token

8. Redirect to dashboard
```

### C. Quên mật khẩu

```
1. User nhập email

2. System kiểm tra email tồn tại
   └─ No → Error (không tiết lộ)

3. System tạo reset token
   ├─ Generate unique token (UUID)
   ├─ Set expiry (1 hour)
   └─ Lưu database

4. Gửi email với reset link
   └─ Link: /reset-password/{token}

5. User click link

6. System verify token
   ├─ Expired? → Error
   └─ Valid → Show reset form

7. User nhập password mới

8. System update password
   ├─ Hash password
   ├─ Clear reset token
   └─ Success message

9. User login với password mới
```

---

## 2. 📅 QUY TRÌNH ĐẶT LỊCH KHÁM

### Flow đặt lịch đầy đủ

```
1. USER: Tìm kiếm bác sĩ
   ├─ Theo chuyên khoa
   ├─ Theo bệnh viện
   ├─ Theo tên bác sĩ
   └─ Xem rating & reviews

2. USER: Chọn bác sĩ
   └─ View doctor detail
      ├─ Thông tin bác sĩ
      ├─ Chuyên khoa
      ├─ Kinh nghiệm
      ├─ Đánh giá
      └─ Giá khám

3. USER: Chọn dịch vụ khám
   ├─ Khám tổng quát
   ├─ Khám chuyên khoa
   ├─ Tư vấn online
   └─ Xem giá dịch vụ

4. USER: Chọn chi nhánh
   └─ Xem danh sách bệnh viện
      ├─ Địa chỉ
      ├─ Tiện nghi
      └─ Giờ làm việc

5. SYSTEM: Load lịch làm việc của bác sĩ
   └─ Filter schedules
      ├─ Doctor ID
      ├─ Hospital ID
      ├─ isAvailable = true
      └─ Date >= today

6. USER: Chọn ngày và giờ
   ├─ View calendar
   └─ Chọn slot còn trống

7. USER: Nhập thông tin
   ├─ Lý do khám
   ├─ Triệu chứng
   └─ Ghi chú thêm

8. USER: Áp dụng mã giảm giá (optional)
   └─ SYSTEM validate coupon
      ├─ Còn hiệu lực?
      ├─ Đủ điều kiện?
      └─ Tính discount

9. USER: Chọn phương thức thanh toán
   ├─ PayPal (thanh toán online)
   └─ Thanh toán tại bệnh viện

10. PAYMENT FLOW:

    A. Nếu chọn PayPal:
       ├─ Redirect to PayPal
       ├─ User login PayPal
       ├─ Confirm payment
       ├─ Redirect back
       └─ System execute payment
          ├─ Success → Status = 'paid'
          └─ Failed → Status = 'pending'

    B. Nếu thanh toán sau:
       └─ Status = 'pending'

11. SYSTEM: Tạo appointment
    ├─ Status = 'pending'
    ├─ Generate QR code
    └─ Lưu database

12. SYSTEM: Cập nhật schedule
    └─ currentPatients += 1

13. SYSTEM: Gửi email xác nhận
    └─ Thông tin appointment
       ├─ Mã đặt lịch
       ├─ Bác sĩ
       ├─ Ngày giờ
       ├─ Địa điểm
       ├─ QR code
       └─ Hướng dẫn

14. SYSTEM: Thông báo cho bác sĩ
    └─ Socket.io notification

15. USER: Nhận xác nhận
    └─ View appointment detail
       ├─ Print phiếu khám
       └─ Save calendar
```

---

## 3. 👨‍⚕️ QUY TRÌNH XÁC NHẬN & KHÁM BỆNH

### A. Bác sĩ xác nhận lịch

```
1. DOCTOR: View appointments
   └─ Filter: status = 'pending'

2. DOCTOR: Review appointment
   ├─ Patient info
   ├─ Reason for visit
   └─ Medical history

3. DOCTOR: Make decision
   ├─ ACCEPT
   │  └─ Status = 'confirmed'
   │     └─ Send email to patient
   │
   └─ REJECT
      └─ Status = 'cancelled'
         ├─ Nhập lý do
         ├─ Send email to patient
         └─ Refund (if paid)

4. SYSTEM: Update appointment status

5. SYSTEM: Send notification
```

### B. Ngày khám bệnh

```
1. PATIENT: Đến bệnh viện
   └─ Check-in bằng QR code

2. RECEPTIONIST: Scan QR code
   └─ SYSTEM verify appointment
      ├─ Valid → checkInTime = now
      │         Status = 'in-progress'
      └─ Invalid → Error message

3. DOCTOR: Start examination
   └─ View patient info
      ├─ Personal details
      ├─ Medical history
      ├─ Previous records
      └─ Reason for visit

4. DOCTOR: Perform examination
   ├─ Vital signs
   ├─ Symptoms check
   └─ Diagnosis

5. DOCTOR: Create medical record
   ├─ Diagnosis
   ├─ Symptoms
   ├─ Test results
   ├─ Prescriptions
   │  ├─ Select medications
   │  ├─ Dosage
   │  ├─ Duration
   │  └─ Instructions
   ├─ Notes
   └─ Follow-up date

6. DOCTOR: Complete appointment
   └─ Status = 'completed'
      └─ checkOutTime = now

7. SYSTEM: Save medical record

8. PATIENT: View medical record
   ├─ Diagnosis
   ├─ Prescriptions
   └─ Download/Print

9. PATIENT: (Optional) Leave review
   └─ See Review Flow below
```

---

## 4. ⭐ QUY TRÌNH ĐÁNH GIÁ

```
1. SYSTEM: After appointment completed
   └─ Send review request email
      └─ Link to review page

2. PATIENT: Access review page
   └─ Can review:
      ├─ Doctor
      └─ Hospital

3. PATIENT: Submit review
   ├─ Rating (1-5 stars)
   ├─ Comment
   ├─ Recommend? (yes/no)
   └─ Upload images (optional)

4. SYSTEM: Save review
   └─ isApproved = false (pending)

5. ADMIN: Review moderation
   ├─ APPROVE → isApproved = true
   │           isVisible = true
   └─ REJECT → Delete/Hide

6. SYSTEM: Update ratings
   ├─ Calculate new average
   ├─ Update doctor.averageRating
   └─ Update doctor.reviewCount

7. DOCTOR: View reviews
   └─ Can reply to reviews

8. SYSTEM: Display reviews
   └─ Show on doctor profile
```

---

## 5. 💬 QUY TRÌNH CHAT

```
1. PATIENT: Initiate chat with doctor
   └─ Click "Chat" button

2. SYSTEM: Check conversation exists
   ├─ Exists → Open conversation
   └─ No → Create new conversation
            participants = [patient, doctor]

3. PATIENT: Send message
   └─ Socket.emit('send_message', data)

4. SYSTEM: Save message to DB
   └─ Create Message document

5. SYSTEM: Broadcast message
   └─ Socket.to(conversationId).emit('new_message', msg)

6. DOCTOR: Receive message
   ├─ Real-time notification
   └─ Update unread count

7. DOCTOR: Reply message
   └─ Same flow as above

8. Features:
   ├─ Send text
   ├─ Send images/files
   ├─ Typing indicator
   ├─ Read receipts
   └─ Message history
```

---

## 6. 🎥 QUY TRÌNH VIDEO CALL

```
1. PATIENT: Book online consultation
   └─ Service type = 'online'

2. DOCTOR: Confirm appointment

3. SYSTEM: Create room
   └─ Room name = appointment ID

4. SYSTEM: Generate tokens
   ├─ Patient token
   └─ Doctor token

5. At appointment time:

   A. PATIENT joins:
      ├─ Click "Join Video Call"
      ├─ Request camera/mic permission
      └─ Connect to LiveKit room

   B. DOCTOR joins:
      └─ Same flow

6. In call features:
   ├─ Video on/off
   ├─ Microphone on/off
   ├─ Screen sharing
   ├─ Chat messages
   └─ End call

7. After call:
   ├─ Room status = 'ended'
   ├─ Save call duration
   └─ Doctor creates medical record

8. SYSTEM: Send recording link (optional)
```

---

## 7. 💳 QUY TRÌNH THANH TOÁN & HOÀN TIỀN

### A. Thanh toán PayPal

```
1. USER: Select PayPal payment

2. SYSTEM: Create payment
   └─ PayPal API: create payment
      ├─ Amount
      ├─ Currency
      ├─ Description
      └─ Redirect URLs

3. SYSTEM: Get approval URL

4. USER: Redirect to PayPal
   └─ Login PayPal account

5. USER: Confirm payment

6. PayPal: Redirect back with payment ID

7. SYSTEM: Execute payment
   └─ PayPal API: execute payment

8. PayPal: Return success/failure

9. SYSTEM: Update payment record
   ├─ Success → paymentStatus = 'success'
   │           Save transaction ID
   └─ Failure → paymentStatus = 'failed'

10. SYSTEM: Update appointment
    └─ paymentStatus = 'paid'

11. USER: View payment confirmation
```

### B. Hoàn tiền

```
1. ADMIN/SYSTEM: Initiate refund
   └─ Reasons:
      ├─ Doctor cancelled
      ├─ Hospital closed
      └─ User request

2. SYSTEM: Check payment method
   └─ PayPal → Process PayPal refund

3. SYSTEM: Call PayPal refund API
   └─ Pass transaction ID

4. PayPal: Process refund

5. SYSTEM: Update payment
   ├─ paymentStatus = 'refunded'
   ├─ refundDate = now
   └─ refundReason

6. SYSTEM: Update appointment
   └─ paymentStatus = 'refunded'

7. SYSTEM: Send email notification

8. USER: Receive refund (3-5 days)
```

---

## 8. 📊 QUY TRÌNH THỐNG KÊ

### Daily Statistics Update

```
1. CRON JOB: Every midnight
   └─ Calculate daily statistics

2. Count appointments
   ├─ Total today
   ├─ By status
   ├─ By doctor
   ├─ By specialty
   └─ By hospital

3. Calculate revenue
   ├─ Total payments
   ├─ Successful payments
   └─ By payment method

4. Count users
   ├─ New registrations
   ├─ Active users
   └─ By role

5. Save to statistics collection

6. Update doctor performance
   ├─ Completed appointments
   ├─ Average rating
   └─ Revenue generated

7. Generate reports
   └─ Admin dashboard data
```

---

## 9. 📧 QUY TRÌNH GỬI EMAIL TỰ ĐỘNG

### Scheduled Reminders

```
CRON: Every hour

1. Find appointments for tomorrow
   └─ Query:
      ├─ appointmentDate = tomorrow
      ├─ status = 'confirmed'
      └─ reminderSent = false

2. For each appointment:
   ├─ Compose email
   │  ├─ Patient name
   │  ├─ Doctor name
   │  ├─ Date & time
   │  ├─ Location
   │  └─ Instructions
   │
   ├─ Send email
   │
   └─ Update: reminderSent = true

3. Log results
```

---

## 10. 🔄 QUY TRÌNH ĐỔI LỊCH HẸN

```
1. PATIENT: Request reschedule
   └─ Conditions:
      ├─ status = 'confirmed'
      └─ appointmentDate > now + 24h

2. PATIENT: Select new date/time
   └─ View available slots

3. PATIENT: Enter reason

4. SYSTEM: Check availability
   ├─ Doctor available?
   └─ Room available?

5. SYSTEM: Create reschedule request
   └─ Save old date/time

6. DOCTOR: Review request
   ├─ APPROVE
   │  ├─ Update appointment
   │  ├─ Update schedules
   │  └─ Send confirmation
   │
   └─ REJECT
      └─ Send notification with reason

7. If approved:
   ├─ Send email confirmation
   └─ Update calendar
```

---

## 11. 🚫 QUY TRÌNH HỦY LỊCH

```
1. PATIENT: Cancel appointment
   └─ Conditions:
      ├─ status ∈ ['pending', 'confirmed']
      └─ appointmentDate > now + 24h

2. PATIENT: Enter cancellation reason

3. SYSTEM: Update appointment
   ├─ status = 'cancelled'
   ├─ cancellationReason
   └─ Save cancellation time

4. SYSTEM: Update schedule
   └─ currentPatients -= 1

5. SYSTEM: Check payment
   └─ If paid:
      ├─ Calculate refund
      ├─ Deduct cancellation fee (if any)
      └─ Process refund

6. SYSTEM: Notify doctor

7. SYSTEM: Send email to patient
   └─ Cancellation confirmation

8. If refund:
   └─ Process refund (see flow above)
```

---

## 🎯 STATE MACHINES

### Appointment Status Flow

```
pending → confirmed → in-progress → completed
   ↓          ↓
cancelled  cancelled
   ↓
(possible refund)

Also:
confirmed → no-show (if patient doesn't come)
```

### Payment Status Flow

```
pending → success → (refunded)
   ↓
failed
```

### Schedule Availability

```
available → (currentPatients < maxPatients)
unavailable → (currentPatients >= maxPatients)
locked → (manually disabled by doctor)
```

---

## 📌 BUSINESS RULES

### Booking Rules
1. Không thể đặt lịch quá khứ
2. Không thể đặt lịch < 2h trước giờ khám
3. Một user chỉ có 1 active appointment/doctor/day
4. Schedule phải available
5. Payment required cho online consultation

### Cancellation Rules
1. Phải hủy trước 24h → full refund
2. Hủy < 24h → 50% refund
3. No-show → no refund

### Review Rules
1. Chỉ review sau khi completed
2. Một appointment chỉ review 1 lần
3. Review phải được approve mới hiển thị

### Refund Rules
1. PayPal: tự động qua API
2. Cash: manual process
3. Processing time: 3-5 business days
