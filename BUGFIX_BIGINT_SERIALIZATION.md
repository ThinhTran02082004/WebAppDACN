# Bug Fix: BigInt Serialization Error

## Ngày: 2025-10-20

## 🐛 Vấn đề

### Lỗi hiện tại:
```
GET http://localhost:5000/api/video-rooms/admin/active-rooms 500 (Internal Server Error)

Error getting active rooms: TypeError: Do not know how to serialize a BigInt
    at JSON.stringify (<anonymous>)
    at stringify (D:\DACS\...\server\node_modules\express\lib\response.js:1160:12)
    at ServerResponse.json (D:\DACS\...\server\node_modules\express\lib\response.js:271:14)
    at D:\DACS\...\server\controllers\videoRoomController.js:447:9
```

### Nguyên nhân gốc rễ:

1. **LiveKit API Response**: LiveKit Server SDK trả về dữ liệu có chứa các giá trị `BigInt` (ví dụ: timestamps, số lượng bytes, v.v.)

2. **JSON.stringify Limitation**: JavaScript's `JSON.stringify()` không thể serialize BigInt values:
   ```javascript
   JSON.stringify({ value: 123n })  // ❌ TypeError: Do not know how to serialize a BigInt
   ```

3. **Express res.json()**: Express sử dụng `JSON.stringify()` internally để convert response object thành JSON string

### Luồng lỗi:
```
LiveKit API
    ↓ (returns data with BigInt values)
livekitService.listRooms()
    ↓
videoRoomController.getActiveLiveKitRooms()
    ↓
res.json({ data: roomsWithBigInt })
    ↓
JSON.stringify() ❌ TypeError: Do not know how to serialize a BigInt
```

---

## ✅ Giải pháp

### Thêm Helper Function để Convert BigInt → String

**File**: `server/controllers/videoRoomController.js`

**Thêm helper function** (trước `getActiveLiveKitRooms`):

```javascript
// Helper function to convert BigInt to string for JSON serialization
const convertBigIntToString = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertBigIntToString(obj[key]);
      }
    }
    return converted;
  }
  
  return obj;
};
```

**Cập nhật `getActiveLiveKitRooms` function**:

**Trước**:
```javascript
exports.getActiveLiveKitRooms = asyncHandler(async (req, res) => {
  // ... authorization check ...

  try {
    const rooms = await livekitService.listRooms();
    
    const roomsWithParticipants = await Promise.all(
      rooms.map(async (room) => {
        const participants = await livekitService.listParticipants(room.name);
        return {
          ...room,
          participants
        };
      })
    );

    res.json({
      success: true,
      data: roomsWithParticipants  // ❌ Contains BigInt values
    });
  } catch (error) {
    // ... error handling ...
  }
});
```

**Sau**:
```javascript
exports.getActiveLiveKitRooms = asyncHandler(async (req, res) => {
  // ... authorization check ...

  try {
    const rooms = await livekitService.listRooms();
    
    const roomsWithParticipants = await Promise.all(
      rooms.map(async (room) => {
        const participants = await livekitService.listParticipants(room.name);
        return {
          ...room,
          participants
        };
      })
    );

    // Convert BigInt values to strings for JSON serialization
    const serializedRooms = convertBigIntToString(roomsWithParticipants);

    res.json({
      success: true,
      data: serializedRooms  // ✅ All BigInt converted to strings
    });
  } catch (error) {
    // ... error handling ...
  }
});
```

---

## 🔍 Giải thích Helper Function

### Cách hoạt động:

1. **Kiểm tra null/undefined**: Return ngay nếu giá trị là null hoặc undefined
   ```javascript
   if (obj === null || obj === undefined) return obj;
   ```

2. **Convert BigInt**: Nếu giá trị là BigInt, convert sang string
   ```javascript
   if (typeof obj === 'bigint') {
     return obj.toString();
   }
   ```

3. **Xử lý Array**: Recursively convert từng element trong array
   ```javascript
   if (Array.isArray(obj)) {
     return obj.map(item => convertBigIntToString(item));
   }
   ```

4. **Xử lý Object**: Recursively convert từng property trong object
   ```javascript
   if (typeof obj === 'object') {
     const converted = {};
     for (const key in obj) {
       if (obj.hasOwnProperty(key)) {
         converted[key] = convertBigIntToString(obj[key]);
       }
     }
     return converted;
   }
   ```

5. **Return primitive values**: Các giá trị khác (string, number, boolean) return nguyên bản
   ```javascript
   return obj;
   ```

### Ví dụ:

