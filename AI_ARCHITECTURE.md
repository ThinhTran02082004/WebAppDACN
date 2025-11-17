# Kiến trúc AI trong Dự án Bệnh viện

## 📋 Tổng quan

Dự án sử dụng **Google Gemini AI (gemini-2.5-flash)** với kiến trúc **Function Calling** để tạo trợ lý AI y tế thông minh, có khả năng:
- Tìm kiếm bệnh viện, bác sĩ, chuyên khoa
- Đặt lịch khám tự động
- Hủy và dời lịch hẹn
- Xem lịch sử khám bệnh

## 🏗️ Kiến trúc 3 tầng

### **Tầng 1: Gác Cổng (Gate Keeper) - Qdrant Vector DB**
**Trạng thái:** Đang bị tắt (commented out)

**Mục đích:** Lọc câu hỏi lạc đề trước khi gửi đến AI
- Sử dụng Qdrant Vector Database
- Embedding câu hỏi người dùng thành vector
- So sánh với database câu hỏi lạc đề
- Nếu similarity > 80% → Chặn và trả lời canned response

**Lợi ích:**
- Tiết kiệm chi phí API Gemini
- Phản hồi nhanh hơn
- Bảo vệ AI khỏi spam/abuse

### **Tầng 2: Bộ Đệm (Cache) - Qdrant Vector DB**
**Trạng thái:** Đang bị tắt (commented out)

**Mục đích:** Cache câu trả lời cho câu hỏi tương tự
- Tìm kiếm câu hỏi tương tự đã được trả lời
- Nếu tìm thấy → Trả về câu trả lời đã cache
- Không cần gọi Gemini API

**Lợi ích:**
- Giảm 70-80% số lần gọi API
- Phản hồi tức thì
- Tiết kiệm chi phí đáng kể

### **Tầng 3: Bộ Não (Brain) - Gemini AI**
**Trạng thái:** ✅ Đang hoạt động

**Mục đích:** Xử lý logic nghiệp vụ phức tạp
- Hiểu ngữ cảnh và ý định người dùng
- Gọi các function tools phù hợp
- Tổng hợp và trả lời tự nhiên

## 🛠️ Function Tools (Công cụ AI)

### 1. **findHospitals**
Tìm kiếm bệnh viện theo:
- Chuyên khoa (specialty)
- Thành phố (city)
- Tên bệnh viện (name)

**Ví dụ:**
```
User: "Tìm bệnh viện tim mạch ở TP.HCM"
AI → findHospitals({ specialty: "tim mạch", city: "TP.HCM" })
```

### 2. **findDoctors**
Tìm kiếm bác sĩ theo:
- Chuyên khoa (specialty)
- Tên bác sĩ (name)

**Ví dụ:**
```
User: "Tìm bác sĩ tai mũi họng"
AI → findDoctors({ specialty: "tai mũi họng" })
```

### 3. **getAppointmentHistory**
Xem lịch sử 5 cuộc hẹn gần nhất
- Yêu cầu: User đã đăng nhập
- Trả về: Danh sách appointments đã completed

### 4. **findAvailableSlots** ⭐
Tìm lịch trống theo:
- Chuyên khoa (specialty) - bắt buộc
- Thành phố (city) - tùy chọn
- Ngày (date) - tùy chọn

**Luồng hoạt động:**
1. Tìm chuyên khoa trong database
2. Tìm bác sĩ thuộc chuyên khoa đó
3. Parse ngày (hỗ trợ: "mai", "20-12", "sáng mai")
4. Tìm schedule có slot trống
5. Trả về tối đa 10 slots với slotId

**Ví dụ:**
```
User: "Tôi muốn đặt lịch khám tim mạch vào sáng mai"
AI → findAvailableSlots({ 
  specialty: "tim mạch", 
  date: "sáng mai" 
})
→ Trả về: [
  { slotId: "abc123_xyz789", doctorName: "BS. Nguyễn Văn A", date: "20/12/2024", time: "09:00" },
  ...
]
```

### 5. **bookAppointment** ⭐⭐⭐
Đặt lịch hẹn sau khi user chọn slot

**Tham số:**
- slotId: ID của slot đã chọn (format: `scheduleId_timeSlotId`)
- sessionId: ID phiên chat (để xác thực user)

