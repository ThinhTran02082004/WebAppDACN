import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/user/Home.jsx';
import Doctors from './pages/user/Doctors.jsx';
import DoctorDetail from './pages/user/DoctorDetail.jsx';
import Branches from './pages/user/Branches.jsx';
import BranchDetail from './pages/user/BranchesDetail.jsx';
import Auth from './pages/user/Auth.jsx';
import Contact from './pages/user/Contact.jsx';

// Trang user
import Profile from './pages/user/Profile.jsx';
import Appointments from './pages/user/Appointments.jsx';
import Appointment from './pages/user/Appointment.jsx';
import AppointmentDetail from './pages/user/AppointmentDetail.jsx';
import PaymentHistory from './pages/PaymentHistory.jsx';
import DoctorPaymentHistory from './pages/doctor/PaymentHistory.jsx';
import PharmacistPaymentHistory from './pages/pharmacist/PaymentHistory.jsx';
import MedicalHistory from './pages/MedicalHistory.jsx';
import MedicalRecordDetail from './pages/MedicalRecordDetail.jsx';
import PrescriptionDetail from './pages/PrescriptionDetail.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import VideoCallNotification from './components/VideoCallNotification';
import ForgotPassword from './pages/user/ForgotPassword';
import OtpVerification from './pages/user/OtpVerification';
import ResetPassword from './pages/user/ResetPassword';
import VerifyEmail from './pages/user/VerifyEmail';
import NeedVerification from './pages/user/NeedVerification';
import PaymentResult from './pages/user/PaymentResult.jsx';

// Routes protectors
import UserRoute from './components/UserRoute';
import AdminRoute from './components/admin/AdminRoute';
import DoctorRoute from './components/doctor/DoctorRoute';
import PharmacistRoute from './components/pharmacist/PharmacistRoute';

// Trang doctor
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorAppointments from './pages/doctor/Appointments';
import DoctorSchedule from './pages/doctor/Schedule';
import DoctorPatients from './pages/doctor/Patients';
import DoctorMedicalRecords from './pages/doctor/MedicalRecords';
import DoctorProfile from './pages/doctor/Profile';
import DoctorReviews from './pages/doctor/Reviews';
import DoctorAppointmentDetail from './pages/doctor/AppointmentDetail';

// Trang pharmacist
import PharmacistDashboard from './pages/pharmacist/Dashboard';
import PharmacistPrescriptions from './pages/pharmacist/Prescriptions';
import PharmacistPrescriptionDetail from './pages/pharmacist/PrescriptionDetail';
import PharmacistAppointments from './pages/pharmacist/Appointments';
import PharmacistAppointmentDetail from './pages/pharmacist/AppointmentDetail';

// Trang khác
import NotFound from './pages/user/NotFound';
import SocialCallback from './pages/user/SocialCallback.jsx';
import SetSocialPassword from './pages/user/SetSocialPassword';
import Specialties from './pages/user/Specialties.jsx';
import SpecialtyDetail from './pages/user/SpecialtyDetail.jsx';
import Services from './pages/user/Services.jsx';
import ServiceDetail from './pages/user/ServiceDetail.jsx';
import RescheduleAppointment from './pages/user/RescheduleAppointment';
import PaymentStatus from './pages/user/PaymentStatus.jsx';
import ReviewChoice from './pages/user/ReviewChoice.jsx';
import ReviewForm from './pages/user/ReviewForm.jsx';

// Trang admin
import AdminDashboard from './pages/admin/Dashboard';
import AdminSpecialties from './pages/admin/Specialties';
import AdminServices from './pages/admin/Services';
import AdminRooms from './pages/admin/Rooms';
import Users from './pages/admin/Users';
import Hospitals from './pages/admin/Hospitals';
import AdminDoctors from './pages/admin/Doctors';
import Pharmacists from './pages/admin/Pharmacists';
// Thêm các trang admin mới

