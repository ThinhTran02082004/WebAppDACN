# AI Chatbot Service

Service AI (Gemini) tách biệt để có thể bật/tắt độc lập với web/backend chính.

## Cấu hình môi trường
Tạo file `.env` (tham khảo các biến dưới):
- `PORT=4001`
- `MONGODB_URI=...` (có thể dùng chung DB với backend)
- `JWT_SECRET=...` (dùng để xác thực người dùng nếu cần)
- `OPENAI_API_KEY` (nếu dùng fallback)
- `GEMINI_API_KEY` (bắt buộc cho AI/embedding)
- `QDRANT_URL`, `QDRANT_API_KEY` (cache/semantic search)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (nếu upload media)

## Cài đặt & chạy
```bash
cd ai-chatbot
npm install
npm run dev   # hoặc npm start
```
API:
- `POST /api/ai/gemini-chat`
- `GET /api/ai/chat-history`
- `GET /api/chat/*` (chat realtime qua REST, có auth)

## Lưu ý
- Nếu không muốn bật chat media/cloudinary, có thể tạm tắt route upload-media hoặc bỏ Cloudinary env.
- Khi deploy riêng, frontend cần trỏ tới domain của service này cho các route `/api/ai` và `/api/chat`.