**Luồng hoạt động:**
1. Giải mã sessionId → userId (từ cache)
2. Kiểm tra user đã đăng nhập chưa
3. Tách slotId thành scheduleId và timeSlotId
4. **Bắt đầu MongoDB Transaction**
5. Tìm và khóa schedule
6. Kiểm tra slot còn trống không
7. Đánh dấu slot đã đặt
8. Tạo Appointment mới
9. **Commit transaction**
10. Trả về booking code

**Bảo mật:**
- Sử dụng MongoDB Transaction để tránh race condition
- Kiểm tra authentication qua sessionId
- Validate tất cả input

**Ví dụ:**
```
User: "Tôi chọn slot 1" (sau khi xem danh sách)
AI → bookAppointment({ 
  slotId: "abc123_xyz789",
  sessionId: "user-session-uuid"
})
→ Trả về: { 
  success: true, 
  bookingCode: "APT-12345",
  doctorName: "BS. Nguyễn Văn A",
  date: "20/12/2024",
  time: "09:00"
}
```

### 6. **cancelAppointment**
Hủy lịch hẹn đã đặt

**Tham số:**
- bookingCode: Mã đặt lịch (APT-xxxxx)
- reason: Lý do hủy
- sessionId: ID phiên chat

**Luồng hoạt động:**
1. Xác thực user qua sessionId
2. Tìm appointment theo bookingCode
3. Kiểm tra quyền sở hữu (patientId === userId)
4. Kiểm tra trạng thái (không hủy được nếu đã completed)
5. Cập nhật status = 'cancelled'
6. Giải phóng time slot trong schedule
7. Giảm bookedCount

### 7. **rescheduleAppointment**
Dời lịch hẹn sang ngày/giờ khác

**Tham số:**
- bookingCode: Mã đặt lịch cũ
- preferredDate: Ngày mới (hỗ trợ: "mai", "20-12")
- preferredTime: Giờ mới (tùy chọn: "9:00", "buổi sáng")
- sessionId: ID phiên chat

**Luồng hoạt động:**
1. Xác thực user
2. Tìm appointment cũ
3. Parse ngày mới
4. Tìm schedule mới của cùng bác sĩ
5. Tìm slot trống phù hợp với preferredTime
6. Giải phóng slot cũ
7. Đặt slot mới
8. Cập nhật appointment với reschedule history

## 🔐 Xác thực & Bảo mật

### Session Management
```javascript
// Cache service lưu mapping: sessionId → userId
cache.setUserId(sessionId, realUserId);
const userId = cache.getUserId(sessionId);
```

**Luồng:**
1. User mở chat → Tạo sessionId (UUID)
2. Nếu đã đăng nhập → Map sessionId với userId
3. Khi đặt/hủy/dời lịch → Giải mã sessionId để lấy userId
4. Validate quyền truy cập

### Transaction Safety
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // Các thao tác database
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
} finally {
  session.endSession();
}
```

## 📊 Luồng hoạt động tổng thể

### Kịch bản: Đặt lịch khám

```
1. User: "Tôi muốn đặt lịch khám tim mạch"
   ↓
2. AI gọi: findAvailableSlots({ specialty: "tim mạch" })
   ↓
3. AI trả lời: "Tôi tìm thấy các lịch trống:
   1. BS. Nguyễn Văn A - 20/12/2024 - 09:00
   2. BS. Trần Thị B - 20/12/2024 - 10:00
   Bạn muốn chọn lịch nào?"
   ↓
4. User: "Tôi chọn lịch 1"
   ↓
5. AI gọi: bookAppointment({ slotId: "...", sessionId: "..." })
   ↓
6. AI trả lời: "Đã đặt lịch thành công!
   Mã đặt lịch: APT-12345
   Bác sĩ: BS. Nguyễn Văn A
   Thời gian: 20/12/2024 lúc 09:00"
```

## 🎯 System Instruction (Prompt Engineering)

```
Role: You are a medical booking assistant.

CRITICAL RULE: NEVER book an appointment unless the user has 
explicitly confirmed a specific slot ID.

Flow:
1. User asks to find appointments
2. FIRST action: Call findAvailableSlots
3. MUST display list with doctor, time, and slotId
4. ONLY when user confirms a specific slot → Call bookAppointment
5. NEVER call bookAppointment from first request

