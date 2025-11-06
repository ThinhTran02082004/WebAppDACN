const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Specialty = require('../models/Specialty');
const Hospital = require('../models/Hospital');
const Service = require('../models/Service');
const Doctor = require('../models/Doctor');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Coupon = require('../models/Coupon');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const MedicalRecord = require('../models/MedicalRecord');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');
const PrescriptionTemplate = require('../models/PrescriptionTemplate');
const Bill = require('../models/Bill');
const BillPayment = require('../models/BillPayment');
const MedicationInventory = require('../models/MedicationInventory');
const InpatientRoom = require('../models/InpatientRoom');
const Hospitalization = require('../models/Hospitalization');
const VideoRoom = require('../models/VideoRoom');
const DoctorMeeting = require('../models/DoctorMeeting');
const Notification = require('../models/Notification');
const News = require('../models/News');
const ServicePriceHistory = require('../models/ServicePriceHistory');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospitalweb';
console.log('Connecting to MongoDB at:', MONGODB_URI.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://*****:*****@'));

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 180000,
  socketTimeoutMS: 180000,
  connectTimeoutMS: 180000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10,
  minPoolSize: 2,
  bufferCommands: true,
  bufferTimeoutMS: 180000
})
  .then(() => console.log('MongoDB connected successfully...'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Reset all collections
const resetCollections = async () => {
  console.log('Resetting collections...');
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection is not ready');
    }
    
    const resetWithRetry = async (model, name, maxRetries = 3) => {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          await model.deleteMany({});
          console.log(`${name} collection reset`);
          return;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    };
    
    await resetWithRetry(User, 'Users');
    await resetWithRetry(Specialty, 'Specialties');
    await resetWithRetry(Hospital, 'Hospitals');
    await resetWithRetry(Service, 'Services');
    await resetWithRetry(Doctor, 'Doctors');
    await resetWithRetry(Schedule, 'Schedules');
    await resetWithRetry(Room, 'Rooms');
    await resetWithRetry(Coupon, 'Coupons');
    await resetWithRetry(Appointment, 'Appointments');
    await resetWithRetry(Payment, 'Payments');
    await resetWithRetry(Review, 'Reviews');
    await resetWithRetry(MedicalRecord, 'Medical records');
    await resetWithRetry(Message, 'Messages');
    await resetWithRetry(Conversation, 'Conversations');
    await resetWithRetry(Medication, 'Medications');
    await resetWithRetry(Prescription, 'Prescriptions');
    await resetWithRetry(PrescriptionTemplate, 'Prescription Templates');
    await resetWithRetry(Bill, 'Bills');
    await resetWithRetry(BillPayment, 'Bill Payments');
    await resetWithRetry(MedicationInventory, 'Medication Inventory');
    await resetWithRetry(InpatientRoom, 'Inpatient Rooms');
    await resetWithRetry(Hospitalization, 'Hospitalizations');
    await resetWithRetry(VideoRoom, 'Video Rooms');
    await resetWithRetry(DoctorMeeting, 'Doctor Meetings');
    await resetWithRetry(Notification, 'Notifications');
    await resetWithRetry(News, 'News');
    await resetWithRetry(ServicePriceHistory, 'Service Price History');
    
    console.log('All collections reset successfully!');
  } catch (err) {
    console.error('Error resetting collections:', err);
    throw err;
  }
};

