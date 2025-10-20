# Bug Fix: Admin Video Call History - Access Denied

## Ngày: 2025-10-20

## 📋 Tổng quan

Tài liệu này mô tả lỗi "Không có quyền truy cập" khi admin vào trang "Lịch sử Video Call" và cách khắc phục.

---

## 🐛 Vấn đề

**Triệu chứng:**
- Admin đăng nhập thành công
- Vào URL: `http://localhost:3000/admin/video-call-history`
- Hiển thị màn hình lỗi: "Không có quyền truy cập" với icon khóa đỏ
- Message: "Bạn không có quyền truy cập vào trang này. Vui lòng quay lại trang quản trị."

**Screenshot từ user:**
```
┌─────────────────────────────────────┐
│           🔒 (Red Lock Icon)        │
│                                     │
│    Không có quyền truy cập          │
│                                     │
│  Bạn không có quyền truy cập vào    │
│  trang này.                         │
│                                     │
│  [Về trang quản trị]                │
└─────────────────────────────────────┘
```

---

## 🔍 Root Cause Analysis

### Nguyên nhân:

**File**: `client/src/components/admin/AdminLayout.jsx`

Trong component `AdminLayout`, có một hàm `hasAccess()` (dòng 47-59) kiểm tra xem user có quyền truy cập route hiện tại không:

```javascript
const hasAccess = () => {
  const path = location.pathname;
  
  if (user?.role === 'admin' || user?.roleType === 'admin') {
    return adminRoutes.some(route => path.startsWith(route));
  }
  
  if (user?.role === 'doctor') {
    return doctorRoutes.some(route => path.startsWith(route));
  }
  
  return false;
};
```

Hàm này kiểm tra xem `location.pathname` có bắt đầu với một trong các route trong mảng `adminRoutes` không.

**Vấn đề**: Mảng `adminRoutes` (dòng 19-36) **KHÔNG BAO GỒM** `/admin/video-call-history`:

```javascript
const adminRoutes = [
  '/admin/dashboard',
  '/admin/users',
  '/admin/doctors',
  '/admin/doctor-schedules',
  '/admin/hospitals',
  '/admin/specialties',
  '/admin/services',
  '/admin/rooms',
  '/admin/appointments',
  '/admin/coupons',
  '/admin/payments',
  '/admin/reviews',
  '/admin/medications',
  '/admin/news',
  '/admin/video-rooms',
  // ❌ MISSING: '/admin/video-call-history'
];
```

Khi admin truy cập `/admin/video-call-history`:
1. `hasAccess()` được gọi
2. Kiểm tra `adminRoutes.some(route => '/admin/video-call-history'.startsWith(route))`
3. Không tìm thấy match → return `false`
4. Component render màn hình "Không có quyền truy cập" (dòng 67-107)

---

## ✅ Giải pháp

### Sửa đổi:

**File**: `client/src/components/admin/AdminLayout.jsx`

**Thêm route vào mảng adminRoutes:**

```javascript
const adminRoutes = [
  '/admin/dashboard',
  '/admin/users',
  '/admin/doctors',
  '/admin/doctor-schedules',
  '/admin/hospitals',
  '/admin/specialties',
  '/admin/services',
  '/admin/rooms',
  '/admin/appointments',
  '/admin/coupons',
  '/admin/payments',
  '/admin/reviews',
  '/admin/medications',
  '/admin/news',
  '/admin/video-rooms',
  '/admin/video-call-history', // ✅ ADDED
];
```

**Vị trí**: Dòng 19-37

---

## 📊 Verification

### Kiểm tra các thành phần liên quan:

#### 1. Route đã được định nghĩa trong App.jsx ✅

**File**: `client/src/App.jsx` (dòng 120)

```javascript
<Route path="/admin" element={<AdminRoute />}>
  {/* ... other routes ... */}
  <Route path="video-call-history" element={<AdminVideoCallHistory />} />
</Route>
```

#### 2. Component đã được import ✅

**File**: `client/src/App.jsx` (dòng 77)

```javascript
import AdminVideoCallHistory from './pages/admin/VideoCallHistory';
```

#### 3. Menu item đã tồn tại ✅

**File**: `client/src/components/admin/AdminLayout.jsx` (dòng 130)

```javascript
const navItems = isAdmin ? [
  // ... other items ...
  { path: '/admin/video-rooms', label: 'Phòng Video', icon: <FaVideo /> },
  { path: '/admin/video-call-history', label: 'Lịch sử Video Call', icon: <FaHistory /> },
] : [];
```

#### 4. Icon đã được import ✅

**File**: `client/src/components/admin/AdminLayout.jsx` (dòng 9)

```javascript
import {
  // ... other icons ...
  FaVideo, FaHistory
} from 'react-icons/fa';
```

#### 5. Menu item đã được thêm vào groupedNavItems ✅

**File**: `client/src/components/admin/AdminLayout.jsx` (dòng 139-141)

```javascript
business: navItems.length > 15
  ? [navItems[10], navItems[11], navItems[12], navItems[13], navItems[14], navItems[15], navItems[16]].filter(Boolean)
  : [] // Coupons, Payments, Reviews, News, Video Rooms, Video Call History
```

**navItems[15]** = Video Call History

---

## 🧪 Testing Guide

### Test Case 1: Admin Access to Video Call History

