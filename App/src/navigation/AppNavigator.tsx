import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import BottomTabs from './BottomTabs';
import DoctorDetail from '../screens/DoctorDetail';
import FacilityDetail from '../screens/FacilityDetail';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import UsageRegulationsScreen from '../screens/UsageRegulationsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import FacilityListScreen from '../screens/FacilityListScreen';
import SpecialtyListScreen from '../screens/SpecialtyListScreen';
import ServiceListScreen from '../screens/ServiceListScreen';
import DoctorListScreen from '../screens/DoctorListScreen';
import NewsListScreen from '../screens/NewsListScreen';
import NewsDetailScreen from '../screens/NewsDetailScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import SpecialtyDetailScreen from '../screens/SpecialtyDetailScreen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootNavigator() {
  const { loading } = useAuth();
  const Stack = createStackNavigator();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabs} />
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
    </Stack.Navigator>
  );
}

export type RootStackParamList = {
  MainTabs: undefined;
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
