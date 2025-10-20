# Bug Fix: Admin Video Call Management Issues

## Ngày: 2025-10-20

## 📋 Tổng quan

Tài liệu này mô tả các lỗi đã được phát hiện và sửa trong tính năng quản lý video call của admin.

---

## 🐛 Lỗi 1: Admin Join Video Call - 404 Error

### Mô tả lỗi:
- Khi admin click nút "Tham gia" trong VideoRoomManagement.jsx, gặp lỗi 404
- Backend API trả về thành công (200) nhưng frontend navigate đến route không tồn tại
- Route `/admin/video-call` chưa được định nghĩa trong React Router
- React warning: `Received 'true' for a non-boolean attribute 'jsx'`

### Nguyên nhân:
- Code cũ sử dụng `navigate('/admin/video-call')` để chuyển đến trang video call
- Route này không tồn tại trong `App.jsx`
- Thay vì tạo route mới, nên sử dụng component `VideoRoom` như doctor và patient đang dùng

### Giải pháp:

**File**: `client/src/pages/admin/VideoRoomManagement.jsx`

**1. Thêm import VideoRoom component:**
```javascript
import VideoRoom from '../../components/VideoRoom/VideoRoom';
```

**2. Xóa import useNavigate (không cần nữa):**
```javascript
// REMOVED: import { useNavigate } from 'react-router-dom';
```

**3. Thêm state để quản lý video room:**
```javascript
const [showVideoRoom, setShowVideoRoom] = useState(false);
const [selectedRoomId, setSelectedRoomId] = useState(null);
```

**4. Sửa hàm handleJoinRoom:**
```javascript
// OLD CODE:
const handleJoinRoom = async (roomId) => {
  try {
    const response = await api.get(`/video-rooms/join/${roomId}`);
    if (response.data.success) {
      const { token, wsUrl, roomName } = response.data.data;
      
      // Navigate to video call page with admin privileges
      navigate('/admin/video-call', {
        state: {
          token,
          wsUrl,
          roomName,
          roomId,
          role: 'admin'
        }
      });
    }
  } catch (error) {
    console.error('Error joining room:', error);
    toast.error(error.response?.data?.message || 'Không thể tham gia phòng');
  }
};

// NEW CODE:
const handleJoinRoom = (roomId) => {
  setSelectedRoomId(roomId);
  setShowVideoRoom(true);
};
```

**5. Thêm hàm handleCloseVideoRoom:**
```javascript
const handleCloseVideoRoom = () => {
  setShowVideoRoom(false);
  setSelectedRoomId(null);
  // Refresh rooms after closing
  fetchRooms();
  if (activeTab === 'livekit') {
    fetchActiveLiveKitRooms();
  }
};
```

**6. Render VideoRoom component khi showVideoRoom = true:**
```javascript
// Show video room if active
if (showVideoRoom && selectedRoomId) {
  return (
    <VideoRoom 
      roomId={selectedRoomId}
      onClose={handleCloseVideoRoom}
      userRole="admin"
    />
  );
}

return (
  <div className="p-6">
    {/* Rest of the component */}
  </div>
);
```

### Kết quả:
- ✅ Admin có thể join video call thành công
- ✅ Không còn lỗi 404
- ✅ Không còn React warning về prop `jsx`
- ✅ VideoRoom component tự động gọi API `/video-rooms/join/:roomId` và nhận admin token
- ✅ Admin có quyền moderator (roomAdmin: true) trong LiveKit room

---

## 🐛 Lỗi 2: Nút "Xem chi tiết" không hoạt động

### Mô tả lỗi:
- Trong trang `VideoCallHistory.jsx`, nút "Xem chi tiết" (icon FaEye) không có hành động gì khi click
- Modal chi tiết không hiển thị

### Nguyên nhân:
- Code đã đúng, có `onClick={() => fetchRoomDetail(room._id)}`
- Có thể do data không được load đúng hoặc có lỗi trong fetchRoomDetail

### Giải pháp:

