# DATABASE SCHEMA

## 📊 MONGODB COLLECTIONS

---

## 1. Users Collection

### Schema
```javascript
{
  _id: ObjectId,
  fullName: String (required),
  email: String (required, unique),
  passwordHash: String,
  phoneNumber: String,
  dateOfBirth: Date,
  gender: String (enum: ['male', 'female', 'other']),
  address: String,
  avatar: String (URL),
  roleType: String (enum: ['user', 'admin'], default: 'user'),
  isVerified: Boolean (default: false),
  verificationToken: String,
  verificationTokenExpiry: Date,
  resetPasswordToken: String,
  resetPasswordExpiry: Date,
  otp: String,
  otpExpiry: Date,
  authProvider: String (enum: ['local', 'google', 'facebook'], default: 'local'),
  socialId: String,
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `email`: unique
- `phoneNumber`: sparse
- `authProvider`, `socialId`: compound index

### Relationships
- Has many: Appointments, Payments, Reviews, Conversations

---

## 2. Doctors Collection

### Schema
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User'),
  fullName: String (required),
  email: String (required, unique),
  passwordHash: String,
  phoneNumber: String,
  specialty: ObjectId (ref: 'Specialty'),
  qualifications: String,
  experience: String,
  description: String,
  avatar: String (URL),
  consultationFee: Number,
  averageRating: Number (default: 0),
  reviewCount: Number (default: 0),
  hospitals: [ObjectId] (ref: 'Hospital'),
  isAvailable: Boolean (default: true),
  isVerified: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `email`: unique
- `specialty`: index
- `hospitals`: index

### Relationships
- Belongs to: Specialty
- Belongs to many: Hospitals
- Has many: Schedules, Appointments, Reviews, MedicalRecords

---

## 3. Appointments Collection

### Schema
```javascript
{
  _id: ObjectId,
  patient: ObjectId (ref: 'User', required),
  doctor: ObjectId (ref: 'Doctor', required),
  schedule: ObjectId (ref: 'Schedule', required),
  service: ObjectId (ref: 'Service', required),
  hospital: ObjectId (ref: 'Hospital', required),
  room: ObjectId (ref: 'Room'),
  
  appointmentDate: Date (required),
  appointmentTime: String (required),
  
  status: String (
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  ),
  
  reason: String,
  notes: String,
  cancellationReason: String,
  
  paymentStatus: String (enum: ['pending', 'paid', 'refunded'], default: 'pending'),
  paymentMethod: String (enum: ['paypal', 'cash', 'insurance']),
  amount: Number,
  
  qrCode: String,
  checkInTime: Date,
  checkOutTime: Date,
  
  isEmergency: Boolean (default: false),
  reminderSent: Boolean (default: false),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `patient`, `appointmentDate`: compound
- `doctor`, `appointmentDate`: compound
- `status`: index
- `appointmentDate`: index

### Relationships
- Belongs to: User (patient), Doctor, Schedule, Service, Hospital, Room
- Has one: MedicalRecord, Payment
- Has one: Review

---

## 4. Schedules Collection

### Schema
```javascript
{
  _id: ObjectId,
  doctor: ObjectId (ref: 'Doctor', required),
  hospital: ObjectId (ref: 'Hospital', required),
  room: ObjectId (ref: 'Room'),
  
  date: Date (required),
  shift: String (enum: ['morning', 'afternoon', 'evening'], required),
  startTime: String (required),
  endTime: String (required),
  
  maxPatients: Number (default: 20),
  currentPatients: Number (default: 0),
  
  isAvailable: Boolean (default: true),
  isLocked: Boolean (default: false),
  
  notes: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `doctor`, `date`: compound unique
- `hospital`, `date`: compound
- `date`: index

### Relationships
- Belongs to: Doctor, Hospital, Room
- Has many: Appointments

---

## 5. MedicalRecords Collection

### Schema
```javascript
{
  _id: ObjectId,
  appointment: ObjectId (ref: 'Appointment', required),
  patient: ObjectId (ref: 'User', required),
  doctor: ObjectId (ref: 'Doctor', required),
  
  diagnosis: String (required),
  symptoms: String,
  vitalSigns: {
    bloodPressure: String,
    heartRate: Number,
    temperature: Number,
    weight: Number,
    height: Number
  },
  
  testResults: String,
  labResults: [{
    testName: String,
    result: String,
    date: Date,
    fileUrl: String
  }],
  
  prescriptions: [{
    medication: ObjectId (ref: 'Medication'),
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String,
    quantity: Number
  }],
  
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadDate: Date
  }],
  
  notes: String,
  followUpDate: Date,
  followUpNotes: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `appointment`: unique