// Create admin user
const createAdmin = async () => {
  console.log('Creating admin user...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('HospitalApp@123', salt);
  
  const adminUser = await User.create({
    fullName: 'Admin User',
    email: 'admin@example.com',
    phoneNumber: '0987654321',
    passwordHash: hashedPassword,
    dateOfBirth: new Date('1990-01-01'),
    gender: 'other',
    address: 'Admin Office, Hospital Building',
    roleType: 'admin',
    isVerified: true,
    avatarUrl: 'https://i.pravatar.cc/300?img=68'
  });
  console.log('Admin user created:', adminUser.email);
  return adminUser;
};

// Create specialties
const createSpecialties = async () => {
  console.log('Creating specialties...');
  const specialties = await Specialty.insertMany([
    {
      name: 'Nội khoa',
      description: 'Khám và điều trị các bệnh lý nội khoa chung',
      icon: 'fa-heartbeat',
      imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800',
      isActive: true
    },
    {
      name: 'Ngoại khoa',
      description: 'Khám và điều trị các bệnh lý cần can thiệp ngoại khoa',
      icon: 'fa-stethoscope',
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
      isActive: true
    },
    {
      name: 'Sản khoa',
      description: 'Chăm sóc sức khỏe phụ nữ mang thai và sinh nở',
      icon: 'fa-baby',
      imageUrl: 'https://images.unsplash.com/photo-1517856712251-22bb056d0b8e?w=800',
      isActive: true
    },
    {
      name: 'Nhi khoa',
      description: 'Chăm sóc sức khỏe trẻ em và điều trị bệnh ở trẻ',
      icon: 'fa-child',
      imageUrl: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800',
      isActive: true
    },
    {
      name: 'Da liễu',
      description: 'Khám và điều trị các bệnh lý về da',
      icon: 'fa-allergies',
      imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800',
      isActive: true
    }
  ]);
  console.log(`${specialties.length} specialties created!`);
  return specialties;
};

// Create hospitals
const createHospitals = async (specialties) => {
  console.log('Creating hospitals...');
  const hospitals = await Hospital.insertMany([
    {
      name: 'Bệnh viện Đa khoa Trung ương',
      address: '1 Đường Trần Nhân Tông, Hai Bà Trưng, Hà Nội',
      contactInfo: {
        phone: '1900 1234',
        email: 'info@bvdktw.vn',
        website: 'www.bvdktw.vn'
      },
      description: 'Bệnh viện đa khoa lớn với đầy đủ các chuyên khoa',
      imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200',
      workingHours: {
        monday: { open: '07:00', close: '20:00', isOpen: true },
        tuesday: { open: '07:00', close: '20:00', isOpen: true },
        wednesday: { open: '07:00', close: '20:00', isOpen: true },
        thursday: { open: '07:00', close: '20:00', isOpen: true },
        friday: { open: '07:00', close: '20:00', isOpen: true },
        saturday: { open: '07:00', close: '17:00', isOpen: true },
        sunday: { open: '07:00', close: '12:00', isOpen: true }
      },
      specialties: specialties.map(specialty => specialty._id),
      facilities: ['Phòng mổ hiện đại', 'Phòng chăm sóc đặc biệt', 'Phòng xét nghiệm', 'Chẩn đoán hình ảnh'],
      location: {
        type: 'Point',
        coordinates: [105.8514, 21.0277]
      },
      isActive: true,
      isMainHospital: true
    },
    {
      name: 'Phòng khám đa khoa Hoàn Kiếm',
      address: '15 Hàng Bài, Hoàn Kiếm, Hà Nội',
      contactInfo: {
        phone: '1900 5678',
        email: 'info@pkhoankiem.vn',
        website: 'www.pkhoankiem.vn'
      },
      description: 'Phòng khám đa khoa với các dịch vụ khám chữa bệnh cơ bản',
      imageUrl: 'https://images.unsplash.com/photo-1471895302489-162283001d8b?w=1200',
      workingHours: {
        monday: { open: '08:00', close: '18:00', isOpen: true },
        tuesday: { open: '08:00', close: '18:00', isOpen: true },
        wednesday: { open: '08:00', close: '18:00', isOpen: true },
        thursday: { open: '08:00', close: '18:00', isOpen: true },
        friday: { open: '08:00', close: '18:00', isOpen: true },
        saturday: { open: '08:00', close: '16:00', isOpen: true },
        sunday: { open: '00:00', close: '00:00', isOpen: false }
      },
      specialties: [specialties[0]._id, specialties[1]._id, specialties[3]._id],
      facilities: ['Phòng khám', 'Phòng xét nghiệm cơ bản'],
      location: {
        type: 'Point',
        coordinates: [105.8480, 21.0222]
      },
      isActive: true,
      isMainHospital: false,
      parentHospital: null
    }
  ]);
  console.log(`${hospitals.length} hospitals created!`);
  return hospitals;
};

// Create services
const createServices = async (specialties) => {
  console.log('Creating services...');
  const services = await Service.insertMany([
    {
      name: 'Khám tổng quát',
      description: 'Khám sức khỏe tổng quát theo tiêu chuẩn',
      price: 500000,
      specialtyId: specialties[0]._id,
      duration: 30,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800'
    },
    {
      name: 'Khám chuyên khoa nội',
      description: 'Khám chuyên sâu các bệnh nội khoa',
      price: 400000,
      specialtyId: specialties[0]._id,
      duration: 30,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1576633587382-13d4ba466621?w=800'
    },
    {
      name: 'Khám thai',
      description: 'Khám thai định kỳ cho phụ nữ mang thai',
      price: 450000,
      specialtyId: specialties[2]._id,
      duration: 40,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800'
    },
    {
      name: 'Tiêm vaccine cho trẻ',
      description: 'Tiêm chủng vaccine theo lịch cho trẻ em',
      price: 350000,
      specialtyId: specialties[3]._id,
      duration: 20,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=800'
    },
    {
      name: 'Khám da',
      description: 'Khám và tư vấn các vấn đề về da',
      price: 400000,
      specialtyId: specialties[4]._id,
      duration: 30,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800'
    }
  ]);
  console.log(`${services.length} services created!`);
  return services;
};

// Create rooms
const createRooms = async (hospitals) => {
  console.log('Creating rooms...');
  let rooms = [];
  let roomCount = 0;
  
  for (const hospital of hospitals) {
    const room1 = await Room.create({
      name: `Phòng 101`,
      number: '101',
      hospitalId: hospital._id,
      floor: '1',
      type: 'examination',
      capacity: 2,
      status: 'active',
      description: 'Phòng khám đa khoa',
      roomId: `R-101-1-${roomCount++}`,
      imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800'
    });
    
    const room2 = await Room.create({
      name: `Phòng 102`,
      number: '102',
      hospitalId: hospital._id,
      floor: '1',
      type: 'examination',
      capacity: 2,
      status: 'active',
      description: 'Phòng khám chuyên khoa',
      roomId: `R-102-1-${roomCount++}`,
      imageUrl: 'https://images.unsplash.com/photo-1576633587382-13d4ba466621?w=800'
    });
    
    const room3 = await Room.create({
      name: `Phòng 201`,
      number: '201',
      hospitalId: hospital._id,
      floor: '2',
      type: 'procedure',
      capacity: 3,
      status: 'active',
      description: 'Phòng tiểu phẫu',
      roomId: `R-201-2-${roomCount++}`,
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800'
    });
    
    rooms = [...rooms, room1, room2, room3];
  }
  
  console.log(`${rooms.length} rooms created!`);
  return rooms;
};

// Create doctors and their accounts
const createDoctors = async (specialties, hospitals, services) => {
  console.log('Creating doctors...');
  const doctors = [];
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('HospitalApp@123', salt);

  const doctorUsers = await User.insertMany([
    {
      fullName: 'Bác sĩ Nguyễn Văn A',
      email: 'doctor.a@example.com',
      phoneNumber: '0901234567',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1980-05-10'),
      gender: 'male',
      address: 'Hà Nội',
      roleType: 'doctor',
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=1'
    },
    {
      fullName: 'Bác sĩ Trần Thị B',
      email: 'doctor.b@example.com',
      phoneNumber: '0901234568',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1985-08-15'),
      gender: 'female',
      address: 'Hà Nội',
      roleType: 'doctor',
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=46'
    },
    {
      fullName: 'Bác sĩ Phạm Văn C',
      email: 'doctor.c@example.com',
      phoneNumber: '0901234569',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1975-03-20'),
      gender: 'male',
      address: 'Hà Nội',
      roleType: 'doctor',
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=5'
    },
    {
      fullName: 'Bác sĩ Lê Thị D',
      email: 'doctor.d@example.com',
      phoneNumber: '0901234570',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1988-11-05'),
      gender: 'female',
      address: 'Hà Nội',
      roleType: 'doctor',
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=47'
    }
  ]);
  
  for (let i = 0; i < doctorUsers.length; i++) {
    const doctor = await Doctor.create({
      user: doctorUsers[i]._id,
      specialtyId: specialties[i % specialties.length]._id,
      hospitalId: hospitals[0]._id,
      services: [services[i % services.length]._id, services[(i + 1) % services.length]._id],
      title: i % 2 === 0 ? 'BS.CK2' : 'BS.CK1',
      description: `Bác sĩ với hơn ${10 + i} năm kinh nghiệm trong lĩnh vực ${specialties[i % specialties.length].name}`,
      education: 'Đại học Y Hà Nội',
      experience: 10 + i,
      certifications: ['Chứng chỉ hành nghề', 'Chứng nhận chuyên khoa'],
      languages: ['Tiếng Việt', 'Tiếng Anh'],
      consultationFee: 300000 + (i * 50000),
      isAvailable: true
    });
    
    doctors.push(doctor);
  }
  
  console.log(`${doctors.length} doctors created!`);
  return { doctors, doctorUsers };
};

// Create pharmacist users
const createPharmacists = async (hospitals) => {
  console.log('Creating pharmacists...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('HospitalApp@123', salt);
  
  const pharmacists = await User.insertMany([
    {
      fullName: 'Dược sĩ Nguyễn Thị X',
      email: 'pharmacist.x@example.com',
      phoneNumber: '0901234571',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1990-06-15'),
      gender: 'female',
      address: 'Hà Nội',
      roleType: 'pharmacist',
      hospitalId: hospitals[0]._id,
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=45'
    },
    {
      fullName: 'Dược sĩ Trần Văn Y',
      email: 'pharmacist.y@example.com',
      phoneNumber: '0901234572',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1992-03-20'),
      gender: 'male',
      address: 'Hà Nội',
      roleType: 'pharmacist',
      hospitalId: hospitals[1] ? hospitals[1]._id : hospitals[0]._id,
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=13'
    }
  ]);
  
  console.log(`${pharmacists.length} pharmacists created!`);
  return pharmacists;
};

// Create medications for each hospital
const createMedications = async (hospitals, admin) => {
  console.log('Creating medications...');
  const allMedications = [];
  
  const medicationData = [
    { name: 'Paracetamol 500mg', category: 'pain-relief', unitPrice: 5000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 1000 },
    { name: 'Amoxicillin 250mg', category: 'antibiotic', unitPrice: 8000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 500 },
    { name: 'Ibuprofen 400mg', category: 'pain-relief', unitPrice: 7000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 800 },
    { name: 'Loratadine 10mg', category: 'antihistamine', unitPrice: 6000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 600 },
    { name: 'Omeprazole 20mg', category: 'gastrointestinal', unitPrice: 10000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 400 },
    { name: 'Vitamin C 1000mg', category: 'other', unitPrice: 3000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 1200 },
    { name: 'Vitamin B Complex', category: 'other', unitPrice: 4000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 900 },
    { name: 'Probiotics', category: 'gastrointestinal', unitPrice: 12000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 350 },
    { name: 'Calcium 500mg', category: 'other', unitPrice: 5000, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 700 },
    { name: 'Zinc 10mg', category: 'other', unitPrice: 3500, unitType: 'pill', unitTypeDisplay: 'viên', stockQuantity: 550 }
  ];
  
  for (const hospital of hospitals) {
    for (const medData of medicationData) {
      const medication = await Medication.create({
        ...medData,
        description: `Thuốc ${medData.name} - ${hospital.name}`,
        defaultDosage: 'Theo chỉ định của bác sĩ',
        defaultUsage: 'Uống sau ăn',
        defaultDuration: '7 ngày',
        manufacturer: 'Công ty Dược phẩm Việt Nam',
        hospitalId: hospital._id,
        createdBy: admin._id,
        isActive: true
      });
      allMedications.push(medication);
    }
  }
  
  console.log(`${allMedications.length} medications created!`);
  return allMedications;
};

// Create prescription templates (system-wide)
const createPrescriptionTemplates = async (medications, doctors) => {
  console.log('Creating prescription templates...');
  
  const templates = [];
  
  // Template 1: Cảm lạnh
  const coldMeds = medications.filter(m => 
    ['Paracetamol', 'Vitamin C'].some(name => m.name.includes(name))
  ).slice(0, 2);
  
  if (coldMeds.length >= 2) {
    const template1 = await PrescriptionTemplate.create({
      name: 'Đơn thuốc cảm lạnh',
      description: 'Đơn thuốc mẫu cho bệnh cảm lạnh thông thường',
      category: 'respiratory',
      diseaseType: 'Cảm lạnh',
      medications: [
        {
          medicationId: coldMeds[0]._id,
          quantity: 10,
          dosage: '500mg',
          usage: 'Uống sau ăn',
          duration: '5 ngày'
        },
        {
          medicationId: coldMeds[1]._id,
          quantity: 20,
          dosage: '1000mg',
          usage: 'Uống sáng',
          duration: '7 ngày'
        }
      ],
      createdBy: doctors[0].user,
      createdByRole: 'doctor',
      creatorName: 'Bác sĩ Nguyễn Văn A',
      isActive: true,
      isPublic: true
    });
    templates.push(template1);
  }
  
  // Template 2: Đau dạ dày
  const stomachMeds = medications.filter(m => 
    ['Omeprazole', 'Probiotics'].some(name => m.name.includes(name))
  ).slice(0, 2);
  
  if (stomachMeds.length >= 2) {
    const template2 = await PrescriptionTemplate.create({
      name: 'Đơn thuốc đau dạ dày',
      description: 'Đơn thuốc mẫu cho bệnh đau dạ dày',
      category: 'digestive',
      diseaseType: 'Đau dạ dày',
      medications: [
        {
          medicationId: stomachMeds[0]._id,
          quantity: 14,
          dosage: '20mg',
          usage: 'Uống trước ăn sáng',
          duration: '14 ngày'
        },
        {
          medicationId: stomachMeds[1]._id,
          quantity: 10,
          dosage: 'Theo chỉ định',
          usage: 'Uống sau ăn',
          duration: '10 ngày'
        }
      ],
      createdBy: doctors[0].user,
      createdByRole: 'doctor',
      creatorName: 'Bác sĩ Nguyễn Văn A',
      isActive: true,
      isPublic: true
    });
    templates.push(template2);
  }
  
  console.log(`${templates.length} prescription templates created!`);
  return templates;
};

// Create schedules
const createSchedules = async (doctors, hospitals, rooms) => {
  console.log('Creating schedules...');
  const doctorSchedules = [];
  const today = new Date();
  
  for (let day = 0; day < 30; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dayOfWeek = date.getDay();
    
    for (let i = 0; i < doctors.length; i++) {
      if ((i % 2 === 0 && dayOfWeek === 0) || (i % 3 === 0 && dayOfWeek === 6)) {
        continue;
      }
      
      if (day % 3 !== 0 || i % 2 === 0) {
        const morningTimeSlots = [
          { startTime: '08:00', endTime: '09:00', isBooked: false, roomId: rooms[i % rooms.length]._id },
          { startTime: '09:00', endTime: '10:00', isBooked: false, roomId: rooms[i % rooms.length]._id },
          { startTime: '10:00', endTime: '11:00', isBooked: false, roomId: rooms[i % rooms.length]._id },
          { startTime: '11:00', endTime: '12:00', isBooked: false, roomId: rooms[i % rooms.length]._id }
        ];
        
        const morningSchedule = await Schedule.create({
          name: 'Ca sáng',
          doctorId: doctors[i]._id,
          hospitalId: hospitals[0]._id,
          date: date,
          timeSlots: morningTimeSlots,
          isActive: true,
          notes: 'Lịch khám buổi sáng'
        });
        
        doctorSchedules.push(morningSchedule);
      }
    }
  }
  
  console.log(`${doctorSchedules.length} doctor schedules created!`);
  return doctorSchedules;
};

// Create regular users
const createUsers = async () => {
  console.log('Creating regular users...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('HospitalApp@123', salt);
  
  const users = await User.insertMany([
    {
      fullName: 'Nguyễn Văn Khách',
      email: 'user1@example.com',
      phoneNumber: '0912345678',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1990-06-15'),
      gender: 'male',
      address: 'Số 10, Đường Lê Lợi, Quận 1, TP.HCM',
      roleType: 'user',
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=10'
    },
    {
      fullName: 'Trần Thị Bệnh',
      email: 'user2@example.com',
      phoneNumber: '0923456789',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1985-03-20'),
      gender: 'female',
      address: 'Số 25, Đường Nguyễn Huệ, Quận Ba Đình, Hà Nội',
      roleType: 'user',
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=33'
    },
    {
      fullName: 'Lê Văn Người',
      email: 'user3@example.com',
      phoneNumber: '0934567890',
      passwordHash: hashedPassword,
      dateOfBirth: new Date('1995-11-10'),
      gender: 'male',
      address: 'Số 5, Đường Hoàng Diệu, Quận Hải Châu, Đà Nẵng',
      roleType: 'user',
      isVerified: true,
      avatarUrl: 'https://i.pravatar.cc/300?img=6'
    }
  ]);
  
  console.log(`${users.length} regular users created!`);
  return users;
};

// Create coupons
const createCoupons = async (admin) => {
  console.log('Creating coupons...');
  const today = new Date();
  
  const coupons = await Coupon.insertMany([
    {
      code: 'WELCOME2023',
      discountType: 'percentage',
      discountValue: 10,
      minPurchase: 300000,
      maxDiscount: 100000,
      startDate: today,
      endDate: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()),
      isActive: true,
      usageLimit: 1000,
      usedCount: 0,
      description: 'Giảm 10% cho lần đầu đặt khám',
      createdBy: admin._id
    },
    {
      code: 'HEALTH100K',
      discountType: 'fixed',
      discountValue: 100000,
      minPurchase: 500000,
      maxDiscount: 100000,
      startDate: today,
      endDate: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()),
      isActive: true,
      usageLimit: 500,
      usedCount: 0,
      description: 'Giảm 100,000đ cho đặt khám từ 500,000đ',
      createdBy: admin._id
    }
  ]);
  
  console.log(`${coupons.length} coupons created!`);
  return coupons;
};

// Create appointments
const createAppointments = async (users, doctors, doctorSchedules, services, coupons) => {
  console.log('Creating appointments...');
  const appointments = [];
  const today = new Date();
  const pastStartDate = new Date(today);
  pastStartDate.setMonth(today.getMonth() - 2);
  
  for (let i = 0; i < 15; i++) {
    const appointmentDate = new Date(pastStartDate);
    appointmentDate.setDate(pastStartDate.getDate() + Math.floor(Math.random() * 60));
    
    if (appointmentDate > today) continue;
    
    const userIndex = Math.floor(Math.random() * users.length);
    const doctorIndex = Math.floor(Math.random() * doctors.length);
    const doctor = doctors[doctorIndex];
    const user = users[userIndex];
    const serviceIndex = Math.floor(Math.random() * doctor.services.length);
    const service = await Service.findById(doctor.services[serviceIndex]);
    const randomSchedule = doctorSchedules[Math.floor(Math.random() * doctorSchedules.length)];
    
    if (randomSchedule.timeSlots.length === 0) continue;
    
    const randomTimeSlotIndex = Math.floor(Math.random() * randomSchedule.timeSlots.length);
    const randomTimeSlot = randomSchedule.timeSlots[randomTimeSlotIndex];
    
    const useCoupon = Math.random() > 0.7;
    const couponUsed = useCoupon ? coupons[Math.floor(Math.random() * coupons.length)] : null;
    const originalAmount = service.price;
    let discount = 0;
    
    if (useCoupon && couponUsed) {
      if (couponUsed.discountType === 'percentage') {
        discount = Math.min((originalAmount * couponUsed.discountValue) / 100, couponUsed.maxDiscount);
      } else {
        discount = couponUsed.discountValue;
      }
    }
    
    const finalAmount = originalAmount - discount;
    
    randomTimeSlot.isBooked = true;
    await randomSchedule.save();
    
    const appointment = await Appointment.create({
      patientId: user._id,
      doctorId: doctor._id,
      serviceId: service._id,
      specialtyId: doctor.specialtyId,
      scheduleId: randomSchedule._id,
      hospitalId: doctor.hospitalId,
      appointmentDate: appointmentDate,
      timeSlot: {
        startTime: randomTimeSlot.startTime,
        endTime: randomTimeSlot.endTime
      },
      appointmentType: ['first-visit', 'follow-up', 'consultation'][Math.floor(Math.random() * 3)],
      status: 'completed',
      notes: `Cuộc hẹn khám ${service.name}`,
      symptoms: ['Đau đầu', 'Chóng mặt', 'Mệt mỏi'][Math.floor(Math.random() * 3)],
      medicalHistory: 'Không có tiền sử bệnh đặc biệt',
      fee: {
        consultationFee: originalAmount,
        discount: discount,
        totalAmount: finalAmount
      },
      paymentStatus: 'completed',
      createdAt: new Date(appointmentDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    });
    
    appointments.push(appointment);
    
    if (useCoupon && couponUsed) {
      await Coupon.findByIdAndUpdate(couponUsed._id, { $inc: { usedCount: 1 } });
    }
  }
  
  console.log(`${appointments.length} appointments created!`);
  return appointments;
};

// Create prescriptions for appointments
const createPrescriptions = async (appointments, medications, doctors) => {
  console.log('Creating prescriptions...');
  const prescriptions = [];
  
  for (const appointment of appointments) {
    // 70% appointments có prescription
    if (Math.random() > 0.3) {
      const doctor = doctors.find(d => d._id.toString() === appointment.doctorId.toString());
      if (!doctor) continue;
      
      // Get medications from the same hospital as appointment
      const hospitalMedications = medications.filter(m => 
        m.hospitalId.toString() === appointment.hospitalId.toString()
      );
      
      if (hospitalMedications.length === 0) continue;
      
      // Select 2-3 random medications
      const selectedMeds = hospitalMedications
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 2) + 2);
      
      const prescriptionMeds = selectedMeds.map(med => ({
        medicationId: med._id,
        medicationName: med.name,
        quantity: Math.floor(Math.random() * 10) + 5,
        dosage: med.defaultDosage || 'Theo chỉ định',
        usage: med.defaultUsage || 'Uống sau ăn',
        duration: med.defaultDuration || '7 ngày',
        unitPrice: med.unitPrice,
        totalPrice: med.unitPrice * (Math.floor(Math.random() * 10) + 5),
        notes: ''
      }));
      
      const totalAmount = prescriptionMeds.reduce((sum, m) => sum + m.totalPrice, 0);
      
      const prescription = await Prescription.create({
        appointmentId: appointment._id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        hospitalId: appointment.hospitalId,
        medications: prescriptionMeds,
        totalAmount: totalAmount,
        status: Math.random() > 0.3 ? 'dispensed' : 'approved',
        diagnosis: 'Cảm lạnh thông thường',
        notes: 'Uống thuốc đều đặn',
        prescriptionOrder: 1,
        isHospitalization: false
      });
      
      prescriptions.push(prescription);
      
      // Reduce stock
      for (const med of selectedMeds) {
        const quantity = prescriptionMeds.find(pm => pm.medicationId.toString() === med._id.toString()).quantity;
        med.stockQuantity -= quantity;
        await med.save();
        
        // Create inventory record
        await MedicationInventory.create({
          medicationId: med._id,
          transactionType: 'prescription',
          quantity: quantity,
          previousStock: med.stockQuantity + quantity,
          newStock: med.stockQuantity,
          unitPrice: med.unitPrice,
          totalCost: med.unitPrice * quantity,
          performedBy: appointment.doctorId,
          reason: 'Kê đơn thuốc',
          referenceId: prescription._id,
          referenceType: 'Prescription',
          hospitalId: appointment.hospitalId
        });
      }
    }
  }
  
  console.log(`${prescriptions.length} prescriptions created!`);
  return prescriptions;
};

