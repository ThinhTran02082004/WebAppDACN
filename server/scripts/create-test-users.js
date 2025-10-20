const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function createTestUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-appointment', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Test users data
    const testUsers = [
      {
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phoneNumber: '0123456789',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        roleType: 'user',
        isVerified: true
      },
      {
        fullName: 'Test User 1',
        email: 'testuser1@example.com',
        password: 'password123',
        phoneNumber: '0123456789',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        roleType: 'user',
        isVerified: true
      },
      {
        fullName: 'Test User 2',
        email: 'testuser2@example.com',
        password: 'password123',
        phoneNumber: '0987654321',
        dateOfBirth: new Date('1995-05-15'),
        gender: 'female',
        roleType: 'user',
        isVerified: true
      },
      {
        fullName: 'Test Admin',
        email: 'admin@example.com',
        password: 'admin123',
        phoneNumber: '0111222333',
        dateOfBirth: new Date('1985-12-25'),
        gender: 'male',
        roleType: 'admin',
        isVerified: true
      }
    ];
    
    for (const userData of testUsers) {
      console.log(`\nCreating/updating user: ${userData.email}`);
      
      // Check if user exists
      let user = await User.findOne({ email: userData.email });
      
      if (user) {
        console.log('User exists, updating password...');
        user.passwordHash = userData.password; // Will be hashed by pre-save middleware
        user.fullName = userData.fullName;
        user.phoneNumber = userData.phoneNumber;
        user.dateOfBirth = userData.dateOfBirth;
        user.gender = userData.gender;
        user.roleType = userData.roleType;
        user.isVerified = userData.isVerified;
      } else {
        console.log('Creating new user...');
        user = new User({
          fullName: userData.fullName,
          email: userData.email,
          passwordHash: userData.password, // Will be hashed by pre-save middleware
          phoneNumber: userData.phoneNumber,
          dateOfBirth: userData.dateOfBirth,
          gender: userData.gender,
          roleType: userData.roleType,
          isVerified: userData.isVerified
        });
      }
      
      // Save user
      await user.save();
      console.log('User saved successfully');
      
      // Test the password
      const isPasswordCorrect = await user.comparePassword(userData.password);
      console.log(`Password test result: ${isPasswordCorrect}`);
      
      if (isPasswordCorrect) {
        console.log(`✅ User ${userData.email} ready for testing`);
        console.log(`   Email: ${userData.email}`);
        console.log(`   Password: ${userData.password}`);
        console.log(`   Role: ${userData.roleType}`);
      } else {
        console.log(`❌ Password test failed for ${userData.email}`);
      }
    }
    
    console.log('\n🎉 All test users created/updated successfully!');
    console.log('\nTest accounts:');
    console.log('1. test@example.com / password123 (user)');
    console.log('2. testuser1@example.com / password123 (user)');
    console.log('3. testuser2@example.com / password123 (user)');
    console.log('4. admin@example.com / admin123 (admin)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createTestUsers();
