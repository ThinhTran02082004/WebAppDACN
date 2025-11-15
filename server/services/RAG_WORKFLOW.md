# 🔄 Workflow của LLM RAG System

## 📋 Tổng quan

Hệ thống RAG (Retrieval-Augmented Generation) này sử dụng kiến trúc **3 lớp** để xử lý câu hỏi của người dùng một cách hiệu quả và tiết kiệm chi phí:

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                              │
│              "Tôi muốn đặt lịch khám"                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  LỚP 1: GÁC CỔNG (Spam Filter)                              │
│  ────────────────────────────────────────────────────────   │
│  • Kiểm tra câu hỏi có "lạc đề" không?                      │
│  • Sử dụng: Qdrant + Embedding (text-embedding-004)         │
│  • Collection: "irrelevant_questions"                       │
│  • Ngưỡng: 0.95 (95% tương đồng)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
    [Lạc đề]                    [Hợp lệ]
         │                           │
         ▼                           ▼
┌──────────────┐          ┌──────────────────────────────────────┐
│  Trả về     │          │  LỚP 2: BỘ ĐỆM (Cache)            │
│  "Xin lỗi,  │          │  ────────────────────────────────  │
│  tôi chỉ    │          │  • Tìm câu trả lời đã cache?       │
│  hỗ trợ..." │          │  • Sử dụng: Qdrant + Embedding     │
└──────────────┘          │  • Collection: "common_answers"    │
                          │  • Ngưỡng: 0.95                    │
                          └──────────────┬─────────────────────┘
                                         │
                            ┌────────────┴────────────┐
                            │                         │
                       [Có cache]              [Không có]
                            │                         │
                            ▼                         ▼
                    ┌──────────────┐    ┌──────────────────────────────┐
                    │  Trả về      │    │  LỚP 3: BỘ NÃO (AI + Tools)  │
                    │  câu trả lời │    │  ──────────────────────────── │
                    │  đã lưu      │    │  • Gọi Gemini 1.5 Pro         │
                    └──────────────┘    │  • Function Calling (Tools)    │
                                        │  • Tìm kiếm & Đặt lịch         │
                                        └──────────────┬─────────────────┘
                                                       │
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │  AI Phân tích & Gọi Tools    │
                                        │  ─────────────────────────── │
                                        │  1. findHospitals()          │
                                        │  2. findDoctors()            │
                                        │  3. findAvailableSlots()     │
                                        │  4. bookAppointment()        │
                                        │  5. getMyAppointments()      │
                                        │  6. cancelAppointment()      │
                                        │  7. rescheduleAppointment()  │
                                        └──────────────┬───────────────┘
                                                       │
                                                       ▼
                                        ┌──────────────────────────────┐
                                        │  Trả về câu trả lời        │
                                        │  + Lưu vào Cache (nếu OK)   │
                                        └────────────────────────────┘