// Create bills
const createBills = async (appointments, prescriptions) => {
  console.log('Creating bills...');
  const bills = [];
  
  for (const appointment of appointments) {
    const appointmentPrescriptions = prescriptions.filter(p => 
      p.appointmentId.toString() === appointment._id.toString()
    );
    
    const consultationAmount = appointment.fee?.totalAmount || 500000;
    const medicationAmount = appointmentPrescriptions.reduce((sum, p) => sum + p.totalAmount, 0);
    
    // Generate bill number
    const billCount = await Bill.countDocuments();
    const billNumber = `BILL-${String(billCount + 1).padStart(6, '0')}`;
    
    const prescriptionPayments = appointmentPrescriptions.map(p => ({
      prescriptionId: p._id,
      amount: p.totalAmount,
      status: p.status === 'dispensed' ? 'paid' : 'pending',
      paymentMethod: p.status === 'dispensed' ? 'cash' : undefined,
      paymentDate: p.status === 'dispensed' ? new Date() : undefined
    }));
    
    // Calculate payment status
    const allPrescriptionsPaid = medicationAmount === 0 || prescriptionPayments.every(p => p.status === 'paid');
    const paidAmount = consultationAmount + (allPrescriptionsPaid ? medicationAmount : 0);
    const remainingAmount = medicationAmount > 0 && !allPrescriptionsPaid ? medicationAmount : 0;
    
    // Determine overallStatus: 'unpaid', 'partial', or 'paid'
    let overallStatus = 'unpaid';
    if (paidAmount > 0 && remainingAmount === 0) {
      overallStatus = 'paid';
    } else if (paidAmount > 0 && remainingAmount > 0) {
      overallStatus = 'partial';
    }
    
    const bill = await Bill.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      billNumber: billNumber,
      consultationBill: {
        amount: consultationAmount,
        status: 'paid',
        paymentMethod: 'cash',
        paymentDate: new Date(appointment.appointmentDate)
      },
      medicationBill: {
        prescriptionIds: appointmentPrescriptions.map(p => p._id),
        amount: medicationAmount,
        status: medicationAmount > 0 ? (allPrescriptionsPaid ? 'paid' : 'pending') : 'pending',
        prescriptionPayments: prescriptionPayments
      },
      hospitalizationBill: {
        amount: 0,
        status: 'pending'
      },
      totalAmount: consultationAmount + medicationAmount,
      paidAmount: paidAmount,
      remainingAmount: remainingAmount,
      overallStatus: overallStatus
    });
    
    bills.push(bill);
  }
  
  console.log(`${bills.length} bills created!`);
  return bills;
};

