# FRONTEND GUIDE

## 📱 TỔNG QUAN FRONTEND

### Tech Stack
- **Framework**: React 19.0.0
- **Build Tool**: Vite 5.1.4
- **Routing**: React Router DOM 7.4.0
- **State Management**: React Context API
- **UI Libraries**: Material-UI, Ant Design, TailwindCSS
- **HTTP Client**: Axios
- **Real-time**: Socket.io-client
- **Video Call**: LiveKit

---

## 📁 CẤU TRÚC THỨ MỤC

```
client/src/
├── components/
│   ├── admin/              # Admin components
│   │   ├── Sidebar.jsx
│   │   └── Header.jsx
│   ├── doctor/             # Doctor components
│   │   ├── Sidebar.jsx
│   │   └── Header.jsx
│   ├── user/               # User components
│   │   ├── Hero.jsx
│   │   ├── DoctorCard.jsx
│   │   ├── ServiceCard.jsx
│   │   ├── SpecialtyCard.jsx
│   │   └── ReviewCard.jsx
│   ├── shared/             # Shared components
│   │   ├── Loading.jsx
│   │   ├── ErrorBoundary.jsx
│   │   └── ProtectedRoute.jsx
│   ├── VideoCall/          # Video call components
│   ├── Navbar.jsx
│   ├── Footer.jsx
│   └── UserRoute.jsx
│
├── pages/
│   ├── user/               # User pages (34 files)
│   ├── doctor/             # Doctor pages (8 files)
│   ├── admin/              # Admin pages (14 files)
│   └── reviews/            # Review pages
│
├── context/
│   └── AuthContext.jsx     # Authentication context
│
├── utils/
│   ├── api.js              # Axios instance & interceptors
│   ├── helpers.js          # Helper functions
│   ├── validators.js       # Form validation
│   └── constants.js        # Constants
│
├── App.jsx                 # Main app with routing
├── main.jsx                # Entry point
└── index.css               # Global styles
```

---

## 🎨 UI LIBRARIES & STYLING

### Material-UI (MUI)
```jsx
import { Button, TextField, Card } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
```

**Sử dụng cho:**
- Form inputs (TextField, Select)
- Date/Time pickers
- Dialogs, Modals
- Tables với pagination
- Icons (@mui/icons-material)

### Ant Design
```jsx
import { Table, Modal, Form, Input, Select } from 'antd';
import { CalendarOutlined, UserOutlined } from '@ant-design/icons';
```

**Sử dụng cho:**
- Complex tables với filters
- Admin dashboards
- Form components
- Icons (@ant-design/icons)

### TailwindCSS
```jsx
<div className="flex items-center justify-between p-4 bg-blue-500 rounded-lg">
  <h1 className="text-2xl font-bold text-white">Title</h1>
</div>
```

**Sử dụng cho:**
- Layout (flex, grid)
- Spacing (margin, padding)
- Colors, typography
- Responsive design

### Bootstrap
```jsx
import { Container, Row, Col } from 'react-bootstrap';
```

**Sử dụng cho:**
- Grid system
- Responsive containers
- Some utility classes

---

## 🛣️ ROUTING (App.jsx)

