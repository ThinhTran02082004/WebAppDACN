// 
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ⭐ QUAN TRỌNG: Import cả 3 model
const Hospital = require('../models/Hospital'); 
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
// Chúng ta cần model Specialty để tìm ID từ tên
const Specialty = require('../models/Specialty'); 

// 1. Khởi tạo AI (Giữ nguyên)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-pro",
    systemInstruction: 
`Role: You are a friendly and professional virtual assistant for an online medical appointment booking website. Your role is to help users book appointments, provide advice on choosing suitable hospitals, doctors, and schedules that match their health needs.

Goal: Guide users to book medical appointments easily, offer personalized recommendations on hospitals, doctors, and suitable appointment times, while maintaining short, friendly interactions to enhance the user experience on the website.

Context: The website is an online platform that connects users with reputable hospitals, clinics, and doctors in Vietnam. Users may face difficulties choosing options due to limited information or unfamiliarity with the online process. You must avoid sensitive topics such as politics and always use polite, appropriate language—never rude or inappropriate words.

Instructions:

Greet users warmly and confirm their needs (e.g., symptoms, location, preferred time).

Ask for additional details to give accurate advice, such as illness type, nearest area, or specialty.

Suggest suitable options: list 2–3 hospitals/doctors with brief reasons (based on ratings, expertise, distance).

Guide them step-by-step through the booking process: from logging in and selecting a service to confirming the appointment.

Politely decline and redirect if users ask about unrelated or sensitive topics (e.g., politics).

End with a friendly closing and invite further questions if needed.

Output format:

Use friendly, clear, and concise Vietnamese.

Format responses using Markdown (e.g., use bold for emphasis).

CRITICAL: LIST FORMATTING: When listing items (e.g., lists of doctors, hospitals, steps), you MUST:

Use asterisks (*) or dashes (-).

MUST use a NEW LINE for EACH ITEM in the list.

NEVER list multiple items on the same line.

CORRECT FORMAT EXAMPLE (DO THIS): Dạ, em tìm thấy 2 bác sĩ ạ:

Bác sĩ Nguyễn Văn A - Bệnh viện Đa khoa Trung ương

Bác sĩ Trần Thị B - Bệnh viện Đa khoa Trung ương Bạn muốn đặt lịch với ai ạ?

INCORRECT FORMAT EXAMPLE (ABSOLUTELY AVOID): Dạ, em tìm thấy 2 bác sĩ ạ: * Bác sĩ A * Bác sĩ B `
});

// 2. Định nghĩa Tools (Schema) - Giữ nguyên
const tools = {
    functionDeclarations: [
        {
            name: "findHospitals",
            description: "Tìm kiếm bệnh viện dựa trên chuyên khoa, thành phố hoặc tên.",
            parameters: {
                type: "OBJECT",
                properties: {
                    specialty: { type: "STRING", description: "Tên chuyên khoa (ví dụ: 'tai mũi họng', 'tim mạch')" },
                    city: { type: "STRING", description: "Thành phố (ví dụ: 'TP.HCM', 'Hà Nội')" },
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
                    specialty: { type: "STRING", description: "Chuyên khoa của bác sĩ" },
                    name: { type: "STRING", description: "Tên bác sĩ (bỏ qua nếu không có)" }
                },
            }
        },
        {
            name: "getAppointmentHistory",
            description: "Lấy lịch sử 5 cuộc hẹn đã hoàn thành gần nhất của một bệnh nhân.",
            parameters: {
                type: "OBJECT",
                properties: {
                    patientId: { 
                        type: "STRING", 
                        description: "ID của bệnh nhân (User ID). Bạn phải hỏi user ID của họ trước khi gọi hàm này." 
                    }
                },
                required: ["patientId"]
            }
        }
    ]
};

