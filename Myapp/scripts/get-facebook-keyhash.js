const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const debugKeystorePath = path.join(os.homedir(), '.android', 'debug.keystore');

console.log('🔑 Generating Facebook Key Hash for Android...\n');

try {
  // Export certificate
  const cert = execSync(
    `keytool -exportcert -alias androiddebugkey -keystore "${debugKeystorePath}" -storepass android -keypass android`,
    { encoding: 'buffer' }
  );

  // Generate SHA1 hash and base64 encode
  const hash = crypto.createHash('sha1').update(cert).digest();
  const keyHash = hash.toString('base64');

  console.log('✅ Key Hash generated successfully!\n');
  console.log('📋 Your Facebook Key Hash:');
  console.log('─'.repeat(50));
  console.log(keyHash);
  console.log('─'.repeat(50));
  console.log('\n📝 Next steps:');
  console.log('1. Go to: https://developers.facebook.com/apps/3561947047432184/');
  console.log('2. Navigate to Settings → Basic');
  console.log('3. Scroll down to "Android" section');
  console.log('4. Click "Add Key Hash"');
  console.log('5. Paste the key hash above');
  console.log('6. Save changes\n');
} catch (error) {
  console.error('❌ Error generating key hash:', error.message);
  console.log('\n💡 Alternative method:');
  console.log('Run this command manually:');
  console.log(`keytool -exportcert -alias androiddebugkey -keystore "${debugKeystorePath}" -storepass android -keypass android | openssl sha1 -binary | openssl base64`);
}
