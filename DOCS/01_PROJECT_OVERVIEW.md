# TÀI LIỆU DỰ ÁN - HOSPITAL WEB SYSTEM

## 📋 TỔNG QUAN DỰ ÁN

### Giới thiệu
**Hospital Web** là hệ thống quản lý bệnh viện toàn diện với các tính năng:
- Đặt lịch khám trực tuyến
- Quản lý hồ sơ bệnh án điện tử
- Thanh toán trực tuyến (PayPal)
- Chat và video call với bác sĩ
- Thống kê và báo cáo

### Thông tin dự án
- **GitHub**: https://github.com/soncoderz/DACS-hospitalweb
- **Node.js**: v22.14.0
- **Database**: MongoDB Atlas
- **Frontend**: React 19.0.0 + Vite
- **Backend**: Node.js + Express 4.18.2

---

## 🏗️ KIẾN TRÚC HỆ THỐNG

### Kiến trúc Client-Server
```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │────────▶│   Backend    │────────▶│   MongoDB    │
│  React+Vite  │◀────────│   Express    │◀────────│    Atlas     │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │
       ├────────────────────────┼─────▶ Socket.io (Chat Real-time)
       ├────────────────────────┼─────▶ LiveKit (Video Call)
       ├────────────────────────┼─────▶ PayPal API (Payment)
       └────────────────────────┼─────▶ Cloudinary (Image Storage)
```

### Tech Stack

#### Frontend
- **Core**: React 19.0.0, Vite 5.1.4
- **UI Libraries**: Material-UI 7.0.2, Ant Design 5.24.6, TailwindCSS 3.3.0
- **Routing**: React Router DOM 7.4.0
- **State**: React Context API
- **HTTP**: Axios 1.8.4
- **Real-time**: Socket.io-client 4.8.1
- **Video**: LiveKit Components 2.9.15
- **Auth**: @react-oauth/google 0.12.1
- **Charts**: Chart.js 4.4.9, Recharts 2.15.2

#### Backend
- **Runtime**: Node.js v22.14.0
- **Framework**: Express 4.18.2
- **Database**: MongoDB + Mongoose 8.0.3
- **Auth**: JWT, Passport (Google, Facebook OAuth)
- **Security**: bcryptjs 2.4.3
- **Email**: Nodemailer 6.10.0
- **Upload**: Multer + Cloudinary 1.41.3
- **Payment**: PayPal REST SDK 1.8.1
- **Real-time**: Socket.io 4.8.1
- **Video**: LiveKit Server SDK 2.14.0
- **Scheduling**: node-cron 3.0.3

---

## 📁 CẤU TRÚC DỰ ÁN

### Cấu trúc tổng thể
```
DACS-hospitalweb/
├── client/                      # Frontend React App
│   ├── src/
│   │   ├── components/         # Components (admin, doctor, user, shared)
│   │   ├── pages/             # Pages (user: 34, admin: 14, doctor: 8)
│   │   ├── context/           # React Context
│   │   ├── utils/             # Utilities
│   │   └── App.jsx            # Main app
│   ├── .env                   # Environment variables
│   └── package.json           # Dependencies
│
├── server/                     # Backend Node.js App
│   ├── config/                # Configurations (DB, Passport, Socket)
│   ├── controllers/           # Business logic (22 controllers)
│   ├── models/                # MongoDB schemas (18 models)
│   ├── routes/                # API routes (20 route files)
│   ├── middlewares/           # Auth, validation, upload
│   ├── services/              # Email service
│   ├── utils/                 # Utilities, cron jobs
│   ├── .env                   # Environment variables
│   └── server.js              # Entry point
│
└── README.txt                 # Setup guide
```

### Client Pages Detail
- **User Pages (34)**: Home, Login, Register, Profile, Appointment, Doctors, Services, Specialties, Branches, News, Reviews, Payment, Medical History, etc.
- **Doctor Pages (8)**: Dashboard, Appointments, Schedule, Medical Records, Patients, Profile, Reviews
- **Admin Pages (14)**: Dashboard, Users, Doctors, Appointments, Services, Specialties, Hospitals, Rooms, Payments, Coupons, Reviews, Medications, News

