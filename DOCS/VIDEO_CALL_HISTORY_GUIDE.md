# Hướng dẫn Tính năng Lịch sử Cuộc gọi Video

## Tổng quan

Tính năng lịch sử cuộc gọi video cho phép người dùng xem lại các cuộc gọi video đã thực hiện trong hệ thống với phân quyền dựa trên vai trò.

## Phân quyền

### 1. Bệnh nhân (User)
- **Quyền truy cập**: Chỉ xem được lịch sử cuộc gọi video của chính mình
- **Đường dẫn**: `/video-call-history`
- **Thông tin hiển thị**:
  - Tên phòng
  - Thông tin bác sĩ
  - Thời gian bắt đầu/kết thúc
  - Thời lượng cuộc gọi
  - Trạng thái cuộc gọi
  - Mã lịch hẹn

### 2. Bác sĩ (Doctor)
- **Quyền truy cập**: Chỉ xem được lịch sử cuộc gọi video của chính mình với bệnh nhân
- **Đường dẫn**: `/doctor/video-call-history`
- **Thông tin hiển thị**:
  - Tên phòng
  - Thông tin bệnh nhân
  - Thời gian bắt đầu/kết thúc
  - Thời lượng cuộc gọi
  - Trạng thái cuộc gọi
  - Mã lịch hẹn
  - Danh sách người tham gia

### 3. Quản trị viên (Admin)
- **Quyền truy cập**: Xem được toàn bộ lịch sử cuộc gọi video của hệ thống
- **Đường dẫn**: `/admin/video-call-history`
- **Thông tin hiển thị**:
  - Tất cả thông tin như bác sĩ và bệnh nhân
  - Thông tin cả bác sĩ và bệnh nhân
  - Danh sách đầy đủ người tham gia
  - Metadata phòng

## API Endpoints

### 1. Lấy danh sách lịch sử cuộc gọi
```
GET /api/video-rooms/history
```

**Query Parameters**:
- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số lượng bản ghi mỗi trang (mặc định: 10)
- `status` (optional): Lọc theo trạng thái ('ended', 'active', 'cancelled', 'all')

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "room_id",
      "roomName": "room_name",
      "doctor": {
        "_id": "doctor_id",
        "fullName": "Tên bác sĩ",
        "email": "email@example.com"
      },
      "patient": {
        "_id": "patient_id",
        "fullName": "Tên bệnh nhân",
        "email": "email@example.com"
      },
      "status": "ended",
      "startTime": "2024-01-01T10:00:00.000Z",
      "endTime": "2024-01-01T10:30:00.000Z",
      "duration": 30,
      "participants": [...],
      "appointmentId": {...}
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "pages": 10,
    "limit": 10
  }
}
```

### 2. Lấy chi tiết lịch sử cuộc gọi
```
GET /api/video-rooms/history/:roomId
```

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "room_id",
    "roomName": "room_name",
    "doctor": {
      "_id": "doctor_id",
      "fullName": "Tên bác sĩ",
      "email": "email@example.com",
      "phoneNumber": "0123456789"
    },
    "patient": {
      "_id": "patient_id",
      "fullName": "Tên bệnh nhân",
      "email": "email@example.com",
      "phoneNumber": "0123456789"
    },
    "status": "ended",
    "startTime": "2024-01-01T10:00:00.000Z",
    "endTime": "2024-01-01T10:30:00.000Z",
    "duration": 30,
    "participants": [
      {
        "userId": {
          "_id": "user_id",
          "fullName": "Tên người dùng",
          "role": "doctor"
        },
        "role": "doctor",
        "joinedAt": "2024-01-01T10:00:00.000Z",
        "leftAt": "2024-01-01T10:30:00.000Z"
      }
    ],
    "recordings": [],
    "metadata": {
      "maxParticipants": 3,
      "enableRecording": false,
      "enableScreenShare": true,
      "enableChat": true
    },
    "appointmentId": {...},
    "createdBy": {...},
    "createdAt": "2024-01-01T09:55:00.000Z",
    "updatedAt": "2024-01-01T10:30:00.000Z"
  }
}
```

## Cách sử dụng

### Đối với Bệnh nhân

