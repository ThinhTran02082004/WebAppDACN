import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import BottomTabs from './BottomTabs';
import DoctorDetail from '../screens/Doctor/DoctorDetail';
import FacilityDetail from '../screens/Facility/FacilityDetail';
import LoginScreen from '../screens/Login';
import RegisterScreen from '../screens/Register';
import UsageRegulationsScreen from '../screens/Legal/Policy';
import PrivacyPolicyScreen from '../screens/Legal/PrivacyPolicy';
import TermsOfServiceScreen from '../screens/Legal/Terms';
import FacilityListScreen from '../screens/Facility/FacilityList';
import SpecialtyListScreen from '../screens/Specialty/SpecialtyList';
import ServiceListScreen from '../screens/Service/ServiceList';
import DoctorListScreen from '../screens/Doctor/DoctorList';
import NewsListScreen from '../screens/News/NewsList';
import NewsDetailScreen from '../screens/News/NewsDetail';
import ServiceDetailScreen from '../screens/Service/ServiceDetail';
import SpecialtyDetailScreen from '../screens/Specialty/SpecialtyDetail';
import ProfileScreen from '../screens/Profile';
import ChangePasswordScreen from '../screens/ResetPassword';
import FavoriteDoctorsScreen from '../screens/FavoriteDoctors';
import AppointmentDetailScreen from '../screens/Schedule/AppointmentDetail';
import BookingNavigator from './BookingNavigator';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SocketProvider } from '../contexts/SocketContext';
import PaymentWebView from '../screens/Payment/PaymentWebView';
import PaymentResultScreen from '../screens/Payment/PaymentResult';
import RescheduleScreen from '../screens/Schedule/Reschedule';
import PaymentHistoryScreen from '../screens/Payment/PaymentHistory';
import VideoCallHistoryScreen from '../screens/VideoCallHistory';
import ChatDetailScreen from '../screens/ChatDetail';
import VideoCallScreen from '../screens/VideoCall';
import VideoCallNotification from '../components/VideoCallNotification';
import ReviewFormScreen from '../screens/ReviewForm';
import PrescriptionDetailScreen from '../screens/PrescriptionDetail';

function RootNavigator() {
  const { loading, user } = useAuth();
  const Stack = createStackNavigator();

  if (loading) return null;

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={BottomTabs} />
        <Stack.Screen name="DoctorDetail" component={DoctorDetail} />
        <Stack.Screen name="FacilityDetail" component={FacilityDetail} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="UsageRegulations" component={UsageRegulationsScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
        <Stack.Screen name="FacilityList" component={FacilityListScreen} />
        <Stack.Screen name="SpecialtyList" component={SpecialtyListScreen} />
        <Stack.Screen name="ServiceList" component={ServiceListScreen} />
        <Stack.Screen name="DoctorList" component={DoctorListScreen} />
        <Stack.Screen name="NewsList" component={NewsListScreen} />
        <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
        <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
        <Stack.Screen name="SpecialtyDetail" component={SpecialtyDetailScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="FavoriteDoctors" component={FavoriteDoctorsScreen} />
        <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
        <Stack.Screen name="Booking" component={BookingNavigator} />
        <Stack.Screen name="PaymentWebView" component={PaymentWebView} />
        <Stack.Screen name="PaymentResult" component={PaymentResultScreen} />
        <Stack.Screen name="Reschedule" component={RescheduleScreen} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
        <Stack.Screen name="VideoCallHistory" component={VideoCallHistoryScreen} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        <Stack.Screen name="VideoCall" component={VideoCallScreen} />
        <Stack.Screen name="ReviewForm" component={ReviewFormScreen} />
        <Stack.Screen name="PrescriptionDetail" component={PrescriptionDetailScreen} />
      </Stack.Navigator>
      {user && <VideoCallNotification />}
    </>
  );
}

export type RootStackParamList = {
  Home: undefined | { screen: 'Account' | 'Home' | 'Notifications' | 'Appointments' | 'Meds' | 'Messages' };
  DoctorDetail: { id: string };
  FacilityDetail: { id: string };
  Login: undefined;
  Register: undefined;
  UsageRegulations: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  FacilityList: undefined;
  SpecialtyList: undefined;
  ServiceList: undefined;
  DoctorList: undefined;
  NewsList: undefined;
  NewsDetail: { newsId: string };
  ServiceDetail: { serviceId: string };
  SpecialtyDetail: { specialtyId: string };
  Profile: undefined;
  ChangePassword: undefined;
  FavoriteDoctors: undefined;
  AppointmentDetail: { appointment?: any; appointmentId?: string; fromPayment?: boolean };
  Booking: { 
    doctorId?: string; 
    specialtyId?: string; 
    hospitalId?: string; 
    serviceId?: string;
  } | undefined;
  AppointmentSchedule: undefined;
  PaymentWebView: { url: string; mode: 'paypal' | 'momo'; appointmentId?: string; appointment?: any };
  PaymentResult: { orderId?: string; resultCode?: string; paymentId?: string; PayerID?: string; mode?: 'momo' | 'paypal'; appointmentId?: string };
  Reschedule: { appointmentId: string; doctorId: string; currentDate: string };
  PaymentHistory: undefined;
  VideoCallHistory: undefined;
  ChatDetail: { conversationId: string; conversation?: any };
  VideoCall: {
    roomId: string;
    roomName: string;
    token: string;
    wsUrl: string;
    role: string;
    appointmentInfo?: {
      id?: string;
      patientName?: string;
      doctorName?: string;
      date?: string;
    };
  };
  ReviewForm: { appointmentId: string; targetType: 'doctor' | 'hospital'; appointment?: any | null };
  PrescriptionDetail: { prescriptionId: string };
};

// const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SocketProvider>
    </AuthProvider>
  );
}
