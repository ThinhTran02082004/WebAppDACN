#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log(' Kiểm tra cấu hình Google OAuth...\n');

// Check Android configuration
const androidConfigPath = path.join(__dirname, '../android/app/google-services.json');
if (fs.existsSync(androidConfigPath)) {
  try {
    const androidConfig = JSON.parse(fs.readFileSync(androidConfigPath, 'utf8'));
    console.log(' Android google-services.json found');
    console.log(`   Project ID: ${androidConfig.project_info?.project_id}`);
    console.log(`   Project Number: ${androidConfig.project_info?.project_number}`);
    
    const client = androidConfig.client?.[0];
    if (client) {
      console.log(`   Package Name: ${client.client_info?.android_client_info?.package_name}`);
      console.log(`   Mobile SDK App ID: ${client.client_info?.mobilesdk_app_id}`);
      
      const oauthClient = client.oauth_client?.find(c => c.client_type === 1);
      if (oauthClient) {
        console.log(`   OAuth Client ID: ${oauthClient.client_id}`);
      }
    }
  } catch (error) {
    console.log(' Error reading Android config:', error.message);
  }
} else {
  console.log(' Android google-services.json not found');
}

console.log('');

// Check iOS configuration
const iosConfigPath = path.join(__dirname, '../ios/Myapp/GoogleService-Info.plist');
if (fs.existsSync(iosConfigPath)) {
  console.log(' iOS GoogleService-Info.plist found');
  try {
    const iosConfig = fs.readFileSync(iosConfigPath, 'utf8');
    const projectIdMatch = iosConfig.match(/<key>PROJECT_ID<\/key>\s*<string>([^<]+)<\/string>/);
    const bundleIdMatch = iosConfig.match(/<key>BUNDLE_ID<\/key>\s*<string>([^<]+)<\/string>/);
    const clientIdMatch = iosConfig.match(/<key>CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/);
    
    if (projectIdMatch) console.log(`   Project ID: ${projectIdMatch[1]}`);
    if (bundleIdMatch) console.log(`   Bundle ID: ${bundleIdMatch[1]}`);
    if (clientIdMatch) console.log(`   Client ID: ${clientIdMatch[1]}`);
  } catch (error) {
    console.log(' Error reading iOS config:', error.message);
  }
} else {
  console.log(' iOS GoogleService-Info.plist not found');
}

console.log('');

// Check React Native configuration
const configPath = path.join(__dirname, '../src/config/index.ts');
if (fs.existsSync(configPath)) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const googleClientIdMatch = configContent.match(/export const GOOGLE_CLIENT_ID = '([^']+)'/);
    
    if (googleClientIdMatch) {
      console.log(' React Native Google Client ID found');
      console.log(`   Client ID: ${googleClientIdMatch[1]}`);
      
      // Check if it's a placeholder
      if (googleClientIdMatch[1].includes('YOUR_WEB_CLIENT_ID') || googleClientIdMatch[1].includes('YOUR_CLIENT_ID')) {
        console.log('  Warning: Google Client ID appears to be a placeholder');
      }
    } else {
      console.log('Google Client ID not found in config');
    }
  } catch (error) {
    console.log(' Error reading React Native config:', error.message);
  }
} else {
  console.log(' React Native config not found');
}

console.log('\n Các bước cần thực hiện để khắc phục lỗi Google OAuth:');
console.log('1. Đảm bảo đã tạo project trên Google Cloud Console');
console.log('2. Kích hoạt Google Sign-In API');
console.log('3. Tạo OAuth 2.0 credentials cho Android và iOS');
console.log('4. Cập nhật SHA-1 fingerprint cho Android');
console.log('5. Cập nhật Bundle ID cho iOS');
console.log('6. Tải xuống file cấu hình mới từ Google Console');
console.log('7. Thay thế các file cấu hình hiện tại');