```

---

## 🔍 Chi tiết từng lớp

### **LỚP 1: GÁC CỔNG (Spam/Irrelevant Filter)**

**Mục đích**: Chặn các câu hỏi không liên quan đến y tế để tiết kiệm chi phí API.

**Cách hoạt động**:
1. **Input**: Câu hỏi của người dùng (ví dụ: "Thời tiết hôm nay thế nào?")
2. **Embedding**: Chuyển câu hỏi thành vector 768 chiều bằng `text-embedding-004`
3. **Vector Search**: Tìm kiếm trong Qdrant collection `irrelevant_questions`
4. **Threshold**: Nếu similarity score ≥ 0.95 → **LẠC ĐỀ**
5. **Output**: 
   - Nếu lạc đề → Trả về: "Xin lỗi, tôi chỉ có thể hỗ trợ các câu hỏi liên quan đến việc tìm kiếm và đặt lịch y tế."
   - Nếu hợp lệ → Chuyển sang LỚP 2

**Code Location**: `server/services/qdrantService.js` → `isIrrelevant()`

**Collection**: `irrelevant_questions` (được seed từ script)

---

### **LỚP 2: BỘ ĐỆM (Answer Cache)**

**Mục đích**: Trả về câu trả lời đã được cache để tránh gọi AI tốn kém cho các câu hỏi tương tự.

**Cách hoạt động**:
1. **Input**: Câu hỏi hợp lệ từ LỚP 1
2. **Embedding**: Chuyển câu hỏi thành vector 768 chiều
3. **Vector Search**: Tìm kiếm trong Qdrant collection `common_answers`
4. **Threshold**: Nếu similarity score ≥ 0.95 → **TRÚNG CACHE**
5. **Validation**: 
   - ❌ Không cache nếu câu trả lời có thông tin cụ thể (bookingCode, ngày giờ cụ thể)
   - ❌ Không cache nếu prompt là câu trả lời ngắn/xác nhận ("ok", "đúng", "l1", "l2"...)
6. **Output**:
   - Nếu có cache → Trả về câu trả lời đã lưu (MIỄN PHÍ)
   - Nếu không có → Chuyển sang LỚP 3

**Code Location**: `server/services/qdrantService.js` → `findCachedAnswer()`

**Collection**: `common_answers` (tự động lưu sau mỗi câu trả lời hợp lệ)

---

### **LỚP 3: BỘ NÃO (AI + Function Calling)**

**Mục đích**: Xử lý câu hỏi phức tạp bằng AI và thực thi các hành động cụ thể (đặt lịch, hủy lịch...).

**Cách hoạt động**:

#### **Bước 1: Khởi tạo Chat**
```javascript
const chat = model.startChat({
    tools: tools,           // Định nghĩa các tools có sẵn
    history: history        // Lịch sử cuộc trò chuyện
});
```

#### **Bước 2: Gửi câu hỏi cho AI**
```javascript
result = await chat.sendMessage(userPrompt);
```

#### **Bước 3: AI Phân tích & Quyết định**
AI sẽ phân tích câu hỏi và quyết định:
- **Trả lời trực tiếp** (nếu là câu hỏi thông thường)
- **Gọi Tool** (nếu cần thực hiện hành động)

#### **Bước 4: Function Calling Loop**
```javascript
while (true) {
    const call = result.response.functionCalls()?.[0];
    
    if (!call) {
        // Không còn gọi hàm → Trả về kết quả
        return { text: result.response.text(), usedTool: toolCalled };
    }
    
    // Thực thi tool
    toolResult = await availableTools[call.name](call.args);
    
    // Gửi kết quả lại cho AI
    result = await chat.sendMessage(JSON.stringify({
        functionResponse: { name: call.name, response: toolResult }
    }));
}
```

#### **Bước 5: Lưu kết quả**
- Lưu vào MongoDB (`ChatHistory`) nếu user đã đăng nhập
- Lưu vào Cache (Qdrant) nếu `usedTool = true` và không có thông tin cụ thể

**Code Location**: 
- `server/services/aiService.js` → `runChatWithTools()`
- `server/services/aiConfig.js` → Cấu hình model
- `server/services/aiToolsDefinitions.js` → Định nghĩa tools
- `server/services/searchTools.js` → Tools tìm kiếm
- `server/services/appointmentTools.js` → Tools quản lý lịch hẹn

---

## 🛠️ Các Tools có sẵn

### **Search Tools** (`searchTools.js`)
1. **`findHospitals`**: Tìm bệnh viện theo tên, địa chỉ, chuyên khoa
2. **`findDoctors`**: Tìm bác sĩ theo tên, chuyên khoa, bệnh viện
3. **`findAvailableSlots`**: Tìm lịch trống của bác sĩ

### **Appointment Tools** (`appointmentTools.js`)
1. **`getAppointmentHistory`**: Lấy lịch sử đã hoàn thành
2. **`getMyAppointments`**: Lấy danh sách lịch hẹn hiện tại (pending, confirmed, rescheduled, pending_payment)
3. **`bookAppointment`**: Đặt lịch hẹn mới
4. **`cancelAppointment`**: Hủy lịch hẹn
5. **`rescheduleAppointment`**: Đổi lịch hẹn

---

## 📊 Luồng dữ liệu chi tiết

### **Ví dụ 1: Câu hỏi lạc đề**
```
User: "Thời tiết hôm nay thế nào?"
  ↓
[LỚP 1] isIrrelevant() → TRUE
  ↓
Response: "Xin lỗi, tôi chỉ có thể hỗ trợ..."
  ↓
