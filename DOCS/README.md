# 📚 TÀI LIỆU DỰ ÁN HOSPITAL WEB

Chào mừng đến với bộ tài liệu đầy đủ của dự án Hospital Web System!

---

## 📖 DANH MỤC TÀI LIỆU

### 1. [**Tổng Quan Dự Án**](01_PROJECT_OVERVIEW.md)
Giới thiệu tổng quan về dự án, kiến trúc hệ thống, công nghệ sử dụng, và cấu trúc tổng thể.

**Nội dung:**
- Giới thiệu dự án
- Kiến trúc Client-Server
- Tech Stack (Frontend & Backend)
- Cấu trúc thư mục chi tiết
- User Roles (Admin, Doctor, User)
- Tính năng chính
- Tài khoản mẫu

**Dành cho:** Tất cả mọi người (Developers, PM, Testers)

---

### 2. [**API Documentation**](02_API_DOCUMENTATION.md)
Tài liệu đầy đủ về tất cả API endpoints của hệ thống.

**Nội dung:**
- Authentication APIs (Register, Login, OAuth, Reset Password)
- User APIs (Profile, Settings)
- Doctor APIs (Schedules, Profile, Reviews)
- Appointment APIs (Create, Update, Cancel, Reschedule)
- Medical Record APIs
- Payment APIs (PayPal Integration)
- Review APIs
- Chat APIs
- Video Call Room APIs
- Admin APIs
- Error Response Formats
- Socket.io Events

**Dành cho:** Backend Developers, Frontend Developers, API Testers

---

### 3. [**Database Schema**](03_DATABASE_SCHEMA.md)
Mô tả chi tiết cấu trúc database MongoDB.

**Nội dung:**
- Tất cả 18 Collections:
  - Users
  - Doctors
  - Appointments
  - Schedules
  - Medical Records
  - Payments
  - Reviews
  - Hospitals
  - Services
  - Specialties
  - Coupons
  - Conversations & Messages
  - Rooms (Video Call)
  - Medications
  - News
  - Logs
- Schema chi tiết cho mỗi collection
- Indexes
- Relationships diagram
- Data volume estimates

**Dành cho:** Backend Developers, Database Administrators

---

### 4. [**Frontend Guide**](04_FRONTEND_GUIDE.md)
Hướng dẫn phát triển Frontend với React.

**Nội dung:**
- Cấu trúc thư mục Frontend
- UI Libraries (MUI, Ant Design, TailwindCSS)
- Routing với React Router
- Authentication với Context API
- API Calls với Axios
- Real-time Chat với Socket.io
- Video Call với LiveKit
- Charts & Statistics
- Form Handling & Validation
- Image Upload
- Responsive Design
- Animations
- Notifications
- Best Practices

**Dành cho:** Frontend Developers

---

### 5. [**Backend Guide**](05_BACKEND_GUIDE.md)
Hướng dẫn phát triển Backend với Node.js & Express.

**Nội dung:**
- Server setup
- Database connection (MongoDB)
- Models với Mongoose
- Controllers (Business Logic)
- Middlewares (Auth, Role Check, Upload)
- Email Service (Nodemailer)
- File Upload (Cloudinary)
- Payment Integration (PayPal)
- Cron Jobs (Scheduled Tasks)
- Socket.io Setup
- OAuth (Google, Facebook)
- LiveKit Integration
- Input Validation
- Best Practices

**Dành cho:** Backend Developers

---

### 6. [**Deployment Guide**](06_DEPLOYMENT_GUIDE.md)
Hướng dẫn triển khai ứng dụng lên môi trường Production.

**Nội dung:**
- Yêu cầu hệ thống
- Cài đặt Local (Development)
- Thiết lập External Services:
  - MongoDB Atlas
  - Google OAuth
  - Facebook OAuth
  - Gmail SMTP
  - Cloudinary
  - PayPal
  - LiveKit
- Production Deployment:
  - Heroku
  - VPS (Ubuntu + Nginx + PM2)
  - Docker
- SSL Configuration
- Security Best Practices
- Monitoring & Maintenance
- Troubleshooting
- Performance Optimization
- CI/CD với GitHub Actions

