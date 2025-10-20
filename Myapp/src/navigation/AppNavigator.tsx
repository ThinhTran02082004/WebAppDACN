import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import BottomTabs from './BottomTabs';
import DoctorDetail from '../screens/DoctorDetail';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import UsageRegulationsScreen from '../screens/UsageRegulationsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import FacilityListScreen from '../screens/FacilityListScreen';
import SpecialtyListScreen from '../screens/SpecialtyListScreen';
import ServiceListScreen from '../screens/ServiceListScreen';
import DoctorListScreen from '../screens/DoctorListScreen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootNavigator() {
  const { loading } = useAuth();
  const Stack = createStackNavigator();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={BottomTabs} />
      <Stack.Screen name="DoctorDetail" component={DoctorDetail} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="UsageRegulations" component={UsageRegulationsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <Stack.Screen name="FacilityList" component={FacilityListScreen} />
      <Stack.Screen name="SpecialtyList" component={SpecialtyListScreen} />
      <Stack.Screen name="ServiceList" component={ServiceListScreen} />
      <Stack.Screen name="DoctorList" component={DoctorListScreen} />
    </Stack.Navigator>
  );
}

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Register: undefined;
  UsageRegulations: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  FacilityList: undefined;
  SpecialtyList: undefined;
  ServiceList: undefined;
  DoctorList: undefined;
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
