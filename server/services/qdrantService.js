// const { QdrantClient } = require("@qdrant/js-client-rest");
// const { getEmbedding } = require("./embeddingService");
// const { v4: uuidv4 } = require('uuid');

// // 1. Cấu hình Qdrant
// // Cho phép chạy local mặc định nếu không cấu hình biến môi trường
// let QDRANT_URL = (process.env.QDRANT_URL || 'http://localhost:6333').trim();
// const QDRANT_API_KEY = process.env.QDRANT_API_KEY; // (Nếu có)

// // Loại bỏ dấu nháy ở hai đầu, dù chỉ có một phía
// QDRANT_URL = QDRANT_URL.replace(/^['"]+|['"]+$/g, '').trim();

// // Đảm bảo URL hợp lệ và có protocol
// if (!/^https?:\/\//i.test(QDRANT_URL)) {
//   QDRANT_URL = `http://${QDRANT_URL}`;
// }

// // Kiểm tra cuối cùng để tránh URL lỗi dạng bắt đầu bằng ký tự lạ
// if (!/^https?:\/\/[\w.-]+(?::\d+)?/i.test(QDRANT_URL)) {
//   throw new Error(`QDRANT_URL không hợp lệ: "${QDRANT_URL}". Hãy đặt ví dụ: http://localhost:6333 hoặc https://<host>`);
// }
// const COLLECTION_NAME = "irrelevant_questions"; // Tên collection trên Qdrant

// // 2. Khởi tạo Client
// const qdrantClient = new QdrantClient({
//   url: QDRANT_URL,
//   apiKey: QDRANT_API_KEY,
// });

// // 3. (Chạy một lần) Hàm tạo Collection
// // Qdrant yêu cầu bạn định nghĩa collection trước
// const initializeCollection = async () => {
//   try {
//     const collections = await qdrantClient.getCollections();
//     const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

//     if (!collectionExists) {
//       console.log(`Đang tạo collection: ${COLLECTION_NAME}...`);
//       await qdrantClient.recreateCollection(COLLECTION_NAME, {
//         vectors: {
//           size: 768, // Kích thước của 'text-embedding-004'
//           distance: "Cosine", // Phương pháp đo lường
//         },
//       });
//       console.log("Tạo collection thành công!");
//     } else {
//       console.log("Qdrant collection đã tồn tại.");
//     }
//   } catch (error) {
//     console.error("Lỗi khi khởi tạo Qdrant collection:", error);
//     throw error;
//   }
// };

// // 4. Hàm thêm câu hỏi (dùng cho script Seeding)
// const addQuestionsToQdrant = async (questions = []) => {
//   console.log(`Bắt đầu thêm ${questions.length} câu hỏi vào Qdrant...`);
//   let points = [];

//   for (const q of questions) {
//     const vector = await getEmbedding(q);
//     points.push({
//       id: uuidv4(), // Qdrant cần một ID duy nhất
//       vector: vector,
//       payload: { text: q } // Dữ liệu đi kèm (để debug)
//     });
//   }

//   await qdrantClient.upsert(COLLECTION_NAME, {
//     wait: true, // Chờ đến khi xử lý xong
//     points: points,
//   });
//   console.log("Thêm câu hỏi vào Qdrant thành công!");
// };

// /**
//  * 5. Hàm kiểm tra "lạc đề" (Detection)
//  * @param {string} userPrompt - Câu hỏi của người dùng
//  * @returns {Promise<boolean>} - True nếu lạc đề, False nếu OK
//  */
// const isIrrelevant = async (userPrompt) => {
//   try {
//     // 1. Biến câu hỏi của user thành vector
//     const userVector = await getEmbedding(userPrompt);

//     // 2. Ngưỡng "lụm" (0.8 = tương đồng 80%)
//     const SIMILARITY_THRESHOLD = 0.8;

