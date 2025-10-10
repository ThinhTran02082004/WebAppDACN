# DEPLOYMENT GUIDE

## 🚀 HƯỚNG DẪN TRIỂN KHAI

---

## 📋 YÊU CẦU HỆ THỐNG

### Development
- **Node.js**: v22.14.0 trở lên
- **npm**: v10.x
- **MongoDB**: Local hoặc Atlas
- **Git**: Để clone repository

### Production
- **Server**: VPS/Cloud (AWS, DigitalOcean, Heroku)
- **RAM**: Tối thiểu 2GB
- **Storage**: Tối thiểu 10GB
- **Database**: MongoDB Atlas (khuyến nghị)
- **Domain**: Tên miền (optional)
- **SSL**: Certificate cho HTTPS

---

## 🛠️ CÀI ĐẶT LOCAL (DEVELOPMENT)

### 1. Clone Repository
```bash
git clone https://github.com/soncoderz/DACS-hospitalweb
cd DACS-hospitalweb
```

### 2. Setup Backend (Server)

#### Cài đặt dependencies
```bash
cd server
npm install
```

#### Cấu hình .env
Tạo file `.env` trong thư mục `server/`:
```env
# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hospital_db

# JWT
JWT_SECRET=your_jwt_secret_key_here_min_32_chars

# Email (Gmail)
EMAIL_USER=your.email@gmail.com
EMAIL_PASSWORD=your_app_password

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# PayPal
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret

# LiveKit
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-livekit-server.com
```

#### Chạy server
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

Server chạy tại: `http://localhost:5000`

### 3. Setup Frontend (Client)

#### Cài đặt dependencies
```bash
cd client
npm install --force
```

**Note**: Sử dụng `--force` để tránh xung đột dependencies.

#### Cấu hình .env
Tạo file `.env` trong thư mục `client/`:
```env
# API URL
VITE_API_URL=http://localhost:5000/api

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id

# Facebook OAuth
VITE_FACEBOOK_APP_ID=your_facebook_app_id

# PayPal
VITE_PAYPAL_CLIENT_ID=your_paypal_client_id

# LiveKit
VITE_LIVEKIT_URL=wss://your-livekit-server.com
```

#### Chạy client
```bash
# Development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Client chạy tại: `http://localhost:3000`

### 4. Chạy Đồng Thời (Cả Server và Client)

**Terminal 1** - Server:
```bash
cd server
npm run dev
```

**Terminal 2** - Client:
```bash
cd client
npm run dev
```

---

## 🌐 THIẾT LẬP EXTERNAL SERVICES

### 1. MongoDB Atlas

1. Truy cập: https://www.mongodb.com/cloud/atlas
2. Tạo tài khoản và cluster miễn phí
3. Tạo database user
4. Whitelist IP address (0.0.0.0/0 cho development)
5. Copy connection string và thêm vào `.env`

```
mongodb+srv://<username>:<password>@cluster.mongodb.net/hospital_db?retryWrites=true&w=majority
```

### 2. Google OAuth

1. Truy cập: https://console.cloud.google.com
2. Tạo project mới
3. Enable Google+ API
4. Tạo OAuth 2.0 credentials
5. Thêm authorized redirect URIs:
   - Development: `http://localhost:5000/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
6. Copy Client ID và Client Secret

### 3. Facebook OAuth

1. Truy cập: https://developers.facebook.com
2. Tạo app mới
3. Thêm Facebook Login product
4. Cấu hình Valid OAuth Redirect URIs:
   - `http://localhost:5000/api/auth/facebook/callback`
   - `https://yourdomain.com/api/auth/facebook/callback`
5. Copy App ID và App Secret

### 4. Gmail SMTP

1. Bật 2-Step Verification cho Gmail account
2. Tạo App Password:
   - Settings → Security → 2-Step Verification → App passwords
3. Copy app password (16 ký tự)

### 5. Cloudinary

1. Truy cập: https://cloudinary.com
2. Đăng ký tài khoản miễn phí
3. Dashboard → Account Details
4. Copy: Cloud Name, API Key, API Secret

### 6. PayPal

1. Truy cập: https://developer.paypal.com
2. Tạo Sandbox account
3. My Apps & Credentials → Create App
4. Copy Client ID và Secret
5. Production: Tạo Live credentials

### 7. LiveKit

1. Truy cập: https://livekit.io
2. Tạo project
3. Copy API Key, API Secret, và WebSocket URL

---

## 🏭 PRODUCTION DEPLOYMENT

### Option 1: Deploy lên Heroku

#### Backend (Server)

1. **Cài đặt Heroku CLI**
```bash
npm install -g heroku
heroku login
```

2. **Tạo Heroku app**
```bash
cd server
heroku create your-hospital-api
```

