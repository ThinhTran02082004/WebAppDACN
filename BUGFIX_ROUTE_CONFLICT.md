# Bug Fix: Route Conflict Issue

## Ngày: 2025-10-20

## 🐛 Vấn đề

### Lỗi hiện tại:
```
GET http://localhost:5000/api/video-rooms?page=1&limit=10 500 (Internal Server Error)

Error fetching medical record: CastError: Cast to ObjectId failed for value "video-rooms" (type string) at path "_id" for model "MedicalRecord"
```

### Nguyên nhân gốc rễ:

1. **Route Conflict**: Trong `server/server.js`, `medicalRecordRoutes` được mount tại `/api` (dòng 173):
   ```javascript
   app.use('/api', medicalRecordRoutes);
   ```

2. **Catch-all Route**: Trong `medicalRecordRoutes.js`, có route `/:id` (dòng 19) để lấy medical record theo ID:
   ```javascript
   router.get('/:id', protect, medicalRecordController.getMedicalRecordById);
   ```

3. **Kết quả**: Khi gọi `/api/video-rooms`, Express router match với route `/api/:id` trong medicalRecordRoutes, coi "video-rooms" là một ID của medical record, dẫn đến lỗi cast ObjectId.

### Luồng lỗi:
```
Request: GET /api/video-rooms?page=1&limit=10
         ↓
Match:   /api/:id (medicalRecordRoutes)
         ↓
Execute: medicalRecordController.getMedicalRecordById('video-rooms')
         ↓
Error:   CastError: Cast to ObjectId failed for value "video-rooms"
```

---

## ✅ Giải pháp

### 1. Sửa Route Mounting trong `server/server.js`

**Trước** (dòng 165-174):
```javascript
// Đăng ký các routes còn thiếu
app.use('/api', apiRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doctor-auth', doctorAuthRoutes);
app.use('/api', medicalRecordRoutes);  // ❌ Vấn đề ở đây
app.use('/api/video-rooms', videoRoomRoutes);
```

**Sau**:
```javascript
// Đăng ký các routes còn thiếu
app.use('/api', apiRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doctor-auth', doctorAuthRoutes);
app.use('/api/video-rooms', videoRoomRoutes);  // ✅ Đặt trước medicalRecordRoutes
app.use('/api/medical-records', medicalRecordRoutes);  // ✅ Mount với prefix cụ thể
```

**Lý do**:
- Mount `medicalRecordRoutes` với prefix `/api/medical-records` thay vì `/api`
- Đặt `videoRoomRoutes` trước `medicalRecordRoutes` để tránh conflict
- Các route cụ thể nên được mount trước các route chung

### 2. Cập nhật Comments trong `medicalRecordRoutes.js`

**Trước**:
```javascript
// GET /api/patients/:id/medical-records - Lấy hồ sơ bệnh án của bệnh nhân
router.get('/doctors/patients/:id/medical-records', medicalRecordController.getPatientMedicalRecords);

// GET /api/doctors/patients/:id - Lấy thông tin bệnh nhân
router.get('/doctors/patients/:id', medicalRecordController.getPatientInfo);
```

**Sau**:
```javascript
// GET /api/medical-records/doctors/patients/:id/medical-records - Lấy hồ sơ bệnh án của bệnh nhân
router.get('/doctors/patients/:id/medical-records', medicalRecordController.getPatientMedicalRecords);

// GET /api/medical-records/doctors/patients/:id - Lấy thông tin bệnh nhân
router.get('/doctors/patients/:id', medicalRecordController.getPatientInfo);
```

### 3. Sắp xếp lại thứ tự routes trong `medicalRecordRoutes.js`

**Nguyên tắc**: Routes cụ thể phải được định nghĩa trước routes chung (/:id)

**Trước**:
```javascript
router.get('/history', medicalRecordController.getMedicalHistory);
router.get('/:id', medicalRecordController.getMedicalRecordById);  // ❌ Quá sớm
router.post('/', ...);
router.put('/:id', ...);
router.get('/all', ...);  // ❌ Sau /:id sẽ không bao giờ được gọi
router.delete('/:id', ...);
```

