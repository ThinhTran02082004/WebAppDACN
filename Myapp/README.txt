================================================================================
                    HƯỚNG DẪN THIẾT LẬP ỨNG DỤNG MOBILE
                         HOSPITAL WEB - MYAPP
================================================================================

Ứng dụng mobile React Native cho hệ thống quản lý bệnh viện

================================================================================
1. YÊU CẦU HỆ THỐNG
================================================================================

1.1. Phần mềm cần thiết:
    - Node.js >= 20.x (khuyến nghị: Node.js v22.14.0 trở lên)
    - npm hoặc yarn
    - Git
    - Java Development Kit (JDK) 17 hoặc cao hơn
    - Android Studio (cho phát triển Android)

1.2. Công cụ phát triển:
    - React Native CLI
    - Android SDK (cài đặt qua Android Studio)

1.3. Thiết bị/Emulator:
    - Android Emulator hoặc thiết bị Android thật

================================================================================
2. CÀI ĐẶT MÔI TRƯỜNG PHÁT TRIỂN
================================================================================

2.1. Cài đặt Node.js:
    - Tải và cài đặt Node.js từ: https://nodejs.org/
    - Kiểm tra phiên bản: node --version
    - Kiểm tra npm: npm --version

2.2. Cài đặt React Native CLI (toàn cục):
    npm install -g react-native-cli

2.3. Cài đặt Android Studio (cho Android):
    - Tải Android Studio từ: https://developer.android.com/studio
    - Cài đặt Android SDK, Android SDK Platform, và Android Virtual Device
    - Thiết lập biến môi trường ANDROID_HOME:
      * Windows: Thêm vào System Environment Variables
        ANDROID_HOME = C:\Users\<YourUsername>\AppData\Local\Android\Sdk
      * Thêm vào PATH:
        %ANDROID_HOME%\platform-tools
        %ANDROID_HOME%\tools
        %ANDROID_HOME%\tools\bin

================================================================================
3. THIẾT LẬP DỰ ÁN
================================================================================

3.1. Di chuyển vào thư mục Myapp:
    cd Myapp

3.2. Cài đặt dependencies:
    npm install

    Lưu ý: Nếu gặp lỗi xung đột, thử:
    - Xóa node_modules và package-lock.json
    - Chạy lại: npm install

================================================================================
4. CẤU HÌNH MÔI TRƯỜNG
================================================================================

4.1. Tạo file .env trong thư mục Myapp:
    Tạo file .env với nội dung:
    
    VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
    VITE_FACEBOOK_APP_ID=your_facebook_app_id_here

    Lưu ý:
    - Thay thế your_google_client_id_here bằng Google Client ID thực tế
    - Thay thế your_facebook_app_id_here bằng Facebook App ID thực tế
    - Các biến này được sử dụng cho xác thực OAuth

4.2. Cấu hình Facebook (Android):
    - Mở file: android/app/src/main/AndroidManifest.xml
    - Thêm Facebook App ID vào meta-data:
      <meta-data 
        android:name="com.facebook.sdk.ApplicationId" 
        android:value="@string/facebook_app_id"/>
    - Thêm vào strings.xml (android/app/src/main/res/values/strings.xml):
      <string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>

4.3. Cấu hình Google Sign-In:
    - File cấu hình: src/config/googleConfig.ts
    - Đảm bảo webClientId đã được cấu hình đúng

4.4. Cấu hình API Server:
    - Mặc định: API chạy tại http://localhost:5000/api
    - Có thể thay đổi trong: src/config/index.ts
    - Để kết nối với server thật qua USB:
      * Chạy: adb reverse tcp:5000 tcp:5000 (Android)
      * Hoặc sử dụng IP máy tính trong cùng mạng Wi-Fi

================================================================================
5. CHẠY ỨNG DỤNG
================================================================================

5.1. Khởi động Metro Bundler:
    npm start

    Hoặc để reset cache:
    npm run start:reset

5.2. Chạy trên Android:
    Cách 1: Chạy trực tiếp (tự động khởi động Metro Bundler):
    - npx react-native run-android
      (Lệnh này sẽ tự động khởi động Metro Bundler nếu chưa chạy)
    
    Cách 2: Chạy riêng biệt (khởi động Metro Bundler trước):
    - Terminal 1: npm start (khởi động Metro Bundler)
    - Terminal 2: npm run android (chạy ứng dụng)
    
    Cách 3: Chạy với cấu hình Facebook tự động:
    - npm run android:start

5.3. Build APK cho Android (Production):
    cd android
    ./gradlew assembleRelease
    File APK sẽ được tạo tại: android/app/build/outputs/apk/release/app-release.apk

================================================================================
6. CẤU HÌNH BỔ SUNG
================================================================================

6.1. Cấu hình Firebase (nếu sử dụng):
    - Tải file google-services.json (Android)
    - Đặt vào: android/app/google-services.json