// Create medical records (linked to prescriptions)
const createMedicalRecords = async (appointments, prescriptions, doctors) => {
  console.log('Creating medical records...');
  const medicalRecords = [];
  
  for (const appointment of appointments) {
    const prescription = prescriptions.find(p => 
      p.appointmentId.toString() === appointment._id.toString()
    );
    
    if (prescription && Math.random() > 0.2) {
      const prescriptionData = prescription.medications.map(med => ({
        medicine: med.medicationName,
        dosage: med.dosage,
        usage: med.usage,
        duration: med.duration,
        notes: med.notes || '',
        quantity: med.quantity,
        medicationId: med.medicationId,
        frequency: med.dosage
      }));
      
      const doctor = doctors.find(d => d._id.toString() === appointment.doctorId.toString());
      
      // Get specialty name
      const Specialty = require('../models/Specialty');
      const specialty = await Specialty.findById(appointment.specialtyId);
      
      const medicalRecord = await MedicalRecord.create({
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentId: appointment._id,
        prescriptionId: prescription._id,
        diagnosis: prescription.diagnosis || 'Cảm lạnh thông thường',
        symptoms: appointment.symptoms || '',
        treatment: 'Uống thuốc đều đặn',
        prescription: prescriptionData,
        notes: prescription.notes || '',
        specialty: appointment.specialtyId,
        specialtyName: specialty ? specialty.name : '',
        status: 'completed',
        isActive: true
      });
      
      medicalRecords.push(medicalRecord);
    }
  }
  
  console.log(`${medicalRecords.length} medical records created!`);
  return medicalRecords;
};