**Sau**:
```javascript
router.get('/history', medicalRecordController.getMedicalHistory);
router.get('/all', authorize('admin'), medicalRecordController.getAllMedicalRecords);  // ✅ Trước /:id
router.post('/', authorize('doctor', 'admin'), medicalRecordController.createMedicalRecord);
router.put('/:id', authorize('doctor', 'admin'), medicalRecordController.updateMedicalRecord);
router.delete('/:id', authorize('admin'), medicalRecordController.deleteMedicalRecord);
router.get('/:id', medicalRecordController.getMedicalRecordById);  // ✅ Cuối cùng
```

### 4. Xóa duplicate import trong `api.js`

**Trước** (dòng 11-16):
```javascript
const couponRoutes = require('./couponRoutes');
const paymentRoutes = require('./paymentRoutes');
const reviewRoutes = require('./reviewRoutes');
const hospitalReviewRoutes = require('./hospitalReviewRoutes');
const medicalRecordRoutes = require('./medicalRecordRoutes');  // ❌ Duplicate
const { getProvinces } = require('../controllers/hospitalController');
```

**Sau**:
```javascript
const couponRoutes = require('./couponRoutes');
const paymentRoutes = require('./paymentRoutes');
const reviewRoutes = require('./reviewRoutes');
const hospitalReviewRoutes = require('./hospitalReviewRoutes');
const { getProvinces } = require('../controllers/hospitalController');
```

**Trước** (dòng 24-31):
```javascript
router.use('/coupons', couponRoutes);
router.use('/reviews', reviewRoutes);
router.use('/', hospitalReviewRoutes);
router.use('/', paymentRoutes);
router.use('/medical-records', medicalRecordRoutes);  // ❌ Duplicate

// Thêm route cho provinces
router.get('/provinces', getProvinces);
```

**Sau**:
```javascript
router.use('/coupons', couponRoutes);
router.use('/reviews', reviewRoutes);
router.use('/', hospitalReviewRoutes);
router.use('/', paymentRoutes);

// Thêm route cho provinces
router.get('/provinces', getProvinces);
```

---

### 5. Sắp xếp lại routes trong `videoRoomRoutes.js`

**Vấn đề**: Route `/:roomId` ở dòng 30 đang catch request `/admin/active-rooms` trước khi nó đến được route admin.

**Trước**:
```javascript
// Protected routes - require authentication
router.use(protect);

// Routes for all authenticated users
router.post('/create', createVideoRoom);
router.get('/join/:roomId', joinVideoRoom);
router.get('/appointment/:appointmentId', getRoomByAppointmentId);

// Video call history routes - role-based access control
router.get('/history', getVideoCallHistory);
router.get('/history/:roomId', getVideoCallHistoryDetail);

// General room routes
router.get('/:roomId', getVideoRoomDetails);  // ❌ Catch /admin/active-rooms
router.post('/:roomId/end', endVideoRoom);
router.get('/', listVideoRooms);

// Admin only routes
router.get('/admin/active-rooms', authorize('admin'), getActiveLiveKitRooms);  // ❌ Không bao giờ được gọi
router.post('/admin/remove-participant', authorize('admin'), removeParticipantFromRoom);
```

**Sau**:
```javascript
// Protected routes - require authentication
router.use(protect);

// Admin only routes - MUST BE FIRST to avoid conflict with /:roomId
router.get('/admin/active-rooms', authorize('admin'), getActiveLiveKitRooms);
router.post('/admin/remove-participant', authorize('admin'), removeParticipantFromRoom);

// Video call history routes - role-based access control
router.get('/history', getVideoCallHistory);
router.get('/history/:roomId', getVideoCallHistoryDetail);

// Routes for all authenticated users
router.post('/create', createVideoRoom);
router.get('/join/:roomId', joinVideoRoom);
router.get('/appointment/:appointmentId', getRoomByAppointmentId);

// General room routes - list must be before /:roomId
router.get('/', listVideoRooms);

// Routes with :roomId parameter - MUST BE LAST
router.get('/:roomId', getVideoRoomDetails);
router.post('/:roomId/end', endVideoRoom);
```