### Server Components
- **Controllers (22)**: auth, user, doctor, appointment, schedule, medical record, payment (PayPal, MoMo), review, hospital, service, specialty, coupon, chat, room, medication, news, statistics
- **Models (18)**: User, Doctor, Appointment, Schedule, MedicalRecord, Payment, Review, Hospital, Service, Specialty, Coupon, Conversation, Message, Room, Medication, News, ServicePriceHistory
- **Routes (20)**: Tương ứng với các controllers

---

## 👥 USER ROLES

### 1. Admin
- **Quyền**: Toàn quyền quản trị hệ thống
- **Chức năng**:
  - Quản lý người dùng, bác sĩ
  - Quản lý lịch hẹn, thanh toán
  - Quản lý dịch vụ, chuyên khoa, chi nhánh
  - Quản lý phòng khám, thuốc, tin tức
  - Quản lý mã giảm giá, đánh giá
  - Xem thống kê, báo cáo

### 2. Doctor (Bác sĩ)
- **Quyền**: Quản lý lịch làm việc và bệnh nhân
- **Chức năng**:
  - Quản lý lịch làm việc
  - Xem và xác nhận lịch hẹn
  - Tạo và cập nhật bệnh án
  - Chat với bệnh nhân
  - Video call tư vấn
  - Xem đánh giá

### 3. User (Bệnh nhân)
- **Quyền**: Đặt lịch và quản lý thông tin cá nhân
- **Chức năng**:
  - Đăng ký, đăng nhập (email/OAuth)
  - Đặt lịch khám
  - Xem lịch sử khám bệnh
  - Xem bệnh án
  - Thanh toán online
  - Chat với bác sĩ
  - Video call tư vấn
  - Đánh giá bác sĩ, bệnh viện

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### Authentication Methods
1. **Email/Password**: Đăng ký thông thường với xác thực OTP
2. **Google OAuth 2.0**: Đăng nhập bằng Google
3. **Facebook OAuth**: Đăng nhập bằng Facebook
4. **JWT Token**: Access token & refresh token

### Authorization
- **Middleware**: `auth.js`, `roleCheck.js`
- **Roles**: admin, doctor, user
- **Protected Routes**: Kiểm tra token và role

---

## 📧 THÔNG BÁO & EMAIL

### Email Notifications
- **Service**: Nodemailer với Gmail SMTP
- **Triggers**:
  - Đăng ký tài khoản → OTP verification
  - Đặt lịch → Xác nhận lịch hẹn
  - Xác nhận lịch → Thông báo cho bệnh nhân
  - Hủy lịch → Thông báo
  - Nhắc lịch → Trước 24h (cron job)
  - Quên mật khẩu → Reset password link

### Real-time Notifications
- **Socket.io**: Chat messages, appointment updates
- **Toast**: React Hot Toast, React Toastify

---

## 💳 PAYMENT INTEGRATION

### PayPal Integration
- **SDK**: paypal-rest-sdk 1.8.1
- **Flow**:
  1. Create payment
  2. Redirect to PayPal
  3. Execute payment after approval
  4. Save transaction to database
- **Refund**: Admin có thể hoàn tiền

### Payment Status
- `pending`: Đang xử lý
- `success`: Thành công
- `failed`: Thất bại
- `refunded`: Đã hoàn tiền

---

## 📊 DATABASE SCHEMA (Tóm tắt)

