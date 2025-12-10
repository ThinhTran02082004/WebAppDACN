import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import BookingAllInOne from '../screens/Booking';
import AppointmentScheduleScreen from '../screens/Schedule';

export type BookingStackParamList = {
  Booking: undefined;
  AppointmentSchedule: undefined;
};

const Stack = createStackNavigator<BookingStackParamList>();

export default function BookingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Booking" component={BookingAllInOne} options={{ title: 'Đặt lịch khám' }} />
      <Stack.Screen name="AppointmentSchedule" component={AppointmentScheduleScreen} options={{ title: 'Lịch hẹn của tôi' }} />
    </Stack.Navigator>
  );
}


