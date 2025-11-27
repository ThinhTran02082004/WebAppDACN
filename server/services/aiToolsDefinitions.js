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
            description: "Tìm các lịch hẹn còn trống dựa trên yêu cầu của người dùng. GỌI tool này khi: (1) Người dùng YÊU CẦU TÌM LỊCH MỚI (ví dụ: 'đặt lịch', 'tôi muốn khám', 'tìm bác sĩ'), (2) Người dùng trả lời 'có', 'muốn', 'được' khi được hỏi có muốn đặt lịch không, (3) Người dùng thay đổi yêu cầu (ngày khác, chuyên khoa khác). KHÔNG gọi tool này khi người dùng đã chọn một mã tham chiếu (L01, L02, v.v.) - trong trường hợp đó, gọi bookAppointment thay vì. QUAN TRỌNG: Nếu người dùng VỪA nói về triệu chứng trong câu trước (ví dụ: 'đau bụng', 'sốt cao'), bạn PHẢI sử dụng triệu chứng đó làm query, KHÔNG hỏi lại.",
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
            description: "Đặt lịch hẹn sau khi người dùng đã chọn một mã tham chiếu (ví dụ: L01, L02, L08) hoặc số thứ tự (ví dụ: 1, 2, 8) từ danh sách slots đã trả về trước đó. QUAN TRỌNG: Khi người dùng nói 'chọn L01', 'tôi chọn số 1', hoặc 'đặt lịch L08', bạn PHẢI gọi tool này NGAY với slotIndex tương ứng, KHÔNG gọi lại findAvailableSlots.",
            parameters: {
                type: "OBJECT",
                properties: {
                    slotIndex: { 
                        type: "STRING", 
                        description: "Mã tham chiếu (ví dụ: 'L01', 'L08') hoặc số thứ tự (ví dụ: '1', '8') mà người dùng đã chọn từ danh sách slots. Tool sẽ tự động tìm slot tương ứng từ cache dựa trên referenceCode hoặc số thứ tự này." 
                    },
                    sessionId: { type: "STRING", description: "ID của phiên chat hiện tại (bắt buộc)." }
                },
                required: ["slotIndex", "sessionId"]
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
            description: "Kiểm tra kho thuốc dựa trên triệu chứng và tạo đơn thuốc nháp nếu có hàng. Tool này sẽ tự động tra cứu hoạt chất phù hợp từ triệu chứng.",
            parameters: {
                type: "OBJECT",
                properties: {
                    symptom: { type: "STRING", description: "Triệu chứng của người dùng (ví dụ: 'đau đầu', 'sốt cao', 'đau bụng'). Tool sẽ tự động tra cứu hoạt chất phù hợp từ triệu chứng này." },
                    sessionId: { type: "STRING", description: "ID phiên chat hiện tại (để xác định người dùng)." }
                },
                required: ["symptom", "sessionId"]
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