**Steps:**
1. Đăng nhập với tài khoản admin
2. Vào URL: `http://localhost:3000/admin/video-call-history`
   - Hoặc click menu "Lịch sử Video Call" trong sidebar

**Expected Results:**
- ✅ Trang "Lịch sử Video Call" hiển thị bình thường
- ✅ Không có màn hình "Không có quyền truy cập"
- ✅ Hiển thị danh sách lịch sử cuộc gọi video
- ✅ Các filter (status) hoạt động
- ✅ Pagination hoạt động
- ✅ Nút "Chi tiết" hoạt động

### Test Case 2: Menu Navigation

**Steps:**
1. Đăng nhập admin
2. Mở sidebar (nếu đang đóng)
3. Tìm section "Business" hoặc cuối danh sách menu
4. Click "Lịch sử Video Call"

**Expected Results:**
- ✅ Navigate đến `/admin/video-call-history`
- ✅ Menu item được highlight
- ✅ Trang load thành công

### Test Case 3: Direct URL Access

**Steps:**
1. Đăng nhập admin
2. Paste URL trực tiếp: `http://localhost:3000/admin/video-call-history`
3. Press Enter

**Expected Results:**
- ✅ Trang load thành công
- ✅ Không redirect về dashboard
- ✅ Không hiển thị lỗi access denied

### Test Case 4: Non-Admin Access (Security Check)

**Steps:**
1. Đăng nhập với tài khoản **doctor** hoặc **user**
2. Thử truy cập: `http://localhost:3000/admin/video-call-history`

**Expected Results:**
- ✅ Bị redirect về trang chủ hoặc dashboard của role đó
- ✅ Không thể truy cập trang admin

---

## 🔧 Technical Details

### AdminLayout Access Control Flow

```
User navigates to /admin/video-call-history
    ↓
AdminRoute checks user.role === 'admin'
    ↓ (if true)
AdminLayout renders
    ↓
hasAccess() function called
    ↓
Check if path starts with any route in adminRoutes[]
    ↓
If found → Render children (VideoCallHistory component)
    ↓
If NOT found → Render "Không có quyền truy cập" screen
```

### Why This Pattern?

**Purpose**: Double-layer security
1. **AdminRoute**: Prevents non-admin users from accessing any `/admin/*` routes
2. **AdminLayout.hasAccess()**: Fine-grained control over which admin routes are accessible

**Benefits**:
- Centralized route management
- Easy to add/remove routes
- Prevents accidental access to unfinished features
- Clear separation of concerns

**Drawback**:
- Need to remember to add new routes to `adminRoutes` array
- Can cause confusion if forgotten (like this bug)

---

## 📝 Lessons Learned

### 1. Checklist for Adding New Admin Routes

When adding a new admin route, remember to:

- [ ] Create the component (e.g., `VideoCallHistory.jsx`)
- [ ] Import component in `App.jsx`
- [ ] Add route in `App.jsx` under `<Route path="/admin">`
- [ ] **Add route to `adminRoutes` array in `AdminLayout.jsx`** ⚠️ CRITICAL
- [ ] Add menu item to `navItems` in `AdminLayout.jsx`
- [ ] Import necessary icons
- [ ] Add to appropriate group in `groupedNavItems`
- [ ] Test access with admin account
- [ ] Test access denial with non-admin account

### 2. Better Pattern (Future Improvement)

Consider auto-generating `adminRoutes` from `navItems`:

```javascript
// Instead of manually maintaining adminRoutes array
const adminRoutes = navItems.map(item => item.path);
```

This would prevent this type of bug in the future.

### 3. Add Warning in Code

Add a comment in `AdminLayout.jsx`:

```javascript
// ⚠️ IMPORTANT: When adding new admin routes, make sure to:
// 1. Add route to App.jsx
// 2. Add route to this adminRoutes array
// 3. Add menu item to navItems below
const adminRoutes = [
  // ...
];
```

---

## 🎯 Impact

**Before Fix:**
- ❌ Admin không thể truy cập trang "Lịch sử Video Call"
- ❌ Menu item tồn tại nhưng không hoạt động
- ❌ Direct URL access bị chặn
- ❌ Poor user experience

**After Fix:**
- ✅ Admin có thể truy cập trang bình thường
- ✅ Menu navigation hoạt động
- ✅ Direct URL access hoạt động
- ✅ Tất cả features của trang hoạt động (filter, pagination, detail modal)

---

## 🚀 Deployment Notes

**Files Changed:**
- `client/src/components/admin/AdminLayout.jsx` (1 line added)

**No Breaking Changes:**
- Chỉ thêm route vào whitelist
- Không ảnh hưởng đến các routes khác
- Không cần database migration
- Không cần backend changes

**Testing Required:**
- Test admin access to video-call-history page
- Test all existing admin routes still work
- Test non-admin users cannot access admin routes

---

## ✅ Checklist

- [x] Identify root cause
- [x] Add `/admin/video-call-history` to `adminRoutes` array
- [x] Verify route exists in App.jsx
- [x] Verify component is imported
- [x] Verify menu item exists
- [x] Verify icon is imported
- [x] Create documentation
- [x] Ready for testing

---

**Lỗi đã được sửa!** 🎊

Hãy refresh trang và test lại. Admin giờ có thể truy cập "Lịch sử Video Call" bình thường! 🚀