### Core Models
1. **User**: Thông tin người dùng (bệnh nhân, admin)
2. **Doctor**: Thông tin bác sĩ
3. **Appointment**: Lịch hẹn
4. **Schedule**: Lịch làm việc bác sĩ
5. **MedicalRecord**: Bệnh án
6. **Payment**: Giao dịch thanh toán
7. **Review**: Đánh giá
8. **Hospital**: Chi nhánh bệnh viện
9. **Service**: Dịch vụ y tế
10. **Specialty**: Chuyên khoa
11. **Coupon**: Mã giảm giá
12. **Conversation/Message**: Chat
13. **Room**: Phòng video call
14. **Medication**: Thuốc
15. **News**: Tin tức

### Relationships
- User → Appointments (1:N)
- Doctor → Appointments (1:N)
- Doctor → Schedules (1:N)
- Appointment → MedicalRecord (1:1)
- Appointment → Payment (1:1)
- Doctor/Hospital → Reviews (1:N)
- User ↔ Doctor → Conversation (N:M)

---

## 🎯 TÍNH NĂNG CHÍNH

### 1. Đặt lịch khám (Appointment Booking)
- Chọn chuyên khoa → bệnh viện → bác sĩ → dịch vụ → ngày giờ
- Thanh toán online hoặc sau
- Nhận email xác nhận
- QR code check-in

### 2. Quản lý bệnh án (Medical Records)
- Bác sĩ tạo bệnh án sau khám
- Chẩn đoán, triệu chứng, đơn thuốc
- Kết quả xét nghiệm, hình ảnh
- Bệnh nhân xem lịch sử

### 3. Thanh toán (Payment)
- PayPal integration
- Áp dụng mã giảm giá
- Lịch sử giao dịch
- In hóa đơn

### 4. Chat Real-time
- Socket.io
- Chat 1-1 với bác sĩ
- Gửi file, hình ảnh
- Lịch sử tin nhắn

### 5. Video Call
- LiveKit integration
- Tư vấn trực tuyến
- Share screen
- Chat trong call

### 6. Đánh giá (Reviews)
- Rating 1-5 sao
- Nhận xét bác sĩ/bệnh viện
- Trả lời đánh giá
- Kiểm duyệt

### 7. Thống kê (Statistics)
- Dashboard admin: Doanh thu, lịch hẹn, người dùng
- Dashboard doctor: Bệnh nhân, lịch hẹn
- Charts: Chart.js, Recharts
- Báo cáo xuất Excel/PDF

### 8. Quản lý (Management)
- CRUD cho tất cả entities
- Search, filter, pagination
- Upload hình ảnh (Cloudinary)
- Cron jobs (nhắc lịch, cleanup)

---

## 🚀 SETUP & DEPLOYMENT

### Development Setup
```bash
# Clone repo
git clone https://github.com/soncoderz/DACS-hospitalweb

# Server setup
cd server
npm install
npm run dev        # Runs on http://localhost:5000

# Client setup (new terminal)
cd client
npm install --force
npm run dev        # Runs on http://localhost:3000
```

### Environment Variables
- **Server**: MongoDB URI, JWT secret, OAuth keys, PayPal credentials, Cloudinary, email SMTP
- **Client**: API URL, OAuth client IDs, PayPal client ID

### Production Build
```bash
# Build client
cd client
npm run build      # Output: client/dist

# Run server in production
cd server
npm start
```

---

## 📝 TÀI KHOẢN MẪU

### Admin
- Email: `admin@congson.com`
- Password: `qwe123`

### Doctors
- Doctor 1: `nguyenhoanglan5008@gmail.com` / `qwe123`
- Doctor 2-4: `doctor.{b,c,d}@example.com` / `HospitalApp@123`

### Users
- User 1-2: `user{1,2}@example.com` / `HospitalApp@123`

---

## 📚 THÊM TÀI LIỆU

Xem các file chi tiết:
- `02_API_DOCUMENTATION.md` - API endpoints
- `03_DATABASE_SCHEMA.md` - Database structure
- `04_FRONTEND_GUIDE.md` - Frontend components
- `05_BACKEND_GUIDE.md` - Backend architecture
- `06_DEPLOYMENT_GUIDE.md` - Deployment instructions
