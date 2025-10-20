const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function recreateTestUser() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp');
    console.log('Connected to MongoDB');

    // Delete existing test user
    await User.deleteOne({ email: 'test@example.com' });
    console.log('Deleted existing test user');

    // Create new test user with proper password hashing
    const testUser = new User({
      fullName: 'Test User',
      email: 'test@example.com',
      phoneNumber: '0123456789',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      address: 'Test Address',
      roleType: 'user',
      isVerified: true,
      isLocked: false
    });

    // Set password using the pre-save middleware
    testUser.passwordHash = '123456'; // This will be hashed by the pre-save middleware
    await testUser.save();

    console.log('Test user created successfully:');
    console.log('- Email: test@example.com');
    console.log('- Password: 123456');
    console.log('- Verified: true');
    console.log('- Locked: false');

    // Test password comparison
    const isMatch = await testUser.comparePassword('123456');
    console.log('Password comparison test:', isMatch);

    if (isMatch) {
      console.log('✅ Password is working correctly!');
    } else {
      console.log('❌ Password is still not working');
    }

  } catch (error) {
    console.error('Error recreating test user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
recreateTestUser();