3. **Set environment variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your_mongodb_uri
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set EMAIL_USER=your_email
heroku config:set EMAIL_PASSWORD=your_email_password
# ... set all other env variables
```

4. **Deploy**
```bash
git push heroku main
```

5. **View logs**
```bash
heroku logs --tail
```

#### Frontend (Client)

1. **Build**
```bash
cd client
npm run build
```

2. **Deploy to Netlify/Vercel**

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

3. **Set environment variables** trên Netlify/Vercel dashboard

### Option 2: Deploy lên VPS (Ubuntu)

#### 1. Chuẩn bị VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

#### 2. Clone và Setup

```bash
# Clone repository
cd /var/www
sudo git clone https://github.com/soncoderz/DACS-hospitalweb
cd DACS-hospitalweb

# Setup backend
cd server
sudo npm install
sudo cp .env.example .env
sudo nano .env  # Edit environment variables

# Setup frontend
cd ../client
sudo npm install --force
sudo npm run build
```

#### 3. Chạy Backend với PM2

```bash
cd /var/www/DACS-hospitalweb/server

# Start with PM2
pm2 start server.js --name hospital-api

# Save PM2 configuration
pm2 save

# Auto-start on boot
pm2 startup
```

#### 4. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/hospital
```

Thêm cấu hình:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/DACS-hospitalweb/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/hospital /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Setup SSL với Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### 6. Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### Option 3: Docker Deployment

#### Dockerfile - Backend
```dockerfile
# server/Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

#### Dockerfile - Frontend
```dockerfile
# client/Dockerfile
FROM node:22-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install --force

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  backend:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
    restart: always

  frontend:
    build: ./client
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: always
```

#### Deploy
```bash
docker-compose up -d --build
```

---

## 🔒 BẢO MẬT

### 1. Environment Variables
- **KHÔNG BAO GIỜ** commit file `.env`
- Sử dụng environment variables cho sensitive data
- Khác biệt giữa dev và production configs

### 2. HTTPS
- Bắt buộc sử dụng HTTPS trong production
- Sử dụng Let's Encrypt (miễn phí) hoặc SSL certificate

### 3. Database
- Giới hạn IP access đến MongoDB
- Sử dụng strong password
- Regular backups

### 4. API Security
- Rate limiting
- CORS configuration
- Input validation
- SQL injection prevention (Mongoose tự động)

### 5. JWT
- Sử dụng strong secret key (min 32 chars)
- Set appropriate expiration time
- Refresh token strategy

---

## 🔍 MONITORING & MAINTENANCE

### 1. Logs

**PM2 Logs:**
```bash
pm2 logs hospital-api
pm2 logs --lines 100
```

**Nginx Logs:**
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 2. Database Backup

**MongoDB Atlas**: Tự động backup
**Self-hosted**:
```bash
mongodump --uri="mongodb://..." --out=/backup/$(date +%Y%m%d)
```

### 3. Performance Monitoring

- PM2 Dashboard: `pm2 monit`
- MongoDB Atlas: Built-in monitoring
- New Relic, Datadog (optional)

### 4. Updates

```bash
# Pull latest code
git pull origin main

# Update backend
cd server
npm install
pm2 restart hospital-api

# Update frontend
cd ../client
npm install --force
npm run build
```

---

## 🐛 TROUBLESHOOTING

### 1. Server không khởi động
- Kiểm tra logs: `pm2 logs`
- Kiểm tra PORT đã được sử dụng: `lsof -i :5000`
- Kiểm tra environment variables

### 2. MongoDB connection error
- Kiểm tra connection string
- Kiểm tra IP whitelist
- Kiểm tra network connectivity

### 3. OAuth không hoạt động
- Kiểm tra redirect URIs
- Kiểm tra credentials
- Kiểm tra callback URLs

### 4. Frontend không connect được Backend
- Kiểm tra CORS configuration
- Kiểm tra API URL trong .env
- Kiểm tra network request trong browser DevTools

### 5. Email không gửi được
- Kiểm tra Gmail app password
- Kiểm tra 2FA enabled
- Kiểm tra spam folder

---

## 📊 PERFORMANCE OPTIMIZATION

### Backend
- Enable gzip compression
- Database indexing
- Connection pooling
- Caching (Redis)
- CDN cho static assets

### Frontend
- Code splitting
- Lazy loading
- Image optimization
- Minimize bundle size
- Service workers

---

## 🔄 CI/CD (Optional)

### GitHub Actions

`.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to Server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/DACS-hospitalweb
          git pull
          cd server && npm install && pm2 restart hospital-api
          cd ../client && npm install --force && npm run build
```

---

## 📝 CHECKLIST TRƯỚC KHI DEPLOY

- [ ] Test tất cả tính năng locally
- [ ] Setup tất cả external services
- [ ] Cấu hình environment variables
- [ ] Enable HTTPS
- [ ] Setup monitoring
- [ ] Configure backup
- [ ] Test performance
- [ ] Security audit
- [ ] Error handling
- [ ] Logging setup