[Lưu vào ChatHistory nếu user đã đăng nhập]
  ↓
Return (KHÔNG tốn tiền AI)
```

### **Ví dụ 2: Câu hỏi đã có cache**
```
User: "Bệnh viện nào tốt ở Hà Nội?"
  ↓
[LỚP 1] isIrrelevant() → FALSE
  ↓
[LỚP 2] findCachedAnswer() → "Bệnh viện Bạch Mai, Bệnh viện Việt Đức..."
  ↓
Response: [Câu trả lời từ cache]
  ↓
[Lưu vào ChatHistory nếu user đã đăng nhập]
  ↓
Return (KHÔNG tốn tiền AI)
```

### **Ví dụ 3: Câu hỏi cần AI xử lý**
```
User: "Tôi muốn đặt lịch khám với bác sĩ Nguyễn Văn A vào ngày 15/12"
  ↓
[LỚP 1] isIrrelevant() → FALSE
  ↓
[LỚP 2] findCachedAnswer() → NULL (không có cache)
  ↓
[LỚP 3] runChatWithTools()
  ↓
AI phân tích → Gọi findDoctors() → Tìm thấy bác sĩ
  ↓
AI phân tích → Gọi findAvailableSlots() → Tìm lịch trống
  ↓
AI phân tích → Gọi bookAppointment() → Đặt lịch thành công
  ↓
AI tạo câu trả lời: "Đã đặt lịch thành công. Mã đặt lịch: APT-XXXXX..."
  ↓
[Lưu vào ChatHistory]
[KHÔNG lưu vào Cache vì có thông tin cụ thể (bookingCode)]
  ↓
Return (TỐN TIỀN AI - nhưng đã thực hiện hành động)
```

---

## 🔐 Authentication & Session Management

### **Session ID Flow**
1. Client gửi request với `sessionId` (hoặc tạo mới nếu chưa có)
2. Server map `sessionId` → `userId` trong cache (nếu user đã đăng nhập)
3. Các tools cần authentication nhận `sessionId` → giải mã thành `userId`

### **Code Location**
- `server/controllers/aiController.js` → Xử lý session mapping
- `server/services/cacheService.js` → Cache `sessionId → userId`
- `server/services/appointmentTools.js` → Sử dụng `sessionId` để lấy `userId`

---

## 💾 Storage

### **Qdrant (Vector Database)**
- **Collection 1**: `irrelevant_questions` - Câu hỏi lạc đề
- **Collection 2**: `common_answers` - Câu trả lời đã cache
- **Vector Size**: 768 (từ `text-embedding-004`)
- **Distance Metric**: Cosine Similarity

### **MongoDB**
- **Collection**: `ChatHistory` - Lịch sử chat của user
- **Fields**: `userId`, `userPrompt`, `aiResponse`, `usedTool`, `createdAt`

---

## ⚡ Tối ưu hóa

1. **Lớp 1 & 2**: Giảm 80-90% số lần gọi AI (tiết kiệm chi phí)
2. **Cache thông minh**: Không cache câu trả lời có thông tin cụ thể (bookingCode, ngày giờ)
3. **Session Management**: Hỗ trợ cả guest và authenticated user
4. **Transaction Safety**: Sử dụng Mongoose transactions cho các thao tác quan trọng (đặt lịch, hủy lịch)

---

## 🚀 Cách sử dụng

### **API Endpoint**
```
POST /api/ai/chat
Body: {
    "prompt": "Tôi muốn đặt lịch khám",
    "messages": [...],  // Optional
    "sessionId": "..."  // Optional
}
```

### **Response**
```json
{
    "success": true,
    "data": {
        "text": "Câu trả lời của AI..."
    },
    "sessionId": "uuid-v4"
}
```

---

## 📝 Notes

- **Embedding Model**: `text-embedding-004` (768 dimensions)
- **LLM Model**: `gemini-1.5-pro` (Google Generative AI)
- **Vector DB**: Qdrant (local hoặc cloud)
- **Similarity Threshold**: 0.95 (95% tương đồng)

---

**Tác giả**: Hệ thống WebAppDACN  
**Ngày tạo**: 2024  
**Phiên bản**: 1.0