import AdminAppointments from './pages/admin/Appointments';
import AdminAppointmentDetail from './pages/admin/AppointmentDetail';
import AdminCoupons from './pages/admin/Coupons';
import AdminPayments from './pages/admin/Payments';
import AdminReviews from './pages/admin/Reviews';
import AdminDoctorSchedules from './pages/admin/DoctorSchedules';
import AdminMedications from './pages/admin/Medications';
import AdminNews from './pages/admin/News';
import VideoRoomManagement from './pages/admin/VideoRoomManagement';
import AdminDoctorMeetings from './pages/admin/DoctorMeetings';
import AdminVideoCallHistory from './pages/admin/VideoCallHistory';
import HistoryAI from './pages/admin/HistoryAI';
import MedicationInventory from './pages/admin/MedicationInventory';
import PrescriptionTemplates from './pages/admin/PrescriptionTemplates';
import InpatientRooms from './pages/admin/InpatientRooms';

import Facilities from './pages/user/Facilities';
import FacilitySurgery from './pages/user/FacilitySurgery';
import News from './pages/user/News';
import NewsDetail from './pages/user/NewsDetail';
import DoctorReviewsPage from './pages/reviews/DoctorReviews.jsx';
import HospitalReviews from './pages/reviews/HospitalReviews.jsx';

// Video call history pages
import DoctorVideoCallHistory from './pages/doctor/VideoCallHistory';
import DoctorMeetingHub from './pages/doctor/DoctorMeetingHub';
import UserVideoCallHistory from './pages/user/VideoCallHistory';

