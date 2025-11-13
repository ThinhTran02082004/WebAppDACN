import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import BottomTabs from './BottomTabs';
import DoctorDetail from '../screens/DoctorDetail';
import FacilityDetail from '../screens/FacilityDetail';
import LoginScreen from '../screens/Login';
import RegisterScreen from '../screens/Register';
import UsageRegulationsScreen from '../screens/Policy';
import PrivacyPolicyScreen from '../screens/PrivacyPolicy';
import TermsOfServiceScreen from '../screens/Terms';
import FacilityListScreen from '../screens/FacilityList';
import SpecialtyListScreen from '../screens/SpecialtyList';
import ServiceListScreen from '../screens/ServiceList';
import DoctorListScreen from '../screens/DoctorList';
import NewsListScreen from '../screens/NewsList';
import NewsDetailScreen from '../screens/NewsDetail';
import ServiceDetailScreen from '../screens/ServiceDetail';
import SpecialtyDetailScreen from '../screens/SpecialtyDetail';
import ProfileScreen from '../screens/Profile';
import ChangePasswordScreen from '../screens/ResetPassword';
import FavoriteDoctorsScreen from '../screens/FavoriteDoctors';
import AppointmentDetailScreen from '../screens/AppointmentDetail';
import BookingNavigator from './BookingNavigator';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import PaymentWebView from '../screens/PaymentWebView';
import PaymentResultScreen from '../screens/PaymentResult';
import RescheduleScreen from '../screens/Reschedule';
import PaymentHistoryScreen from '../screens/PaymentHistory';

function RootNavigator() {
  const { loading } = useAuth();
  const Stack = createStackNavigator();

  if (loading) return null;

  return (
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
    </Stack.Navigator>
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
  Booking: undefined;
  AppointmentSchedule: undefined;
  PaymentWebView: { url: string; mode: 'paypal' | 'momo'; appointmentId?: string; appointment?: any };
  PaymentResult: { orderId?: string; resultCode?: string; paymentId?: string; PayerID?: string; mode?: 'momo' | 'paypal'; appointmentId?: string };
  Reschedule: { appointmentId: string; doctorId: string; currentDate: string };
  PaymentHistory: undefined;
};

// const Stack = createStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
