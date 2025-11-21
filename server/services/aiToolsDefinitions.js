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
            description: "Lấy danh sách tất cả lịch hẹn hiện tại của người dùng. BẠN PHẢI gọi tool này khi người dùng hỏi về lịch hẹn của họ (ví dụ: 'lịch của tôi', 'tôi có lịch nào không', 'xem lịch hẹn', 'lịch đã đặt', 'appointment của tôi'). KHÔNG trả lời về lịch hẹn mà không gọi tool này - bạn không thể biết lịch hẹn của người dùng nếu không gọi tool.",
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
            description: "Tìm các lịch hẹn còn trống dựa trên yêu cầu của người dùng. CHỈ gọi tool này khi người dùng YÊU CẦU TÌM LỊCH MỚI hoặc thay đổi yêu cầu. KHÔNG gọi tool này khi người dùng đã chọn một mã tham chiếu (L01, L02, v.v.) - trong trường hợp đó, gọi bookAppointment thay vì.",
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
            description: "Đặt lịch hẹn sau khi người dùng đã chọn một mã tham chiếu (ví dụ: L01, L02, L08) từ danh sách slots đã trả về trước đó. Bạn PHẢI sử dụng slotId và serviceId từ kết quả của findAvailableSlots trong lịch sử chat, KHÔNG được tự tạo slotId. QUAN TRỌNG: Khi người dùng nói 'chọn L01' hoặc 'tôi chọn L01', bạn PHẢI gọi tool này NGAY, KHÔNG gọi lại findAvailableSlots.",
            parameters: {
                type: "OBJECT",
                properties: {
                    slotId: { 
                        type: "STRING", 
                        description: "slotId chính xác từ kết quả của findAvailableSlots TRƯỚC ĐÓ trong lịch sử chat (format: scheduleId_timeSlotId). Bạn PHẢI tìm trong lịch sử chat để lấy slotId từ danh sách availableSlots đã trả về, KHÔNG được tự tạo hoặc suy đoán. Nếu người dùng chọn L08, bạn phải tìm trong lịch sử chat slot có referenceCode='L08' và lấy slotId tương ứng từ đó." 
                    },
                    serviceId: {
                        type: "STRING",
                        description: "serviceId từ kết quả của findAvailableSlots TRƯỚC ĐÓ trong lịch sử chat (nếu có). Lấy từ slot đã chọn để đảm bảo đặt đúng dịch vụ mà người dùng yêu cầu."
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
        },
        {
            name: "checkInventoryAndPrescribe",
            description: "Kiểm tra kho thuốc dựa trên hoạt chất/từ khóa và tạo đơn thuốc nháp nếu có hàng.",
            parameters: {
                type: "OBJECT",
                properties: {
                    searchQuery: { type: "STRING", description: "Tên hoạt chất hoặc thuốc mà AI đã tìm được sau khi tra cứu (ví dụ: Paracetamol, Ibuprofen)." },
                    symptom: { type: "STRING", description: "Triệu chứng của người dùng để lưu vào đơn." },
                    sessionId: { type: "STRING", description: "ID phiên chat hiện tại (để xác định người dùng)." }
                },
                required: ["searchQuery", "symptom", "sessionId"]
            }
        },
        {
            name: "getMyPrescriptions",
            description: "Lấy danh sách các đơn thuốc hiện có của người dùng, bao gồm cả đơn nháp chờ duyệt.",
            parameters: {
                type: "OBJECT",
                properties: {
                    status: { type: "STRING", description: "Trạng thái muốn lọc (ví dụ: pending, approved, dispensed, pending_approval)." },
                    includeDrafts: { type: "BOOLEAN", description: "Có bao gồm các đơn thuốc nháp hay không (mặc định: true)." },
                    limit: { type: "NUMBER", description: "Số lượng tối đa bản ghi cần lấy (mặc định: 10, tối đa: 50)." },
                    sessionId: { type: "STRING", description: "ID phiên chat hiện tại (bắt buộc)." }
                },
                required: ["sessionId"]
            }
        },
        {
            name: "cancelPrescription",
            description: "Hủy một đơn thuốc (đơn nháp hoặc đơn chính thức).",
            parameters: {
                type: "OBJECT",
                properties: {
                    prescriptionCode: {
                        type: "STRING",
                        description: "Mã đơn thuốc dạng PRS-XXXXXX (đối với đơn nháp)."
                    },
                    prescriptionId: {
                        type: "STRING",
                        description: "ID của đơn thuốc chính thức (nếu không có prescriptionCode)."
                    },
                    reason: {
                        type: "STRING",
                        description: "Lý do hủy đơn thuốc (tùy chọn)."
                    },
                    sessionId: { type: "STRING", description: "ID phiên chat hiện tại (bắt buộc)." }
                },
                required: ["sessionId"]
            }
        }
    ]
};

module.exports = { tools };