Output format:
- Tiếng Việt thân thiện
- Không dùng Markdown (*, **)
- Trình bày rõ ràng với xuống dòng
```

## 💾 Database Models

### ChatHistory
```javascript
{
  userId: ObjectId,
  userPrompt: String,
  aiResponse: String,
  usedTool: Boolean,
  createdAt: Date
}
```

### Appointment
```javascript
{
  bookingCode: String,
  patientId: ObjectId,
  doctorId: ObjectId,
  scheduleId: ObjectId,
  appointmentDate: Date,
  timeSlot: { startTime, endTime },
  status: String, // pending, confirmed, completed, cancelled
  rescheduleHistory: Array,
  cancellationReason: String
}
```

### Schedule
```javascript
{
  doctorId: ObjectId,
  date: Date,
  timeSlots: [{
    startTime: String,
    endTime: String,
    isBooked: Boolean,
    bookedCount: Number,
    maxBookings: Number,
    appointmentIds: [ObjectId]
  }]
}
```

## 🔧 Configuration

### Environment Variables
```env
GEMINI_API_KEY=your_gemini_api_key
QDRANT_URL=http://localhost:6333  # (Đang tắt)
QDRANT_API_KEY=your_qdrant_key    # (Đang tắt)
```

### API Endpoints
```
POST /api/ai/gemini-chat
- Body: { prompt, messages, sessionId }
- Response: { success, data: { text }, sessionId }

GET /api/ai/chat-history
- Headers: Authorization Bearer token
- Response: { success, data: [messages] }
```

## 📈 Performance & Cost

### Hiện tại (Chỉ dùng Gemini)
- Mỗi tin nhắn: 1 API call
- Chi phí: ~$0.001 - $0.005 per request
- Latency: 1-3 giây

### Khi bật Qdrant (Tầng 1 & 2)
- 70-80% requests được cache
- Chi phí giảm: ~$0.0002 - $0.001 per request
- Latency: 100-500ms (cached)

## 🚀 Cải tiến trong tương lai

### 1. Bật lại Qdrant
- Uncomment code trong `qdrantService.js`
- Seed database với câu hỏi lạc đề
- Seed cache với Q&A phổ biến

### 2. Thêm Tools mới
- `checkDoctorAvailability`: Kiểm tra bác sĩ có rảnh không
- `getHospitalInfo`: Thông tin chi tiết bệnh viện
- `estimateWaitTime`: Ước tính thời gian chờ
- `findNearbyHospitals`: Tìm bệnh viện gần nhất (GPS)

### 3. Multi-turn Conversation
- Lưu context conversation
- Hiểu câu hỏi follow-up
- Xử lý clarification questions

### 4. Voice Integration
- Speech-to-text
- Text-to-speech
- Voice booking

## 🐛 Debugging

### Logs
```javascript
console.log('[AI Request] Yêu cầu gọi hàm:', call.name);
console.log('[Tool] Đang tìm lịch trống:', params);
console.log('[Tool] Đang đặt lịch cho slot:', slotId);
```

### Common Issues

**1. "Lỗi xác thực: Không tìm thấy ID người dùng"**
- Nguyên nhân: sessionId không hợp lệ hoặc user chưa đăng nhập
- Giải pháp: Yêu cầu user đăng nhập lại

**2. "Rất tiếc, giờ hẹn này vừa có người khác đặt mất"**
- Nguyên nhân: Race condition (2 users đặt cùng lúc)
- Giải pháp: Đã xử lý bằng MongoDB Transaction

**3. "Không tìm thấy lịch trống"**
- Nguyên nhân: Không có schedule hoặc tất cả slots đã đầy
- Giải pháp: Gợi ý ngày khác hoặc bác sĩ khác

## 📚 Tài liệu tham khảo

- [Google Gemini API](https://ai.google.dev/docs)
- [Function Calling Guide](https://ai.google.dev/docs/function_calling)
- [Qdrant Vector Database](https://qdrant.tech/documentation/)
- [MongoDB Transactions](https://www.mongodb.com/docs/manual/core/transactions/)

---

**Tóm lại:** Hệ thống AI của bạn đang hoạt động tốt với Gemini Function Calling, có khả năng đặt/hủy/dời lịch tự động. Để tối ưu chi phí và hiệu suất, nên bật lại Qdrant cache layer.
