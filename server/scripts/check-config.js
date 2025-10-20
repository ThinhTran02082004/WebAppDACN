#!/usr/bin/env node

/**
 * Script to check Google OAuth configuration
 * Run with: node scripts/check-config.js
 */

require('dotenv').config();

console.log('🔍 Checking Google OAuth Configuration...\n');

// Check environment variables
const requiredVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'JWT_SECRET',
  'MONGODB_URI'
];

const optionalVars = [
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'EMAIL_USER',
  'EMAIL_PASSWORD'
];

console.log('📋 Required Environment Variables:');
requiredVars.forEach(varName => {
  const exists = !!process.env[varName];
  const status = exists ? '✅' : '❌';
  const value = exists ? process.env[varName].substring(0, 20) + '...' : 'NOT SET';
  console.log(`  ${status} ${varName}: ${value}`);
});

console.log('\n📋 Optional Environment Variables:');
optionalVars.forEach(varName => {
  const exists = !!process.env[varName];
  const status = exists ? '✅' : '⚠️';
  const value = exists ? process.env[varName].substring(0, 20) + '...' : 'NOT SET';
  console.log(`  ${status} ${varName}: ${value}`);
});

// Check Google OAuth specific
console.log('\n🔑 Google OAuth Configuration:');
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  console.log('  ✅ Google OAuth credentials found');
  console.log(`  📱 Client ID: ${googleClientId.substring(0, 30)}...`);
  console.log(`  🔐 Client Secret: ${googleClientSecret.substring(0, 10)}...`);
  
  // Check if it's a valid Google Client ID format
  if (googleClientId.includes('.apps.googleusercontent.com')) {
    console.log('  ✅ Client ID format looks correct');
  } else {
    console.log('  ⚠️  Client ID format might be incorrect (should end with .apps.googleusercontent.com)');
  }
} else {
  console.log('  ❌ Google OAuth credentials missing');
  console.log('  💡 Create server/.env file with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
}

// Check file existence
const fs = require('fs');
const path = require('path');

console.log('\n📁 File Configuration:');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('  ✅ .env file exists');
} else {
  console.log('  ❌ .env file missing');
  console.log('  💡 Create server/.env file with your configuration');
}

// Check if google-services.json exists (for Android)
const googleServicesPath = path.join(__dirname, '..', '..', 'Myapp', 'android', 'app', 'google-services.json');
if (fs.existsSync(googleServicesPath)) {
  console.log('  ✅ google-services.json exists (Android)');
} else {
  console.log('  ❌ google-services.json missing (Android)');
  console.log('  💡 Download from Google Console and place in Myapp/android/app/');
}

// Check if GoogleService-Info.plist exists (for iOS)
const googleServiceInfoPath = path.join(__dirname, '..', '..', 'Myapp', 'ios', 'Myapp', 'GoogleService-Info.plist');
if (fs.existsSync(googleServiceInfoPath)) {
  console.log('  ✅ GoogleService-Info.plist exists (iOS)');
} else {
  console.log('  ❌ GoogleService-Info.plist missing (iOS)');
  console.log('  💡 Download from Google Console and place in Myapp/ios/Myapp/');
}

console.log('\n🎯 Summary:');
const hasRequiredVars = requiredVars.every(varName => !!process.env[varName]);
const hasEnvFile = fs.existsSync(envPath);

if (hasRequiredVars && hasEnvFile) {
  console.log('  ✅ Configuration looks good!');
  console.log('  🚀 You can start the server with: npm start');
} else {
  console.log('  ❌ Configuration incomplete');
  console.log('  📖 See GOOGLE_SIGNIN_FIX_GUIDE.md for detailed instructions');
}











