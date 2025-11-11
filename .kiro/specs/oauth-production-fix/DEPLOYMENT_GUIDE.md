# OAuth Production Deployment Guide

## Bước 1: Cập nhật Environment Variables trên Railway

1. Truy cập Railway dashboard: https://railway.app
2. Chọn project backend của bạn
3. Vào tab **Variables**
4. Cập nhật hoặc thêm biến:
   ```
   FRONTEND_URL=https://dacs-hospitalweb.vercel.app
   ```
5. Click **Save** - Railway sẽ tự động redeploy

## Bước 2: Deploy Frontend lên Vercel

### Option A: Deploy qua Vercel CLI

```bash
# Cài đặt Vercel CLI (nếu chưa có)
npm install -g vercel

# Di chuyển vào thư mục client
cd client

# Deploy lên production
vercel --prod
```

### Option B: Deploy qua Vercel Dashboard

1. Truy cập: https://vercel.com
2. Chọn project **dacs-hospitalweb**
3. Vào tab **Deployments**
4. Click **Redeploy** để deploy lại với file `vercel.json` mới

### Option C: Push lên Git (Nếu đã connect với Git)

```bash
# Commit changes
git add client/vercel.json server/.env
git commit -m "fix: Add Vercel rewrites for OAuth callback routing"

# Push to main branch
git push origin main
```

Vercel sẽ tự động detect và deploy.

## Bước 3: Verify Vercel Configuration

1. Sau khi deploy xong, vào Vercel dashboard
2. Chọn project → **Settings** → **Rewrites**
3. Kiểm tra có rule: `/*` → `/index.html`

## Bước 4: Test OAuth Flow

### Test Google Login

1. Truy cập: https://dacs-hospitalweb.vercel.app
2. Click **Đăng nhập với Google**
3. Chọn tài khoản Google
4. **Expected Result:**
   - Redirect về `/auth/social-callback` (không còn 404)
   - Hiển thị loading spinner
   - Toast notification: "Đăng nhập Google thành công!"
   - Redirect về dashboard hoặc home page

### Test Facebook Login

1. Truy cập: https://dacs-hospitalweb.vercel.app
2. Click **Đăng nhập với Facebook**
3. Chọn tài khoản Facebook
4. **Expected Result:**
   - Redirect về `/auth/social-callback` (không còn 404)
   - Hiển thị loading spinner
   - Toast notification: "Đăng nhập Facebook thành công!"
   - Redirect về dashboard hoặc home page

## Bước 5: Debug (Nếu vẫn có lỗi)

### Check Railway Logs

```bash
# Xem logs trên Railway dashboard
# Hoặc dùng Railway CLI
railway logs
```

**Tìm kiếm:**
- `Social login successful for user: [email]`
- `Redirecting to: https://dacs-hospitalweb.vercel.app/auth/social-callback`

### Check Browser Console

1. Mở DevTools (F12)
2. Vào tab **Console**
3. **Tìm kiếm:**
   - `Đăng nhập thành công với dữ liệu:`
   - `needPassword:`
   - Errors (màu đỏ)

### Check Network Tab

1. Mở DevTools (F12)
2. Vào tab **Network**
3. Click OAuth login
4. **Kiểm tra:**
   - Request đến `/api/auth/google` hoặc `/api/auth/facebook`
   - Response status: 302 (redirect)
   - Redirect location: `https://dacs-hospitalweb.vercel.app/auth/social-callback?data=...`
   - Final request: `/auth/social-callback` → Status 200 (không còn 404)

## Bước 6: Test Direct URL Access

1. Truy cập trực tiếp: https://dacs-hospitalweb.vercel.app/auth/social-callback
2. **Expected Result:**
   - Không còn 404
   - Hiển thị React app
   - Có thể thấy error message: "Không nhận được dữ liệu người dùng từ máy chủ" (đây là bình thường vì không có data parameter)

## Troubleshooting

### Vẫn bị 404

**Nguyên nhân có thể:**
1. Vercel chưa deploy file `vercel.json`
2. Cache của Vercel

**Giải pháp:**
```bash
# Clear cache và redeploy
vercel --prod --force
```

### CORS Error

**Nguyên nhân:** Railway backend chưa allow Vercel domain

**Giải pháp:** Check file `server/server.js` hoặc `server/index.js`:
```javascript
const cors = require('cors');
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

### Token Invalid

**Nguyên nhân:** JWT_SECRET khác nhau giữa local và production

**Giải pháp:** Verify Railway environment variables có `JWT_SECRET`

## Success Indicators

✅ Không còn lỗi 404 khi redirect về `/auth/social-callback`
✅ Toast notification hiển thị thành công
✅ User được redirect về dashboard/home
✅ User data được lưu vào localStorage
✅ Navbar hiển thị user info (avatar, name)

## Notes

- File `vercel.json` chỉ cần deploy một lần
- Mỗi lần update backend URL, cần redeploy Railway
- OAuth credentials (Google/Facebook) không cần thay đổi
- Test trên incognito mode để tránh cache
