# Changelog - Video Call History Feature

## Ngày: 2025-10-20

### 🐛 Bug Fixes

#### 1. Sửa lỗi 500 Internal Server Error cho endpoint `/api/video-rooms`

**Vấn đề**: 
- Endpoint `/api/video-rooms?page=1&limit=10` trả về lỗi 500
- Lỗi: `MissingSchemaError: Schema hasn't been registered for model "fullName email"`

**Nguyên nhân**:
- Code đang cố populate `doctorId` với field `fullName` trực tiếp
- Model `Doctor` không có field `fullName` - nó có field `user` reference đến `User` model
- `User` model mới có field `fullName`

**Giải pháp**:
- Sửa populate từ `.populate('doctorId', 'fullName')` 
- Thành `.populate({ path: 'doctorId', populate: { path: 'user', select: 'fullName email' } })`

**Files đã sửa**:
- `server/controllers/videoRoomController.js`:
  - Line 396-399: Sửa `listVideoRooms` function
  - Line 515-520: Sửa `getRoomByAppointmentId` function

---

### ✨ New Features

#### 2. Triển khai tính năng Lịch sử Cuộc gọi Video

**Mô tả**:
Thêm tính năng xem lịch sử cuộc gọi video với phân quyền dựa trên vai trò:
- **Bệnh nhân**: Chỉ xem lịch sử cuộc gọi của chính họ
- **Bác sĩ**: Chỉ xem lịch sử cuộc gọi của chính họ
- **Quản trị viên**: Xem toàn bộ lịch sử cuộc gọi của hệ thống

**Backend Changes**:

1. **Controllers** (`server/controllers/videoRoomController.js`):
   - Thêm `getVideoCallHistory`: Lấy danh sách lịch sử cuộc gọi với phân quyền
   - Thêm `getVideoCallHistoryDetail`: Lấy chi tiết cuộc gọi với phân quyền

2. **Routes** (`server/routes/videoRoomRoutes.js`):
   - Thêm `GET /api/video-rooms/history`: Endpoint lấy danh sách lịch sử
   - Thêm `GET /api/video-rooms/history/:roomId`: Endpoint lấy chi tiết lịch sử

**Frontend Changes**:

1. **Components mới**:
   - `client/src/pages/admin/VideoCallHistory.jsx`: Trang lịch sử cho admin
   - `client/src/pages/doctor/VideoCallHistory.jsx`: Trang lịch sử cho bác sĩ
   - `client/src/pages/user/VideoCallHistory.jsx`: Trang lịch sử cho bệnh nhân

2. **Routing** (`client/src/App.jsx`):
   - Thêm route `/admin/video-call-history` cho admin
   - Thêm route `/doctor/video-call-history` cho bác sĩ
   - Thêm route `/video-call-history` cho bệnh nhân

3. **Navigation Updates**:
   - `client/src/components/admin/AdminLayout.jsx`: Thêm menu item "Lịch sử Video Call"
   - `client/src/components/doctor/DoctorLayout.jsx`: Thêm menu item "Lịch sử Video Call"
   - `client/src/components/Navbar.jsx`: Thêm menu item "Lịch sử Video Call" cho user

**Tính năng**:
- ✅ Xem danh sách lịch sử cuộc gọi với phân trang
- ✅ Lọc theo trạng thái (ended, active, cancelled, all)
- ✅ Xem chi tiết cuộc gọi (thông tin phòng, người tham gia, thời gian)
- ✅ Phân quyền dựa trên vai trò
- ✅ Hiển thị thời lượng cuộc gọi
- ✅ Hiển thị danh sách người tham gia với thời gian join/leave
- ✅ Responsive design cho mobile

---

### 📝 Documentation

**Files mới**:
- `DOCS/VIDEO_CALL_HISTORY_GUIDE.md`: Hướng dẫn chi tiết sử dụng tính năng
- `CHANGELOG_VIDEO_CALL_HISTORY.md`: File này - tóm tắt các thay đổi

---

### 🔧 Technical Details

**Database Model**:
- Sử dụng model `VideoRoom` hiện có (không cần tạo model mới)
- Model đã có đầy đủ fields cần thiết:
  - `startTime`, `endTime`, `duration`
  - `participants` array với `joinedAt`, `leftAt`
  - `status`, `doctorId`, `patientId`
  - `appointmentId`, `recordings`, `metadata`

**API Endpoints**:
```
GET /api/video-rooms/history
  - Query params: page, limit, status
  - Returns: paginated list of video call history
  - Access: All authenticated users (filtered by role)

GET /api/video-rooms/history/:roomId
  - Returns: detailed information of a specific call
  - Access: All authenticated users (with authorization check)
```

**Role-based Access Control**:
- Admin: `query = {}` (no filter, see all)
- Doctor: `query.doctorId = doctor._id` (only their calls)
- Patient: `query.patientId = userId` (only their calls)

---

### 🧪 Testing Checklist

- [x] Sửa lỗi 500 cho `/api/video-rooms` endpoint
- [x] API endpoint `/api/video-rooms/history` hoạt động đúng
- [x] API endpoint `/api/video-rooms/history/:roomId` hoạt động đúng
- [x] Phân quyền admin - xem tất cả cuộc gọi
- [x] Phân quyền doctor - chỉ xem cuộc gọi của mình
- [x] Phân quyền patient - chỉ xem cuộc gọi của mình
- [x] UI component admin hiển thị đúng
- [x] UI component doctor hiển thị đúng
- [x] UI component patient hiển thị đúng
- [x] Navigation menu cập nhật đúng
- [x] Responsive design hoạt động tốt
- [x] Pagination hoạt động đúng
- [x] Filter theo status hoạt động đúng
- [x] Modal chi tiết hiển thị đầy đủ thông tin

---

### 📊 Files Changed Summary

**Backend** (2 files):
- `server/controllers/videoRoomController.js` - Added 2 new functions, fixed 2 populate issues
- `server/routes/videoRoomRoutes.js` - Added 2 new routes

**Frontend** (7 files):
- `client/src/App.jsx` - Added 3 new routes and imports
- `client/src/pages/admin/VideoCallHistory.jsx` - New file (300+ lines)
- `client/src/pages/doctor/VideoCallHistory.jsx` - New file (300+ lines)
- `client/src/pages/user/VideoCallHistory.jsx` - New file (300+ lines)
- `client/src/components/admin/AdminLayout.jsx` - Added menu item
- `client/src/components/doctor/DoctorLayout.jsx` - Added menu item
- `client/src/components/Navbar.jsx` - Added menu items (desktop + mobile)

**Documentation** (2 files):
- `DOCS/VIDEO_CALL_HISTORY_GUIDE.md` - New comprehensive guide
- `CHANGELOG_VIDEO_CALL_HISTORY.md` - This file

**Total**: 11 files changed/created

---

### 🚀 Deployment Notes

1. **No database migration needed** - Using existing VideoRoom model
2. **No environment variables needed** - Using existing configuration
3. **No package installation needed** - Using existing dependencies
4. **Server restart required** - To load new controller functions and routes
5. **Client rebuild required** - To include new components and routes

---

### 🔮 Future Enhancements

Potential improvements for future versions:
1. Search functionality (by doctor/patient name)
2. Date range filter
3. Export to CSV/PDF
4. Statistics dashboard
5. Recording playback integration
6. Real-time updates using WebSocket
7. Call quality metrics
8. Automated call summaries

---

### 👥 Credits

- **Developer**: Augment Agent
- **Date**: 2025-10-20
- **Version**: 1.0.0

