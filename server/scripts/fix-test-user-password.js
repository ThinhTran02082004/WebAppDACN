const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function fixTestUserPassword() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp');
    console.log('Connected to MongoDB');

    // Find test user
    const testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      console.log('Test user not found');
      return;
    }

    console.log('Found test user:', testUser.email);
    console.log('Current passwordHash:', testUser.passwordHash);

    // Test password comparison
    const testPassword = '123456';
    const isMatch = await bcrypt.compare(testPassword, testUser.passwordHash);
    console.log('Password comparison result:', isMatch);

    if (!isMatch) {
      console.log('Password does not match. Updating password...');
      
      // Hash the password correctly
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(testPassword, salt);
      
      // Update the user's password
      testUser.passwordHash = newPasswordHash;
      await testUser.save();
      
      console.log('Password updated successfully');
      
      // Test again
      const isMatchAfterUpdate = await bcrypt.compare(testPassword, testUser.passwordHash);
      console.log('Password comparison after update:', isMatchAfterUpdate);
    } else {
      console.log('Password is correct');
    }

    // Show user details
    console.log('\nUser details:');
    console.log('- Email:', testUser.email);
    console.log('- Is Verified:', testUser.isVerified);
    console.log('- Is Locked:', testUser.isLocked);
    console.log('- Role Type:', testUser.roleType);

  } catch (error) {
    console.error('Error fixing test user password:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixTestUserPassword();
