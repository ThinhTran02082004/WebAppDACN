#!/usr/bin/env bash
set -e

# 1️⃣ Build frontend
cd client
npm install
npm run build
cd ..

# 2️⃣ Cài đặt backend
cd server
npm install

# 3️⃣ Chạy server
npm start