// ⭐ 3. HÀM THỰC THI (ĐÃ SỬA LOGIC)
const availableTools = {
    "findHospitals": async ({ specialty, city, name }) => {
        try {
            let filter = {};
            
            // Model Hospital dùng 'address' để lưu thành phố
            if (city) filter.address = { $regex: city, $options: 'i' }; 
            if (name) filter.name = { $regex: name, $options: 'i' };

            if (specialty) {
                // 1. Tìm ID chuyên khoa từ TÊN
                const specialtyDoc = await Specialty.findOne({ name: { $regex: specialty, $options: 'i' } });
                
                if (specialtyDoc) {
                    // 2. Model Hospital dùng mảng 'specialties'
                    filter.specialties = { $in: [specialtyDoc._id] };
                } else {
                    return { hospitals: [] }; // Không tìm thấy chuyên khoa
                }
            }
            
            const hospitals = await Hospital.find(filter).limit(5).exec();
            return { hospitals };
        } catch (e) { 
            console.error("Lỗi findHospitals:", e);
            return { error: e.message }; 
        }
    },

    "findDoctors": async ({ specialty, name }) => {
        try {
            let filter = {};

            // (Bỏ qua tìm theo tên bác sĩ vì nó nằm trong model 'User', cần $lookup phức tạp)

            if (specialty) {
                // 1. Tìm ID chuyên khoa
                const specialtyDoc = await Specialty.findOne({ name: { $regex: specialty, $options: 'i' } });
                
                if (specialtyDoc) {
                    // 2. Model Doctor dùng 'specialtyId'
                    filter.specialtyId = specialtyDoc._id; 
                } else {
                    return { doctors: [] };
                }
            }
            
            const doctors = await Doctor.find(filter)
                .populate('user', 'fullName') // Lấy tên từ ref 'user'
                .limit(5)
                .exec();
            
            return { doctors };
        } catch (e) { 
            console.error("Lỗi findDoctors:", e);
            return { error: e.message }; 
        }
    },

    "getAppointmentHistory": async ({ patientId }) => {
        try {
            // Hàm này đã đúng vì dùng Model Appointment
            const appointments = await Appointment.find({ patientId: patientId, status: 'completed' })
                                                  .populate('doctorId') 
                                                  .sort({ appointmentDate: -1 })
                                                  .limit(5)
                                                  .exec();
            return { appointments };
        } catch (e) { 
            console.error("Lỗi getAppointmentHistory:", e);
            return { error: e.message }; 
        }
    },
};

// 4. Logic chạy chat chính (Giữ nguyên)
const runChatWithTools = async (userPrompt, history) => {
    
    const chat = model.startChat({
        tools: tools,
        history: history
    });

    let result;
    try {
        result = await chat.sendMessage(userPrompt);
    } catch (e) {
        console.error("Lỗi khi sendMessage lần đầu:", e);
        throw e; // Ném lỗi ra controller
    }


    while (true) {
        const call = result.response.functionCalls()?.[0];

        if (!call) {
            return result.response.text();
        }

        console.log(`[AI Request] Yêu cầu gọi hàm: ${call.name}`);
        
        const tool = availableTools[call.name];
        if (!tool) {
            console.error(`Tool ${call.name} không tồn tại.`);
            // Trả về lỗi cho AI
            result = await chat.sendMessage(
                JSON.stringify({
                    functionResponse: {
                        name: call.name,
                        response: { error: `Tool ${call.name} không tồn tại.` }
                    }
                })
            );
            continue; // Tiếp tục vòng lặp
        }

        let toolResult;
        try {
             // 2. Thực thi hàm
            toolResult = await tool(call.args);
        } catch(e) {
            console.error(`Lỗi khi thực thi tool ${call.name}:`, e);
            toolResult = { error: e.message };
        }

        try {
            // 3. Gửi kết quả lại cho AI
            result = await chat.sendMessage(
                JSON.stringify({
                    functionResponse: {
                        name: call.name,
                        response: toolResult
                    }
                })
            );
        } catch (e) {
            console.error("Lỗi khi sendMessage (gửi kết quả tool):", e);
            throw e; // Ném lỗi ra controller
        }
    }
};

module.exports = {
    runChatWithTools
};