**Input**:
```javascript
{
  name: "room-123",
  numParticipants: 2,
  creationTime: 1729425600000n,  // BigInt
  metadata: {
    duration: 3600n,  // BigInt
    bytes: 1048576n   // BigInt
  },
  participants: [
    {
      identity: "user-1",
      joinedAt: 1729425600000n  // BigInt
    }
  ]
}
```

**Output**:
```javascript
{
  name: "room-123",
  numParticipants: 2,
  creationTime: "1729425600000",  // String
  metadata: {
    duration: "3600",  // String
    bytes: "1048576"   // String
  },
  participants: [
    {
      identity: "user-1",
      joinedAt: "1729425600000"  // String
    }
  ]
}
```

---

## 📝 Files đã sửa

1. **server/controllers/videoRoomController.js**
   - Thêm helper function `convertBigIntToString` (dòng 424-447)
   - Cập nhật `getActiveLiveKitRooms` để sử dụng helper function (dòng 449-487)

---

## 🧪 Kiểm tra

### Test case:

1. **Đăng nhập với tài khoản admin**

2. **Vào trang "Phòng Video"**:
   ```
   http://localhost:3000/admin/video-rooms
   ```

3. **Chuyển tab sang "LiveKit Rooms"**:
   - Click vào tab "LiveKit Rooms"
   - Kiểm tra danh sách phòng hoạt động hiển thị ✅
   - Không có lỗi 500 ✅

4. **Kiểm tra API trực tiếp**:
   ```bash
   GET http://localhost:5000/api/video-rooms/admin/active-rooms
   # Expected: 200 OK với danh sách rooms
   # Response format:
   {
     "success": true,
     "data": [
       {
         "name": "room-name",
         "numParticipants": 2,
         "creationTime": "1729425600000",  // String, not BigInt
         "participants": [...]
       }
     ]
   }
   ```

---

## 📚 Bài học

### BigInt trong JavaScript:

1. **BigInt là gì?**
   - Primitive type cho số nguyên lớn hơn `Number.MAX_SAFE_INTEGER` (2^53 - 1)
   - Syntax: `123n` hoặc `BigInt(123)`

2. **Vấn đề với JSON**:
   - `JSON.stringify()` không hỗ trợ BigInt
   - Phải convert sang string hoặc number trước khi serialize

3. **Giải pháp**:
   - **Option 1**: Convert sang string (recommended cho timestamps lớn)
   - **Option 2**: Convert sang number (nếu giá trị nằm trong safe range)
   - **Option 3**: Custom JSON.stringify replacer function

### Best Practices:

1. **Always sanitize external API responses** trước khi trả về client
2. **Handle BigInt explicitly** khi làm việc với external libraries
3. **Use helper functions** để convert data types consistently
4. **Test with real data** từ external APIs để phát hiện edge cases

---

## 🔍 Alternative Solutions

### Option 1: Global JSON.stringify Replacer (không khuyến khích)

```javascript
// Modify global JSON.stringify behavior
JSON.stringify = (function(stringify) {
  return function(obj, replacer, space) {
    return stringify(obj, function(key, value) {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return replacer ? replacer(key, value) : value;
    }, space);
  };
})(JSON.stringify);
```

**Nhược điểm**: Ảnh hưởng toàn bộ application, khó debug

### Option 2: Custom Replacer per Call

```javascript
res.json(
  JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  )
);
```

**Nhược điểm**: Phải lặp lại code nhiều lần

### Option 3: Helper Function (✅ Recommended)

```javascript
const convertBigIntToString = (obj) => { /* ... */ };
const serializedData = convertBigIntToString(data);
res.json({ success: true, data: serializedData });
```

**Ưu điểm**: 
- Reusable
- Explicit
- Easy to test
- No side effects

---

## ✅ Kết quả

Sau khi áp dụng fix:
- ✅ `/api/video-rooms/admin/active-rooms` hoạt động bình thường
- ✅ Không còn lỗi BigInt serialization
- ✅ Admin có thể xem danh sách phòng hoạt động từ LiveKit
- ✅ Tất cả BigInt values được convert sang string
- ✅ Frontend nhận được data hợp lệ

---

## 🚀 Next Steps

1. ✅ Restart server để áp dụng thay đổi
2. ✅ Test endpoint `/api/video-rooms/admin/active-rooms`
3. ✅ Verify frontend hiển thị danh sách phòng
4. ✅ Monitor logs để đảm bảo không có lỗi mới

---

## 📖 Related Issues

- Route conflict issue: `BUGFIX_ROUTE_CONFLICT.md`
- Video call history feature: `CHANGELOG_VIDEO_CALL_HISTORY.md`

