# Hướng dẫn khắc phục lỗi "Unable to load script"

## Giải pháp 1: Xóa cache và build lại

```powershell
# Terminal 1: Khởi động Metro bundler
cd Myapp
npx react-native start --reset-cache

# Terminal 2: Chạy app trên Android
cd Myapp
npx react-native run-android
```

## Giải pháp 2: Xóa toàn bộ cache

```powershell
cd Myapp

# Xóa cache Metro
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# Xóa cache Android
cd android
.\gradlew clean
cd ..

# Xóa cache npm
npm cache clean --force

# Cài đặt lại dependencies
npm install

# Khởi động lại
npx react-native start --reset-cache
```

## Giải pháp 3: Kiểm tra kết nối mạng

Nếu bạn đang dùng thiết bị thật (physical device):

```powershell
# Kiểm tra ADB devices
adb devices

# Reverse port để thiết bị có thể kết nối với Metro bundler
adb reverse tcp:8081 tcp:8081
```

## Giải pháp 4: Xóa app và cài lại

```powershell
# Gỡ cài đặt app trên thiết bị/emulator
adb uninstall com.myapp

# Build và cài đặt lại
cd Myapp
npx react-native run-android
```

## Giải pháp 5: Kiểm tra địa chỉ IP (cho thiết bị thật)

Nếu dùng thiết bị thật qua WiFi:
1. Lắc thiết bị để mở Dev Menu
2. Chọn "Settings"
3. Chọn "Debug server host & port for device"
4. Nhập: `10.0.188.228:8081` (IP máy tính của bạn)

Để tìm IP máy tính:
```powershell
ipconfig
# Tìm "IPv4 Address" trong phần WiFi adapter
```

## Giải pháp 6: Xóa build folder Android

```powershell
cd Myapp\android

# Xóa build folders
Remove-Item -Recurse -Force app\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

# Clean gradle
.\gradlew clean

cd ..

# Chạy lại
npx react-native run-android
```

## Lưu ý quan trọng

- **Đảm bảo Metro bundler đang chạy** trước khi chạy app
- **Kiểm tra firewall** không chặn port 8081
- **Sử dụng cùng mạng WiFi** nếu test trên thiết bị thật
- **Chạy adb reverse** nếu dùng USB debugging