- `patient`: index
- `doctor`: index

### Relationships
- Belongs to: Appointment, User (patient), Doctor
- References: Medications

---

## 6. Payments Collection

### Schema
```javascript
{
  _id: ObjectId,
  appointment: ObjectId (ref: 'Appointment', required),
  user: ObjectId (ref: 'User', required),
  
  amount: Number (required),
  originalAmount: Number,
  discount: Number (default: 0),
  coupon: ObjectId (ref: 'Coupon'),
  
  paymentMethod: String (enum: ['paypal', 'momo', 'cash'], required),
  paymentStatus: String (
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending'
  ),
  
  transactionId: String,
  paymentId: String,
  payerId: String,
  
  paymentDate: Date,
  refundDate: Date,
  refundReason: String,
  
  metadata: Object,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `appointment`: unique
- `user`: index
- `transactionId`: unique sparse
- `paymentStatus`: index

### Relationships
- Belongs to: Appointment, User, Coupon

---

## 7. Reviews Collection

### Schema
```javascript
{
  _id: ObjectId,
  appointment: ObjectId (ref: 'Appointment', required),
  patient: ObjectId (ref: 'User', required),
  doctor: ObjectId (ref: 'Doctor', required),
  hospital: ObjectId (ref: 'Hospital'),
  
  rating: Number (min: 1, max: 5, required),
  comment: String,
  recommend: Boolean,
  
  aspects: {
    professionalism: Number,
    communication: Number,
    waitTime: Number,
    facilities: Number
  },
  
  images: [String],
  
  reply: String,
  repliedBy: ObjectId (ref: 'User'),
  repliedAt: Date,
  
  isApproved: Boolean (default: false),
  isVisible: Boolean (default: true),
  
  helpfulCount: Number (default: 0),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `appointment`: unique
- `doctor`: index
- `hospital`: index
- `rating`: index

### Relationships
- Belongs to: Appointment, User (patient), Doctor, Hospital

---

## 8. Hospitals Collection

### Schema
```javascript
{
  _id: ObjectId,
  name: String (required),
  slug: String (unique),
  
  address: String (required),
  city: String,
  district: String,
  ward: String,
  
  phone: String,
  email: String,
  website: String,
  
  description: String,
  
  facilities: [String],
  services: [ObjectId] (ref: 'Service'),
  specialties: [ObjectId] (ref: 'Specialty'),
  
  images: [String],
  
  openingHours: {
    monday: { open: String, close: String, isOpen: Boolean },
    tuesday: { open: String, close: String, isOpen: Boolean },
    wednesday: { open: String, close: String, isOpen: Boolean },
    thursday: { open: String, close: String, isOpen: Boolean },
    friday: { open: String, close: String, isOpen: Boolean },
    saturday: { open: String, close: String, isOpen: Boolean },
    sunday: { open: String, close: String, isOpen: Boolean }
  },
  
  location: {
    type: String (enum: ['Point']),
    coordinates: [Number]
  },
  
  averageRating: Number (default: 0),
  reviewCount: Number (default: 0),
  
  isActive: Boolean (default: true),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `slug`: unique
- `location`: 2dsphere
- `city`, `district`: compound

### Relationships
- Has many: Doctors, Schedules, Rooms, Reviews
- Has many: Services, Specialties (through references)

---

## 9. Services Collection

### Schema
```javascript
{
  _id: ObjectId,
  name: String (required, unique),
  slug: String (unique),
  description: String,
  
  price: Number (required),
  duration: Number (minutes),
  
  category: String,
  specialty: ObjectId (ref: 'Specialty'),
  
  image: String (URL),
  
  isActive: Boolean (default: true),
  isPopular: Boolean (default: false),
  
  metadata: Object,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `name`: unique
- `slug`: unique
- `specialty`: index
- `isActive`: index

### Relationships
- Belongs to: Specialty
- Used in: Appointments
- Has many: ServicePriceHistory

---

## 10. ServicePriceHistory Collection

### Schema
```javascript
{
  _id: ObjectId,
  service: ObjectId (ref: 'Service', required),
  oldPrice: Number,
  newPrice: Number (required),
  changedBy: ObjectId (ref: 'User', required),
  reason: String,
  effectiveDate: Date,
  createdAt: Date
}
```

### Indexes
- `service`: index
- `effectiveDate`: index

---

## 11. Specialties Collection

### Schema
```javascript
{
  _id: ObjectId,
  name: String (required, unique),
  slug: String (unique),
  description: String,
  image: String (URL),
  icon: String,
  
  isActive: Boolean (default: true),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `name`: unique
- `slug`: unique

### Relationships
- Has many: Doctors, Services

---

## 12. Coupons Collection

### Schema
```javascript
{
  _id: ObjectId,
  code: String (required, unique),
  
  discountType: String (enum: ['percentage', 'fixed'], required),
  discountValue: Number (required),
  
  minAmount: Number (default: 0),
  maxDiscount: Number,
  
  startDate: Date (required),
  endDate: Date (required),
  
  usageLimit: Number,
  usageCount: Number (default: 0),
  
  userUsageLimit: Number (default: 1),
  
  applicableServices: [ObjectId] (ref: 'Service'),
  applicableSpecialties: [ObjectId] (ref: 'Specialty'),
  
  isActive: Boolean (default: true),
  
  description: String,
  terms: String,
  
  createdBy: ObjectId (ref: 'User'),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `code`: unique
- `isActive`, `startDate`, `endDate`: compound
- `endDate`: index

### Relationships
- References: Services, Specialties
- Used in: Payments

---

## 13. Conversations Collection

### Schema
```javascript
{
  _id: ObjectId,
  participants: [ObjectId] (ref: 'User'),
  
  type: String (enum: ['direct', 'group'], default: 'direct'),
  
  lastMessage: ObjectId (ref: 'Message'),
  lastMessageAt: Date,
  
  unreadCount: {
    type: Map,
    of: Number
  },
  
  isActive: Boolean (default: true),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `participants`: index
- `lastMessageAt`: index

### Relationships
- Has many: Messages
- References: Users (participants)

---

## 14. Messages Collection

### Schema
```javascript
{
  _id: ObjectId,
  conversation: ObjectId (ref: 'Conversation', required),
  sender: ObjectId (ref: 'User', required),
  
  content: String (required),
  messageType: String (enum: ['text', 'image', 'file'], default: 'text'),
  
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number
  }],
  
  readBy: [{
    user: ObjectId (ref: 'User'),
    readAt: Date
  }],
  
  isDeleted: Boolean (default: false),
  deletedAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `conversation`: index
- `sender`: index
- `createdAt`: index

### Relationships
- Belongs to: Conversation, User (sender)

---

## 15. Rooms Collection (Video Call)

### Schema
```javascript
{
  _id: ObjectId,
  name: String (required, unique),
  
  appointment: ObjectId (ref: 'Appointment'),
  
  participants: [{
    user: ObjectId (ref: 'User'),
    role: String (enum: ['doctor', 'patient']),
    joinedAt: Date,
    leftAt: Date
  }],
  
  status: String (enum: ['waiting', 'active', 'ended'], default: 'waiting'),
  
  startTime: Date,
  endTime: Date,
  duration: Number,
  
  recordingUrl: String,
  
  metadata: Object,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `name`: unique
- `appointment`: index
- `status`: index

### Relationships
- Belongs to: Appointment
- References: Users (participants)

---

## 16. Medications Collection

### Schema
```javascript
{
  _id: ObjectId,
  name: String (required),
  genericName: String,
  
  ingredient: String,
  strength: String,
  form: String (enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream']),
  
  manufacturer: String,
  
  usage: String,
  dosage: String,
  sideEffects: String,
  contraindications: String,
  interactions: String,
  
  price: Number,
  
  image: String (URL),
  
  isActive: Boolean (default: true),
  isPrescriptionRequired: Boolean (default: true),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `name`: text index
- `genericName`: text index

### Relationships
- Used in: MedicalRecords (prescriptions)

---

## 17. News Collection

### Schema
```javascript
{
  _id: ObjectId,
  title: String (required),
  slug: String (unique),
  
  content: String (required),
  excerpt: String,
  
  featuredImage: String (URL),
  images: [String],
  
  category: String,
  tags: [String],
  
  author: ObjectId (ref: 'User'),
  
  status: String (enum: ['draft', 'published', 'archived'], default: 'draft'),
  publishedAt: Date,
  
  views: Number (default: 0),
  
  isPopular: Boolean (default: false),
  isFeatured: Boolean (default: false),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
- `slug`: unique
- `status`, `publishedAt`: compound
- `category`: index

### Relationships
- Belongs to: User (author)

---

## 18. Logs Collection

### Schema
```javascript
{
  _id: ObjectId,
  level: String (enum: ['info', 'warning', 'error'], required),
  
  message: String (required),
  
  user: ObjectId (ref: 'User'),
  
  method: String,
  url: String,
  statusCode: Number,
  ip: String,
  
  requestBody: Object,
  responseBody: Object,
  
  error: {
    message: String,
    stack: String
  },
  
  metadata: Object,
  
  timestamp: Date (default: Date.now)
}
```

### Indexes
- `timestamp`: index
- `level`: index
- `user`: index

---

## 🔗 RELATIONSHIPS DIAGRAM

```
User ────────┐
    │        │
    │        ├─── has many ──▶ Appointments
    │        │
    │        ├─── has many ──▶ Payments
    │        │
    │        └─── has many ──▶ Reviews

Doctor ──────┐
    │        │
    │        ├─── has many ──▶ Schedules
    │        │
    │        ├─── has many ──▶ Appointments
    │        │
    │        ├─── has many ──▶ Reviews
    │        │
    │        └─── has many ──▶ MedicalRecords

Appointment ─┐
    │        │
    │        ├─── has one ──▶ MedicalRecord
    │        │
    │        ├─── has one ──▶ Payment
    │        │
    │        ├─── has one ──▶ Review
    │        │
    │        └─── has one ──▶ Room

Hospital ────┐
    │        │
    │        ├─── has many ──▶ Schedules
    │        │
    │        ├─── has many ──▶ Rooms
    │        │
    │        └─── has many ──▶ Reviews

Specialty ───┐
    │        │
    │        ├─── has many ──▶ Doctors
    │        │
    │        └─── has many ──▶ Services

Service ─────┐
    │        │
    │        ├─── used in ──▶ Appointments
    │        │
    │        └─── has many ──▶ ServicePriceHistory

Conversation ┐
    │        │
    │        └─── has many ──▶ Messages

Coupon ──────┐
    │        │
    │        └─── used in ──▶ Payments

Medication ──┐
    │        │
    │        └─── used in ──▶ MedicalRecords
```

---

## 🎯 INDEXES SUMMARY

### High-Performance Indexes
1. **Users**: email (unique), authProvider+socialId
2. **Doctors**: email (unique), specialty, hospitals
3. **Appointments**: patient+date, doctor+date, status, date
4. **Schedules**: doctor+date (unique), hospital+date, date
5. **Payments**: transactionId (unique), paymentStatus
6. **Reviews**: doctor, hospital, rating
7. **Hospitals**: slug (unique), location (2dsphere)
8. **Services**: name, slug (unique)
9. **Messages**: conversation, createdAt
10. **Logs**: timestamp, level

---

## 💾 DATA VOLUME ESTIMATES

### Expected Document Counts (1 year)
- Users: ~10,000
- Doctors: ~100
- Appointments: ~50,000
- Schedules: ~36,500
- MedicalRecords: ~40,000
- Payments: ~40,000
- Reviews: ~30,000
- Messages: ~100,000
- Logs: ~1,000,000

### Storage Estimates
- Total: ~2-5 GB (với indexes)
- Logs: ~1 GB
- Messages: ~500 MB
- Appointments: ~200 MB
- Other collections: ~1-3 GB