// Create inpatient rooms
const createInpatientRooms = async (hospitals) => {
  console.log('Creating inpatient rooms...');
  const inpatientRooms = [];
  
  for (const hospital of hospitals) {
    // Standard rooms
    for (let i = 1; i <= 5; i++) {
      const room = await InpatientRoom.create({
        roomNumber: `P${String(i).padStart(3, '0')}`,
        roomName: `Phòng nội trú ${i}`,
        floor: '3',
        type: 'standard',
        hourlyRate: 50000,
        capacity: 2,
        currentOccupancy: 0,
        amenities: ['Điều hòa', 'TV', 'Giường bệnh'],
        status: 'available',
        hospitalId: hospital._id,
        isActive: true,
        description: `Phòng nội trú tiêu chuẩn - ${hospital.name}`
      });
      inpatientRooms.push(room);
    }
    
    // VIP rooms
    for (let i = 1; i <= 2; i++) {
      const room = await InpatientRoom.create({
        roomNumber: `VIP${String(i).padStart(2, '0')}`,
        roomName: `Phòng VIP ${i}`,
        floor: '4',
        type: 'vip',
        hourlyRate: 150000,
        capacity: 1,
        currentOccupancy: 0,
        amenities: ['Điều hòa', 'TV', 'Tủ lạnh', 'Giường bệnh cao cấp'],
        status: 'available',
        hospitalId: hospital._id,
        isActive: true,
        description: `Phòng VIP - ${hospital.name}`
      });
      inpatientRooms.push(room);
    }
    
    // ICU rooms
    const icuRoom = await InpatientRoom.create({
      roomNumber: 'ICU01',
      roomName: 'Phòng ICU',
      floor: '5',
      type: 'icu',
      hourlyRate: 300000,
      capacity: 1,
      currentOccupancy: 0,
      amenities: ['Máy thở', 'Monitor', 'Máy đo huyết áp', 'Thiết bị cấp cứu'],
      status: 'available',
      hospitalId: hospital._id,
      isActive: true,
      description: `Phòng chăm sóc đặc biệt - ${hospital.name}`,
      equipment: ['Máy thở', 'Monitor', 'Máy đo huyết áp']
    });
    inpatientRooms.push(icuRoom);
  }
  
  console.log(`${inpatientRooms.length} inpatient rooms created!`);
  return inpatientRooms;
};

// Create hospitalizations
const createHospitalizations = async (appointments, inpatientRooms, doctors) => {
  console.log('Creating hospitalizations...');
  const hospitalizations = [];
  
  for (const appointment of appointments) {
    // 20% appointments có hospitalization
    if (Math.random() > 0.8 && appointment.status === 'completed') {
      // Find available room in same hospital
      const hospitalRooms = inpatientRooms.filter(r => 
        r.hospitalId.toString() === appointment.hospitalId.toString() && 
        r.status === 'available'
      );
      
      if (hospitalRooms.length === 0) continue;
      
      const selectedRoom = hospitalRooms[Math.floor(Math.random() * hospitalRooms.length)];
      const admissionDate = new Date(appointment.appointmentDate);
      admissionDate.setHours(admissionDate.getHours() + 2);
      
      const hospitalization = await Hospitalization.create({
        appointmentId: appointment._id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        inpatientRoomId: selectedRoom._id,
        admissionDate: admissionDate,
        status: Math.random() > 0.5 ? 'discharged' : 'admitted',
        hourlyRate: selectedRoom.hourlyRate,
        admissionReason: 'Cần theo dõi sức khỏe',
        notes: 'Bệnh nhân cần nội trú để theo dõi'
      });
      
      if (hospitalization.status === 'discharged') {
        const dischargeDate = new Date(admissionDate);
        dischargeDate.setHours(dischargeDate.getHours() + 24);
        hospitalization.dischargeDate = dischargeDate;
        hospitalization.dischargedBy = appointment.doctorId;
        hospitalization.dischargeReason = 'Sức khỏe ổn định';
        
        // Add room history
        const hours = 24;
        hospitalization.roomHistory = [{
          inpatientRoomId: selectedRoom._id,
          roomNumber: selectedRoom.roomNumber,
          roomType: selectedRoom.type,
          checkInTime: admissionDate,
          checkOutTime: dischargeDate,
          hourlyRate: selectedRoom.hourlyRate,
          hours: hours,
          amount: hours * selectedRoom.hourlyRate
        }];
        
        hospitalization.totalHours = hours;
        hospitalization.totalAmount = hours * selectedRoom.hourlyRate;
        await hospitalization.save();
      } else {
        // Update room occupancy
        selectedRoom.currentOccupancy += 1;
        if (selectedRoom.currentOccupancy >= selectedRoom.capacity) {
          selectedRoom.status = 'occupied';
        }
        await selectedRoom.save();
        
        // Add initial room history entry
        hospitalization.roomHistory = [{
          inpatientRoomId: selectedRoom._id,
          roomNumber: selectedRoom.roomNumber,
          roomType: selectedRoom.type,
          checkInTime: admissionDate,
          hourlyRate: selectedRoom.hourlyRate
        }];
        await hospitalization.save();
      }
      
      hospitalizations.push(hospitalization);
    }
  }
  
  console.log(`${hospitalizations.length} hospitalizations created!`);
  return hospitalizations;
};