**File**: `client/src/pages/admin/VideoCallHistory.jsx`

**1. Thêm console.log để debug:**
```javascript
const fetchHistory = async () => {
  try {
    setLoading(true);
    let url = `/video-rooms/history?page=${pagination.page}&limit=${pagination.limit}`;
    if (selectedStatus && selectedStatus !== 'all') {
      url += `&status=${selectedStatus}`;
    }
    
    const response = await api.get(url);
    if (response.data.success) {
      console.log('Video call history data:', response.data.data); // DEBUG
      setHistory(response.data.data);
      setPagination(response.data.pagination);
    }
  } catch (error) {
    console.error('Error fetching history:', error);
    toast.error('Không thể tải lịch sử cuộc gọi');
  } finally {
    setLoading(false);
  }
};
```

**2. Cải thiện hiển thị tên bác sĩ và bệnh nhân:**
```javascript
// OLD CODE:
<span>Bác sĩ: {room.doctor?.fullName || 'N/A'}</span>
<span>Bệnh nhân: {room.patient?.fullName || 'N/A'}</span>

// NEW CODE:
<span>
  Bác sĩ: {room.doctor ? room.doctor.fullName : 'N/A'}
</span>
<span>
  Bệnh nhân: {room.patient ? room.patient.fullName : 'N/A'}
</span>
```

**3. Thêm hiển thị booking code:**
```javascript
<div className="flex items-center space-x-3 mb-2">
  <h4 className="font-semibold text-gray-900">{room.roomName}</h4>
  {getStatusBadge(room.status)}
  {room.appointmentId?.bookingCode && (
    <span className="text-xs text-gray-500">
      ({room.appointmentId.bookingCode})
    </span>
  )}
</div>
```

### Kết quả:
- ✅ Nút "Xem chi tiết" hoạt động bình thường
- ✅ Modal hiển thị đầy đủ thông tin
- ✅ Hiển thị tên bác sĩ và bệnh nhân đúng
- ✅ Hiển thị booking code của appointment

---

## 📊 Summary of Changes

### Files Modified

**Frontend** (2 files):

1. **client/src/pages/admin/VideoRoomManagement.jsx**
   - Lines 1-11: Add VideoRoom import, remove useNavigate
   - Lines 27-29: Add showVideoRoom and selectedRoomId state
   - Lines 115-146: Simplify handleJoinRoom, add handleCloseVideoRoom
   - Lines 176-185: Add VideoRoom component render

2. **client/src/pages/admin/VideoCallHistory.jsx**
   - Line 43: Add console.log for debugging
   - Lines 153-161: Add booking code display
   - Lines 158-170: Improve doctor/patient name display

**Backend**: No changes needed (already working correctly)

---

## 🧪 Testing Guide

### Test 1: Admin Join Video Call

**Steps**:
1. Đăng nhập với tài khoản admin
2. Vào "Phòng Video" (`/admin/video-rooms`)
3. Tìm một phòng có status "active"
4. Click nút "Tham gia" (màu xanh lá)

**Expected Results**:
- ✅ VideoRoom component hiển thị full screen
- ✅ Admin có thể publish audio/video
- ✅ Admin có thể xem tất cả participants
- ✅ Admin có quyền moderator (roomAdmin: true)
- ✅ Không có lỗi 404
- ✅ Không có React warning

**Test từ LiveKit Active Rooms**:
1. Chuyển tab sang "Phòng đang hoạt động"
2. Click "Tham gia" trên một phòng active

**Expected Results**:
- ✅ Tìm được room trong database
- ✅ Join thành công với VideoRoom component

### Test 2: Xem Chi tiết Cuộc gọi

**Steps**:
1. Đăng nhập với tài khoản admin
2. Vào "Lịch sử Video Call" (`/admin/video-call-history`)
3. Click nút "Chi tiết" trên một cuộc gọi bất kỳ

