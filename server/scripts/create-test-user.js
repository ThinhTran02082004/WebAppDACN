const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function createTestUser() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp');
    console.log('Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@example.com' });
    if (existingUser) {
      console.log('Test user already exists:', existingUser.email);
      console.log('Is verified:', existingUser.isVerified);
      console.log('Is locked:', existingUser.isLocked);
      return;
    }

    // Create test user
    const testUser = new User({
      fullName: 'Test User',
      email: 'test@example.com',
      passwordHash: await bcrypt.hash('123456', 10),
      phoneNumber: '0123456789',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      address: 'Test Address',
      roleType: 'user',
      isVerified: true, // Mark as verified
      isLocked: false
    });

    await testUser.save();
    console.log('Test user created successfully:');
    console.log('- Email: test@example.com');
    console.log('- Password: 123456');
    console.log('- Verified: true');
    console.log('- Locked: false');

  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTestUser();