// Create video rooms for appointments
const createVideoRooms = async (appointments, users, doctors) => {
  console.log('Creating video rooms...');
  const videoRooms = [];
  
  // Create video rooms for some appointments (30%)
  for (const appointment of appointments) {
    if (Math.random() > 0.7) {
      const roomName = `appointment_${appointment._id}_${Date.now()}`;
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const startTime = new Date(appointment.appointmentDate);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);
      
      const doctorForRoom = doctors.find(d => d._id.toString() === appointment.doctorId.toString());
      const doctorUserId = doctorForRoom ? doctorForRoom.user : appointment.patientId;
      
      const videoRoom = await VideoRoom.create({
        roomName: roomName,
        roomCode: roomCode,
        meetingType: 'appointment',
        isPublic: true,
        appointmentId: appointment._id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        createdBy: appointment.patientId, // Created by patient
        status: appointment.status === 'completed' ? 'ended' : 'waiting',
        startTime: startTime,
        endTime: appointment.status === 'completed' ? endTime : null,
        duration: appointment.status === 'completed' ? 30 : 0,
        participants: [
          {
            userId: appointment.patientId,
            role: 'patient',
            joinedAt: startTime,
            leftAt: appointment.status === 'completed' ? endTime : null
          },
          {
            userId: doctorUserId,
            role: 'doctor',
            joinedAt: new Date(startTime.getTime() + 1000),
            leftAt: appointment.status === 'completed' ? endTime : null
          }
        ],
        metadata: {
          maxParticipants: 10,
          enableRecording: false,
          enableScreenShare: true,
          enableChat: true
        }
      });
      
      videoRooms.push(videoRoom);
    }
  }
  
  console.log(`${videoRooms.length} video rooms created!`);
  return videoRooms;
};

// Create doctor meetings
const createDoctorMeetings = async (doctors, hospitals) => {
  console.log('Creating doctor meetings...');
  const meetings = [];
  
  for (let i = 0; i < 5; i++) {
    const organizer = doctors[Math.floor(Math.random() * doctors.length)];
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + i);
    startTime.setHours(10 + i, 0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    
    const roomName = `meeting_${organizer._id}_${Date.now()}_${i}`;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const invitedDoctors = doctors
      .filter(d => d._id.toString() !== organizer._id.toString())
      .slice(0, Math.floor(Math.random() * 3) + 1)
      .map(d => d._id);
    
    const meeting = await DoctorMeeting.create({
      roomCode: roomCode,
      roomName: roomName,
      title: `Cuộc họp ${i + 1}: Hội chẩn bệnh án`,
      description: 'Cuộc họp hội chẩn về các ca bệnh phức tạp',
      createdBy: organizer._id,
      organizer: organizer._id,
      hospitals: [hospitals[0]._id],
      primaryHospital: hospitals[0]._id,
      status: i < 2 ? 'ended' : 'waiting',
      startTime: startTime,
      endTime: i < 2 ? endTime : null,
      duration: i < 2 ? 60 : 0,
      participants: [
        {
          doctorId: organizer._id,
          joinedAt: startTime,
          leftAt: i < 2 ? endTime : null
        },
        ...invitedDoctors.map(docId => ({
          doctorId: docId,
          joinedAt: new Date(startTime.getTime() + 5000),
          leftAt: i < 2 ? endTime : null
        }))
      ],
      maxParticipants: 20,
      invitedDoctors: invitedDoctors,
      metadata: {
        enableRecording: false,
        enableScreenShare: true,
        enableChat: true
      }
    });
    
    meetings.push(meeting);
  }
  
  console.log(`${meetings.length} doctor meetings created!`);
  return meetings;
};

// Create bill payments
const createBillPayments = async (bills, appointments) => {
  console.log('Creating bill payments...');
  const billPayments = [];
  
  for (const bill of bills) {
    const appointment = appointments.find(a => a._id.toString() === bill.appointmentId.toString());
    if (!appointment) continue;
    
    // Create payment for consultation
    if (bill.consultationBill.amount > 0 && bill.consultationBill.status === 'paid') {
      const billPayment = await BillPayment.create({
        billId: bill._id,
        appointmentId: bill.appointmentId,
        patientId: bill.patientId,
        billType: 'consultation',
        amount: bill.consultationBill.amount,
        paymentMethod: bill.consultationBill.paymentMethod || 'cash',
        paymentStatus: 'completed',
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        processedBy: appointment.doctorId,
        notes: 'Thanh toán phí khám bệnh'
      });
      billPayments.push(billPayment);
    }
    
    // Create payments for medication prescriptions
    if (bill.medicationBill.prescriptionPayments && bill.medicationBill.prescriptionPayments.length > 0) {
      for (const prescriptionPayment of bill.medicationBill.prescriptionPayments) {
        if (prescriptionPayment.status === 'paid') {
          const billPayment = await BillPayment.create({
            billId: bill._id,
            appointmentId: bill.appointmentId,
            patientId: bill.patientId,
            billType: 'medication',
            amount: prescriptionPayment.amount,
            paymentMethod: prescriptionPayment.paymentMethod || 'cash',
            paymentStatus: 'completed',
            transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            processedBy: appointment.doctorId,
            notes: 'Thanh toán tiền thuốc'
          });
          billPayments.push(billPayment);
        }
      }
    }
    
    // Create payment for hospitalization if exists
    if (bill.hospitalizationBill.amount > 0 && bill.hospitalizationBill.status === 'paid') {
      const billPayment = await BillPayment.create({
        billId: bill._id,
        appointmentId: bill.appointmentId,
        patientId: bill.patientId,
        billType: 'hospitalization',
        amount: bill.hospitalizationBill.amount,
        paymentMethod: bill.hospitalizationBill.paymentMethod || 'cash',
        paymentStatus: 'completed',
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        processedBy: appointment.doctorId,
        notes: 'Thanh toán phí nội trú'
      });
      billPayments.push(billPayment);
    }
  }
  
  console.log(`${billPayments.length} bill payments created!`);
  return billPayments;
};

