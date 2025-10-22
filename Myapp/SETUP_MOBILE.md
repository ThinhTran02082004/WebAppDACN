# Mobile App Setup Guide

## ⚠️ Important: Firebase Configuration

The following sensitive files have been removed from git for security and are **required** for the app to work:

### Android

1. **`android/app/google-services.json`**
   - Get from: [Firebase Console](https://console.firebase.google.com/)
   - Navigate to: Project Settings → Your Apps → Android app
   - Download the `google-services.json` file
   - Place it in: `Myapp/android/app/google-services.json`

2. **Signing Keys** (for production builds)
   - `upload-keystore.jks` - For uploading to Google Play
   - `myapp-signing.keystore` - For signing releases
   
   **Generate a new keystore** (if you don't have one):
   ```bash
   cd android/app
   keytool -genkeypair -v -storetype PKCS12 -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
   
   **Important:** Never commit keystores to git! Store them securely.

### iOS

1. **`ios/Myapp/GoogleService-Info.plist`**
   - Get from: [Firebase Console](https://console.firebase.google.com/)
   - Navigate to: Project Settings → Your Apps → iOS app
   - Download the `GoogleService-Info.plist` file
   - Place it in: `Myapp/ios/Myapp/GoogleService-Info.plist`
   
   ℹ️ Use `GoogleService-Info.plist.example` as a reference for the structure

## Quick Setup Steps

### 1. Install Dependencies
```bash
npm install
# or
yarn install

# For iOS (macOS only)
cd ios
pod install
cd ..
```

### 2. Setup Environment Variables

Create a `.env` file from the template:
```bash
cp .env.example .env
```

Then edit `.env` and update the IP addresses:
- Replace `192.168.1.x` with your local machine's IP address
- Find your IP:
  - **Windows:** Run `ipconfig` in Command Prompt (look for IPv4 Address)
  - **macOS/Linux:** Run `ifconfig` or `ip addr show`

**Example `.env` file:**
```
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.100
METRO_HOST=192.168.1.100
API_HOST=192.168.1.100
API_PORT=5000
SERVER_HOST=192.168.1.100
SERVER_PORT=5000
```

### 3. Setup Firebase Files

**Android:**
```bash
# Download google-services.json from Firebase Console
# Copy it to: Myapp/android/app/google-services.json
```

**iOS:**
```bash
# Download GoogleService-Info.plist from Firebase Console
# Copy it to: Myapp/ios/Myapp/GoogleService-Info.plist
```

### 4. Run the App

**Android:**
```bash
npx react-native run-android
```

**iOS:**
```bash
npx react-native run-ios
```

## Troubleshooting

### Missing google-services.json
If you see errors like:
- `File google-services.json is missing`
- Firebase SDK errors

**Solution:** Download the file from Firebase Console and place it in the correct location.

### Build Errors on Android
If you get signing errors when building release APKs:
1. Make sure you have a valid keystore
2. Update `android/gradle.properties` with your keystore credentials
3. Never commit these credentials to git!

### iOS Pod Install Errors
```bash
cd ios
pod deintegrate
pod install
cd ..
```

## Security Checklist

- ✅ `google-services.json` is NOT committed to git
- ✅ `GoogleService-Info.plist` is NOT committed to git
- ✅ Keystores (`.jks`, `.keystore`) are NOT committed to git
- ✅ Certificate files (`.der`) are NOT committed to git
- ✅ All sensitive files are in `.gitignore`

## Need Help?

1. Check the example files:
   - `ios/Myapp/GoogleService-Info.plist.example`
   
2. Firebase Documentation:
   - [Add Firebase to Android](https://firebase.google.com/docs/android/setup)
   - [Add Firebase to iOS](https://firebase.google.com/docs/ios/setup)

3. Contact your team lead for:
   - Firebase project access
   - Keystore files (for production builds)
   - Signing credentials