// Chat pages
import UserChat from './pages/user/Chat';
import DoctorChat from './pages/doctor/Chat';
import ChatWidget from './components/chat/ChatWidget';

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="spinner"></div>
    </div>;
  }

  // Show chat widget only for user role (not doctor or admin)
  const showChatWidget = isAuthenticated && user && (user.role === 'user' || user.roleType === 'user');

  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        {/* Admin Routes - No Navbar/Footer */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="pharmacists" element={<Pharmacists />} />
          <Route path="hospitals" element={<Hospitals />} />
          <Route path="specialties" element={<AdminSpecialties />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="rooms" element={<AdminRooms />} />
          {/* Thêm routes cho các trang admin mới */}
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="appointments/:id" element={<AdminAppointmentDetail />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="doctor-schedules" element={<AdminDoctorSchedules />} />
          <Route path="medications" element={<AdminMedications />} />
          <Route path="medication-inventory" element={<MedicationInventory />} />
          <Route path="prescription-templates" element={<PrescriptionTemplates />} />
          <Route path="inpatient-rooms" element={<InpatientRooms />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="video-rooms" element={<VideoRoomManagement />} />
          <Route path="doctor-meetings" element={<AdminDoctorMeetings />} />
          <Route path="video-call-history" element={<AdminVideoCallHistory />} />
          <Route path="history-ai" element={<HistoryAI />} />
        </Route>

        {/* Doctor Routes - No Navbar/Footer */}
        <Route path="/doctor" element={<DoctorRoute />}>
          <Route path="dashboard" element={<DoctorDashboard />} />
          <Route path="appointments" element={<DoctorAppointments />} />
          <Route path="appointments/:id" element={<DoctorAppointmentDetail />} />
          <Route path="patients" element={<DoctorPatients />} />
          <Route path="medical-records/:patientId" element={<DoctorMedicalRecords />} />
          <Route path="medical-records" element={<DoctorMedicalRecords />} />
          <Route path="schedule" element={<DoctorSchedule />} />
          <Route path="profile" element={<DoctorProfile />} />
          <Route path="reviews" element={<DoctorReviews />} />
          <Route path="meetings" element={<DoctorMeetingHub />} />
          <Route path="video-call-history" element={<DoctorVideoCallHistory />} />
          <Route path="payment-history" element={<DoctorPaymentHistory />} />
          <Route path="chat" element={<DoctorChat />} />
          <Route path="chat/:conversationId" element={<DoctorChat />} />
        </Route>

        {/* Pharmacist Routes - No Navbar/Footer */}
        <Route path="/pharmacist" element={<PharmacistRoute />}>
          <Route path="dashboard" element={<PharmacistDashboard />} />
          <Route path="appointments" element={<PharmacistAppointments />} />
          <Route path="appointments/:id" element={<PharmacistAppointmentDetail />} />
          <Route path="prescriptions" element={<PharmacistPrescriptions />} />
          <Route path="prescriptions/:id" element={<PharmacistPrescriptionDetail />} />
          <Route path="medication-inventory" element={<MedicationInventory />} />
          <Route path="payment-history" element={<PharmacistPaymentHistory />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Public and User Routes - With Navbar/Footer */}
        <Route path="*" element={
          <>
            <Navbar />
            <div className="flex-grow">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/otp-verification" element={<OtpVerification />} />
                <Route path="/need-verification" element={<NeedVerification />} />

                <Route path="/auth/social-callback" element={<SocialCallback />} />
                <Route path="/facebook-callback" element={<SocialCallback />} />
                <Route path="/doctors" element={<Doctors />} />
                <Route path="/doctors/:doctorId" element={<DoctorDetail />} />
                <Route path="/reviews/doctor/:doctorId" element={<DoctorReviewsPage />} />
                <Route path="/branches" element={<Branches />} />
                <Route path="/branches/:id" element={<BranchDetail />} />
                <Route path="/reviews/hospital/:id" element={<HospitalReviews />} />
                <Route path="/specialties" element={<Specialties />} />
                <Route path="/specialties/:specialtyId" element={<SpecialtyDetail />} />
                <Route path="/services" element={<Services />} />
                <Route path="/services/:serviceId" element={<ServiceDetail />} />
                <Route path="/contact" element={<Contact />} />

                {/* Payment Status Routes */}
                <Route path="/payment/paypal/success" element={<PaymentStatus />} />
                <Route path="/payment/paypal/cancel" element={<PaymentStatus />} />
                <Route path="/payment/result" element={<PaymentResult />} />

                {/* Redirect old routes to new auth page */}
                <Route path="/login" element={
                  isAuthenticated ? <Navigate to="/" /> : <Auth />
                } />
                <Route path="/register" element={
                  isAuthenticated ? <Navigate to="/" /> : <Auth />
                } />

                {/* User Protected Routes */}
                <Route element={<UserRoute />}>
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/appointment" element={<Appointment />} />
                  <Route path="/appointments/:id" element={<AppointmentDetail />} />
                  <Route path="/appointments/:id/reschedule" element={<RescheduleAppointment />} />
                  <Route path="/appointments/:id/review" element={<ReviewChoice />} />
                  <Route path="/appointments/:id/review/:type" element={<ReviewForm />} />
                  <Route path="/payment-history" element={<PaymentHistory />} />
                  <Route path="/medical-history" element={<MedicalHistory />} />
                  <Route path="/prescriptions/:id" element={<PrescriptionDetail />} />
                  <Route path="/medical-record/:id" element={<MedicalRecordDetail />} />
                  <Route path="/video-call-history" element={<UserVideoCallHistory />} />
                  <Route path="/chat" element={<UserChat />} />
                  <Route path="/chat/:conversationId" element={<UserChat />} />
                </Route>

                {/* New routes */}
                <Route path="/set-social-password" element={<SetSocialPassword />} />

                {/* New facilities routes */}
                <Route path="/facilities" element={<Facilities />} />
                <Route path="/facilities/surgery" element={<FacilitySurgery />} />

                {/* News routes */}
                <Route path="/news" element={<News />} />
                <Route path="/news/:slug" element={<NewsDetail />} />
                <Route path="/tin-tuc" element={<Navigate to="/news" />} />
                <Route path="/tin-tuc/:slug" element={<NewsDetail />} />

                {/* Catch All */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <Footer />
            <ChatWidget />
          </>
        } />
      </Routes>

      {/* Chat widget for regular users (not in admin or doctor portals) */}
      {showChatWidget && <ChatWidget currentUserId={user?.id} />}

      {/* Video call notification for all authenticated users */}
      {isAuthenticated && <VideoCallNotification />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <Router>
            <AppContent />
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick={false}
              rtl={false}
              pauseOnFocusLoss
              draggable={false}
              pauseOnHover
              theme="light"
              limit={3}
              style={{
                fontSize: '16px',
                zIndex: 9999,
                marginTop: '4.5rem'
              }}
            />
          </Router>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

// Protected route component for authenticated users
function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Redirect to login if not authenticated, but remember where they were going
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default App; 