// Create notifications
const createNotifications = async (users, doctors, appointments, conversations) => {
  console.log('Creating notifications...');
  const notifications = [];
  
  // Create notifications for appointments
  for (const appointment of appointments) {
    const notification = await Notification.create({
      userId: appointment.patientId,
      type: 'appointment',
      title: 'Lịch hẹn đã được xác nhận',
      content: `Lịch hẹn của bạn đã được xác nhận. Thời gian: ${new Date(appointment.appointmentDate).toLocaleString('vi-VN')}`,
      data: {
        appointmentId: appointment._id,
        senderId: appointment.doctorId
      },
      isRead: appointment.status === 'completed',
      readAt: appointment.status === 'completed' ? new Date(appointment.appointmentDate) : null
    });
    notifications.push(notification);
  }
  
  // Create notifications for conversations
  for (const conversation of conversations.slice(0, 5)) {
    if (conversation.lastMessage && conversation.lastMessage.senderId) {
      const notification = await Notification.create({
        userId: conversation.participants.find(p => p.toString() !== conversation.lastMessage.senderId.toString()),
        type: 'message',
        title: 'Tin nhắn mới',
        content: conversation.lastMessage.content || 'Bạn có tin nhắn mới',
        data: {
          conversationId: conversation._id,
          messageId: null,
          senderId: conversation.lastMessage.senderId
        },
        isRead: false
      });
      notifications.push(notification);
    }
  }
  
  console.log(`${notifications.length} notifications created!`);
  return notifications;
};

// Create news
const createNews = async (doctors, hospitals, admin) => {
  console.log('Creating news...');
  const newsArticles = [];
  
  const newsData = [
    {
      title: 'Cập nhật quy trình khám bệnh mới',
      summary: 'Bệnh viện đã cập nhật quy trình khám bệnh để phục vụ bệnh nhân tốt hơn',
      content: 'Nội dung chi tiết về quy trình khám bệnh mới...',
      category: 'hospital',
      tags: ['quy trình', 'khám bệnh'],
      hospital: hospitals[0]._id,
      image: {
        url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=1200'
      }
    },
    {
      title: 'Tư vấn sức khỏe mùa đông',
      summary: 'Các bác sĩ chuyên khoa chia sẻ cách bảo vệ sức khỏe trong mùa đông',
      content: 'Nội dung tư vấn về sức khỏe mùa đông...',
      category: 'medical',
      tags: ['sức khỏe', 'mùa đông', 'tư vấn'],
      author: doctors[0]._id,
      image: {
        url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200'
      }
    },
    {
      title: 'Giới thiệu dịch vụ khám sức khỏe tổng quát',
      summary: 'Dịch vụ khám sức khỏe tổng quát với trang thiết bị hiện đại',
      content: 'Nội dung về dịch vụ khám sức khỏe tổng quát...',
      category: 'service',
      tags: ['khám sức khỏe', 'dịch vụ'],
      hospital: hospitals[0]._id,
      image: {
        url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200'
      }
    }
  ];
  
  for (const article of newsData) {
    const slug = article.title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    const news = await News.create({
      ...article,
      slug: `${slug}-${Date.now()}`,
      publishDate: new Date(),
      isPublished: true,
      viewCount: Math.floor(Math.random() * 100)
    });
    newsArticles.push(news);
  }
  
  console.log(`${newsArticles.length} news articles created!`);
  return newsArticles;
};

// Create service price history
const createServicePriceHistory = async (services, admin) => {
  console.log('Creating service price history...');
  const priceHistories = [];
  
  for (const service of services) {
    // Simulate 1-2 price changes per service
    const changes = Math.floor(Math.random() * 2) + 1;
    
    let currentPrice = service.price;
    for (let i = 0; i < changes; i++) {
      const previousPrice = currentPrice;
      const changePercent = (Math.random() * 20) - 10; // -10% to +10%
      currentPrice = Math.round(previousPrice * (1 + changePercent / 100));
      
      const priceHistory = await ServicePriceHistory.create({
        serviceId: service._id,
        previousPrice: previousPrice,
        newPrice: currentPrice,
        changedBy: admin._id,
        reason: `Điều chỉnh giá theo chính sách ${i + 1}`,
        createdAt: new Date(Date.now() - (changes - i) * 30 * 24 * 60 * 60 * 1000) // Older dates
      });
      priceHistories.push(priceHistory);
    }
  }
  
  console.log(`${priceHistories.length} service price histories created!`);
  return priceHistories;
};

// Create reviews
const createReviews = async (appointments, users, doctors) => {
  console.log('Creating reviews...');
  const reviews = [];
  
  for (const appointment of appointments) {
    // 60% completed appointments have reviews
    if (appointment.status === 'completed' && Math.random() > 0.4) {
      const rating = Math.floor(Math.random() * 3) + 3; // 3-5 stars
      
      const comments = [
        'Bác sĩ rất tận tình và chuyên nghiệp',
        'Phòng khám sạch sẽ, nhân viên thân thiện',
        'Bác sĩ giải thích rất rõ ràng về tình trạng bệnh',
        'Thời gian chờ đợi ngắn, dịch vụ tốt',
        'Rất hài lòng với dịch vụ, sẽ quay lại lần sau'
      ];
      
      const review = await Review.create({
        userId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentId: appointment._id,
        hospitalId: appointment.hospitalId,
        rating: rating,
        comment: comments[Math.floor(Math.random() * comments.length)],
        date: new Date(appointment.appointmentDate.getTime() + Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000),
        status: 'approved'
      });
      
      reviews.push(review);
    }
  }
  
  console.log(`${reviews.length} reviews created!`);
  return reviews;
};

// Create conversations and messages (update existing)
const createConversations = async (users, doctors, appointments) => {
  console.log('Creating conversations and messages...');
  const conversations = [];
  const messages = [];
  
  for (let i = 0; i < 10; i++) {
    const randomAppointment = appointments[Math.floor(Math.random() * appointments.length)];
    const user = await User.findById(randomAppointment.patientId);
    const doctor = doctors.find(d => d._id.toString() === randomAppointment.doctorId.toString());
    const doctorUser = await User.findById(doctor.user);
    
    if (!user || !doctorUser) continue;
    
    const conversation = await Conversation.create({
      participants: [user._id, doctorUser._id],
      lastMessage: {
        content: 'Cảm ơn bác sĩ đã tư vấn!',
        senderId: user._id,
        timestamp: new Date(randomAppointment.appointmentDate)
      },
      unreadCount: {
        [user._id.toString()]: 0,
        [doctorUser._id.toString()]: 1
      },
      appointmentId: randomAppointment._id,
      isActive: true,
      lastActivity: new Date(randomAppointment.appointmentDate)
    });
    
    const messageCount = Math.floor(Math.random() * 10) + 3;
    const baseTime = new Date(conversation.createdAt);
    
    const patientMessages = [
      'Xin chào bác sĩ, tôi muốn hỏi về triệu chứng của mình',
      'Tôi bị đau đầu và chóng mặt mấy ngày nay',
      'Tôi có nên uống thuốc gì không?',
      'Cảm ơn bác sĩ đã tư vấn!'
    ];
    
    const doctorMessages = [
      'Xin chào, tôi có thể giúp gì cho bạn?',
      'Bạn có thể mô tả rõ hơn về triệu chứng không?',
      'Tôi khuyên bạn nên đến khám trực tiếp để có chẩn đoán chính xác',
      'Nhớ uống thuốc đúng liều lượng đã kê'
    ];
    
    for (let j = 0; j < messageCount; j++) {
      const isPatient = j % 2 === 0;
      const sender = isPatient ? user._id : doctorUser._id;
      const messageContent = isPatient 
        ? patientMessages[Math.floor(Math.random() * patientMessages.length)]
        : doctorMessages[Math.floor(Math.random() * doctorMessages.length)];
      
      baseTime.setMinutes(baseTime.getMinutes() + Math.floor(Math.random() * 60) + 1);
      
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: sender,
        receiverId: isPatient ? doctorUser._id : user._id,
        content: messageContent,
        messageType: 'text',
        readAt: isPatient ? null : new Date(baseTime)
      });
      
      messages.push(message);
      
      if (j === messageCount - 1) {
        await Conversation.findByIdAndUpdate(conversation._id, {
          lastMessage: {
            content: messageContent,
            senderId: sender,
            timestamp: message.createdAt
          }
        });
      }
    }
    
    conversations.push(conversation);
  }
  
  console.log(`${conversations.length} conversations created!`);
  console.log(`${messages.length} messages created!`);
  return { conversations, messages };
};