//     // 3. Tìm kiếm trên Qdrant
//     const searchResult = await qdrantClient.search(COLLECTION_NAME, {
//       vector: userVector,
//       limit: 1, // Chỉ cần kết quả giống nhất
//       with_payload: true, // Lấy cả 'text'
//       score_threshold: SIMILARITY_THRESHOLD, // Qdrant tự lọc theo ngưỡng
//     });

//     if (searchResult.length > 0) {
//       const topMatch = searchResult[0];
//       console.log(`[Qdrant Filter] Giống: "${topMatch.payload.text}" (Score: ${topMatch.score})`);
//       return true; // LẠC ĐỀ (Đã "lụm")
//     }

//     // 4. Nếu không có gì > ngưỡng
//     return false; // HỢP LỆ

//   } catch (error) {
//     console.error("Lỗi khi Qdrant search:", error);
//     return false; // Lỗi thì cho qua
//   }
// };

// module.exports = {
//   isIrrelevant,
//   initializeCollection,
//   addQuestionsToQdrant
// };


const { QdrantClient } = require("@qdrant/js-client-rest");
const { getEmbedding } = require("./embeddingService");
const { v4: uuidv4 } = require('uuid');

// 1. Cấu hình Qdrant
let QDRANT_URL = (process.env.QDRANT_URL || 'http://localhost:6333').trim();
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

