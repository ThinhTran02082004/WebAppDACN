const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    index: { unique: true, sparse: true }
  },
  phoneNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  passwordHash: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  address: {
    type: String,
    trim: true
  },
  roleType: {
    type: String,
    enum: ['user', 'doctor', 'admin', 'pharmacist'],
    default: 'user'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockReason: {
    type: String,
    trim: true
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  verificationMethod: {
    type: String,
    enum: ['phone', 'email'],
    default: 'email'
  },
  avatarUrl: {
    type: String,
    trim: true
  },
  avatar: {
    url: String,
    publicId: String,
    secureUrl: String,
    cloudName: String,
    resourceType: String
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  otpCode: String,
  otpExpires: Date,
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    }
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  facebookId: {
    type: String,
    unique: true,
    sparse: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local'
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital'
  }
}, {
  timestamps: true
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpires = Date.now() + 2 * 60 * 1000;
  return resetToken;
};

userSchema.methods.generateVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  this.verificationToken = hashedToken;
  this.verificationTokenExpires = Date.now() + 5 * 60 * 1000;
  return verificationToken;
};

userSchema.methods.generateOTP = function() {
  const otpNumber = Math.floor(100000 + Math.random() * 900000).toString();
  const otpToken = jwt.sign(
    { otp: otpNumber, userId: this._id.toString() },
    process.env.JWT_SECRET || 'fallback-secret-key',
    { expiresIn: '2m' }
  );
  this.otpCode = otpToken;
  this.otpExpires = Date.now() + 2 * 60 * 1000;
  return otpNumber;
};

userSchema.index({ verificationToken: 1 });
userSchema.index({ hospitalId: 1, roleType: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;