**Dành cho:** DevOps, System Administrators, Deployment Team

---

### 7. [**Business Flows & Workflows**](07_BUSINESS_FLOWS.md)
Mô tả chi tiết các quy trình nghiệp vụ trong hệ thống.

**Nội dung:**
- Quy trình Đăng ký & Xác thực:
  - Đăng ký Email/Password
  - Đăng nhập OAuth (Google/Facebook)
  - Quên mật khẩu
- Quy trình Đặt lịch khám (chi tiết từng bước)
- Quy trình Xác nhận & Khám bệnh
- Quy trình Đánh giá (Review)
- Quy trình Chat Real-time
- Quy trình Video Call
- Quy trình Thanh toán & Hoàn tiền
- Quy trình Thống kê
- Quy trình Email tự động
- Quy trình Đổi lịch & Hủy lịch
- State Machines
- Business Rules

**Dành cho:** Business Analysts, Developers, Testers, PM

---

## 🚀 HƯỚNG DẪN SỬ DỤNG TÀI LIỆU

### Cho Developers Mới

1. **Bắt đầu với:** [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md)
   - Hiểu tổng quan về dự án
   - Nắm được kiến trúc và tech stack

2. **Tiếp theo:**
   - Frontend Dev → [04_FRONTEND_GUIDE.md](04_FRONTEND_GUIDE.md)
   - Backend Dev → [05_BACKEND_GUIDE.md](05_BACKEND_GUIDE.md)

3. **Tham khảo khi cần:**
   - [02_API_DOCUMENTATION.md](02_API_DOCUMENTATION.md) - Khi làm việc với APIs
   - [03_DATABASE_SCHEMA.md](03_DATABASE_SCHEMA.md) - Khi làm việc với database

4. **Deploy:** [06_DEPLOYMENT_GUIDE.md](06_DEPLOYMENT_GUIDE.md)

### Cho Business Analysts / Product Managers

1. **Bắt đầu với:** [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md)
2. **Hiểu quy trình:** [07_BUSINESS_FLOWS.md](07_BUSINESS_FLOWS.md)
3. **Tham khảo:** [02_API_DOCUMENTATION.md](02_API_DOCUMENTATION.md)

### Cho Testers

1. **Hiểu hệ thống:** [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md)
2. **Test cases:** [07_BUSINESS_FLOWS.md](07_BUSINESS_FLOWS.md)
3. **API testing:** [02_API_DOCUMENTATION.md](02_API_DOCUMENTATION.md)

### Cho DevOps / System Admins

1. **Deployment:** [06_DEPLOYMENT_GUIDE.md](06_DEPLOYMENT_GUIDE.md)
2. **Kiến trúc:** [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md)
3. **Database:** [03_DATABASE_SCHEMA.md](03_DATABASE_SCHEMA.md)

---

## 🎯 TÀI LIỆU THEO CHỨC NĂNG

### Tìm hiểu về Authentication
- [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md) - Section: Authentication
- [02_API_DOCUMENTATION.md](02_API_DOCUMENTATION.md) - Auth Routes
- [05_BACKEND_GUIDE.md](05_BACKEND_GUIDE.md) - Authentication Middleware
- [07_BUSINESS_FLOWS.md](07_BUSINESS_FLOWS.md) - Quy trình Đăng ký & Xác thực

### Tìm hiểu về Appointment System
- [02_API_DOCUMENTATION.md](02_API_DOCUMENTATION.md) - Appointment Routes
- [03_DATABASE_SCHEMA.md](03_DATABASE_SCHEMA.md) - Appointments & Schedules Collections
- [07_BUSINESS_FLOWS.md](07_BUSINESS_FLOWS.md) - Quy trình Đặt lịch khám

### Tìm hiểu về Payment
- [02_API_DOCUMENTATION.md](02_API_DOCUMENTATION.md) - Payment Routes
- [03_DATABASE_SCHEMA.md](03_DATABASE_SCHEMA.md) - Payments Collection
- [05_BACKEND_GUIDE.md](05_BACKEND_GUIDE.md) - Payment Integration
- [07_BUSINESS_FLOWS.md](07_BUSINESS_FLOWS.md) - Quy trình Thanh toán