1. Đăng nhập vào hệ thống
2. Click vào menu người dùng (góc trên bên phải)
3. Chọn "Lịch sử Video Call"
4. Xem danh sách các cuộc gọi đã thực hiện
5. Click "Chi tiết" để xem thông tin chi tiết cuộc gọi

### Đối với Bác sĩ

1. Đăng nhập vào hệ thống với tài khoản bác sĩ
2. Vào dashboard bác sĩ
3. Click "Lịch sử Video Call" trong menu bên trái
4. Xem danh sách các cuộc gọi với bệnh nhân
5. Click "Chi tiết" để xem thông tin chi tiết cuộc gọi

### Đối với Quản trị viên

1. Đăng nhập vào hệ thống với tài khoản admin
2. Vào dashboard admin
3. Click "Lịch sử Video Call" trong menu bên trái
4. Xem toàn bộ lịch sử cuộc gọi của hệ thống
5. Sử dụng bộ lọc để tìm kiếm theo trạng thái
6. Click "Chi tiết" để xem thông tin chi tiết cuộc gọi

## Tính năng

### 1. Lọc theo trạng thái
- **Tất cả**: Hiển thị tất cả cuộc gọi
- **Đã kết thúc**: Chỉ hiển thị cuộc gọi đã kết thúc
- **Đang hoạt động**: Chỉ hiển thị cuộc gọi đang diễn ra
- **Đã hủy**: Chỉ hiển thị cuộc gọi đã bị hủy

### 2. Phân trang
- Mặc định hiển thị 10 bản ghi mỗi trang
- Có thể điều hướng giữa các trang

### 3. Xem chi tiết
- Thông tin phòng
- Thông tin người tham gia (bác sĩ, bệnh nhân)
- Thời gian bắt đầu/kết thúc
- Thời lượng cuộc gọi
- Danh sách tất cả người tham gia với thời gian tham gia/rời đi

### 4. Làm mới dữ liệu
- Nút "Làm mới" để cập nhật danh sách mới nhất

## Lưu ý kỹ thuật

### Backend
- Controller: `server/controllers/videoRoomController.js`
  - `getVideoCallHistory`: Lấy danh sách lịch sử
  - `getVideoCallHistoryDetail`: Lấy chi tiết cuộc gọi
- Routes: `server/routes/videoRoomRoutes.js`
- Model: `server/models/VideoRoom.js` (sử dụng model hiện có)

### Frontend
- Admin: `client/src/pages/admin/VideoCallHistory.jsx`
- Doctor: `client/src/pages/doctor/VideoCallHistory.jsx`
- User: `client/src/pages/user/VideoCallHistory.jsx`
- Routes: `client/src/App.jsx`
- Navigation:
  - Admin: `client/src/components/admin/AdminLayout.jsx`
  - Doctor: `client/src/components/doctor/DoctorLayout.jsx`
  - User: `client/src/components/Navbar.jsx`

## Bảo mật

- Tất cả endpoints đều yêu cầu xác thực (protected routes)
- Phân quyền dựa trên vai trò người dùng
- Bệnh nhân chỉ xem được cuộc gọi của mình
- Bác sĩ chỉ xem được cuộc gọi của mình
- Admin xem được tất cả cuộc gọi

## Khắc phục sự cố

### Lỗi 500 khi tải danh sách phòng
**Nguyên nhân**: Lỗi populate model Doctor không đúng cách
**Giải pháp**: Đã sửa bằng cách populate nested `doctorId.user` thay vì `doctorId.fullName`

### Không thấy dữ liệu
**Kiểm tra**:
1. Đảm bảo đã có cuộc gọi video đã kết thúc
2. Kiểm tra filter trạng thái (mặc định chỉ hiển thị 'ended')
3. Kiểm tra phân quyền người dùng

### Lỗi 403 Forbidden
**Nguyên nhân**: Người dùng không có quyền xem cuộc gọi
**Giải pháp**: Đảm bảo người dùng đang cố xem cuộc gọi của chính họ

## Cải tiến trong tương lai

1. Thêm tính năng tìm kiếm theo tên bác sĩ/bệnh nhân
2. Lọc theo khoảng thời gian
3. Export lịch sử cuộc gọi ra file CSV/PDF
4. Thêm biểu đồ thống kê cuộc gọi
5. Tích hợp xem lại recording (nếu có)