// Loại bỏ dấu nháy ở hai đầu (nếu có)
QDRANT_URL = QDRANT_URL.replace(/^['"]+|['"]+$/g, '').trim();

// Đảm bảo URL có protocol hợp lệ
if (!/^https?:\/\//i.test(QDRANT_URL)) {
  QDRANT_URL = `http://${QDRANT_URL}`;
}

// console.log(`[Qdrant] Using URL: ${QDRANT_URL}`);

// Tên 3 collection của chúng ta
const SPAM_COLLECTION = "irrelevant_questions";
const CACHE_COLLECTION = "common_answers";
const MAPPER_COLLECTION = "specialty_mapper";
const MEDICAL_COLLECTION = "medical_knowledge";

// 2. Khởi tạo Client
const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

// 3. Hàm tạo Collection (sẽ tạo cả 2)
const initializeCollections = async () => {
  try {
    const collections = await qdrantClient.getCollections();
    const collectionNames = collections.collections.map(c => c.name);

    const vectorConfig = {
      vectors: { size: 768, distance: "Cosine" },
    };

    if (!collectionNames.includes(SPAM_COLLECTION)) {
      console.log(`Đang tạo collection (Lạc đề): ${SPAM_COLLECTION}...`);
      await qdrantClient.recreateCollection(SPAM_COLLECTION, vectorConfig);
      console.log("Tạo collection (Lạc đề) thành công!");
    }

    if (!collectionNames.includes(CACHE_COLLECTION)) {
      console.log(`Đang tạo collection (Bộ đệm): ${CACHE_COLLECTION}...`);
      await qdrantClient.recreateCollection(CACHE_COLLECTION, vectorConfig);
      console.log("Tạo collection (Bộ đệm) thành công!");
    }

    if (!collectionNames.includes(MAPPER_COLLECTION)) {
      console.log(`Đang tạo collection (Bộ ánh xạ chuyên khoa): ${MAPPER_COLLECTION}...`);
      await qdrantClient.recreateCollection(MAPPER_COLLECTION, vectorConfig);
      console.log("Tạo collection (Bộ ánh xạ chuyên khoa) thành công!");
    }
    
    if (!collectionNames.includes(MEDICAL_COLLECTION)) {
      console.log(`Đang tạo collection (Kiến thức y khoa): ${MEDICAL_COLLECTION}...`);
      await qdrantClient.recreateCollection(MEDICAL_COLLECTION, vectorConfig);
      console.log("Tạo collection (Kiến thức y khoa) thành công!");
    }
    
    console.log("Qdrant collections đã sẵn sàng.");
  } catch (error) {
    console.error("Lỗi khi khởi tạo Qdrant collection:", error);
    throw error; // Ném lỗi để dừng script seeding nếu có lỗi
  }
};

// 4. Hàm thêm câu hỏi (dùng cho script Seeding)
const addQuestionsToQdrant = async (questions = []) => {
  console.log(`Bắt đầu thêm ${questions.length} câu hỏi (lạc đề) vào Qdrant...`);
  let points = [];

  for (const q of questions) {
    const vector = await getEmbedding(q);
    points.push({
      id: uuidv4(),
      vector: vector,
      payload: { text: q } 
    });
  }

  await qdrantClient.upsert(SPAM_COLLECTION, {
    wait: true,
    points: points,
  });
  console.log("Thêm câu hỏi (lạc đề) vào Qdrant thành công!");
};

/**
 * 5. LỚP 1: Kiểm tra "lạc đề" (Detection)
 * @returns {Promise<boolean>} - True nếu lạc đề, False nếu OK
 */
const isIrrelevant = async (userPrompt) => {
  try {
    const userVector = await getEmbedding(userPrompt);
    const SIMILARITY_THRESHOLD = 0.95;

    const searchResult = await qdrantClient.search(SPAM_COLLECTION, {
      vector: userVector,
      limit: 1,
      with_payload: true,
      score_threshold: SIMILARITY_THRESHOLD, 
    });

    if (searchResult.length > 0) {
      console.log(`[Qdrant Filter] LẠC ĐỀ: "${userPrompt}" (Giống: "${searchResult[0].payload.text}", Score: ${searchResult[0].score})`);
      return true; // LẠC ĐỀ
    }
    return false; // HỢP LỆ
  } catch (error) {
    console.error("Lỗi khi Qdrant (lọc lạc đề):", error);
    return false; 
  }
};

/**
 * Kiểm tra xem câu trả lời có chứa thông tin cụ thể về lịch hẹn, đơn thuốc, hoặc thông tin cá nhân không
 * @param {string} aiResponse - Câu trả lời của AI
 * @returns {boolean} - True nếu có thông tin cụ thể
 */
const hasSpecificAppointmentInfo = (aiResponse) => {
  if (!aiResponse) return false;
  
  const lowerResponse = aiResponse.toLowerCase();
  
  // Kiểm tra có bookingCode (format: APT-XXXXX, ví dụ: APT-OTH3WP63)
  if (/apt-[a-z0-9]{6,10}/i.test(aiResponse)) {
    return true;
  }
  
  // Kiểm tra có ngày cụ thể (format: dd/mm/yyyy hoặc dd-mm-yyyy)
  if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(aiResponse)) {
    return true;
  }
  
  // Kiểm tra có mã slot (L01, L02, L1, L2, ...) - đây là thông tin cụ thể về lịch hẹn
  // Pattern: L + số (có thể có số 0 đứng trước) + có thể kèm theo giờ
  if (/l\s*0?\d{1,2}/i.test(aiResponse)) {
    // Nếu có slot kèm theo giờ hoặc từ khóa liên quan đến lịch hẹn
    const hasTime = /\d{1,2}\s*(h|giờ|:)/i.test(aiResponse);
    const hasBookingKeywords = lowerResponse.includes('có') || 
                               lowerResponse.includes('còn') || 
                               lowerResponse.includes('slot') ||
                               lowerResponse.includes('khung giờ') ||
                               lowerResponse.includes('lịch hẹn');
    
    if (hasTime || hasBookingKeywords) {
      return true;
    }
  }
  
  // Kiểm tra có giờ cụ thể (format: HH:MM hoặc Xh, X giờ)
  if (/\d{1,2}:\d{2}/.test(aiResponse) || /\d{1,2}\s*(h|giờ)/i.test(aiResponse)) {
    // Kiểm tra có kèm theo từ khóa liên quan đến lịch hẹn
    if (lowerResponse.includes('mã đặt lịch') || 
        lowerResponse.includes('bác sĩ') || 
        lowerResponse.includes('bệnh viện') ||
        lowerResponse.includes('bookingcode') ||
        lowerResponse.includes('mai') ||
        lowerResponse.includes('ngày mai') ||
        lowerResponse.includes('hôm nay') ||
        lowerResponse.includes('có l') ||
        lowerResponse.includes('còn l') ||
        lowerResponse.includes('slot')) {
      return true;
    }
  }
  
  // Kiểm tra các từ khóa về thời gian cụ thể kèm theo thông tin lịch hẹn
  const timeKeywords = ['mai', 'ngày mai', 'hôm nay', 'ngày \d+', 'thứ \d+'];
  const appointmentKeywords = ['có l', 'còn l', 'slot', 'khung giờ', 'lịch hẹn', 'đặt lịch'];
  
  for (const timeKeyword of timeKeywords) {
    if (new RegExp(timeKeyword, 'i').test(aiResponse)) {
      for (const apptKeyword of appointmentKeywords) {
        if (lowerResponse.includes(apptKeyword)) {
          return true;
        }
      }
    }
  }
  
  // Kiểm tra thông tin về đơn thuốc (prescription)
  const prescriptionKeywords = [
    'đơn thuốc', 'toa thuốc', 'thuốc', 'prescription',
    'đã kê', 'kê đơn', 'mã đơn', 'đơn số'
  ];
  for (const keyword of prescriptionKeywords) {
    if (lowerResponse.includes(keyword)) {
      // Nếu có mã đơn thuốc hoặc tên thuốc cụ thể
      if (/đơn\s*(số|#)?\s*\d+/i.test(aiResponse) || 
          /mã\s*đơn\s*:?\s*[a-z0-9]+/i.test(aiResponse) ||
          /\d+\s*(viên|vi|tablet|mg|ml)/i.test(aiResponse)) {
        return true;
      }
    }
  }
  
  // Kiểm tra thông tin về hủy lịch/đổi lịch
  const cancelChangeKeywords = [
    'đã hủy', 'hủy thành công', 'hủy lịch', 'cancel',
    'đã đổi', 'đổi thành công', 'đổi lịch', 'reschedule',
    'thay đổi lịch', 'chuyển lịch'
  ];
  for (const keyword of cancelChangeKeywords) {
    if (lowerResponse.includes(keyword)) {
      // Nếu có thông tin cụ thể về lịch đã hủy/đổi
      if (/apt-[a-z0-9]{6,10}/i.test(aiResponse) ||
          /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(aiResponse) ||
          /l\s*0?\d{1,2}/i.test(aiResponse)) {
        return true;
      }
    }
  }
  
  // Kiểm tra thông tin về hồ sơ bệnh án, kết quả xét nghiệm
  const medicalRecordKeywords = [
    'hồ sơ bệnh án', 'bệnh án', 'kết quả xét nghiệm', 'xét nghiệm',
    'kết quả khám', 'chẩn đoán', 'diagnosis', 'medical record'
  ];
  for (const keyword of medicalRecordKeywords) {
    if (lowerResponse.includes(keyword)) {
      // Nếu có mã bệnh án hoặc ngày cụ thể
      if (/mã\s*(bệnh án|hồ sơ)\s*:?\s*[a-z0-9]+/i.test(aiResponse) ||
          /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(aiResponse)) {
        return true;
      }
    }
  }
  
  // Kiểm tra thông tin về thanh toán, hóa đơn
  const paymentKeywords = [
    'hóa đơn', 'bill', 'thanh toán', 'payment', 'mã thanh toán',
    'số tiền', 'tổng cộng', 'vnd', 'đồng'
  ];
  for (const keyword of paymentKeywords) {
    if (lowerResponse.includes(keyword)) {
      // Nếu có số tiền cụ thể hoặc mã hóa đơn
      if (/\d+[.,]\d+\s*(vnd|đồng|vnđ)/i.test(aiResponse) ||
          /mã\s*(hóa đơn|thanh toán)\s*:?\s*[a-z0-9]+/i.test(aiResponse) ||
          /bill\s*#?\s*[a-z0-9]+/i.test(aiResponse)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
  * Kiểm tra xem prompt có phải là câu trả lời ngắn/xác nhận hoặc câu lệnh đặt lịch không
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @returns {boolean} - True nếu là câu trả lời ngắn hoặc câu lệnh đặt lịch
 */
const isShortConfirmation = (userPrompt) => {
  if (!userPrompt) return false;
  
  const trimmed = userPrompt.trim().toLowerCase();
  const shortConfirmations = [
    'ok', 'okay', 'đúng', 'đúng rồi', 'đúng vậy', 'chắc chắn', 'có', 'yes', 
    'yep', 'yeah', 'đồng ý', 'tôi đồng ý', 'tôi chọn', 'chọn'
  ];
  
  // Kiểm tra có chứa mã slot (L01, L02, L1, L2, v.v.) - đây là câu lệnh đặt lịch
  // Pattern: L + số (có thể có số 0 đứng trước)
  if (/l\s*0?\d{1,2}/i.test(trimmed)) {
    console.log(`[Qdrant Cache] Nhận diện câu lệnh đặt lịch: "${userPrompt}"`);
    return true;
  }
  
  // Kiểm tra các từ khóa đặt lịch
  const bookingKeywords = [
    'chọn l', 'chọn cho tôi l', 'tôi chọn l', 'đặt l', 'book l',
    'lựa chọn l', 'muốn l', 'lấy l'
  ];
  for (const keyword of bookingKeywords) {
    if (trimmed.includes(keyword) && /l\s*0?\d{1,2}/i.test(trimmed)) {
      console.log(`[Qdrant Cache] Nhận diện câu lệnh đặt lịch với từ khóa "${keyword}": "${userPrompt}"`);
      return true;
    }
  }
  
  // Nếu prompt ngắn hơn 10 ký tự và là một trong các từ xác nhận
  if (trimmed.length <= 10 && shortConfirmations.includes(trimmed)) {
    return true;
  }
  
  return false;
};

/**
 * Kiểm tra xem câu hỏi có liên quan đến đặt lịch/khám bệnh/hủy lịch/đổi lịch/đơn thuốc không
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @returns {boolean} - True nếu liên quan đến thông tin cá nhân
 */
const isAppointmentRelated = (userPrompt) => {
  if (!userPrompt) return false;
  
  const lowerPrompt = userPrompt.toLowerCase();
  
  // Từ khóa về đặt lịch/khám bệnh
  const appointmentKeywords = [
    'đặt lịch', 'đặt hẹn', 'khám', 'khám bệnh', 'lịch hẹn',
    'ngày mai', 'mai', 'hôm nay', 'ngày \d+', 'thứ \d+',
    'giờ', 'khung giờ', 'slot', 'l01', 'l02', 'l1', 'l2',
    'lịch của tôi', 'lịch khám của tôi'
  ];
  
  for (const keyword of appointmentKeywords) {
    if (new RegExp(keyword, 'i').test(userPrompt)) {
      return true;
    }
  }
  
  // Từ khóa về hủy lịch
  const cancelKeywords = [
    'hủy lịch', 'hủy hẹn', 'cancel', 'hủy đặt lịch',
    'hủy lịch khám', 'hủy cuộc hẹn', 'xóa lịch'
  ];
  for (const keyword of cancelKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return true;
    }
  }
  
  // Từ khóa về đổi lịch
  const changeKeywords = [
    'đổi lịch', 'đổi hẹn', 'reschedule', 'thay đổi lịch',
    'chuyển lịch', 'dời lịch', 'đổi lịch khám', 'đổi cuộc hẹn'
  ];
  for (const keyword of changeKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return true;
    }
  }
  
  // Từ khóa về đơn thuốc
  const prescriptionKeywords = [
    'đơn thuốc', 'toa thuốc', 'thuốc của tôi', 'prescription',
    'đơn thuốc của tôi', 'toa thuốc của tôi', 'xem đơn thuốc',
    'lịch sử đơn thuốc', 'đơn thuốc gần đây'
  ];
  for (const keyword of prescriptionKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return true;
    }
  }
  
  // Từ khóa về hồ sơ bệnh án
  const medicalRecordKeywords = [
    'hồ sơ bệnh án', 'bệnh án của tôi', 'kết quả xét nghiệm',
    'kết quả khám', 'chẩn đoán', 'medical record', 'hồ sơ y tế'
  ];
  for (const keyword of medicalRecordKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return true;
    }
  }
  
  // Từ khóa về thanh toán/hóa đơn
  const paymentKeywords = [
    'hóa đơn của tôi', 'thanh toán của tôi', 'bill', 'payment',
    'lịch sử thanh toán', 'hóa đơn gần đây'
  ];
  for (const keyword of paymentKeywords) {
    if (lowerPrompt.includes(keyword)) {
      return true;
    }
  }
  
  return false;
};

/**
 * 6. LỚP 2: Tìm câu trả lời trong cache
 * @returns {Promise<string|null>} - Trả về câu trả lời nếu tìm thấy, ngược lại null
 */
const findCachedAnswer = async (userPrompt) => {
  try {
    // KHÔNG cache cho các câu trả lời ngắn/xác nhận (có thể là trong flow đặt lịch)
    if (isShortConfirmation(userPrompt)) {
      console.log(`[Qdrant Cache] BỎ QUA CACHE cho câu trả lời ngắn/xác nhận: "${userPrompt}"`);
      return null;
    }
    
    // Nếu câu hỏi liên quan đến đặt lịch, không dùng cache (vì mỗi người có lịch khác nhau)
    if (isAppointmentRelated(userPrompt)) {
      console.log(`[Qdrant Cache] BỎ QUA CACHE vì câu hỏi liên quan đến đặt lịch: "${userPrompt}"`);
      return null;
    }
    
    const userVector = await getEmbedding(userPrompt);
    const SIMILARITY_THRESHOLD = 0.95; // Ngưỡng cache (phải cao hơn, gần như giống hệt)

    const searchResult = await qdrantClient.search(CACHE_COLLECTION, {
      vector: userVector,
      limit: 1,
      with_payload: true,
      score_threshold: SIMILARITY_THRESHOLD,
    });

    if (searchResult.length > 0) {
      const cachedResponse = searchResult[0].payload.aiResponse;
      
      // KIỂM TRA: Nếu câu trả lời cache có thông tin cụ thể về lịch hẹn, KHÔNG trả về
      if (hasSpecificAppointmentInfo(cachedResponse)) {
        console.log(`[Qdrant Cache] BỎ QUA CACHE vì có thông tin cụ thể về lịch hẹn: "${userPrompt}"`);
        return null;
      }
      
      console.log(`[Qdrant Cache] TRÚNG CACHE: "${userPrompt}" (Score: ${searchResult[0].score})`);
      return cachedResponse; // Trả về câu trả lời đã lưu
    }
    return null; // KHÔNG CÓ TRONG CACHE
  } catch (error) {
    console.error("Lỗi khi Qdrant (tìm cache):", error);
    return null;
  }
};

/**
 * 7. LỚP 2: Lưu câu trả lời mới vào cache
 */
const cacheAnswer = async (userPrompt, aiResponse) => {
  try {
    // KHÔNG cache nếu:
    // 1. Câu trả lời có thông tin cụ thể về:
    //    - Lịch hẹn (bookingCode, ngày giờ cụ thể, slot)
    //    - Đơn thuốc (mã đơn, tên thuốc cụ thể)
    //    - Hủy/đổi lịch (thông tin lịch đã hủy/đổi)
    //    - Hồ sơ bệnh án (mã bệnh án, kết quả xét nghiệm)
    //    - Thanh toán (số tiền, mã hóa đơn)
    // 2. Prompt là câu trả lời ngắn/xác nhận (có thể là trong flow đặt lịch)
    // 3. Câu hỏi liên quan đến thông tin cá nhân:
    //    - Đặt lịch, hủy lịch, đổi lịch
    //    - Đơn thuốc, hồ sơ bệnh án
    //    - Thanh toán, hóa đơn
    //    (vì mỗi người có thông tin khác nhau)
    if (hasSpecificAppointmentInfo(aiResponse)) {
      console.log(`[Qdrant Cache] KHÔNG LƯU CACHE vì có thông tin cụ thể (lịch hẹn/đơn thuốc/hủy đổi lịch/hồ sơ/thanh toán): "${userPrompt}"`);
      return;
    }
    
    if (isShortConfirmation(userPrompt)) {
      console.log(`[Qdrant Cache] KHÔNG LƯU CACHE cho câu trả lời ngắn/xác nhận: "${userPrompt}"`);
      return;
    }
    
    // Không cache nếu câu hỏi liên quan đến thông tin cá nhân (vì mỗi người có thông tin khác nhau)
    if (isAppointmentRelated(userPrompt)) {
      console.log(`[Qdrant Cache] KHÔNG LƯU CACHE vì câu hỏi liên quan đến thông tin cá nhân (lịch hẹn/hủy đổi lịch/đơn thuốc/hồ sơ/thanh toán): "${userPrompt}"`);
      return;
    }
    
    const vector = await getEmbedding(userPrompt);
    await qdrantClient.upsert(CACHE_COLLECTION, {
      wait: true,
      points: [{
        id: uuidv4(),
        vector: vector,
        payload: { userPrompt: userPrompt, aiResponse: aiResponse }
      }]
    });
    console.log(`[Qdrant Cache] Đã lưu cache cho: "${userPrompt}"`);
  } catch (error) {
    console.error("Lỗi khi Qdrant (lưu cache):", error);
  }
};

/**
 * LỚP 4: Tìm chuyên khoa từ triệu chứng (Bộ ánh xạ)
 * @param {string} symptomQuery - Triệu chứng hoặc từ khóa người dùng nhập (ví dụ: "tiêm vaccine", "đau tim")
 * @returns {Promise<{specialtyId: string, specialtyName: string} | null>}
 */
const findSpecialtyMapping = async (symptomQuery) => {
  try {
    const userVector = await getEmbedding(symptomQuery);
    const SIMILARITY_THRESHOLD = 0.8; // Ngưỡng an toàn

    const searchResult = await qdrantClient.search(MAPPER_COLLECTION, {
      vector: userVector,
      limit: 1,
      with_payload: true,
      score_threshold: SIMILARITY_THRESHOLD,
    });

    if (searchResult.length > 0) {
      const mapping = searchResult[0].payload;
      console.log(`[Qdrant Mapper] Đã map: "${symptomQuery}" -> "${mapping.specialtyName}" (Score: ${searchResult[0].score.toFixed(3)})`);
      return { 
        specialtyId: mapping.specialtyId, 
        specialtyName: mapping.specialtyName 
      };
    }
    
    console.log(`[Qdrant Mapper] Không tìm thấy mapping cho: "${symptomQuery}"`);
    return null; // Không tìm thấy
  } catch (error) {
    console.error("Lỗi khi Qdrant (tìm bộ ánh xạ):", error);
    return null;
  }
};

/**
 * Tìm kiếm kiến thức y khoa liên quan
 * @param {string} query - Triệu chứng hoặc tên bệnh
 */
const searchMedicalKnowledge = async (query) => {
  try {
    const vector = await getEmbedding(query);
    const searchResult = await qdrantClient.search(MEDICAL_COLLECTION, {
      vector: vector,
      limit: 3,
      with_payload: true,
    });
    return searchResult.map(item => item.payload.content).join("\n\n---\n\n");
  } catch (error) {
    console.error("Lỗi tìm kiếm y khoa:", error);
    return "";
  }
};

/**
 * Tìm dịch vụ từ query sử dụng vector similarity
 * @param {string} query - Từ khóa tìm kiếm dịch vụ (ví dụ: "khám tổng quát", "tiêm vaccine")
 * @param {string} specialtyId - ID chuyên khoa (optional, để filter)
 * @returns {Promise<Array>} - Danh sách services phù hợp
 */
const findServiceMapping = async (query, specialtyId = null) => {
  try {
    const SERVICE_COLLECTION = "service_mapper";
    const userVector = await getEmbedding(query);
    const SIMILARITY_THRESHOLD = 0.7; // Ngưỡng thấp hơn để tìm được nhiều kết quả

    const searchResult = await qdrantClient.search(SERVICE_COLLECTION, {
      vector: userVector,
      limit: 5, // Lấy top 5 kết quả
      with_payload: true,
      score_threshold: SIMILARITY_THRESHOLD,
    });

    if (searchResult.length === 0) {
      console.log(`[Qdrant Service Mapper] Không tìm thấy service cho: "${query}"`);
      return [];
    }

    // Filter theo specialtyId nếu có
    let filteredResults = searchResult;
    if (specialtyId) {
      filteredResults = searchResult.filter(item => 
        item.payload.specialtyId === specialtyId.toString()
      );
    }

    // Sắp xếp theo score giảm dần
    filteredResults.sort((a, b) => b.score - a.score);

    console.log(`[Qdrant Service Mapper] Tìm thấy ${filteredResults.length} services cho: "${query}"`);
    return filteredResults.map(item => ({
      serviceId: item.payload.serviceId,
      serviceName: item.payload.serviceName,
      specialtyId: item.payload.specialtyId,
      specialtyName: item.payload.specialtyName,
      score: item.score
    }));
  } catch (error) {
    console.error("Lỗi khi Qdrant (tìm service mapper):", error);
    return [];
  }
};

/**
 * Tìm bác sĩ từ query sử dụng vector similarity
 * @param {string} query - Từ khóa tìm kiếm bác sĩ (ví dụ: "bác sĩ tim mạch", "Nguyễn Văn A")
 * @param {string} specialtyId - ID chuyên khoa (optional, để filter)
 * @param {string} serviceId - ID dịch vụ (optional, để filter)
 * @returns {Promise<Array>} - Danh sách doctors phù hợp
 */
const findDoctorMapping = async (query, specialtyId = null, serviceId = null) => {
  try {
    const DOCTOR_COLLECTION = "doctor_mapper";
    const userVector = await getEmbedding(query);
    const SIMILARITY_THRESHOLD = 0.7;

    const searchResult = await qdrantClient.search(DOCTOR_COLLECTION, {
      vector: userVector,
      limit: 10, // Lấy top 10 kết quả
      with_payload: true,
      score_threshold: SIMILARITY_THRESHOLD,
    });

    if (searchResult.length === 0) {
      console.log(`[Qdrant Doctor Mapper] Không tìm thấy doctor cho: "${query}"`);
      return [];
    }

    // Filter theo specialtyId và serviceId nếu có
    let filteredResults = searchResult;
    if (specialtyId) {
      filteredResults = filteredResults.filter(item => 
        item.payload.specialtyId === specialtyId.toString()
      );
    }

    // Sắp xếp theo score giảm dần
    filteredResults.sort((a, b) => b.score - a.score);

    console.log(`[Qdrant Doctor Mapper] Tìm thấy ${filteredResults.length} doctors cho: "${query}"`);
    return filteredResults.map(item => ({
      doctorId: item.payload.doctorId,
      fullName: item.payload.fullName,
      title: item.payload.title,
      specialtyId: item.payload.specialtyId,
      specialtyName: item.payload.specialtyName,
      hospitalId: item.payload.hospitalId,
      hospitalName: item.payload.hospitalName,
      score: item.score
    }));
  } catch (error) {
    console.error("Lỗi khi Qdrant (tìm doctor mapper):", error);
    return [];
  }
};

module.exports = {
  isIrrelevant,
  findCachedAnswer,
  cacheAnswer,
  initializeCollections, // Sửa tên hàm
  addQuestionsToQdrant,
  findSpecialtyMapping,
  searchMedicalKnowledge,
  findServiceMapping,
  findDoctorMapping
};