### Tìm hiểu về Real-time Features
- [04_FRONTEND_GUIDE.md](04_FRONTEND_GUIDE.md) - Socket.io Usage
- [05_BACKEND_GUIDE.md](05_BACKEND_GUIDE.md) - Socket.io Setup
- [07_BUSINESS_FLOWS.md](07_BUSINESS_FLOWS.md) - Quy trình Chat & Video Call

---

## 📊 THỐNG KÊ TÀI LIỆU

| Tài liệu | Số trang | Chủ đề chính |
|----------|----------|--------------|
| 01_PROJECT_OVERVIEW.md | ~8 | Tổng quan, Kiến trúc, Setup |
| 02_API_DOCUMENTATION.md | ~15 | API Endpoints, Requests/Responses |
| 03_DATABASE_SCHEMA.md | ~12 | Database Schema, Relationships |
| 04_FRONTEND_GUIDE.md | ~10 | React, Components, Libraries |
| 05_BACKEND_GUIDE.md | ~8 | Node.js, Express, Services |
| 06_DEPLOYMENT_GUIDE.md | ~10 | Deployment, Security, Monitoring |
| 07_BUSINESS_FLOWS.md | ~12 | Workflows, State Machines, Rules |

**Tổng:** ~75 trang tài liệu chi tiết

---

## 🔄 CẬP NHẬT TÀI LIỆU

Tài liệu được tạo ngày: **10/10/2025**

### Lịch sử phiên bản
- **v1.0** (10/10/2025): Tạo tài liệu đầy đủ cho dự án

### Cập nhật trong tương lai
Khi có thay đổi trong dự án, cần cập nhật:
- API mới → `02_API_DOCUMENTATION.md`
- Database changes → `03_DATABASE_SCHEMA.md`
- Tính năng mới → Tất cả docs liên quan
- Deployment changes → `06_DEPLOYMENT_GUIDE.md`

---

## 💡 LƯU Ý

### Conventions
- **Bold**: Điểm quan trọng
- `Code`: Tên file, function, variable
- ```code block```: Code examples
- > Quote: Lưu ý đặc biệt

### Symbols
- ✅ Recommended
- ⚠️ Warning
- 🔒 Security related
- 📝 Documentation
- 🔧 Configuration
- 🐛 Bug/Issue

---

## 📞 HỖ TRỢ

Nếu có câu hỏi về tài liệu hoặc dự án:

1. **Đọc tài liệu liên quan** trước
2. **Check GitHub Issues**: https://github.com/soncoderz/DACS-hospitalweb/issues
3. **Liên hệ team leader**

---

## 🎓 HỌC TẬP THÊM

### Technologies Documentation
- **React**: https://react.dev
- **Node.js**: https://nodejs.org
- **Express**: https://expressjs.com
- **MongoDB**: https://www.mongodb.com/docs
- **Socket.io**: https://socket.io/docs
- **PayPal**: https://developer.paypal.com
- **LiveKit**: https://docs.livekit.io

### Best Practices
- **RESTful API**: https://restfulapi.net
- **MongoDB Best Practices**: https://www.mongodb.com/developer/products/mongodb/mongodb-schema-design-best-practices
- **React Best Practices**: https://react.dev/learn/thinking-in-react

---

## ✅ CHECKLIST SỬ DỤNG TÀI LIỆU

### Cho Developers mới vào dự án

- [ ] Đọc PROJECT_OVERVIEW
- [ ] Setup môi trường local
- [ ] Đọc Frontend/Backend Guide (tùy role)
- [ ] Tìm hiểu API Documentation
- [ ] Hiểu Database Schema
- [ ] Nắm Business Flows chính
- [ ] Test run dự án
- [ ] Tạo feature đầu tiên

### Cho việc Deploy

- [ ] Đọc Deployment Guide
- [ ] Setup external services
- [ ] Configure environment variables
- [ ] Test locally
- [ ] Deploy to staging
- [ ] Test staging
- [ ] Deploy to production
- [ ] Monitor & verify

---

**Happy Coding! 🚀**