### Route Structure
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* User Routes */}
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/:id" element={<DoctorDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/specialties" element={<Specialties />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/news" element={<News />} />
        
        {/* Protected User Routes */}
        <Route element={<ProtectedRoute role="user" />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/appointment" element={<Appointment />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/medical-history" element={<MedicalHistory />} />
          <Route path="/payment-history" element={<PaymentHistory />} />
        </Route>
        
        {/* Doctor Routes */}
        <Route element={<ProtectedRoute role="doctor" />}>
          <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
          <Route path="/doctor/appointments" element={<DoctorAppointments />} />
          <Route path="/doctor/schedule" element={<DoctorSchedule />} />
          <Route path="/doctor/patients" element={<DoctorPatients />} />
          <Route path="/doctor/medical-records" element={<MedicalRecords />} />
        </Route>
        
        {/* Admin Routes */}
        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/doctors" element={<AdminDoctors />} />
          <Route path="/admin/appointments" element={<AdminAppointments />} />
          <Route path="/admin/services" element={<AdminServices />} />
          <Route path="/admin/hospitals" element={<Hospitals />} />
          <Route path="/admin/payments" element={<Payments />} />
          <Route path="/admin/coupons" element={<Coupons />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### Protected Route Component
```jsx
// components/shared/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ role }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <Loading />;
  
  if (!user) return <Navigate to="/login" />;
  
  if (role && user.roleType !== role) {
    return <Navigate to="/" />;
  }
  
  return <Outlet />;
};
```

---

## 🔐 AUTHENTICATION

### AuthContext
```jsx
// context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          fetchUserProfile();
        } else {
          logout();
        }
      } catch (error) {
        logout();
      }
    }
    setLoading(false);
  }, []);
  
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };
  
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### Usage in Components
```jsx
import { useAuth } from '../context/AuthContext';

function Profile() {
  const { user, logout } = useAuth();
  
  return (
    <div>
      <h1>Welcome, {user.fullName}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## 🌐 API CALLS (Axios)

### Axios Configuration
```jsx
// utils/api.js
import axios from 'axios';
import { toast } from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - Add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      toast.error('Session expired. Please login again.');
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to access this resource.');
    } else if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    } else {
      toast.error('An error occurred. Please try again.');
    }
    return Promise.reject(error);
  }
);

export default api;
```

### API Service Functions
```jsx
// services/appointmentService.js
import api from '../utils/api';

export const appointmentService = {
  getAll: (params) => api.get('/appointments', { params }),
  
  getById: (id) => api.get(`/appointments/${id}`),
  
  create: (data) => api.post('/appointments', data),
  
  update: (id, data) => api.put(`/appointments/${id}`, data),
  
  cancel: (id, reason) => 
    api.delete(`/appointments/${id}`, { data: { reason } }),
  
  reschedule: (id, data) => 
    api.put(`/appointments/${id}/reschedule`, data)
};
```

### Usage in Components
```jsx
import { useEffect, useState } from 'react';
import { appointmentService } from '../services/appointmentService';

function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAppointments();
  }, []);
  
  const fetchAppointments = async () => {
    try {
      const response = await appointmentService.getAll();
      setAppointments(response.data.appointments);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {loading ? <Loading /> : <AppointmentList data={appointments} />}
    </div>
  );
}
```

---

## 💬 REAL-TIME (Socket.io)

### Socket Setup
```jsx
// utils/socket.js
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: {
    token: localStorage.getItem('token')
  }
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
```

### Usage in Chat Component
```jsx
import { useEffect, useState } from 'react';
import { socket, connectSocket, disconnectSocket } from '../utils/socket';

function Chat({ conversationId }) {
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    connectSocket();
    
    // Join conversation
    socket.emit('join_conversation', conversationId);
    
    // Listen for new messages
    socket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    // Cleanup
    return () => {
      socket.off('new_message');
      disconnectSocket();
    };
  }, [conversationId]);
  
  const sendMessage = (content) => {
    socket.emit('send_message', {
      conversationId,
      content
    });
  };
  
  return (
    <div>
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

---

## 🎥 VIDEO CALL (LiveKit)

### Video Call Component
```jsx
import { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  useToken
} from '@livekit/components-react';
import '@livekit/components-styles';
import api from '../utils/api';

function VideoCall({ roomName, appointmentId }) {
  const [token, setToken] = useState('');
  
  useEffect(() => {
    fetchToken();
  }, []);
  
  const fetchToken = async () => {
    try {
      const response = await api.post(`/rooms/${roomName}/join`, {
        appointmentId
      });
      setToken(response.data.token);
    } catch (error) {
      console.error('Failed to get token:', error);
    }
  };
  
  if (!token) return <Loading />;
  
  return (
    <LiveKitRoom
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      connect={true}
      audio={true}
      video={true}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
```

---

## 📊 CHARTS & STATISTICS

### Chart.js Example
```jsx
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend
);

function RevenueChart({ data }) {
  const chartData = {
    labels: data.map(d => d.month),
    datasets: [{
      label: 'Revenue',
      data: data.map(d => d.amount),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)'
    }]
  };
  
  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Monthly Revenue' }
    }
  };
  
  return <Line data={chartData} options={options} />;
}
```

### Recharts Example
```jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function AppointmentChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="appointments" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## 📝 FORM HANDLING

### Form with Validation
```jsx
import { useState } from 'react';
import { TextField, Button } from '@mui/material';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

function AppointmentForm() {
  const [formData, setFormData] = useState({
    doctorId: '',
    date: '',
    time: '',
    reason: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const validate = () => {
    const newErrors = {};
    if (!formData.doctorId) newErrors.doctorId = 'Please select a doctor';
    if (!formData.date) newErrors.date = 'Please select a date';
    if (!formData.time) newErrors.time = 'Please select a time';
    if (!formData.reason) newErrors.reason = 'Please enter a reason';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      await api.post('/appointments', formData);
      toast.success('Appointment booked successfully!');
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <TextField
        label="Doctor"
        value={formData.doctorId}
        onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
        error={!!errors.doctorId}
        helperText={errors.doctorId}
        fullWidth
        margin="normal"
      />
      {/* Other fields */}
      <Button type="submit" variant="contained" disabled={loading}>
        {loading ? 'Booking...' : 'Book Appointment'}
      </Button>
    </form>
  );
}
```

---

## 🖼️ IMAGE UPLOAD

### Upload Component
```jsx
import { useState } from 'react';
import { Button } from '@mui/material';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

function ImageUpload({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    setUploading(true);
    try {
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      onUploadSuccess(response.data.imageUrl);
      toast.success('Image uploaded successfully');
    } catch (error) {
      // Error handled by interceptor
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: 'none' }}
        id="image-upload"
      />
      <label htmlFor="image-upload">
        <Button variant="contained" component="span" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Image'}
        </Button>
      </label>
    </div>
  );
}
```

---

## 📱 RESPONSIVE DESIGN

### Breakpoints
```jsx
// TailwindCSS breakpoints
sm: 640px   // Mobile landscape
md: 768px   // Tablet
lg: 1024px  // Desktop
xl: 1280px  // Large desktop

// Example
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards */}
</div>
```

### Material-UI Responsive
```jsx
import { useMediaQuery, useTheme } from '@mui/material';

function ResponsiveComponent() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  return (
    <div>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}
```

---

## 🎭 ANIMATIONS

### Framer Motion
```jsx
import { motion } from 'framer-motion';

function AnimatedCard({ data }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.05 }}
    >
      <Card>{data}</Card>
    </motion.div>
  );
}
```

### AOS (Animate On Scroll)
```jsx
import AOS from 'aos';
import 'aos/dist/aos.css';

useEffect(() => {
  AOS.init({ duration: 1000 });
}, []);

// In JSX
<div data-aos="fade-up">
  <h1>Animated Content</h1>
</div>
```

---

## 🔔 NOTIFICATIONS

### React Hot Toast
```jsx
import toast from 'react-hot-toast';

// Success
toast.success('Operation successful!');

// Error
toast.error('Something went wrong!');

// Loading
const loadingToast = toast.loading('Loading...');
// Later: toast.dismiss(loadingToast);

// Custom
toast.custom((t) => (
  <div className="bg-blue-500 text-white p-4 rounded">
    Custom notification
  </div>
));
```

---

## 🧪 BEST PRACTICES

### 1. Component Organization
- Một component một file
- Tên file PascalCase
- Props destructuring
- PropTypes hoặc TypeScript

### 2. State Management
- useState cho local state
- Context cho global state (auth, theme)
- Avoid prop drilling

### 3. Performance
- useMemo cho expensive calculations
- useCallback cho event handlers
- React.memo cho pure components
- Lazy loading routes

### 4. Error Handling
- Try-catch trong async functions
- Error boundaries cho component errors
- User-friendly error messages

### 5. Code Style
- Consistent naming conventions
- Comments cho complex logic
- Clean up useEffect
- Avoid inline styles (use CSS classes)