6.2. Cấu hình LiveKit (cho video call):
    - Đảm bảo server LiveKit đã được cấu hình
    - Kiểm tra cấu hình trong các file service liên quan

6.3. Cấu hình Permissions:
    - Android: Kiểm tra android/app/src/main/AndroidManifest.xml

================================================================================
7. XỬ LÝ SỰ CỐ THÔNG THƯỜNG
================================================================================

7.1. Lỗi "Unable to resolve module":
    - Xóa node_modules: rm -rf node_modules
    - Xóa cache: npm start --reset-cache
    - Cài đặt lại: npm install

7.2. Lỗi Metro Bundler:
    - Dừng Metro Bundler (Ctrl+C)
    - Xóa cache: npm start --reset-cache
    - Khởi động lại: npm start

7.3. Lỗi Android Build:
    - Làm sạch build: cd android && ./gradlew clean
    - Xóa thư mục build: rm -rf android/app/build
    - Build lại: npm run android

7.4. Lỗi kết nối API:
    - Kiểm tra server backend đã chạy chưa
    - Kiểm tra địa chỉ IP/port trong config
    - Với Android emulator, sử dụng 10.0.2.2 thay vì localhost
    - Với thiết bị thật, sử dụng IP máy tính trong cùng mạng Wi-Fi

7.5. Lỗi OAuth (Google/Facebook):
    - Kiểm tra Client ID/App ID đã đúng chưa
    - Kiểm tra cấu hình trong AndroidManifest.xml
    - Đảm bảo SHA-1 key đã được thêm vào Google Console và Facebook App

7.6. Lỗi "SDK location not found" (Android):
    - Thiết lập ANDROID_HOME trong biến môi trường
    - Tạo file local.properties trong android/ với nội dung:
      sdk.dir=C:\\Users\\<YourUsername>\\AppData\\Local\\Android\\Sdk

================================================================================
8. CẤU TRÚC THƯ MỤC
================================================================================

Myapp/
├── android/              # Mã nguồn Android native
├── src/
│   ├── components/       # Các component React Native
│   ├── config/          # File cấu hình (API, OAuth, etc.)
│   ├── contexts/        # React Context providers
│   ├── navigation/      # Cấu hình navigation
│   ├── screens/         # Các màn hình của ứng dụng
│   ├── services/        # Các service (API calls, etc.)
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Các utility functions
├── app.json             # Cấu hình ứng dụng
├── package.json         # Dependencies và scripts
└── tsconfig.json        # Cấu hình TypeScript

================================================================================
9. SCRIPTS CÓ SẴN
================================================================================

- npm start              : Khởi động Metro Bundler
- npm run start:reset    : Khởi động Metro với reset cache
- npm run android        : Chạy ứng dụng trên Android
- npm run android:start  : Chạy Android với cấu hình Facebook tự động
- npm run lint           : Kiểm tra lỗi code
- npm test               : Chạy tests
- npm run update-facebook-config : Cập nhật cấu hình Facebook

================================================================================
10. TÀI KHOẢN TEST
================================================================================

Tài khoản người dùng:
- Email: user1@example.com
- Password: HospitalApp@123

Tài khoản bác sĩ:
- Email: doctor.a@example.com
         doctor.b@example.com
         doctor.c@example.com
         doctor.d@example.com
- Password: HospitalApp@123

Hoặc sử dụng đăng nhập OAuth (Google/Facebook)

================================================================================
11. LIÊN KẾT VỚI SERVER BACKEND
================================================================================

Đảm bảo server backend đã được khởi động:
- Di chuyển vào thư mục server: cd ../server
- Cài đặt dependencies: npm install
- Khởi động server: npm run dev
- Server sẽ chạy tại: http://localhost:5000

Để kết nối từ Android emulator:
- Sử dụng: http://10.0.2.2:5000/api

Để kết nối từ thiết bị thật:
- Kết nối qua dây USB:
  * Kết nối thiết bị Android với máy tính qua dây USB
  * Bật chế độ USB Debugging trên thiết bị
  * Chạy lệnh: adb reverse tcp:5000 tcp:5000
  * Ứng dụng sẽ kết nối đến: http://localhost:5000/api
- Hoặc kết nối qua Wi-Fi:
  * Sử dụng IP máy tính trong cùng mạng Wi-Fi
  * Ví dụ: http://192.168.1.100:5000/api

================================================================================
12. HỖ TRỢ VÀ TÀI LIỆU
================================================================================

- React Native Documentation: https://reactnative.dev/docs/getting-started
- React Navigation: https://reactnavigation.org/
- TypeScript: https://www.typescriptlang.org/docs/

================================================================================
                        CHÚC BẠN PHÁT TRIỂN THÀNH CÔNG!
================================================================================