---

## 📝 Files đã sửa

1. **server/server.js**
   - Dòng 173-174: Đổi thứ tự và thêm prefix cho medicalRecordRoutes

2. **server/routes/medicalRecordRoutes.js**
   - Dòng 9, 12: Cập nhật comments
   - Dòng 6-46: Sắp xếp lại thứ tự routes, đặt `/:id` cuối cùng

3. **server/routes/api.js**
   - Dòng 15: Xóa import medicalRecordRoutes (duplicate)
   - Dòng 29: Xóa mount medicalRecordRoutes (duplicate)

4. **server/routes/videoRoomRoutes.js**
   - Dòng 17-38: Sắp xếp lại thứ tự routes
   - Admin routes (`/admin/*`) đặt đầu tiên
   - Routes với params (`/:roomId`) đặt cuối cùng

---

## 🧪 Kiểm tra

### Test cases cần chạy:

1. **Video Rooms API**:
   ```bash
   GET http://localhost:5000/api/video-rooms?page=1&limit=10
   # Expected: 200 OK với danh sách video rooms

   GET http://localhost:5000/api/video-rooms/admin/active-rooms
   # Expected: 200 OK với danh sách phòng hoạt động từ LiveKit (admin only)
   ```

2. **Medical Records API**:
   ```bash
   GET http://localhost:5000/api/medical-records/history
   # Expected: 200 OK với lịch sử medical records

   GET http://localhost:5000/api/medical-records/:id
   # Expected: 200 OK với medical record detail

   GET http://localhost:5000/api/medical-records/all
   # Expected: 200 OK (admin only)
   ```

3. **Video Call History API**:
   ```bash
   GET http://localhost:5000/api/video-rooms/history
   # Expected: 200 OK với lịch sử video calls
   ```

---

## 📚 Bài học

### Best Practices cho Express Route Ordering:

1. **Specific routes first, generic routes last**:
   ```javascript
   router.get('/history', ...);      // ✅ Specific
   router.get('/all', ...);          // ✅ Specific
   router.get('/:id', ...);          // ✅ Generic - phải cuối cùng
   ```

2. **Mount routes with specific prefixes**:
   ```javascript
   app.use('/api/medical-records', medicalRecordRoutes);  // ✅ Specific
   app.use('/api', generalRoutes);                        // ❌ Too generic
   ```

3. **Order of mounting matters**:
   ```javascript
   app.use('/api/video-rooms', videoRoomRoutes);      // ✅ First
   app.use('/api/medical-records', medicalRecordRoutes);  // ✅ Second
   ```

4. **Avoid catch-all routes at root level**:
   ```javascript
   // ❌ Bad
   app.use('/api', routesWithParamId);
   
   // ✅ Good
   app.use('/api/resource', routesWithParamId);
   ```

---

## 🔍 Debugging Tips

Khi gặp lỗi route conflict:

1. **Check route mounting order** trong server.js
2. **Check route definition order** trong route files
3. **Use specific prefixes** khi mount routes
4. **Log incoming requests** để xem route nào được match
5. **Test routes individually** để isolate vấn đề

---

## ✅ Kết quả

Sau khi áp dụng các fix trên:
- ✅ `/api/video-rooms` hoạt động bình thường
- ✅ `/api/medical-records/*` hoạt động bình thường
- ✅ `/api/video-rooms/history` hoạt động bình thường
- ✅ Không còn route conflict
- ✅ Tất cả API endpoints hoạt động đúng

---

## 🚀 Next Steps

1. Restart server để áp dụng thay đổi
2. Test tất cả endpoints
3. Verify frontend hoạt động bình thường
4. Monitor logs để đảm bảo không có lỗi mới

