import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useRoute } from '@react-navigation/native';
import BookingAllInOne from '../screens/Booking';
import AppointmentScheduleScreen from '../screens/Schedule/Schedule';

export type BookingStackParamList = {
  Booking: { 
    doctorId?: string; 
    specialtyId?: string; 
    hospitalId?: string; 
    serviceId?: string;
  } | undefined;
  AppointmentSchedule: undefined;
};

const Stack = createStackNavigator<BookingStackParamList>();

export default function BookingNavigator() {
  // Get params from parent navigator
  const route = useRoute();
  const parentParams = (route.params as any) || {};
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="Booking" 
        component={BookingAllInOne} 
        options={{ title: 'Đặt lịch khám' }}
        initialParams={parentParams}
      />
      <Stack.Screen name="AppointmentSchedule" component={AppointmentScheduleScreen} options={{ title: 'Lịch hẹn của tôi' }} />
    </Stack.Navigator>
  );
}


