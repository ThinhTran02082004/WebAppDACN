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
 * Kiểm tra xem câu trả lời có chứa thông tin cụ thể về lịch hẹn không
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
  
  // Kiểm tra có giờ cụ thể (format: HH:MM)
  if (/\d{1,2}:\d{2}/.test(aiResponse)) {
    // Nhưng chỉ coi là cụ thể nếu có kèm theo "mã đặt lịch" hoặc "bác sĩ" hoặc "bệnh viện"
    if (lowerResponse.includes('mã đặt lịch') || 
        lowerResponse.includes('bác sĩ') || 
        lowerResponse.includes('bệnh viện') ||
        lowerResponse.includes('bookingcode')) {
      return true;
    }
  }
  
  return false;
};

/**
 * Kiểm tra xem prompt có phải là câu trả lời ngắn/xác nhận không
 * @param {string} userPrompt - Câu hỏi của người dùng
 * @returns {boolean} - True nếu là câu trả lời ngắn
 */
const isShortConfirmation = (userPrompt) => {
  if (!userPrompt) return false;
  
  const trimmed = userPrompt.trim().toLowerCase();
  const shortConfirmations = [
    'ok', 'okay', 'đúng', 'đúng rồi', 'đúng vậy', 'chắc chắn', 'có', 'yes', 
    'yep', 'yeah', 'đồng ý', 'tôi đồng ý', 'tôi chọn', 'chọn', 'l1', 'l2', 
    'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10'
  ];
  
  // Nếu prompt ngắn hơn 10 ký tự và là một trong các từ xác nhận
  if (trimmed.length <= 10 && shortConfirmations.includes(trimmed)) {
    return true;
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
    // 1. Câu trả lời có thông tin cụ thể về lịch hẹn (bookingCode, ngày giờ cụ thể)
    // 2. Prompt là câu trả lời ngắn/xác nhận (có thể là trong flow đặt lịch)
    if (hasSpecificAppointmentInfo(aiResponse)) {
      console.log(`[Qdrant Cache] KHÔNG LƯU CACHE vì có thông tin cụ thể về lịch hẹn: "${userPrompt}"`);
      return;
    }
    
    if (isShortConfirmation(userPrompt)) {
      console.log(`[Qdrant Cache] KHÔNG LƯU CACHE cho câu trả lời ngắn/xác nhận: "${userPrompt}"`);
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

module.exports = {
  isIrrelevant,
  findCachedAnswer,
  cacheAnswer,
  initializeCollections, // Sửa tên hàm
  addQuestionsToQdrant,
  findSpecialtyMapping // Export hàm mới
};