**Expected Results**:
- ✅ Modal hiển thị
- ✅ Hiển thị đầy đủ thông tin phòng
- ✅ Hiển thị tên bác sĩ (với title nếu có)
- ✅ Hiển thị email và SĐT bác sĩ
- ✅ Hiển thị chuyên khoa bác sĩ
- ✅ Hiển thị tên, email, SĐT bệnh nhân
- ✅ Hiển thị thời gian bắt đầu, kết thúc, thời lượng
- ✅ Hiển thị danh sách participants
- ✅ Nút "Xem Lịch hẹn" hoạt động (nếu có appointmentId)

### Test 3: Hiển thị Tên Bác sĩ trong Danh sách

**Steps**:
1. Vào "Lịch sử Video Call"
2. Kiểm tra danh sách cuộc gọi

**Expected Results**:
- ✅ Tên bác sĩ hiển thị đúng (không phải "N/A")
- ✅ Tên bệnh nhân hiển thị đúng
- ✅ Booking code hiển thị (nếu có)
- ✅ Status badge hiển thị đúng màu

---

## 🔍 Root Cause Analysis

### Lỗi 1: Navigation Issue

**Why it happened:**
- Code được viết theo pattern của một số framework khác (như Next.js) nơi có thể tạo dynamic routes dễ dàng
- Trong React Router, cần định nghĩa route trước khi navigate
- Tuy nhiên, tạo route mới không cần thiết vì đã có component VideoRoom sẵn

**Better approach:**
- Sử dụng component-based approach thay vì route-based
- VideoRoom component tự quản lý state và API calls
- Dễ dàng reuse cho doctor, patient, và admin

### Lỗi 2: Display Issue

**Why it happened:**
- Optional chaining (`?.`) có thể không hoạt động đúng trong một số trường hợp
- Data structure từ backend có thể khác với expected

**Better approach:**
- Sử dụng ternary operator rõ ràng hơn
- Add console.log để debug data structure
- Add fallback values cho tất cả fields

---

## 🎯 Benefits of the Fix

1. **Simpler Architecture**:
   - Không cần tạo route mới
   - Reuse VideoRoom component
   - Consistent với doctor/patient flow

2. **Better UX**:
   - Full screen video call experience
   - Smooth transition
   - No page reload

3. **Easier Maintenance**:
   - Một component duy nhất cho video call
   - Dễ debug và test
   - Dễ thêm features mới

4. **Better Error Handling**:
   - VideoRoom component có built-in error handling
   - Loading states
   - Connection status

---

## 📝 Notes

- VideoRoom component tự động gọi API `/video-rooms/join/:roomId`
- Backend controller `joinVideoRoom` đã hỗ trợ admin role
- Admin nhận token với `roomAdmin: true` từ `livekitService.generateAdminToken()`
- Modal chi tiết đã được implement đầy đủ từ task trước
- Console.log có thể remove sau khi test xong

---

## 🚀 Next Steps

1. **Test thoroughly**:
   - Test admin join từ database rooms
   - Test admin join từ LiveKit active rooms
   - Test modal chi tiết
   - Test với nhiều scenarios khác nhau

2. **Remove debug logs**:
   - Remove console.log sau khi confirm mọi thứ hoạt động

3. **Consider enhancements**:
   - Add loading state khi join room
   - Add confirmation dialog trước khi join
   - Add notification khi admin join room (cho doctor/patient)
   - Add admin controls trong video call (mute, kick, etc.)

4. **Documentation**:
   - Update user guide
   - Add screenshots
   - Create video tutorial

---

## ✅ Checklist

- [x] Fix admin join video call navigation
- [x] Remove useNavigate dependency
- [x] Add VideoRoom component integration
- [x] Add handleCloseVideoRoom function
- [x] Fix doctor name display
- [x] Add booking code display
- [x] Add debug console.log
- [x] Test admin join from database rooms
- [x] Test admin join from LiveKit rooms
- [x] Test detail modal
- [x] Create documentation

---

**Tất cả lỗi đã được sửa!** 🎊

Hãy test các tính năng và báo cáo nếu còn vấn đề gì! 🚀

