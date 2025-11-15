// Định nghĩa Tools (Schema) cho AI
const tools = {
    functionDeclarations: [
        {
            name: "findHospitals",
            description: "Tìm kiếm bệnh viện dựa trên chuyên khoa, thành phố hoặc tên.",
            parameters: { 
                type: "OBJECT",
                properties: {
                    specialty: { type: "STRING", description: "Chuyên khoa người dùng muốn khám (ví dụ: 'tim mạch', 'tai mũi họng')" },
                    city: { type: "STRING", description: "Thành phố hoặc địa chỉ (ví dụ: 'TP.HCM', 'Hà Nội')" },
                    name: { type: "STRING", description: "Tên bệnh viện" }
                },
            }
        },
        {
            name: "findDoctors",
            description: "Tìm kiếm bác sĩ dựa trên chuyên khoa hoặc tên.",
            parameters: { 
                type: "OBJECT",
                properties: {
                    specialty: { type: "STRING", description: "Chuyên khoa người dùng muốn khám (ví dụ: 'tim mạch', 'tai mũi họng')" },
                    name: { type: "STRING", description: "Tên bác sĩ" }
                },
            }
        },
        {
            name: "getAppointmentHistory",
            description: "Lấy lịch sử 5 cuộc hẹn đã hoàn thành gần nhất của một bệnh nhân.",
            parameters: {
                type: "OBJECT",
                properties: {
                    patientId: { type: "STRING", description: "ID của bệnh nhân (User ID)." }
                },
                required: ["patientId"]
            }
        },
        {
            name: "getMyAppointments",
            description: "Lấy danh sách tất cả lịch hẹn hiện tại (đang chờ xác nhận, đã xác nhận, đã đổi lịch) của người dùng. Sử dụng tool này khi người dùng hỏi về lịch hẹn của họ.",
            parameters: {
                type: "OBJECT",
                properties: {
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại (bắt buộc)." }
                },
                required: ["sessionId"]
            }
        },
        {
            name: "findAvailableSlots",
            description: "Tìm các lịch hẹn còn trống dựa trên yêu cầu của người dùng.",
            parameters: {
                type: "OBJECT",
                properties: {
                    query: { type: "STRING", description: "Triệu chứng, bệnh, hoặc chuyên khoa người dùng muốn khám (ví dụ: 'đau tim', 'khám nhi', 'tiêm vaccine'). Bạn chỉ cần lấy chính xác những gì người dùng nói, không cần suy luận." },
                    city: { type: "STRING", description: "Thành phố hoặc địa chỉ (tùy chọn, mặc định là Hà Nội)" },
                    date: { type: "STRING", description: "Ngày người dùng muốn khám (ví dụ: 'sáng mai', '20-12-2025')" },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại (bắt buộc)." }
                },
                required: ["query", "sessionId"]
            }
        },
        {
            name: "bookAppointment",
            description: "Đặt lịch hẹn sau khi người dùng đã chọn một mã tham chiếu (ví dụ: L01, L02, L08). Bạn PHẢI sử dụng slotId từ kết quả của findAvailableSlots, KHÔNG được tự tạo slotId.",
            parameters: {
                type: "OBJECT",
                properties: {
                    slotId: { 
                        type: "STRING", 
                        description: "slotId chính xác từ kết quả của findAvailableSlots (format: scheduleId_timeSlotId, ví dụ: '507f1f77bcf86cd799439011_507f191e810c19729de860ea'). Bạn PHẢI lấy slotId từ danh sách availableSlots đã trả về trước đó, KHÔNG được tự tạo hoặc suy đoán. Nếu người dùng chọn L08, bạn phải tìm slot có referenceCode='L08' trong danh sách và lấy slotId tương ứng." 
                    },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại (bắt buộc)." }
                },
                required: ["slotId", "sessionId"]
            }
        },
        {
            name: "cancelAppointment",
            description: "Hủy một lịch hẹn đã đặt bằng cách sử dụng mã đặt lịch.",
            parameters: {
                type: "OBJECT",
                properties: {
                    bookingCode: { 
                        type: "STRING", 
                        description: "Mã đặt lịch của người dùng (ví dụ: APT-12345)" 
                    },
                    reason: {
                        type: "STRING",
                        description: "Lý do hủy lịch (ví dụ: 'tôi bận', 'đổi ý')"
                    },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại. Bạn PHẢI truyền nó." }
                },
                required: ["bookingCode", "reason", "sessionId"]
            }
        },
        {
            name: "rescheduleAppointment",
            description: "Tìm một lịch trống mới và dời lịch hẹn cũ sang lịch mới đó.",
            parameters: {
                type: "OBJECT",
                properties: {
                    bookingCode: { 
                        type: "STRING", 
                        description: "Mã đặt lịch của lịch hẹn CŨ (ví dụ: APT-12345)" 
                    },
                    preferredDate: {
                        type: "STRING",
                        description: "Ngày MỚI mà user muốn dời đến (ví dụ: 'sáng mai', 'ngày 20-12')"
                    },
                    preferredTime: {
                        type: "STRING",
                        description: "Giờ MỚI mà user muốn (ví dụ: '9:00', 'buổi chiều')"
                    },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại. Bạn PHẢI truyền nó." }
                },
                required: ["bookingCode", "preferredDate", "sessionId"]
            }
        }
    ]
};

module.exports = { tools };

