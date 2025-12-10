# Cron Mapping Service

Service cron độc lập chuyên seed dữ liệu specialty/service/doctor mappings lên Qdrant.

## Cấu trúc
- `index.js`: khởi động cron (mặc định chạy seed specialty lúc 02:00).
- `utils/cron.js`: định nghĩa cron jobs.
- `scripts/seedSpecialtyMapper.js`: script seed (hỗ trợ `specialty`, `service`, `doctor`, `all`).
- `scripts/specialtyMappings.json`: nguồn mapping fallback.
- `models/`: các model Mongo cần cho seed.
- `services/embeddingService.js`: tạo embedding bằng Gemini.
- `config/database.js`: kết nối Mongo.

## Cấu hình môi trường
Tạo file `.env` (tham khảo `.env.example`):
```
MONGODB_URI=mongodb://localhost:27017/hospitalweb
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
GEMINI_API_KEY=your_gemini_key
```

## Cài đặt & chạy
```bash
npm install
npm run seed:specialty   # seed specialty mappings thủ công
npm run seed:service     # seed services
npm run seed:doctor      # seed doctors
npm start                # khởi động cron (seed specialty mỗi ngày 02:00)
```

## Lưu ý
- Dùng chung DB với backend sẽ cập nhật dữ liệu trực tiếp; tránh chạy trùng cron ở backend cũ nếu không muốn seed 2 lần.
- Script yêu cầu Qdrant đang chạy và có quyền truy cập qua `QDRANT_URL`/`QDRANT_API_KEY`.