// Update main function
const seedDatabase = async () => {
  try {
    console.log('Starting database seeding process...');
    
    if (mongoose.connection.readyState !== 1) {
      await new Promise(resolve => {
        const checkConnection = () => {
          if (mongoose.connection.readyState === 1) resolve();
          else setTimeout(checkConnection, 1000);
        };
        checkConnection();
      });
    }

    await resetCollections();
    const admin = await createAdmin();
    const specialties = await createSpecialties();
    const hospitals = await createHospitals(specialties);
    const services = await createServices(specialties);
    const rooms = await createRooms(hospitals);
    const { doctors, doctorUsers } = await createDoctors(specialties, hospitals, services);
    const pharmacists = await createPharmacists(hospitals);
    const medications = await createMedications(hospitals, admin);
    const templates = await createPrescriptionTemplates(medications, doctors);
    const doctorSchedules = await createSchedules(doctors, hospitals, rooms);
    const users = await createUsers();
    const coupons = await createCoupons(admin);
    const appointments = await createAppointments(users, doctors, doctorSchedules, services, coupons);
    const prescriptions = await createPrescriptions(appointments, medications, doctors);
    const bills = await createBills(appointments, prescriptions);
    const inpatientRooms = await createInpatientRooms(hospitals);
    const hospitalizations = await createHospitalizations(appointments, inpatientRooms, doctors);
    
    // Update bills with hospitalization data
    for (const hospitalization of hospitalizations) {
      if (hospitalization.status === 'discharged') {
        const bill = await Bill.findOne({ appointmentId: hospitalization.appointmentId });
        if (bill) {
          const hospitalizationId = hospitalization._id;
          const hospitalizationAmount = hospitalization.totalAmount;
          const isPaid = Math.random() > 0.3;
          
          // Update hospitalizationBill
          bill.hospitalizationBill.hospitalizationId = hospitalizationId;
          bill.hospitalizationBill.amount = hospitalizationAmount;
          bill.hospitalizationBill.status = isPaid ? 'paid' : 'pending';
          if (isPaid) {
            bill.hospitalizationBill.paymentMethod = 'cash';
            bill.hospitalizationBill.paymentDate = new Date();
          }
          
          // Recalculate totals (Bill model pre-save hook will handle this, but we set explicitly)
          bill.totalAmount = 
            bill.consultationBill.amount + 
            bill.medicationBill.amount + 
            bill.hospitalizationBill.amount;
          
          // Calculate paid amount
          let paidAmount = 0;
          if (bill.consultationBill.status === 'paid') paidAmount += bill.consultationBill.amount;
          if (bill.hospitalizationBill.status === 'paid') paidAmount += bill.hospitalizationBill.amount;
          
          // For medicationBill: check prescriptionPayments
          if (bill.medicationBill.prescriptionPayments && bill.medicationBill.prescriptionPayments.length > 0) {
            const paidPrescriptions = bill.medicationBill.prescriptionPayments.filter(p => p.status === 'paid');
            paidAmount += paidPrescriptions.reduce((sum, p) => sum + (p.amount || 0), 0);
          } else if (bill.medicationBill.status === 'paid') {
            paidAmount += bill.medicationBill.amount;
          }
          
          bill.paidAmount = paidAmount;
          bill.remainingAmount = bill.totalAmount - paidAmount;
          
          // Update overallStatus
          if (bill.paidAmount === 0) {
            bill.overallStatus = 'unpaid';
          } else if (bill.paidAmount < bill.totalAmount) {
            bill.overallStatus = 'partial';
          } else {
            bill.overallStatus = 'paid';
          }
          
          await bill.save();
        }
      }
    }
    
    const updatedBills = await Bill.find();
    const medicalRecords = await createMedicalRecords(appointments, prescriptions, doctors);
    const reviews = await createReviews(appointments, users, doctors);
    const { conversations, messages } = await createConversations(users, doctors, appointments);
    const videoRooms = await createVideoRooms(appointments, users, doctors);
    const doctorMeetings = await createDoctorMeetings(doctors, hospitals);
    const billPayments = await createBillPayments(updatedBills, appointments);
    const notifications = await createNotifications(users, doctors, appointments, conversations);
    const news = await createNews(doctors, hospitals, admin);
    const priceHistories = await createServicePriceHistory(services, admin);

    console.log('\n=== Database seeding completed successfully ===\n');
    console.log(`
Summary:
- Admin users: 1
- Specialties: ${specialties.length}
- Hospitals: ${hospitals.length}
- Services: ${services.length}
- Rooms: ${rooms.length}
- Doctors: ${doctors.length}
- Pharmacists: ${pharmacists.length}
- Medications: ${medications.length}
- Prescription Templates: ${templates.length}
- Users: ${users.length}
- Coupons: ${coupons.length}
- Appointments: ${appointments.length}
- Prescriptions: ${prescriptions.length}
- Inpatient Rooms: ${inpatientRooms.length}
- Hospitalizations: ${hospitalizations.length}
- Bills: ${updatedBills.length}
- Bill Payments: ${billPayments.length}
- Medical Records: ${medicalRecords.length}
- Reviews: ${reviews.length}
- Conversations: ${conversations.length}
- Messages: ${messages.length}
- Video Rooms: ${videoRooms.length}
- Doctor Meetings: ${doctorMeetings.length}
- Notifications: ${notifications.length}
- News: ${news.length}
- Service Price History: ${priceHistories.length}

Default password for all accounts: HospitalApp@123
    `);

    return true;
  } catch (err) {
    console.error('Error seeding database:', err);
    console.error('Stack trace:', err.stack);
    return false;
  }
};

// ... (giữ nguyên runSeedProcess và runSeedProcess() từ code hiện tại) ...

// Run seed process
const runSeedProcess = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('Waiting for MongoDB connection...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MongoDB connection timeout'));
        }, 180000);
        
        const interval = setInterval(() => {
          if (mongoose.connection.readyState === 1) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve();
          }
        }, 1000);
        
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        });
      });
    }
    
    const success = await seedDatabase();
    await mongoose.disconnect();
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error('Fatal error:', err);
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch (disconnectErr) {
      console.error('Error disconnecting:', disconnectErr);
    }
    process.exit(1);
  }
};

runSeedProcess();

