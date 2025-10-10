# BACKEND GUIDE

## 🔧 TỔNG QUAN

### Tech Stack
- **Runtime**: Node.js v22.14.0
- **Framework**: Express 4.18.2
- **Database**: MongoDB + Mongoose 8.0.3
- **Auth**: JWT + Passport OAuth
- **Upload**: Multer + Cloudinary
- **Email**: Nodemailer
- **Payment**: PayPal SDK
- **Real-time**: Socket.io
- **Video**: LiveKit Server SDK
- **Scheduling**: node-cron

---

## 📁 CẤU TRÚC

```
server/
├── config/           # Configurations
├── controllers/      # Business logic (22 files)
├── models/           # MongoDB schemas (18 files)
├── routes/           # API routes (20 files)
├── middlewares/      # Auth, validation, upload
├── services/         # Email service
├── utils/            # Utilities, cron jobs
├── .env              # Environment variables
└── server.js         # Entry point
```

---

## 🚀 SERVER ENTRY POINT

### server.js
```javascript
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { initializeSocket } = require('./config/socketConfig');

dotenv.config();

const app = express();
const server = require('http').createServer(app);
const io = initializeSocket(server);

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/user'));
app.use('/api/doctors', require('./routes/doctor'));
// ... other routes

const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server on port ${PORT}`));
};

startServer();
```

---

## 🗄️ DATABASE

### Connection (config/database.js)
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
};

module.exports = { connectDB };
```

### Model Example (models/User.js)
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: String,
  roleType: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
```

---

## 🎯 CONTROLLERS

### Example: authController.js
```javascript
const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email exists' });
    
    const user = await User.create({ fullName, email, passwordHash: password });
    
    res.status(201).json({ message: 'User created', userId: user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !await user.comparePassword(password)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

---

## 🔐 MIDDLEWARE

### Authentication (middlewares/auth.js)
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Auth required' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    
    req.userId = user._id;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Auth failed' });
  }
};
```

### Role Check (middlewares/roleCheck.js)
```javascript
exports.checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.roleType)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};
```

---

## 📧 EMAIL SERVICE

### services/emailService.js
```javascript
const nodemailer = require('nodemailer');

let transporter;

exports.initializeEmailTransport = async () => {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  await transporter.verify();
};

exports.sendEmail = async ({ to, subject, html }) => {
  return await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to, subject, html
  });
};
```

---

## 📁 FILE UPLOAD

### Cloudinary Upload
```javascript
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.uploadImage = async (req, res) => {
  const result = await cloudinary.uploader.upload(req.file.path, {
    folder: 'hospital-app'
  });
  res.json({ imageUrl: result.secure_url });
};
```

---

## 💳 PAYMENT

### PayPal Integration
```javascript
const paypal = require('paypal-rest-sdk');

paypal.configure({
  mode: process.env.PAYPAL_MODE,
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

exports.createPayment = (req, res) => {
  const payment = {
    intent: 'sale',
    payer: { payment_method: 'paypal' },
    transactions: [{ amount: { total: req.body.amount, currency: 'USD' } }],
    redirect_urls: {
      return_url: `${process.env.FRONTEND_URL}/payment/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
    }
  };
  
  paypal.payment.create(payment, (error, payment) => {
    if (error) throw error;
    const approvalUrl = payment.links.find(l => l.rel === 'approval_url').href;
    res.json({ approvalUrl });
  });
};
```

---

## ⏰ CRON JOBS

### utils/cron.js
```javascript
const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const { sendEmail } = require('../services/emailService');

exports.initCronJobs = () => {
  // Send reminders every hour
  cron.schedule('0 * * * *', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointments = await Appointment.find({
      appointmentDate: { $gte: tomorrow },
      status: 'confirmed',
      reminderSent: false
    }).populate('patient doctor');
    
    for (const apt of appointments) {
      await sendEmail({
        to: apt.patient.email,
        subject: 'Appointment Reminder',
        html: `Your appointment with Dr. ${apt.doctor.fullName} tomorrow`
      });
      apt.reminderSent = true;
      await apt.save();
    }
  });
};
```

---

## 🔌 SOCKET.IO

### config/socketConfig.js
```javascript
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

exports.initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: { origin: process.env.FRONTEND_URL }
  });
  
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  });
  
  io.on('connection', (socket) => {
    socket.on('join_conversation', (id) => socket.join(id));
    
    socket.on('send_message', async (data) => {
      const Message = require('../models/Message');
      const msg = await Message.create(data);
      io.to(data.conversationId).emit('new_message', msg);
    });
  });
  
  return io;
};
```

---

## 🛣️ ROUTES

### Example: routes/appointmentRoutes.js
```javascript
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const { checkRole } = require('../middlewares/roleCheck');
const controller = require('../controllers/appointmentController');

router.post('/', authenticate, controller.create);
router.get('/', authenticate, controller.getAll);
router.get('/:id', authenticate, controller.getById);
router.put('/:id', authenticate, controller.update);
router.delete('/:id', authenticate, controller.cancel);

module.exports = router;
```

---

## 🔒 OAUTH

### Passport Google (config/passport.js)
```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ socialId: profile.id, authProvider: 'google' });
  
  if (!user) {
    user = await User.create({
      fullName: profile.displayName,
      email: profile.emails[0].value,
      socialId: profile.id,
      authProvider: 'google',
      isVerified: true
    });
  }
  
  done(null, user);
}));
```

---

## 🎥 LIVEKIT

### Video Call Room
```javascript
const { AccessToken } = require('livekit-server-sdk');

exports.createRoom = async (req, res) => {
  const roomName = `room-${req.body.appointmentId}`;
  
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: req.userId.toString(),
      name: req.user.fullName
    }
  );
  
  token.addGrant({ roomJoin: true, room: roomName });
  
  res.json({ roomName, token: token.toJwt() });
};
```

---

## 📊 VALIDATION

### Input Validation (express-validator)
```javascript
const { body, validationResult } = require('express-validator');

exports.validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').trim().notEmpty(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

---

## 🧪 BEST PRACTICES

1. **Error Handling**: Use try-catch, consistent error responses
2. **Async Operations**: Use async/await with proper error handling
3. **Security**: Validate inputs, sanitize data, use helmet
4. **Logging**: Log errors and important operations
5. **Environment Variables**: Never commit .env files
6. **Database**: Use indexes, validate schemas
7. **API Design**: RESTful conventions, versioning
8. **Code Organization**: Separation of concerns
